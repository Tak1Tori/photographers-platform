"use server";

import { randomBytes } from "node:crypto";
import { NotificationType, TelegramConnectionStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/notifications/notification-service";
import { requireSession } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

const CODE_TTL_MS = 15 * 60 * 1000;

export async function createTelegramConnectionCodeAction() {
  const session = await requireSession();
  const now = new Date();

  await prisma.telegramConnection.updateMany({
    where: {
      userId: session.user.id,
      status: TelegramConnectionStatus.PENDING
    },
    data: {
      status: TelegramConnectionStatus.DISABLED,
      connectionCode: null,
      codeExpiresAt: null,
      disconnectedAt: now
    }
  });

  await prisma.telegramConnection.create({
    data: {
      userId: session.user.id,
      status: TelegramConnectionStatus.PENDING,
      connectionCode: await uniqueTelegramCode(),
      codeExpiresAt: new Date(Date.now() + CODE_TTL_MS)
    }
  });

  revalidateNotificationSettings();
}

export async function disconnectTelegramConnectionAction() {
  const session = await requireSession();

  await prisma.telegramConnection.updateMany({
    where: {
      userId: session.user.id,
      status: { in: [TelegramConnectionStatus.ACTIVE, TelegramConnectionStatus.PENDING] }
    },
    data: {
      status: TelegramConnectionStatus.DISABLED,
      telegramChatId: null,
      telegramUserId: null,
      telegramUsername: null,
      connectionCode: null,
      codeExpiresAt: null,
      disconnectedAt: new Date()
    }
  });

  revalidateNotificationSettings();
}

export async function sendTelegramTestNotificationAction() {
  const session = await requireSession();
  const linkUrl =
    session.user.role === UserRole.PHOTOGRAPHER
      ? "/dashboard/photographer/settings/notifications"
      : "/dashboard/settings/notifications";

  await createNotification({
    userId: session.user.id,
    type: NotificationType.ADMIN_NOTICE,
    title: "Тестовое Telegram-уведомление",
    message: "Telegram подключен. Это тестовое уведомление Framely.",
    linkUrl
  });

  revalidateNotificationSettings();
}

async function uniqueTelegramCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomBytes(3).toString("hex").toUpperCase();
    const existing = await prisma.telegramConnection.findUnique({
      where: { connectionCode: code }
    });
    if (!existing) return code;
  }

  return randomBytes(5).toString("hex").toUpperCase();
}

function revalidateNotificationSettings() {
  revalidatePath("/dashboard/settings/notifications");
  revalidatePath("/dashboard/photographer/settings/notifications");
}
