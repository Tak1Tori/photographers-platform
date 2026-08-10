import {
  BookingPaymentStatus,
  BookingStatus,
  BookingType,
  NotificationType,
  PlatformFeeStatus,
  Prisma,
  ProfileStatus,
  ProviderPaymentStatus,
  StudioConfirmationMode,
  StudioConfirmationRejectionReason,
  StudioConfirmationRequestStatus,
  UserRole
} from "@prisma/client";
import { addMinutes, dateKey, localDateTime, timeLabel } from "@/lib/calendar/time-utils";
import { assertNoCalendarConflict } from "@/lib/calendar/conflict-service";
import { cancelBookingHolds, createHoldsForBooking } from "@/lib/calendar/hold-service";
import { canUseDatabase } from "@/lib/data/db";
import { prisma } from "@/lib/prisma";
import { calculateBookingPricing } from "@/lib/pricing";
import { createPlatformFeePaymentForBooking } from "@/lib/payments/payment-service";
import { createNotifications } from "@/lib/notifications/notification-service";
import type { CreateStudioOnlyBookingInput } from "@/lib/types";
import {
  buildStudioConfirmationUrl,
  buildStudioWaitingUrl,
  buildStudioWhatsappMessage,
  buildStudioWhatsappMessageAfterPayment,
  buildWhatsappOpenUrl
} from "@/lib/studio-confirmations/whatsapp-message-builder";
import {
  createStudioConfirmationExpiration,
  createStudioConfirmationToken
} from "@/lib/studio-confirmations/studio-confirmation-token";

const studioConfirmationInclude = {
  studioProfile: { include: { owner: true } },
  studioHall: true,
  booking: true,
  client: true
};

type ConfirmationRequestWithRelations = Prisma.StudioConfirmationRequestGetPayload<{
  include: typeof studioConfirmationInclude;
}>;

export async function createStudioConfirmationRequest(input: CreateStudioOnlyBookingInput) {
  if (!canUseDatabase()) throw new Error("DATABASE_URL is not configured");

  const hall = await prisma.studioHall.findUnique({
    where: { id: input.studioHallId },
    include: { studio: { include: { owner: true } } }
  });

  if (!hall) throw new Error("Зал не найден.");
  if (input.studioId && hall.studioId !== input.studioId) {
    throw new Error("Выбранный зал не относится к этой студии.");
  }
  if (hall.studio.status !== ProfileStatus.PUBLISHED) {
    throw new Error("Эта студия пока недоступна для бронирования.");
  }
  if (hall.status !== "ACTIVE") {
    throw new Error("Этот зал сейчас недоступен для бронирования.");
  }
  if (
    hall.studio.confirmationMode !== StudioConfirmationMode.WHATSAPP_CONFIRMATION ||
    !hall.studio.whatsappConfirmationEnabled
  ) {
    throw new Error("Для этой студии не включено подтверждение через WhatsApp.");
  }
  if (!hall.studio.whatsappBookingPhone) {
    throw new Error("Студия еще не указала WhatsApp для подтверждений.");
  }
  if (input.peopleCount && input.peopleCount > hall.capacity) {
    throw new Error(`Вместимость зала: ${hall.capacity} человек.`);
  }

  const startTime = localDateTime(input.date, input.startTime);
  const endTime = addMinutes(startTime, input.durationHours * 60);

  await assertNoCalendarConflict(
    { type: "STUDIO_HALL", studioHallId: hall.id },
    startTime,
    endTime
  );

  const pricing = calculateBookingPricing({
    bookingType: BookingType.STUDIO_ONLY,
    photographerPrice: 0,
    studioPrice: hall.hourlyRate,
    durationHours: input.durationHours
  });
  const confirmationToken = createStudioConfirmationToken();
  const tokenExpiresAt = createStudioConfirmationExpiration(
    hall.studio.whatsappResponseTimeoutMinutes
  );

  const created = await prisma.studioConfirmationRequest.create({
    data: {
      studioProfileId: hall.studioId,
      studioHallId: hall.id,
      clientId: input.clientId,
      bookingType: BookingType.STUDIO_ONLY,
      confirmationToken,
      tokenExpiresAt,
      studioName: hall.studio.name,
      hallName: hall.name,
      startTime,
      endTime,
      durationMinutes: input.durationHours * 60,
      totalServicePrice: pricing.totalServicePrice,
      platformFeeAmount: pricing.platformFeeAmount,
      providerAmount: pricing.providerAmount,
      clientName: input.clientName,
      clientPhone: input.clientPhone,
      clientEmail: input.clientEmail,
      rentalPurpose: input.rentalPurpose,
      shootDescription: input.shootDescription,
      needsEquipment: input.needsEquipment,
      selectedAmenities: input.selectedAmenities ?? [],
      peopleCount: input.peopleCount,
      specialRequirements: input.specialRequirements || null
    },
    include: studioConfirmationInclude
  });

  const whatsappMessageText = buildStudioWhatsappMessage(created);
  const whatsappOpenUrl = buildWhatsappOpenUrl(
    created.studioProfile.whatsappBookingPhone,
    whatsappMessageText
  );
  const request = await prisma.studioConfirmationRequest.update({
    where: { id: created.id },
    data: {
      whatsappMessageText,
      whatsappOpenUrl,
      sentToWhatsappAt: whatsappOpenUrl ? new Date() : null
    },
    include: studioConfirmationInclude
  });

  await notifyStudioConfirmationRequest(request, "created");
  return request;
}

export async function expirePendingStudioConfirmationRequests() {
  if (!canUseDatabase()) return 0;

  const expired = await prisma.studioConfirmationRequest.findMany({
    where: {
      status: StudioConfirmationRequestStatus.PENDING_STUDIO_CONFIRMATION,
      tokenExpiresAt: { lte: new Date() }
    },
    include: studioConfirmationInclude
  });

  if (!expired.length) return 0;

  await prisma.studioConfirmationRequest.updateMany({
    where: { id: { in: expired.map((item) => item.id) } },
    data: { status: StudioConfirmationRequestStatus.EXPIRED }
  });

  await Promise.all(expired.map((request) => notifyStudioConfirmationRequest(request, "expired")));
  return expired.length;
}

export async function getStudioConfirmationRequestForClient(
  requestId: string,
  clientId: string,
  isAdmin = false
) {
  await expirePendingStudioConfirmationRequests();
  const request = await prisma.studioConfirmationRequest.findUnique({
    where: { id: requestId },
    include: studioConfirmationInclude
  });

  if (!request) return null;
  if (!isAdmin && request.clientId !== clientId) return null;
  return request;
}

export async function getStudioConfirmationRequestByToken(token: string) {
  await expirePendingStudioConfirmationRequests();
  const request = await prisma.studioConfirmationRequest.findUnique({
    where: { confirmationToken: token },
    include: studioConfirmationInclude
  });

  if (!request) return null;
  if (!request.openedAt) {
    return prisma.studioConfirmationRequest.update({
      where: { id: request.id },
      data: { openedAt: new Date() },
      include: studioConfirmationInclude
    });
  }

  return request;
}

export async function acceptStudioConfirmationRequestByToken(token: string) {
  const request = await getPendingTokenRequest(token);
  await assertNoCalendarConflict(
    { type: "STUDIO_HALL", studioHallId: request.studioHallId },
    request.startTime,
    request.endTime
  );

  const updated = await prisma.studioConfirmationRequest.update({
    where: { id: request.id },
    data: {
      status: StudioConfirmationRequestStatus.ACCEPTED_BY_STUDIO,
      acceptedAt: new Date()
    },
    include: studioConfirmationInclude
  });

  await notifyStudioConfirmationRequest(updated, "accepted");
  return updated;
}

export async function rejectStudioConfirmationRequestByToken(
  token: string,
  reason: StudioConfirmationRejectionReason,
  comment?: string
) {
  const request = await getPendingTokenRequest(token);
  const updated = await prisma.studioConfirmationRequest.update({
    where: { id: request.id },
    data: {
      status: StudioConfirmationRequestStatus.REJECTED_BY_STUDIO,
      rejectedAt: new Date(),
      rejectionReason: reason,
      rejectionComment: comment?.trim() || null
    },
    include: studioConfirmationInclude
  });

  await notifyStudioConfirmationRequest(updated, "rejected");
  return updated;
}

export async function acceptStudioConfirmationRequestFromDashboard(
  requestId: string,
  ownerId: string,
  isAdmin = false
) {
  const request = await getDashboardRequest(requestId, ownerId, isAdmin);
  if (request.status !== StudioConfirmationRequestStatus.PENDING_STUDIO_CONFIRMATION) {
    throw new Error("Эта заявка уже обработана.");
  }
  if (request.tokenExpiresAt <= new Date()) {
    await expirePendingStudioConfirmationRequests();
    throw new Error("Срок подтверждения истек.");
  }

  await assertNoCalendarConflict(
    { type: "STUDIO_HALL", studioHallId: request.studioHallId },
    request.startTime,
    request.endTime
  );

  const updated = await prisma.studioConfirmationRequest.update({
    where: { id: request.id },
    data: {
      status: StudioConfirmationRequestStatus.ACCEPTED_BY_STUDIO,
      acceptedAt: new Date()
    },
    include: studioConfirmationInclude
  });

  await notifyStudioConfirmationRequest(updated, "accepted");
  return updated;
}

export async function rejectStudioConfirmationRequestFromDashboard(
  requestId: string,
  ownerId: string,
  isAdmin: boolean,
  reason: StudioConfirmationRejectionReason,
  comment?: string
) {
  const request = await getDashboardRequest(requestId, ownerId, isAdmin);
  if (request.status !== StudioConfirmationRequestStatus.PENDING_STUDIO_CONFIRMATION) {
    throw new Error("Эта заявка уже обработана.");
  }

  const updated = await prisma.studioConfirmationRequest.update({
    where: { id: request.id },
    data: {
      status: StudioConfirmationRequestStatus.REJECTED_BY_STUDIO,
      rejectedAt: new Date(),
      rejectionReason: reason,
      rejectionComment: comment?.trim() || null
    },
    include: studioConfirmationInclude
  });

  await notifyStudioConfirmationRequest(updated, "rejected");
  return updated;
}

export async function convertAcceptedStudioConfirmationToBooking(
  requestId: string,
  clientId: string,
  isAdmin = false
) {
  const request = await prisma.studioConfirmationRequest.findUnique({
    where: { id: requestId },
    include: studioConfirmationInclude
  });

  if (!request) throw new Error("Заявка не найдена.");
  if (!isAdmin && request.clientId !== clientId) {
    throw new Error("Нет доступа к этой заявке.");
  }
  if (request.status === StudioConfirmationRequestStatus.CONVERTED_TO_BOOKING && request.bookingId) {
    if (!request.booking) throw new Error("Бронь по этой заявке не найдена.");
    const paymentSession = await createPlatformFeePaymentForBooking(request.bookingId);
    return { booking: request.booking, paymentSession };
  }
  if (request.status !== StudioConfirmationRequestStatus.ACCEPTED_BY_STUDIO) {
    throw new Error("Студия еще не подтвердила заявку.");
  }

  await assertNoCalendarConflict(
    { type: "STUDIO_HALL", studioHallId: request.studioHallId },
    request.startTime,
    request.endTime
  );

  const bookingNumber = `BK-ST-${Date.now().toString().slice(-7)}`;
  const booking = await prisma.booking.create({
    data: {
      bookingNumber,
      clientId: request.clientId,
      clientName: request.clientName ?? "Клиент",
      clientEmail: request.clientEmail ?? request.client?.email ?? "",
      clientPhone: request.clientPhone ?? "",
      clientComment: request.clientComment,
      bookingType: BookingType.STUDIO_ONLY,
      styleId: null,
      photographerId: null,
      studioId: request.studioProfileId,
      studioHallId: request.studioHallId,
      rentalPurpose: request.rentalPurpose,
      needsEquipment: request.needsEquipment,
      selectedAmenities: request.selectedAmenities ?? [],
      shootDescription: request.shootDescription,
      peopleCount: request.peopleCount,
      specialRequirements: request.specialRequirements,
      date: new Date(`${dateKey(request.startTime)}T00:00:00.000Z`),
      startTime: timeLabel(request.startTime),
      endTime: timeLabel(request.endTime),
      durationHours: Math.max(1, Math.round(request.durationMinutes / 60)),
      photographerPrice: 0,
      studioPrice: request.totalServicePrice,
      serviceFee: request.platformFeeAmount,
      totalPrice: request.totalServicePrice + request.platformFeeAmount,
      settlementMode: "PLATFORM_FEE_ONLY",
      totalServicePrice: request.totalServicePrice,
      platformFeeAmount: request.platformFeeAmount,
      providerAmount: request.providerAmount,
      platformFeeStatus: PlatformFeeStatus.UNPAID,
      providerPaymentStatus: ProviderPaymentStatus.EXTERNAL_PENDING,
      depositAmount: request.platformFeeAmount,
      paidAmount: 0,
      remainingAmount: request.providerAmount,
      platformCommission: request.platformFeeAmount,
      providerFee: 0,
      netPlatformRevenue: request.platformFeeAmount,
      paymentStatus: BookingPaymentStatus.UNPAID,
      status: BookingStatus.PENDING_PLATFORM_FEE
    }
  });

  await prisma.studioConfirmationRequest.update({
    where: { id: request.id },
    data: { bookingId: booking.id }
  });

  try {
    await createHoldsForBooking(booking.id);
    const paymentSession = await createPlatformFeePaymentForBooking(booking.id);
    return { booking, paymentSession };
  } catch (error) {
    await cancelBookingHolds(booking.id);
    await prisma.studioConfirmationRequest.update({
      where: { id: request.id },
      data: { bookingId: null }
    });
    await prisma.booking.delete({ where: { id: booking.id } }).catch(() => undefined);
    throw error;
  }
}

export async function listStudioConfirmationRequestsForOwner(ownerId: string, isAdmin = false) {
  await expirePendingStudioConfirmationRequests();
  return prisma.studioConfirmationRequest.findMany({
    where: isAdmin ? undefined : { studioProfile: { ownerId } },
    include: studioConfirmationInclude,
    orderBy: { createdAt: "desc" }
  });
}

export async function updateStudioConfirmationSettings(
  ownerId: string,
  isAdmin: boolean,
  input: {
    studioId?: string;
    confirmationMode: StudioConfirmationMode;
    whatsappBookingPhone?: string | null;
    whatsappContactName?: string | null;
    whatsappResponseTimeoutMinutes: number;
    whatsappConfirmationEnabled: boolean;
  }
) {
  const where = isAdmin && input.studioId
    ? { id: input.studioId }
    : { ownerId };

  const studio = await prisma.studioProfile.findFirst({ where });
  if (!studio) throw new Error("Профиль студии не найден.");

  return prisma.studioProfile.update({
    where: { id: studio.id },
    data: {
      confirmationMode: input.confirmationMode,
      whatsappBookingPhone: input.whatsappBookingPhone?.trim() || null,
      whatsappContactName: input.whatsappContactName?.trim() || null,
      whatsappResponseTimeoutMinutes: input.whatsappResponseTimeoutMinutes,
      whatsappConfirmationEnabled: input.whatsappConfirmationEnabled
    }
  });
}

export function buildRequestWhatsappAfterPaymentPayload(
  request: ConfirmationRequestWithRelations
) {
  const message = buildStudioWhatsappMessageAfterPayment(request);
  return {
    message,
    url: buildWhatsappOpenUrl(request.studioProfile.whatsappBookingPhone, message)
  };
}

async function getPendingTokenRequest(token: string) {
  const request = await getStudioConfirmationRequestByToken(token);
  if (!request) throw new Error("Заявка не найдена.");
  if (request.status !== StudioConfirmationRequestStatus.PENDING_STUDIO_CONFIRMATION) {
    throw new Error("Эта заявка уже обработана.");
  }
  if (request.tokenExpiresAt <= new Date()) {
    await expirePendingStudioConfirmationRequests();
    throw new Error("Срок подтверждения истек.");
  }
  return request;
}

async function getDashboardRequest(requestId: string, ownerId: string, isAdmin = false) {
  await expirePendingStudioConfirmationRequests();
  const request = await prisma.studioConfirmationRequest.findUnique({
    where: { id: requestId },
    include: studioConfirmationInclude
  });

  if (!request) throw new Error("Заявка не найдена.");
  if (!isAdmin && request.studioProfile.ownerId !== ownerId) {
    throw new Error("Нет доступа к этой заявке.");
  }
  return request;
}

async function notifyStudioConfirmationRequest(
  request: ConfirmationRequestWithRelations,
  event: "created" | "accepted" | "rejected" | "expired"
) {
  const admins = await prisma.user.findMany({
    where: { role: UserRole.ADMIN },
    select: { id: true }
  });
  const titleByEvent = {
    created: "Новая заявка на подтверждение студии",
    accepted: "Студия подтвердила заявку",
    rejected: "Студия отклонила заявку",
    expired: "Заявка студии истекла"
  };
  const messageByEvent = {
    created: `${request.studioName}: заявка на ${formatRequestDate(request)} ожидает подтверждения.`,
    accepted: `${request.studioName} подтвердила ${request.hallName}. Клиент может оплатить сервисный сбор.`,
    rejected: `${request.studioName} отклонила заявку на ${request.hallName}.`,
    expired: `Срок подтверждения заявки ${request.studioName} истек.`
  };
  const inputs = [
    request.studioProfile.ownerId
      ? {
          userId: request.studioProfile.ownerId,
          type: NotificationType.ADMIN_NOTICE,
          title: titleByEvent[event],
          message: messageByEvent[event],
          linkUrl: "/dashboard/studio/requests"
        }
      : null,
    request.clientId
      ? {
          userId: request.clientId,
          type: NotificationType.ADMIN_NOTICE,
          title: titleByEvent[event],
          message: messageByEvent[event],
          linkUrl: buildStudioWaitingUrl(request.id)
        }
      : null,
    ...admins.map((admin) => ({
      userId: admin.id,
      type: NotificationType.ADMIN_NOTICE,
      title: titleByEvent[event],
      message: messageByEvent[event],
      linkUrl: "/admin/studio-confirmations"
    }))
  ].filter(Boolean);

  await createNotifications(inputs as NonNullable<(typeof inputs)[number]>[]);
}

function formatRequestDate(request: Pick<ConfirmationRequestWithRelations, "startTime" | "endTime">) {
  return `${dateKey(request.startTime)} ${timeLabel(request.startTime)}-${timeLabel(request.endTime)}`;
}
