import { BookingStatus, NotificationType, UserRole } from "@prisma/client";
import { canUseDatabase } from "@/lib/data/db";
import { prisma } from "@/lib/prisma";
import { createInAppDeliveryLog, simulateMockEmail } from "@/lib/notifications/mock-delivery";
import type { CreateNotificationInput, NotificationDTO } from "@/lib/notifications/types";

const bookingNotificationInclude = {
  client: true,
  photographer: { include: { user: true } },
  studio: { include: { owner: true } },
  style: true
};

export async function createNotification(input: CreateNotificationInput) {
  if (!canUseDatabase()) return undefined;
  if (!isInternalLink(input.linkUrl)) {
    throw new Error("Notification linkUrl must be an internal URL");
  }

  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      linkUrl: input.linkUrl
    }
  });

  await Promise.all([
    createInAppDeliveryLog(notification),
    simulateMockEmail(notification)
  ]);

  return notification;
}

export async function createNotifications(inputs: CreateNotificationInput[]) {
  const uniqueInputs = dedupeByUserAndType(inputs);
  const created = [];

  for (const input of uniqueInputs) {
    const notification = await createNotification(input);
    if (notification) created.push(notification);
  }

  return created;
}

export async function markNotificationAsRead(notificationId: string, userId: string) {
  if (!canUseDatabase()) return undefined;

  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true }
  });
}

export async function markAllNotificationsAsRead(userId: string) {
  if (!canUseDatabase()) return undefined;

  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true }
  });
}

export async function getUserNotifications(userId: string): Promise<NotificationDTO[]> {
  if (!canUseDatabase()) return [];

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  return notifications.map(mapNotification);
}

export async function getUnreadNotificationsCount(userId: string) {
  if (!canUseDatabase()) return 0;

  return prisma.notification.count({
    where: { userId, isRead: false }
  });
}

export async function notifyBookingCreated(bookingId: string) {
  await safeNotify(async () => {
    const booking = await getBookingForNotification(bookingId);
    if (!booking) return;

    await createNotifications([
      ...participantNotifications(booking, {
        type: NotificationType.BOOKING_CREATED,
        title:
          booking.bookingType === "PHOTOGRAPHER_ONLY"
            ? "Новая заявка на съемку"
            : booking.bookingType === "STUDIO_ONLY"
              ? "Новая заявка на аренду студии"
              : "Новая бронь",
        message:
          booking.bookingType === "PHOTOGRAPHER_ONLY"
            ? `Создана заявка ${booking.bookingNumber} на съемку.`
            : booking.bookingType === "STUDIO_ONLY"
              ? `Создана заявка ${booking.bookingNumber} на аренду студии.`
            : `Создана бронь ${booking.bookingNumber} на ${booking.style?.name ?? "съемку"}.`,
        linkUrl: bookingLink(booking.bookingNumber)
      }),
      ...(await adminNotifications({
        type: NotificationType.BOOKING_CREATED,
        title: "Новая бронь",
        message: `Создана бронь ${booking.bookingNumber}.`,
        linkUrl: "/admin"
      }))
    ]);
  });
}

export async function notifyDepositPaid(bookingId: string) {
  await safeNotify(async () => {
    const booking = await getBookingForNotification(bookingId);
    if (!booking) return;

    await createNotifications([
      ...allBookingSideNotifications(booking, {
        type: NotificationType.DEPOSIT_PAID,
        title: "Депозит оплачен",
        message:
          booking.bookingType === "PHOTOGRAPHER_ONLY"
            ? `Клиент оплатил депозит за съемку ${booking.bookingNumber}.`
            : booking.bookingType === "STUDIO_ONLY"
              ? `Клиент оплатил депозит за аренду студии ${booking.bookingNumber}.`
            : `По брони ${booking.bookingNumber} оплачен депозит.`,
        linkUrl: bookingLink(booking.bookingNumber)
      }),
      ...(await adminNotifications({
        type: NotificationType.DEPOSIT_PAID,
        title: "Депозит оплачен",
        message: `По брони ${booking.bookingNumber} оплачен депозит.`,
        linkUrl: "/admin"
      }))
    ]);
  });
}

export async function notifyBookingStatusChanged(bookingId: string, newStatus: BookingStatus) {
  await safeNotify(async () => {
    const booking = await getBookingForNotification(bookingId);
    if (!booking) return;

    const config = bookingStatusConfig(booking.bookingNumber, newStatus);
    if (!config) return;

    const notifications: CreateNotificationInput[] = [];
    if (booking.clientId) notifications.push({ userId: booking.clientId, ...config });

    if (newStatus === BookingStatus.DECLINED || newStatus === BookingStatus.CANCELLED) {
      notifications.push(
        ...(await adminNotifications({
          ...config,
          linkUrl: "/admin"
        }))
      );
    }

    if (newStatus === BookingStatus.CANCELLED) {
      notifications.push(
        ...participantNotifications(booking, {
          ...config,
          linkUrl: "/admin"
        })
      );
    }

    await createNotifications(notifications);
  });
}

export async function notifyRescheduleRequested(bookingId: string) {
  await safeNotify(async () => {
    const booking = await getBookingForNotification(bookingId);
    if (!booking) return;

    await createNotifications([
      ...participantNotifications(booking, {
        type: NotificationType.RESCHEDULE_REQUESTED,
        title: "Запрос на перенос",
        message: `Клиент запросил перенос брони ${booking.bookingNumber}.`,
        linkUrl: "/dashboard/photographer"
      }),
      ...(await adminNotifications({
        type: NotificationType.RESCHEDULE_REQUESTED,
        title: "Запрос на перенос",
        message: `Клиент запросил перенос брони ${booking.bookingNumber}.`,
        linkUrl: "/admin"
      }))
    ]);
  });
}

export async function notifyReviewCreated(reviewId: string) {
  await safeNotify(async () => {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        booking: true,
        photographer: { include: { user: true } },
        studio: { include: { owner: true } }
      }
    });

    if (!review) return;

    await createNotifications([
      ...(review.photographer?.userId
        ? [{
            userId: review.photographer.userId,
            type: NotificationType.REVIEW_CREATED,
            title: "Новый отзыв",
            message: `Клиент оставил отзыв по брони ${review.booking.bookingNumber}.`,
            linkUrl: "/dashboard/photographer"
          }]
        : []),
      ...(review.studio?.ownerId
        ? [{
            userId: review.studio.ownerId,
            type: NotificationType.REVIEW_CREATED,
            title: "Новый отзыв",
            message: `Клиент оставил отзыв по брони ${review.booking.bookingNumber}.`,
            linkUrl: "/dashboard/studio"
          }]
        : []),
      ...(await adminNotifications({
        type: NotificationType.REVIEW_CREATED,
        title: "Новый отзыв",
        message: `Создан отзыв по брони ${review.booking.bookingNumber}.`,
        linkUrl: "/admin"
      }))
    ]);
  });
}

export async function notifyPaymentRefunded(bookingId: string) {
  await safeNotify(async () => {
    const booking = await getBookingForNotification(bookingId);
    if (!booking) return;

    await createNotifications([
      ...(booking.clientId
        ? [{
            userId: booking.clientId,
            type: NotificationType.PAYMENT_REFUNDED,
            title: "Возврат депозита",
            message: `По брони ${booking.bookingNumber} оформлен mock refund.`,
            linkUrl: bookingLink(booking.bookingNumber)
          }]
        : []),
      ...(await adminNotifications({
        type: NotificationType.PAYMENT_REFUNDED,
        title: "Возврат депозита",
        message: `По брони ${booking.bookingNumber} оформлен mock refund.`,
        linkUrl: "/admin"
      }))
    ]);
  });
}

async function getBookingForNotification(bookingId: string) {
  if (!canUseDatabase()) return undefined;

  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingNotificationInclude
  });
}

function allBookingSideNotifications(
  booking: NonNullable<Awaited<ReturnType<typeof getBookingForNotification>>>,
  input: Omit<CreateNotificationInput, "userId">
) {
  return [
    ...(booking.clientId ? [{ userId: booking.clientId, ...input }] : []),
    ...participantNotifications(booking, input)
  ];
}

function participantNotifications(
  booking: NonNullable<Awaited<ReturnType<typeof getBookingForNotification>>>,
  input: Omit<CreateNotificationInput, "userId">
) {
  return [
    ...(booking.photographer?.userId
      ? [{ userId: booking.photographer.userId, ...input, linkUrl: "/dashboard/photographer" }]
      : []),
    ...(booking.studio?.ownerId
      ? [{ userId: booking.studio.ownerId, ...input, linkUrl: "/dashboard/studio" }]
      : [])
  ];
}

async function adminNotifications(input: Omit<CreateNotificationInput, "userId">) {
  if (!canUseDatabase()) return [];

  const admins = await prisma.user.findMany({
    where: { role: UserRole.ADMIN },
    select: { id: true }
  });

  return admins.map((admin) => ({ userId: admin.id, ...input }));
}

function bookingStatusConfig(bookingNumber: string, status: BookingStatus) {
  const config: Partial<Record<BookingStatus, Omit<CreateNotificationInput, "userId">>> = {
    CONFIRMED: {
      type: NotificationType.BOOKING_CONFIRMED,
      title: "Бронь подтверждена",
      message: `Бронь ${bookingNumber} подтверждена.`,
      linkUrl: bookingLink(bookingNumber)
    },
    DECLINED: {
      type: NotificationType.BOOKING_DECLINED,
      title: "Бронь отклонена",
      message: `Бронь ${bookingNumber} отклонена.`,
      linkUrl: bookingLink(bookingNumber)
    },
    CANCELLED: {
      type: NotificationType.BOOKING_CANCELLED,
      title: "Бронь отменена",
      message: `Бронь ${bookingNumber} отменена.`,
      linkUrl: bookingLink(bookingNumber)
    },
    COMPLETED: {
      type: NotificationType.BOOKING_COMPLETED,
      title: "Съемка завершена",
      message: `Бронь ${bookingNumber} завершена. Можно оставить отзыв.`,
      linkUrl: bookingLink(bookingNumber)
    }
  };

  return config[status];
}

function bookingLink(bookingNumber: string) {
  return `/dashboard/client/bookings/${bookingNumber}`;
}

function isInternalLink(linkUrl?: string) {
  return !linkUrl || (linkUrl.startsWith("/") && !linkUrl.startsWith("//"));
}

function dedupeByUserAndType(inputs: CreateNotificationInput[]) {
  const seen = new Set<string>();
  return inputs.filter((input) => {
    const key = `${input.userId}:${input.type}:${input.title}:${input.linkUrl ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapNotification(notification: {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: Date;
}): NotificationDTO {
  return {
    id: notification.id,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    linkUrl: notification.linkUrl ?? undefined,
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString()
  };
}

async function safeNotify(callback: () => Promise<void>) {
  try {
    await callback();
  } catch (error) {
    console.error("Notification error", error);
  }
}
