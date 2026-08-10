import { NotificationChannel, NotificationDeliveryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type NotificationLike = {
  id: string;
  userId: string;
};

export async function createInAppDeliveryLog(notification: NotificationLike) {
  return prisma.notificationDeliveryLog.create({
    data: {
      notificationId: notification.id,
      userId: notification.userId,
      channel: NotificationChannel.IN_APP,
      status: NotificationDeliveryStatus.SENT,
      provider: "internal"
    }
  });
}

export async function simulateMockEmail(notification: NotificationLike) {
  return prisma.notificationDeliveryLog.create({
    data: {
      notificationId: notification.id,
      userId: notification.userId,
      channel: NotificationChannel.MOCK_EMAIL,
      status: NotificationDeliveryStatus.SENT,
      provider: "mock-email"
    }
  });
}

export async function simulateMockTelegram(notification: NotificationLike) {
  return prisma.notificationDeliveryLog.create({
    data: {
      notificationId: notification.id,
      userId: notification.userId,
      channel: NotificationChannel.MOCK_TELEGRAM,
      status: NotificationDeliveryStatus.SENT,
      provider: "mock-telegram"
    }
  });
}
