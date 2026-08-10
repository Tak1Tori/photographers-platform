// Deprecated: Telegram now works as notification-only. This legacy calendar
// assistant security helper is kept for historical data compatibility.
import type { NextRequest } from "next/server";
import { CalendarDraftStatus } from "@prisma/client";
import type {
  CalendarDraftWithMessage,
  ConnectedExternalChannel,
  TelegramUser
} from "@/lib/integrations/telegram/types";

export function verifyTelegramWebhookSecret(request: NextRequest) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return true;
  return request.headers.get("x-telegram-bot-api-secret-token") === expected;
}

export function validateCallbackPayload(data?: string) {
  if (!data) return null;
  const match = /^(confirm_draft|reject_draft|lead_create_link|lead_as_busy|lead_reject):([a-z0-9]+)$/i.exec(data);
  if (!match) return null;
  const action = match[1] as
    | "confirm_draft"
    | "reject_draft"
    | "lead_create_link"
    | "lead_as_busy"
    | "lead_reject";
  return action === "confirm_draft" || action === "reject_draft"
    ? { action, draftId: match[2] }
    : { action, leadId: match[2] };
}

export function ensureTelegramChannelOwnership(
  channel: ConnectedExternalChannel | null | undefined,
  telegramUser: TelegramUser
) {
  if (!channel?.isActive) {
    throw new Error("Telegram не подключен к аккаунту.");
  }
  if (channel.telegramUserId && channel.telegramUserId !== String(telegramUser.id)) {
    throw new Error("Этот Telegram пользователь не владеет подключенным каналом.");
  }
}

export function ensureDraftCanBeConfirmed(
  draft: CalendarDraftWithMessage | null,
  telegramUser: TelegramUser
) {
  if (!draft) throw new Error("Черновик не найден.");
  if (draft.status !== CalendarDraftStatus.PENDING) {
    throw new Error("Этот черновик уже обработан.");
  }
  if (draft.expiresAt && draft.expiresAt < new Date()) {
    throw new Error("Срок подтверждения черновика истек.");
  }
  ensureTelegramChannelOwnership(draft.externalMessage?.channel, telegramUser);
}
