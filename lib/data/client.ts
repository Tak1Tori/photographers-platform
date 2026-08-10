import {
  BookingPaymentStatus,
  BookingStatus,
  PaymentProvider,
  PaymentStatus,
  PaymentType,
  PlatformFeeStatus,
  ProviderPaymentStatus,
  UserRole
} from "@prisma/client";
import { canUseDatabase } from "@/lib/data/db";
import { getAllBookings, saveMockRuntimeBooking } from "@/lib/data/bookings";
import { prisma } from "@/lib/prisma";
import { cancelPlatformBookingEvent, createPlatformBookingEvent } from "@/lib/calendar/calendar-service";
import { cancelBookingHolds } from "@/lib/calendar/hold-service";
import { refundManualPayment } from "@/lib/payments/payment-service";
import type {
  Booking,
  ClientBookingDetails,
  ClientBookingFilter,
  ClientBookingListItem,
  ClientDashboardStats,
  CreateClientReviewInput
} from "@/lib/types";

type ClientAccess = {
  userId: string;
  role?: string;
};

const clientBookingInclude = {
  style: true,
  photographer: true,
  studio: true,
  studioHall: true,
  review: true
};

export async function getClientDashboardStats(
  userId: string,
  role?: string
): Promise<ClientDashboardStats> {
  const bookings = await getClientBookings(userId, { role });

  return {
    totalBookings: bookings.length,
    pendingBookings: bookings.filter((booking) => booking.status === "Pending").length,
    confirmedBookings: bookings.filter((booking) => booking.status === "Confirmed").length,
    completedBookings: bookings.filter((booking) => booking.status === "Completed").length,
    paidDepositTotal: bookings.reduce((sum, booking) => sum + booking.paidAmount, 0)
  };
}

export async function getClientBookings(
  userId: string,
  filters: { status?: ClientBookingFilter; role?: string } = {}
): Promise<ClientBookingListItem[]> {
  const bookings = await getAccessibleBookings({ userId, role: filters.role });
  const filtered =
    filters.status && filters.status !== "All"
      ? bookings.filter((booking) => booking.status === filters.status)
      : bookings;

  return filtered.sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)));
}

export async function getClientBookingByNumber(
  userId: string,
  bookingNumber: string,
  role?: string
): Promise<ClientBookingDetails | undefined> {
  if (!canUseDatabase()) {
    const booking = (await getAccessibleBookings({ userId, role })).find(
      (item) => item.id === bookingNumber
    );
    return booking
      ? {
          ...booking,
          endTime: calculateEndTime(booking.time, booking.durationHours),
          clientEmail: booking.clientEmail ?? "",
          clientPhone: booking.clientPhone ?? "",
          clientComment: booking.clientComment
        }
      : undefined;
  }

  const booking = await prisma.booking.findFirst({
    where: buildBookingAccessWhere({ userId, role }, bookingNumber),
    include: clientBookingInclude
  });

  return booking ? mapPrismaClientBookingDetails(booking) : undefined;
}

export type BookingCancellationOutcome = "not_applicable" | "non_refundable" | "refund_requested" | "refunded";

export async function cancelClientBooking(userId: string, bookingNumber: string, role?: string) {
  const booking = await getClientBookingByNumber(userId, bookingNumber, role);

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (!["Pending", "Confirmed"].includes(booking.status)) {
    throw new Error("This booking cannot be cancelled");
  }

  const canReceiveFullRefund =
    booking.platformFeeStatus === "PAID" && isMoreThan24HoursBeforeStart(booking.date, booking.time);

  if (!canUseDatabase()) {
    await saveMockRuntimeBooking({ ...booking, status: "Cancelled" });
    return {
      bookingId: booking.dbId ?? booking.id,
      refundOutcome: canReceiveFullRefund ? "refunded" : "not_applicable"
    } as const;
  }

  if (!booking.dbId) {
    throw new Error("У брони отсутствует внутренний идентификатор");
  }

  const paidPlatformFee = await prisma.payment.findFirst({
    where: {
      bookingId: booking.dbId,
      type: { in: [PaymentType.PLATFORM_FEE, PaymentType.DEPOSIT] },
      status: PaymentStatus.PAID
    },
    orderBy: { paidAt: "desc" },
    select: { id: true, provider: true }
  });
  const refundOutcome: BookingCancellationOutcome = !paidPlatformFee
    ? "not_applicable"
    : canReceiveFullRefund
      ? paidPlatformFee.provider === PaymentProvider.MOCK
        ? "refunded"
        : "refund_requested"
      : "non_refundable";

  const updated = await prisma.booking.update({
    where: { id: booking.dbId },
    data: {
      status: BookingStatus.CANCELLED_BY_CLIENT,
      cancelledAt: new Date(),
      cancelledById: userId,
      platformFeeStatus:
        refundOutcome === "refunded"
          ? PlatformFeeStatus.REFUNDED
          : refundOutcome === "refund_requested"
            ? PlatformFeeStatus.REFUND_REQUESTED
            : booking.platformFeeStatus === "PAID"
              ? PlatformFeeStatus.NON_REFUNDABLE
              : PlatformFeeStatus.UNPAID,
      providerPaymentStatus: ProviderPaymentStatus.EXTERNAL_CANCELLED
    }
  });

  if (refundOutcome === "refunded" && paidPlatformFee) {
    await refundManualPayment(
      paidPlatformFee.id,
      userId,
      "Отмена клиентом более чем за 24 часа до начала услуги"
    );
    await prisma.booking.update({
      where: { id: updated.id },
      data: { platformFeeStatus: PlatformFeeStatus.REFUNDED }
    });
  }
  await Promise.all([
    cancelPlatformBookingEvent(updated.id),
    cancelBookingHolds(updated.id)
  ]);
  return { bookingId: updated.id, refundOutcome } as const;
}

type RescheduleRequestInput = {
  date: string;
  startTime: string;
  comment?: string;
};

export async function requestBookingReschedule(
  userId: string,
  bookingNumber: string,
  input: RescheduleRequestInput,
  role?: string
) {
  const date = input.date.trim();
  const startTime = input.startTime.trim();
  const comment = input.comment?.trim() ?? "";

  if (!date) throw new Error("Date is required");
  if (!startTime) throw new Error("Time is required");

  const booking = await getClientBookingByNumber(userId, bookingNumber, role);

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (!["Pending", "Confirmed"].includes(booking.status)) {
    throw new Error("Перенос доступен только для ожидающих и подтвержденных броней");
  }

  if (booking.rescheduleRequestedAt) {
    throw new Error("Запрос на перенос уже отправлен");
  }

  const endTime = calculateEndTime(startTime, booking.durationHours);
  const rescheduleComment = [
    `Запрошен перенос на ${date} в ${startTime}`,
    comment ? `Комментарий: ${comment}` : null
  ]
    .filter(Boolean)
    .join("\n");

  if (!canUseDatabase()) {
    await saveMockRuntimeBooking({
      ...booking,
      date,
      time: startTime,
      status: "Pending",
      rescheduleRequestedAt: new Date().toISOString(),
      rescheduleComment
    });
    return booking.dbId ?? booking.id;
  }

  const bookingId = booking.dbId;
  if (!bookingId) {
    throw new Error("У брони отсутствует внутренний идентификатор");
  }

  const updated = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: {
        in: [
          BookingStatus.PENDING,
          BookingStatus.PENDING_PLATFORM_FEE,
          BookingStatus.CONFIRMED,
          BookingStatus.RESCHEDULED
        ]
      },
      rescheduleRequestedAt: null
    },
    data: {
      date: localDateTime(date, "12:00"),
      startTime,
      endTime,
      status: BookingStatus.RESCHEDULE_REQUESTED,
      rescheduleRequestedAt: new Date(),
      rescheduleComment
    }
  });

  if (updated.count !== 1) {
    throw new Error("Перенос недоступен: статус брони уже изменился");
  }

  await createPlatformBookingEvent(bookingId);
  return bookingId;
}

export async function createClientReview(
  userId: string,
  input: CreateClientReviewInput,
  role?: string
) {
  const booking = await getClientBookingByNumber(userId, input.bookingNumber, role);

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.status !== "Completed") {
    throw new Error("Review is available only after completed bookings");
  }

  if (!input.reviewPhotographer && !input.reviewStudio) {
    throw new Error("Choose photographer or studio for review");
  }

  const rating = Math.min(Math.max(input.rating, 1), 5);

  if (!canUseDatabase()) {
    throw new Error("Reviews require DATABASE_URL in this MVP");
  }

  const existing = await prisma.review.findUnique({ where: { bookingId: booking.dbId } });

  if (existing) {
    throw new Error("Review already exists for this booking");
  }

  const review = await prisma.review.create({
    data: {
      bookingId: booking.dbId!,
      photographerId: input.reviewPhotographer ? booking.photographerId : null,
      studioId: input.reviewStudio ? booking.studioId : null,
      rating,
      comment: input.comment?.trim() || null
    }
  });

  // TODO: Пересчитать средний рейтинг фотографа/студии после появления отдельной rating service.
  return review.id;
}

async function getAccessibleBookings(access: ClientAccess): Promise<ClientBookingListItem[]> {
  if (!canUseDatabase()) {
    const bookings = await getAllBookings();
    return bookings
      .filter((booking) => access.role === UserRole.ADMIN || booking.clientId === access.userId)
      .map(mapMockClientBooking);
  }

  const bookings = await prisma.booking.findMany({
    where: buildBookingAccessWhere(access),
    include: clientBookingInclude,
    orderBy: { createdAt: "desc" }
  });

  return bookings.map(mapPrismaClientBookingListItem);
}

function buildBookingAccessWhere(access: ClientAccess, bookingNumber?: string) {
  return {
    ...(bookingNumber ? { bookingNumber } : {}),
    ...(access.role === UserRole.ADMIN ? {} : { clientId: access.userId })
  };
}

type PrismaClientBooking = Awaited<
  ReturnType<typeof prisma.booking.findFirst<{ include: typeof clientBookingInclude }>>
>;

function mapPrismaClientBookingListItem(
  booking: NonNullable<PrismaClientBooking>
): ClientBookingListItem {
  return {
    id: booking.bookingNumber,
    dbId: booking.id,
    clientId: booking.clientId ?? undefined,
    clientName: booking.clientName,
    bookingType: booking.bookingType,
    photographerId: booking.photographerId ?? "",
    studioId: booking.studioId ?? "",
    styleId: booking.style?.slug ?? "",
    shootType: booking.shootType ?? undefined,
    shootDescription: booking.shootDescription ?? undefined,
    locationType: booking.locationType ?? undefined,
    city: booking.city ?? undefined,
    district: booking.district ?? undefined,
    addressDetails: booking.addressDetails ?? undefined,
    peopleCount: booking.peopleCount ?? undefined,
    equipmentNeeded: Array.isArray(booking.equipmentNeeded)
      ? (booking.equipmentNeeded as string[])
      : undefined,
    specialRequirements: booking.specialRequirements ?? undefined,
    rentalPurpose: booking.rentalPurpose ?? undefined,
    needsEquipment: booking.needsEquipment ?? undefined,
    selectedAmenities: Array.isArray(booking.selectedAmenities)
      ? (booking.selectedAmenities as string[])
      : undefined,
    hallName: booking.studioHall?.name ?? "Без зала",
    date: booking.date.toISOString().slice(0, 10),
    time: booking.startTime,
    durationHours: booking.durationHours,
    photographerTotal: booking.photographerPrice,
    studioTotal: booking.studioPrice,
    serviceFee: booking.serviceFee,
    totalAmount: booking.totalPrice,
    settlementMode: booking.settlementMode,
    totalServicePrice: booking.totalServicePrice || booking.totalPrice,
    platformFeeAmount: booking.platformFeeAmount || booking.depositAmount || booking.serviceFee,
    providerAmount:
      booking.providerAmount ||
      booking.remainingAmount ||
      Math.max((booking.totalServicePrice || booking.totalPrice) - (booking.platformFeeAmount || booking.depositAmount || booking.serviceFee), 0),
    platformFeeStatus: booking.platformFeeStatus,
    providerPaymentStatus: booking.providerPaymentStatus,
    platformFeePaidAt: booking.platformFeePaidAt?.toISOString(),
    depositAmount: booking.depositAmount,
    paidAmount: booking.paidAmount,
    remainingAmount: booking.remainingAmount,
    platformCommission: booking.platformCommission ?? undefined,
    providerFee: booking.providerFee ?? undefined,
    netPlatformRevenue: booking.netPlatformRevenue ?? undefined,
    paymentStatus: mapPaymentStatus(booking.paymentStatus),
    completedAt: booking.completedAt?.toISOString(),
    finalPaymentRequestedAt: booking.finalPaymentRequestedAt?.toISOString(),
    fullyPaidAt: booking.fullyPaidAt?.toISOString(),
    payoutStatus: booking.payoutStatus ?? undefined,
    payoutAmount: booking.payoutAmount ?? undefined,
    rescheduleRequestedAt: booking.rescheduleRequestedAt?.toISOString(),
    rescheduleComment: booking.rescheduleComment ?? undefined,
    status: mapBookingStatus(booking.status),
    styleName:
      booking.style?.name ??
      booking.shootType ??
      booking.rentalPurpose ??
      (booking.bookingType === "STUDIO_ONLY" ? "Бронирование студии" : "Бронирование фотографа"),
    photographerName: booking.photographer?.name ?? "Без фотографа",
    studioName: booking.studio?.name ?? "Без студии",
    studioAddress: booking.studio?.address ?? "-",
    createdAt: booking.createdAt.toISOString(),
    hasReview: Boolean(booking.review)
  };
}

function mapPrismaClientBookingDetails(
  booking: NonNullable<PrismaClientBooking>
): ClientBookingDetails {
  return {
    ...mapPrismaClientBookingListItem(booking),
    endTime: booking.endTime,
    clientEmail: booking.clientEmail,
    clientPhone: booking.clientPhone,
    clientComment: booking.clientComment ?? undefined,
    review: booking.review
      ? {
          id: booking.review.id,
          rating: booking.review.rating,
          comment: booking.review.comment ?? undefined,
          photographerId: booking.review.photographerId ?? undefined,
          studioId: booking.review.studioId ?? undefined
        }
      : undefined
  };
}

function mapMockClientBooking(booking: Booking): ClientBookingListItem {
  return {
    ...booking,
    styleName: booking.styleId,
    photographerName: booking.photographerId,
    studioName: booking.studioId,
    studioAddress: "Адрес студии из mock data",
    createdAt: booking.rescheduleRequestedAt ?? `${booking.date}T${booking.time}:00.000Z`,
    hasReview: false
  };
}

function mapBookingStatus(status: BookingStatus): Booking["status"] {
  const map: Partial<Record<BookingStatus, Booking["status"]>> = {
    PENDING: "Pending",
    PENDING_PLATFORM_FEE: "Pending",
    CONFIRMED: "Confirmed",
    RESCHEDULE_REQUESTED: "Pending",
    RESCHEDULED: "Confirmed",
    IN_PROGRESS: "In progress",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    CANCELLED_BY_CLIENT: "Cancelled",
    CANCELLED_BY_PROVIDER: "Cancelled",
    CANCELLED_BY_PLATFORM: "Cancelled",
    NO_SHOW_CLIENT: "Cancelled",
    NO_SHOW_PROVIDER: "Cancelled",
    DECLINED: "Declined"
  };
  return map[status] ?? "Pending";
}

function mapPaymentStatus(status: BookingPaymentStatus): Booking["paymentStatus"] {
  return status;
}

function calculateEndTime(startTime: string, durationHours: number) {
  const [hour = "0", minute = "0"] = startTime.split(":");
  const totalMinutes = Number(hour) * 60 + Number(minute) + durationHours * 60;
  const normalizedMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalizedMinutes / 60)).padStart(2, "0")}:${String(normalizedMinutes % 60).padStart(2, "0")}`;
}

function localDateTime(date: string, time = "00:00") {
  return new Date(`${date}T${time}:00+05:00`);
}

function isMoreThan24HoursBeforeStart(date: string, time: string) {
  return localDateTime(date, time).getTime() - Date.now() > 24 * 60 * 60 * 1000;
}
