import {
  BookingPaymentStatus,
  PaymentProvider,
  PaymentStatus,
  PaymentType
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MockPaymentProvider } from "@/lib/payments/mock-provider";

const mockProvider = new MockPaymentProvider();

export async function createDepositPaymentForBooking(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId }
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  const payment = await prisma.payment.create({
    data: {
      bookingId: booking.id,
      amount: booking.depositAmount,
      currency: "KZT",
      status: PaymentStatus.PENDING,
      provider: PaymentProvider.MOCK,
      type: PaymentType.DEPOSIT
    }
  });

  const session = await mockProvider.createPaymentSession({
    paymentId: payment.id,
    bookingNumber: booking.bookingNumber,
    amount: payment.amount,
    currency: payment.currency
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      providerPaymentId: session.providerPaymentId,
      metadata: { checkoutUrl: session.checkoutUrl }
    }
  });

  return session;
}

export async function markPaymentAsPaid(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { booking: true }
  });

  if (!payment) throw new Error("Payment not found");
  if (payment.status === PaymentStatus.PAID) return getPaymentById(payment.id);

  const confirmed = await mockProvider.confirmPayment({
    paymentId: payment.id,
    providerPaymentId: payment.providerPaymentId
  });

  const paidAmount = payment.amount;
  const remainingAmount = Math.max(payment.booking.totalPrice - paidAmount, 0);

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.PAID,
        providerPaymentId: confirmed.providerPaymentId
      }
    }),
    prisma.booking.update({
      where: { id: payment.bookingId },
      data: {
        paymentStatus:
          remainingAmount === 0 ? BookingPaymentStatus.PAID : BookingPaymentStatus.DEPOSIT_PAID,
        paidAmount,
        remainingAmount
      }
    })
  ]);

  return getPaymentById(payment.id);
}

export async function markPaymentAsFailed(paymentId: string) {
  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: { status: PaymentStatus.FAILED },
    include: { booking: true }
  });

  await prisma.booking.update({
    where: { id: payment.bookingId },
    data: { paymentStatus: BookingPaymentStatus.FAILED }
  });

  return payment;
}

export async function markPaymentAsCancelled(paymentId: string) {
  return prisma.payment.update({
    where: { id: paymentId },
    data: { status: PaymentStatus.CANCELLED }
  });
}

export async function refundMockPayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { booking: true }
  });

  if (!payment) throw new Error("Payment not found");
  if (payment.status !== PaymentStatus.PAID) throw new Error("Only paid payments can be refunded");

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.REFUNDED }
    }),
    prisma.payment.create({
      data: {
        bookingId: payment.bookingId,
        amount: payment.amount,
        currency: payment.currency,
        status: PaymentStatus.REFUNDED,
        provider: PaymentProvider.MOCK,
        type: PaymentType.REFUND,
        providerPaymentId: `refund_${payment.providerPaymentId ?? payment.id}`
      }
    }),
    prisma.booking.update({
      where: { id: payment.bookingId },
      data: {
        paymentStatus: BookingPaymentStatus.REFUNDED,
        paidAmount: 0,
        remainingAmount: payment.booking.totalPrice
      }
    })
  ]);

  return getPaymentById(payment.id);
}

export async function getPaymentById(paymentId: string) {
  return prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      booking: {
        include: {
          style: true,
          photographer: true,
          studio: true,
          studioHall: true
        }
      }
    }
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
    payments: booking.payments
  };
}
