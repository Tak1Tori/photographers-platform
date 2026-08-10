// Deprecated: Telegram now works as notification-only. This legacy calendar
// assistant client is kept for historical data compatibility.
import type { BookingLead, CalendarDraft } from "@prisma/client";
import { dateKey, timeLabel } from "@/lib/calendar/time-utils";

type InlineKeyboardButton = {
  text: string;
  callback_data: string;
};

type SendMessageOptions = {
  replyMarkup?: {
    inline_keyboard: InlineKeyboardButton[][];
  };
};

const telegramApiBase = "https://api.telegram.org";

export function isTelegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export function getTelegramBotUsername() {
  return process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "") ?? "";
}

export async function sendMessage(
  chatId: string,
  text: string,
  options: SendMessageOptions = {}
) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return { ok: false, disabled: true };
  }

  const response = await fetch(
    `${telegramApiBase}/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_markup: options.replyMarkup
      })
    }
  );

  return response.json().catch(() => ({ ok: response.ok }));
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return { ok: false, disabled: true };
  }

  const response = await fetch(
    `${telegramApiBase}/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text
      })
    }
  );

  return response.json().catch(() => ({ ok: response.ok }));
}

export function sendCalendarDraftConfirmation(chatId: string, draft: CalendarDraft) {
  const date = draft.parsedStartTime
    ? formatDate(draft.parsedStartTime)
    : "не распознана";
  const time =
    draft.parsedStartTime && draft.parsedEndTime
      ? `${timeLabel(draft.parsedStartTime)}-${timeLabel(draft.parsedEndTime)}`
      : "не распознано";
  const title = draft.title?.trim() || "Занято";

  return sendMessage(
    chatId,
    [
      "Я понял так:",
      `Дата: ${date}`,
      `Время: ${time}`,
      `Название: ${escapeHtml(title)}`,
      "",
      "Добавить занятость в календарь?"
    ].join("\n"),
    {
      replyMarkup: {
        inline_keyboard: [
          [
            { text: "Добавить", callback_data: `confirm_draft:${draft.id}` },
            { text: "Отмена", callback_data: `reject_draft:${draft.id}` }
          ]
        ]
      }
    }
  );
}

export function sendBookingLeadConfirmation(
  chatId: string,
  lead: BookingLead,
  publicUrl?: string
) {
  const date = lead.parsedStartTime ? formatDate(lead.parsedStartTime) : "не распознана";
  const time =
    lead.parsedStartTime && lead.parsedEndTime
      ? `${timeLabel(lead.parsedStartTime)}-${timeLabel(lead.parsedEndTime)}`
      : "не распознано";

  return sendMessage(
    chatId,
    [
      "Я понял заявку на бронь:",
      `Дата: ${date}`,
      `Время: ${time}`,
      `Клиент: ${escapeHtml(lead.clientName ?? "не указан")}`,
      `Описание: ${escapeHtml(lead.title ?? "Внешняя заявка")}`,
      publicUrl ? `Ссылка для клиента: ${escapeHtml(publicUrl)}` : "",
      "",
      publicUrl
        ? "Отправьте ссылку клиенту для контактов и сервисного сбора."
        : "Создать ссылку для клиента?"
    ].filter(Boolean).join("\n"),
    publicUrl
      ? {}
      : {
          replyMarkup: {
            inline_keyboard: [
              [
                { text: "Создать ссылку", callback_data: `lead_create_link:${lead.id}` },
                { text: "Как занятость", callback_data: `lead_as_busy:${lead.id}` }
              ],
              [{ text: "Отклонить", callback_data: `lead_reject:${lead.id}` }]
            ]
          }
        }
  );
}

export function sendHelpMessage(chatId: string) {
  return sendMessage(
    chatId,
    `Этот бот отправляет уведомления Framely.
Чтобы изменить заявку или календарь, откройте платформу.`
  );
}

export function sendConnectionSuccess(chatId: string) {
  return sendMessage(
    chatId,
    `Telegram подключен ✅

Теперь вы будете получать важные уведомления Framely здесь.
Все действия выполняются на платформе.`
  );
}

export function sendErrorMessage(chatId: string, message: string) {
  return sendMessage(chatId, message);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    day: "numeric",
    month: "long"
  }).format(dateKeyToLocalDate(dateKey(date)));
}

function dateKeyToLocalDate(value: string) {
  return new Date(`${value}T12:00:00+05:00`);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
