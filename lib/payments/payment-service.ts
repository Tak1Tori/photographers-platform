import {
  BookingPaymentStatus,
  BookingStatus,
  PaymentProvider,
  PaymentStatus,
  PaymentType,
  PlatformFeeStatus,
  PayoutStatus,
  ProviderPaymentStatus,
  Prisma,
  StudioConfirmationRequestStatus
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  calculateFinalPaymentAmount,
  calculateNetPlatformRevenue,
  calculateProviderFeeEstimate
} from "@/lib/pricing";
import {
  getConfiguredPaymentProvider,
  getPaymentProviderClient
} from "@/lib/payments/providers";
import {
  requireIntegerMoney,
  requireKzt
} from "@/lib/payments/payment-security";
import type {
  CreateCheckoutSessionResult,
  ProviderPaymentData
} from "@/lib/payments/types";
import {
  cancelBookingHolds,
  convertBookingHolds
} from "@/lib/calendar/hold-service";
import {
  cancelPlatformBookingEvent,
  createPlatformBookingEvent
} from "@/lib/calendar/calendar-service";
import {
  buildStudioWhatsappMessageAfterPayment,
  buildWhatsappOpenUrl
} from "@/lib/studio-confirmations/whatsapp-message-builder";

const paymentBookingInclude = {
  style: true,
  photographer: true,
  studio: true,
  studioHall: true
};

export async function createPlatformFeePaymentForBooking(
  bookingId: string,
  provider = getConfiguredPaymentProvider()
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payments: { orderBy: { createdAt: "desc" } } }
  });

  if (!booking) throw new Error("Booking not found");
  if (booking.clientId === null && booking.source !== "TELEGRAM_LEAD") {
    throw new Error("A signed-in client is required for hosted payment");
  }
  const platformFeeAmount = booking.platformFeeAmount || booking.depositAmount || booking.serviceFee;

  if (platformFeeAmount <= 0 || platformFeeAmount > booking.totalPrice) {
    throw new Error("Invalid booking platform fee amount");
  }

  const paidDeposit = booking.payments.find(
    (payment) =>
      (payment.type === PaymentType.PLATFORM_FEE || payment.type === PaymentType.DEPOSIT) &&
      payment.status === PaymentStatus.PAID
  );
  if (paidDeposit) throw new Error("Platform fee is already paid");

  const reusable = booking.payments.find(
    (payment) =>
      payment.type === PaymentType.PLATFORM_FEE &&
      payment.status === PaymentStatus.PENDING &&
      payment.provider === provider
  );
  if (reusable?.providerCheckoutUrl) {
    return mapExistingCheckout(reusable);
  }

  const payment =
    reusable ??
    (await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          bookingId: booking.id,
          amount: platformFeeAmount,
          currency: "KZT",
          status: PaymentStatus.PENDING,
          provider,
          type: PaymentType.PLATFORM_FEE
        }
      });
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          paymentStatus: BookingPaymentStatus.DEPOSIT_PENDING,
          platformFeeStatus: PlatformFeeStatus.UNPAID,
          status: BookingStatus.PENDING_PLATFORM_FEE
        }
      });
      await createAuditLog(tx, {
        bookingId: booking.id,
        paymentId: created.id,
        action: "PLATFORM_FEE_PAYMENT_CREATED",
        metadata: { provider, amount: created.amount }
      });
      return created;
    }));

  try {
    return await initializeCheckout(payment.id);
  } catch (error) {
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED, failedAt: new Date() }
      });
      await tx.booking.update({
        where: { id: booking.id },
        data: { paymentStatus: BookingPaymentStatus.FAILED }
      });
      await createAuditLog(tx, {
        bookingId: booking.id,
        paymentId: payment.id,
        action: "CHECKOUT_SESSION_CREATION_FAILED",
        metadata: {
          message: error instanceof Error ? error.message : "Unknown provider error"
        }
      });
    });
    throw error;
  }
}

export const createDepositPaymentForBooking = createPlatformFeePaymentForBooking;

export async function createFinalPaymentForBooking(
  bookingId: string,
  options: { actorId?: string; provider?: PaymentProvider } = {}
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payments: { orderBy: { createdAt: "desc" } } }
  });

  if (!booking) throw new Error("Booking not found");
  if (
    booking.status !== BookingStatus.CONFIRMED &&
    booking.status !== BookingStatus.IN_PROGRESS
  ) {
    throw new Error("Final payment can be requested only for an active confirmed booking");
  }
  if (booking.paymentStatus !== BookingPaymentStatus.DEPOSIT_PAID) {
    throw new Error("Final payment requires a paid deposit");
  }

  const amount = calculateFinalPaymentAmount(booking);
  if (amount <= 0 || amount !== booking.remainingAmount) {
    throw new Error("Final payment amount must equal booking remaining amount");
  }

  const existing = booking.payments.find(
    (payment) =>
      payment.type === PaymentType.FINAL_PAYMENT &&
      payment.status === PaymentStatus.PENDING
  );
  if (existing?.providerCheckoutUrl) return mapExistingCheckout(existing);

  const depositProvider = booking.payments.find(
    (payment) =>
      payment.type === PaymentType.DEPOSIT &&
      payment.status === PaymentStatus.PAID
  )?.provider;
  const provider = options.provider ?? depositProvider ?? getConfiguredPaymentProvider();

  const payment =
    existing ??
    (await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          bookingId: booking.id,
          amount,
          currency: "KZT",
          status: PaymentStatus.PENDING,
          provider,
          type: PaymentType.FINAL_PAYMENT
        }
      });
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          paymentStatus: BookingPaymentStatus.FINAL_PAYMENT_PENDING,
          finalPaymentRequestedAt: new Date(),
          completedAt: booking.completedAt ?? new Date()
        }
      });
      await createAuditLog(tx, {
        bookingId: booking.id,
        paymentId: created.id,
        actorId: options.actorId,
        action: "FINAL_PAYMENT_REQUESTED",
        metadata: { provider, amount }
      });
      return created;
    }));

  try {
    return await initializeCheckout(payment.id);
  } catch (error) {
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: { paymentStatus: BookingPaymentStatus.DEPOSIT_PAID }
      });
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED, failedAt: new Date() }
      });
    });
    throw error;
  }
}

export async function markPaymentAsPaid(
  paymentId: string,
  providerData: ProviderPaymentData = {}
) {
  return prisma.$transaction(
    async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { booking: true }
      });

      if (!payment) throw new Error("Payment not found");
      if (payment.status === PaymentStatus.PAID) {
        return tx.payment.findUnique({
          where: { id: payment.id },
          include: { booking: { include: paymentBookingInclude } }
        });
      }
      if (payment.status !== PaymentStatus.PENDING) {
        throw new Error(`Payment cannot be paid from status ${payment.status}`);
      }

      requireIntegerMoney(payment.amount, "payment.amount");
      requireKzt(payment.currency);

      const fee =
        providerData.providerFee ?? calculateProviderFeeEstimate(payment.amount);
      requireIntegerMoney(fee, "providerFee");
      const totalProviderFee = (payment.booking.providerFee ?? 0) + fee;
      const platformCommission = payment.booking.platformCommission ?? payment.booking.serviceFee;

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PAID,
          paidAt: new Date(),
          providerPaymentId:
            providerData.providerPaymentId ?? payment.providerPaymentId,
          metadata: mergeMetadata(payment.metadata, providerData)
        }
      });

      if (payment.type === PaymentType.PLATFORM_FEE || payment.type === PaymentType.DEPOSIT) {
        const confirmationRequest = await tx.studioConfirmationRequest.findUnique({
          where: { bookingId: payment.bookingId },
          include: {
            studioProfile: { include: { owner: true } },
            studioHall: true,
            booking: true,
            client: true
          }
        });
        const platformFeeAmount =
          payment.booking.platformFeeAmount || payment.booking.depositAmount || payment.booking.serviceFee;
        const providerAmount =
          payment.booking.providerAmount ||
          Math.max(payment.booking.totalPrice - platformFeeAmount, 0);

        if (payment.amount !== platformFeeAmount) {
          throw new Error("Platform fee payment amount does not match booking");
        }
        await tx.booking.update({
          where: { id: payment.bookingId },
          data: {
            paymentStatus: BookingPaymentStatus.DEPOSIT_PAID,
            platformFeeStatus: PlatformFeeStatus.PAID,
            platformFeePaidAt: new Date(),
            providerPaymentStatus: ProviderPaymentStatus.EXTERNAL_PENDING,
            status: confirmationRequest ? BookingStatus.CONFIRMED : BookingStatus.PENDING,
            paidAmount: payment.amount,
            remainingAmount: providerAmount,
            providerFee: totalProviderFee,
            netPlatformRevenue: calculateNetPlatformRevenue({
              platformCommission,
              providerFee: totalProviderFee
            })
          }
        });
        const totalHolds = await tx.availabilityHold.count({
          where: { bookingId: payment.bookingId }
        });
        const converted = await convertBookingHolds(payment.bookingId, tx);
        const expectedHolds =
          payment.booking.bookingType === "FULL_SHOOT" ? 2 : 1;
        if (totalHolds > 0 && converted.count !== expectedHolds) {
          throw new Error(
            "Время больше не удерживается. Вернитесь к бронированию и выберите новый слот."
          );
        }
        await createPlatformBookingEvent(payment.bookingId, tx);
        if (confirmationRequest) {
          const message = buildStudioWhatsappMessageAfterPayment(confirmationRequest);
          const url = buildWhatsappOpenUrl(confirmationRequest.studioProfile.whatsappBookingPhone, message);
          await tx.studioConfirmationRequest.update({
            where: { id: confirmationRequest.id },
            data: {
              status: StudioConfirmationRequestStatus.CONVERTED_TO_BOOKING,
              whatsappMessageTextAfterPayment: message,
              whatsappOpenUrlAfterPayment: url
            }
          });
        }
      } else if (payment.type === PaymentType.FINAL_PAYMENT) {
        if (payment.amount !== payment.booking.remainingAmount) {
          throw new Error("Final payment amount does not match booking remainder");
        }
        await tx.booking.update({
          where: { id: payment.bookingId },
          data: {
            paymentStatus: BookingPaymentStatus.FULLY_PAID,
            paidAmount: payment.booking.totalPrice,
            remainingAmount: 0,
            fullyPaidAt: new Date(),
            completedAt: payment.booking.completedAt ?? new Date(),
            status: BookingStatus.COMPLETED,
            payoutStatus: PayoutStatus.PAYOUT_PENDING,
            payoutAmount:
              payment.booking.photographerPrice + payment.booking.studioPrice,
            providerFee: totalProviderFee,
            netPlatformRevenue: calculateNetPlatformRevenue({
              platformCommission,
              providerFee: totalProviderFee
            })
          }
        });
        await cancelPlatformBookingEvent(payment.bookingId, tx);
      } else {
        throw new Error("Refund records cannot be marked as paid");
      }

      await createAuditLog(tx, {
        bookingId: payment.bookingId,
        paymentId: payment.id,
        actorId: providerData.actorId,
        action: `${payment.type}_PAID`,
        metadata: providerData
      });

      return tx.payment.findUnique({
        where: { id: payment.id },
        include: { booking: { include: paymentBookingInclude } }
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function markPaymentAsFailed(
  paymentId: string,
  providerData: ProviderPaymentData = {}
) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true }
    });
    if (!payment) throw new Error("Payment not found");
    if (payment.status === PaymentStatus.PAID) {
      throw new Error("Paid payment cannot be marked as failed");
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        failedAt: new Date(),
        metadata: mergeMetadata(payment.metadata, providerData)
      }
    });
    await tx.booking.update({
      where: { id: payment.bookingId },
      data: {
        paymentStatus:
          payment.type === PaymentType.FINAL_PAYMENT
            ? BookingPaymentStatus.DEPOSIT_PAID
            : BookingPaymentStatus.FAILED
      }
    });
      if (payment.type === PaymentType.DEPOSIT || payment.type === PaymentType.PLATFORM_FEE) {
        await cancelBookingHolds(payment.bookingId, tx);
      }
    await createAuditLog(tx, {
      bookingId: payment.bookingId,
      paymentId: payment.id,
      actorId: providerData.actorId,
      action: `${payment.type}_FAILED`,
      metadata: providerData
    });
    return tx.payment.findUnique({
      where: { id: payment.id },
      include: { booking: true }
    });
  });
}

export async function cancelPayment(
  paymentId: string,
  options: { actorId?: string; reason?: string } = {}
) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true }
    });
    if (!payment) throw new Error("Payment not found");
    if (payment.status === PaymentStatus.PAID) {
      throw new Error("Paid payment cannot be cancelled");
    }

    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.CANCELLED,
        cancelledAt: new Date()
      }
    });
    await tx.booking.update({
      where: { id: payment.bookingId },
      data: {
        paymentStatus:
          payment.type === PaymentType.FINAL_PAYMENT
            ? BookingPaymentStatus.DEPOSIT_PAID
            : BookingPaymentStatus.UNPAID
      }
    });
    if (payment.type === PaymentType.DEPOSIT || payment.type === PaymentType.PLATFORM_FEE) {
      await cancelBookingHolds(payment.bookingId, tx);
    }
    await createAuditLog(tx, {
      bookingId: payment.bookingId,
      paymentId: payment.id,
      actorId: options.actorId,
      action: "PAYMENT_CANCELLED",
      metadata: { reason: options.reason }
    });
    return updated;
  });
}

export async function getPaymentById(paymentId: string) {
  return prisma.payment.findUnique({
    where: { id: paymentId },
    include: { booking: { include: paymentBookingInclude } }
  });
}

export async function getPaymentByProviderPaymentId(providerPaymentId: string) {
  return prisma.payment.findUnique({
    where: { providerPaymentId },
    include: { booking: true }
  });
}

export async function getBookingPaymentSummary(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payments: { orderBy: { createdAt: "desc" } } }
  });
  if (!booking) return undefined;
  return {
    bookingId: booking.id,
    bookingNumber: booking.bookingNumber,
    paymentStatus: booking.paymentStatus,
    depositAmount: booking.depositAmount,
    paidAmount: booking.paidAmount,
    remainingAmount: booking.remainingAmount,
    totalPrice: booking.totalPrice,
    platformCommission: booking.platformCommission,
    providerFee: booking.providerFee,
    netPlatformRevenue: booking.netPlatformRevenue,
    settlementMode: booking.settlementMode,
    totalServicePrice: booking.totalServicePrice,
    platformFeeAmount: booking.platformFeeAmount,
    providerAmount: booking.providerAmount,
    platformFeeStatus: booking.platformFeeStatus,
    providerPaymentStatus: booking.providerPaymentStatus,
    payments: booking.payments
  };
}

export async function getPendingFinalPaymentCheckout(bookingId: string) {
  const payment = await prisma.payment.findFirst({
    where: {
      bookingId,
      type: PaymentType.FINAL_PAYMENT,
      status: PaymentStatus.PENDING
    },
    orderBy: { createdAt: "desc" }
  });
  if (!payment?.providerCheckoutUrl) {
    throw new Error("Final payment checkout is not available");
  }
  return {
    paymentId: payment.id,
    checkoutUrl: payment.providerCheckoutUrl
  };
}

export async function refundManualPayment(
  paymentId: string,
  actorId: string,
  reason?: string
) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { booking: true }
  });
  if (!payment) throw new Error("Payment not found");
  if (payment.status !== PaymentStatus.PAID) {
    throw new Error("Only paid payments can be refunded");
  }

  return prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.REFUNDED }
    });
    const refund = await tx.payment.create({
      data: {
        bookingId: payment.bookingId,
        amount: payment.amount,
        currency: payment.currency,
        status: PaymentStatus.REFUNDED,
        provider: PaymentProvider.MANUAL,
        type: PaymentType.REFUND,
        metadata: { originalPaymentId: payment.id, reason }
      }
    });
    await tx.booking.update({
      where: { id: payment.bookingId },
      data: {
        paymentStatus: BookingPaymentStatus.REFUNDED,
        paidAmount: Math.max(payment.booking.paidAmount - payment.amount, 0),
        remainingAmount: Math.min(
          payment.booking.remainingAmount + payment.amount,
          payment.booking.totalPrice
        )
      }
    });
    await cancelBookingHolds(payment.bookingId, tx);
    await cancelPlatformBookingEvent(payment.bookingId, tx);
    await createAuditLog(tx, {
      bookingId: payment.bookingId,
      paymentId: refund.id,
      actorId,
      action: "MANUAL_REFUND_RECORDED",
      metadata: { originalPaymentId: payment.id, reason, amount: payment.amount }
    });
    return refund;
  });
}

async function initializeCheckout(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { booking: true }
  });
  if (!payment) throw new Error("Payment not found");
  if (payment.status !== PaymentStatus.PENDING) {
    throw new Error("Only pending payments can create checkout sessions");
  }

  const provider = getPaymentProviderClient(payment.provider);
  const appUrl = getAppUrl();
  const session = await provider.createCheckoutSession({
    paymentId: payment.id,
    bookingId: payment.bookingId,
    bookingNumber: payment.booking.bookingNumber,
    amount: payment.amount,
    currency: payment.currency,
    type: payment.type,
    description:
      payment.type === PaymentType.PLATFORM_FEE || payment.type === PaymentType.DEPOSIT
        ? `Сервисный сбор по брони ${payment.booking.bookingNumber}`
        : `Платеж по брони ${payment.booking.bookingNumber}`,
    successUrl: `${appUrl}/booking/success?bookingNumber=${encodeURIComponent(
      payment.booking.bookingNumber
    )}`,
    cancelUrl: `${appUrl}/dashboard/client/bookings/${encodeURIComponent(
      payment.booking.bookingNumber
    )}`,
    customer: {
      id: payment.booking.clientId ?? undefined,
      name: payment.booking.clientName,
      email: payment.booking.clientEmail,
      phone: payment.booking.clientPhone
    }
  });

  if (session.amount !== payment.amount || session.currency !== payment.currency) {
    throw new Error("Provider checkout session amount mismatch");
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      providerPaymentId: session.providerPaymentId,
      providerCheckoutUrl: session.checkoutUrl,
      metadata: mergeMetadata(payment.metadata, {
        checkoutCreatedAt: new Date().toISOString()
      })
    }
  });

  return { paymentId: payment.id, ...session };
}

function mapExistingCheckout(payment: {
  id: string;
  providerCheckoutUrl: string | null;
  providerPaymentId: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
}): CreateCheckoutSessionResult & { paymentId: string } {
  if (!payment.providerCheckoutUrl || !payment.providerPaymentId) {
    throw new Error("Pending payment has no checkout session");
  }
  return {
    paymentId: payment.id,
    checkoutUrl: payment.providerCheckoutUrl,
    providerPaymentId: payment.providerPaymentId,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status
  };
}

function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function mergeMetadata(
  current: Prisma.JsonValue | null,
  next: object
): Prisma.InputJsonValue {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, Prisma.JsonValue>)
      : {};
  return toJsonValue({ ...base, ...next });
}

function createAuditLog(
  tx: Prisma.TransactionClient,
  input: {
    bookingId: string;
    paymentId?: string;
    actorId?: string;
    action: string;
    metadata?: unknown;
  }
) {
  return tx.paymentAuditLog.create({
    data: {
      bookingId: input.bookingId,
      paymentId: input.paymentId,
      actorId: input.actorId,
      action: input.action,
      metadata:
        input.metadata === undefined ? undefined : toJsonValue(input.metadata)
    }
  });
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
