import {
  NotificationChannel,
  NotificationDeliveryStatus,
  TelegramConnectionStatus,
  type Notification
} from "@prisma/client";
import { canUseDatabase } from "@/lib/data/db";
import { prisma } from "@/lib/prisma";

type TelegramButton = {
  text: string;
  url: string;
};

type TelegramSendResult =
  | { ok: true; providerMessageId?: string }
  | {
      ok: false;
      status: typeof NotificationDeliveryStatus.FAILED | typeof NotificationDeliveryStatus.SKIPPED;
      errorMessage: string;
    };

type TelegramApiResponse = {
  ok: boolean;
  description?: string;
  result?: {
    message_id?: number;
  };
};

export function buildTelegramNotificationMessage(
  notification: Pick<Notification, "title" | "message">
) {
  return `<b>${escapeHtml(notification.title)}</b>\n${escapeHtml(notification.message)}`;
}

export async function sendTelegramMessage(
  chatId: string,
  text: string,
  buttons: TelegramButton[] = []
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    return {
      ok: false,
      status: NotificationDeliveryStatus.SKIPPED,
      errorMessage: "TELEGRAM_BOT_TOKEN is not configured"
    };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...(buttons.length
          ? {
              reply_markup: {
                inline_keyboard: [
                  buttons.map((button) => ({
                    text: button.text,
                    url: button.url
                  }))
                ]
              }
            }
          : {})
      })
    });
    const payload = (await response.json().catch(() => null)) as TelegramApiResponse | null;

    if (!response.ok || !payload?.ok) {
      return {
        ok: false,
        status: NotificationDeliveryStatus.FAILED,
        errorMessage: payload?.description ?? `Telegram API request failed with ${response.status}`
      };
    }

    return {
      ok: true,
      providerMessageId: payload.result?.message_id ? String(payload.result.message_id) : undefined
    };
  } catch (error) {
    return {
      ok: false,
      status: NotificationDeliveryStatus.FAILED,
      errorMessage: error instanceof Error ? error.message : "Telegram API request failed"
    };
  }
}

export async function sendNotificationToTelegram(notificationId: string) {
  if (!canUseDatabase()) return undefined;

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId }
  });

  if (!notification) return undefined;

  const deliveryLog = await prisma.notificationDeliveryLog.create({
    data: {
      notificationId: notification.id,
      userId: notification.userId,
      channel: NotificationChannel.TELEGRAM,
      status: NotificationDeliveryStatus.PENDING,
      provider: "telegram"
    }
  });

  const connection = await prisma.telegramConnection.findFirst({
    where: {
      userId: notification.userId,
      status: TelegramConnectionStatus.ACTIVE,
      telegramChatId: { not: null }
    },
    orderBy: { connectedAt: "desc" }
  });

  if (!connection?.telegramChatId) {
    return prisma.notificationDeliveryLog.update({
      where: { id: deliveryLog.id },
      data: {
        status: NotificationDeliveryStatus.SKIPPED,
        errorMessage: "Telegram is not connected"
      }
    });
  }

  const result = await sendTelegramMessage(
    connection.telegramChatId,
    buildTelegramNotificationMessage(notification),
    [{ text: "Открыть платформу", url: absolutePlatformUrl(notification.linkUrl ?? "/dashboard") }]
  );

  if (!result.ok) {
    return prisma.notificationDeliveryLog.update({
      where: { id: deliveryLog.id },
      data: {
        status: result.status,
        errorMessage: result.errorMessage
      }
    });
  }

  await prisma.telegramConnection.update({
    where: { id: connection.id },
    data: { lastMessageAt: new Date() }
  });

  return prisma.notificationDeliveryLog.update({
    where: { id: deliveryLog.id },
    data: {
      status: NotificationDeliveryStatus.SENT,
      providerMessageId: result.providerMessageId,
      sentAt: new Date()
    }
  });
}

function absolutePlatformUrl(path: string) {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return new URL(path, base).toString();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
