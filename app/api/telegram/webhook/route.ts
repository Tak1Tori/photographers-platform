import { NextRequest, NextResponse } from "next/server";
import { TelegramConnectionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram/telegram-notification-service";

type TelegramWebhookPayload = {
  message?: {
    text?: string;
    chat?: {
      id?: number | string;
    };
    from?: {
      id?: number | string;
      username?: string;
    };
  };
};

const connectedText = `Telegram подключен ✅

Теперь вы будете получать важные уведомления Framely здесь.
Все действия выполняются на платформе.`;

const botInfoText = `Этот бот отправляет уведомления Framely.
Чтобы изменить заявку или календарь, откройте платформу.`;

export async function GET() {
  return NextResponse.json({
    ok: true,
    mode: "notifications",
    configured: Boolean(process.env.TELEGRAM_BOT_TOKEN)
  });
}

export async function POST(request: NextRequest) {
  if (!verifyTelegramWebhookSecret(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as TelegramWebhookPayload;
    const message = payload.message;
    const text = message?.text?.trim();
    const chatId = message?.chat?.id ? String(message.chat.id) : null;
    const telegramUserId = message?.from?.id ? String(message.from.id) : null;
    const telegramUsername = message?.from?.username ?? null;

    if (!chatId || !text) {
      return NextResponse.json({ ok: true });
    }

    const startMatch = text.match(/^\/start(?:@\w+)?(?:\s+(.+))?$/i);

    if (startMatch) {
      const code = startMatch[1]?.trim();
      if (!code) {
        await sendTelegramMessage(chatId, "Создайте код подключения в настройках Framely и отправьте /start CODE.");
        return NextResponse.json({ ok: true });
      }

      const connection = await prisma.telegramConnection.findFirst({
        where: {
          connectionCode: code,
          status: TelegramConnectionStatus.PENDING,
          codeExpiresAt: { gt: new Date() }
        }
      });

      if (!connection) {
        await sendTelegramMessage(chatId, "Код подключения не найден или истек. Создайте новый код в настройках Framely.");
        return NextResponse.json({ ok: true });
      }

      const now = new Date();
      await prisma.$transaction([
        prisma.telegramConnection.updateMany({
          where: {
            telegramChatId: chatId,
            id: { not: connection.id }
          },
          data: {
            status: TelegramConnectionStatus.DISABLED,
            telegramChatId: null,
            telegramUserId: null,
            telegramUsername: null,
            connectionCode: null,
            codeExpiresAt: null,
            disconnectedAt: now
          }
        }),
        prisma.telegramConnection.update({
          where: { id: connection.id },
          data: {
            status: TelegramConnectionStatus.ACTIVE,
            telegramChatId: chatId,
            telegramUserId,
            telegramUsername,
            connectionCode: null,
            codeExpiresAt: null,
            connectedAt: now,
            disconnectedAt: null,
            lastMessageAt: now
          }
        })
      ]);

      await sendTelegramMessage(chatId, connectedText);
      return NextResponse.json({ ok: true });
    }

    await prisma.telegramConnection.updateMany({
      where: {
        telegramChatId: chatId,
        status: TelegramConnectionStatus.ACTIVE
      },
      data: { lastMessageAt: new Date() }
    });
    await sendTelegramMessage(chatId, botInfoText);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

function verifyTelegramWebhookSecret(request: NextRequest) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return true;
  return request.headers.get("x-telegram-bot-api-secret-token") === expected;
}
