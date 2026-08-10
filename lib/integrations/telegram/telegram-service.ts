// Deprecated: Telegram now works as notification-only. This legacy calendar
// assistant service is kept for historical data compatibility.
import {
  ExternalChannelOwnerType,
  ExternalMessageStatus,
  ExternalProvider,
  type ExternalMessage
} from "@prisma/client";
import { getAvailableSlots } from "@/lib/calendar/availability-service";
import { getCalendarEventsForDashboard } from "@/lib/calendar/calendar-service";
import { dateKey, dayRange, localDateTime, timeLabel } from "@/lib/calendar/time-utils";
import {
  createBookingLeadFromTelegram,
  createBusyEventFromBookingLead,
  createExternalBookingLinkForLead,
  markBookingLeadLinkSent,
  rejectBookingLead
} from "@/lib/booking-leads/booking-lead-service";
import { prisma } from "@/lib/prisma";
import {
  createCalendarDraftFromMessage,
  confirmCalendarDraft,
  rejectCalendarDraft
} from "@/lib/integrations/telegram/telegram-actions";
import {
  answerCallbackQuery,
  sendBookingLeadConfirmation,
  sendCalendarDraftConfirmation,
  sendConnectionSuccess,
  sendErrorMessage,
  sendHelpMessage,
  sendMessage
} from "@/lib/integrations/telegram/telegram-client";
import {
  parseBusyCommand,
  parseCalendarIntent,
  parseDateExpression,
  parseNaturalBusyText,
  parseTelegramIntent
} from "@/lib/integrations/telegram/telegram-parser";
import { validateCallbackPayload } from "@/lib/integrations/telegram/telegram-security";
import type {
  ConnectedExternalChannel,
  ParsedCalendarIntent,
  ParsedBookingLeadIntent,
  TelegramCallbackQuery,
  TelegramMessage,
  TelegramUserData,
  TelegramWebhookPayload
} from "@/lib/integrations/telegram/types";

export async function handleTelegramWebhook(payload: TelegramWebhookPayload) {
  try {
    if (payload.callback_query) {
      await handleTelegramCallbackQuery(payload.callback_query);
      return { success: true };
    }

    const message = payload.message ?? payload.edited_message;
    if (message?.text) {
      await handleTelegramTextMessage(message, payload);
      return { success: true };
    }

    return { success: true, message: "Ignored unknown update type." };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Telegram webhook failed."
    };
  }
}

export async function handleTelegramTextMessage(
  message: TelegramMessage,
  payload?: TelegramWebhookPayload
) {
  const channel = await getExternalChannelByTelegramChatId(String(message.chat.id));
  const logged = await logExternalMessage({
    channelId: channel?.id,
    externalMessageId: `${message.chat.id}:${message.message_id}`,
    telegramChatId: String(message.chat.id),
    telegramUserId: message.from ? String(message.from.id) : undefined,
    senderName: senderName(message),
    senderUsername: message.from?.username,
    text: message.text,
    rawPayload: payload ?? { message }
  });

  if (!message.text) {
    await markMessage(logged.id, ExternalMessageStatus.IGNORED);
    return;
  }

  if (message.text.startsWith("/")) {
    await handleTelegramCommand(message, logged, channel);
    return;
  }

  if (!channel) {
    await markMessage(logged.id, ExternalMessageStatus.IGNORED);
    await sendErrorMessage(
      String(message.chat.id),
      "Telegram пока не подключен. Сначала отправьте /start CODE из кабинета."
    );
    return;
  }

  const parsed = parseTelegramIntent(message.text);
  if (parsed.intent === "CREATE_BOOKING_LEAD") {
    await createLeadAndAskConfirmation(channel, parsed, logged, String(message.chat.id));
    return;
  }

  if (parsed.intent !== "CREATE_BUSY_EVENT" || parsed.needsClarification || !parsed.date || !parsed.startTime || !parsed.endTime) {
    await markMessage(logged.id, ExternalMessageStatus.IGNORED);
    await sendErrorMessage(String(message.chat.id), parsed.clarificationMessage ?? helpMessage());
    return;
  }

  await createDraftAndAskConfirmation(channel, parsed, logged, String(message.chat.id));
}

export async function handleTelegramCommand(
  message: TelegramMessage,
  logged?: ExternalMessage,
  channel?: ConnectedExternalChannel | null
) {
  const chatId = String(message.chat.id);
  const text = message.text?.trim() ?? "";
  const [rawCommand, ...args] = text.split(/\s+/);
  const command = rawCommand.replace(/@\w+$/, "").toLowerCase();

  if (command === "/start") {
    const code = args[0];
    if (!code) {
      if (logged) await markMessage(logged.id, ExternalMessageStatus.IGNORED);
      await sendHelpMessage(chatId);
      return;
    }

    await connectTelegramChannelByCode(code, {
      chatId,
      userId: message.from ? String(message.from.id) : undefined,
      username: message.from?.username,
      title: message.chat.title ?? message.chat.username ?? senderName(message)
    });
    if (logged) await markMessage(logged.id, ExternalMessageStatus.CONFIRMED);
    await sendConnectionSuccess(chatId);
    return;
  }

  if (command === "/help") {
    if (logged) await markMessage(logged.id, ExternalMessageStatus.IGNORED);
    await sendHelpMessage(chatId);
    return;
  }

  if (!channel) {
    if (logged) await markMessage(logged.id, ExternalMessageStatus.IGNORED);
    await sendErrorMessage(chatId, "Сначала подключите Telegram через /start CODE.");
    return;
  }

  if (command === "/busy") {
    const parsed = parseBusyCommand(text);
    await createDraftAndAskConfirmation(channel, parsed, requireLogged(logged), chatId);
    return;
  }

  if (command === "/busy_hall") {
    await handleBusyHallCommand(channel, text, requireLogged(logged), chatId);
    return;
  }

  if (command === "/lead" || command === "/book") {
    const parsed = parseTelegramIntent(text);
    if (parsed.intent !== "CREATE_BOOKING_LEAD") {
      await sendErrorMessage(chatId, parsed.clarificationMessage ?? helpMessage());
      return;
    }
    await createLeadAndAskConfirmation(channel, parsed, requireLogged(logged), chatId);
    return;
  }

  if (command === "/lead_hall" || command === "/book_hall") {
    await handleLeadHallCommand(channel, text, requireLogged(logged), chatId);
    return;
  }

  if (command === "/studio_halls") {
    if (logged) await markMessage(logged.id, ExternalMessageStatus.IGNORED);
    await sendStudioHalls(channel, chatId);
    return;
  }

  if (command === "/week") {
    if (logged) await markMessage(logged.id, ExternalMessageStatus.PARSED);
    await sendWeekSummary(channel, chatId);
    return;
  }

  if (command === "/free") {
    if (logged) await markMessage(logged.id, ExternalMessageStatus.PARSED);
    await sendFreeSlots(channel, args.join(" "), chatId);
    return;
  }

  if (logged) await markMessage(logged.id, ExternalMessageStatus.IGNORED);
  await sendHelpMessage(chatId);
}

export async function handleTelegramCallbackQuery(callbackQuery: TelegramCallbackQuery) {
  const payload = validateCallbackPayload(callbackQuery.data);
  if (!payload) {
    await answerCallbackQuery(callbackQuery.id, "Неизвестное действие.");
    return;
  }

  const chatId = callbackQuery.message?.chat.id
    ? String(callbackQuery.message.chat.id)
    : undefined;

  try {
    if (payload.action === "confirm_draft") {
      await confirmCalendarDraft(payload.draftId, callbackQuery.from);
      await answerCallbackQuery(callbackQuery.id, "Добавлено.");
      if (chatId) await sendMessage(chatId, "Готово, добавил занятость в календарь.");
      return;
    }

    if (payload.action === "lead_create_link") {
      const result = await createExternalBookingLinkForLead(payload.leadId);
      await markBookingLeadLinkSent(payload.leadId);
      await answerCallbackQuery(callbackQuery.id, "Ссылка создана.");
      if (chatId) {
        await sendBookingLeadConfirmation(chatId, result.lead, result.url);
      }
      return;
    }

    if (payload.action === "lead_as_busy") {
      await createBusyEventFromBookingLead(payload.leadId);
      await answerCallbackQuery(callbackQuery.id, "Добавлено как занятость.");
      if (chatId) await sendMessage(chatId, "Готово, добавил слот как занятость.");
      return;
    }

    if (payload.action === "lead_reject") {
      await rejectBookingLead(payload.leadId);
      await answerCallbackQuery(callbackQuery.id, "Отклонено.");
      if (chatId) await sendMessage(chatId, "Окей, заявку отклонил.");
      return;
    }

    if (payload.action === "reject_draft") {
      await rejectCalendarDraft(payload.draftId, callbackQuery.from);
      await answerCallbackQuery(callbackQuery.id, "Отменено.");
      if (chatId) await sendMessage(chatId, "Окей, не добавляю.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось выполнить действие.";
    await answerCallbackQuery(callbackQuery.id, message);
    if (chatId) await sendErrorMessage(chatId, message);
  }
}

export async function connectTelegramChannelByCode(
  code: string,
  telegramUserData: TelegramUserData
) {
  const connectionCode = await prisma.telegramConnectionCode.findUnique({
    where: { code },
    include: {
      photographerProfile: { select: { id: true, userId: true, name: true } },
      studioProfile: { select: { id: true, ownerId: true, name: true } }
    }
  });

  if (!connectionCode || connectionCode.usedAt || connectionCode.expiresAt < new Date()) {
    throw new Error("Код подключения не найден или истек.");
  }

  const ownerWhere =
    connectionCode.ownerType === ExternalChannelOwnerType.PHOTOGRAPHER
      ? { photographerProfileId: connectionCode.photographerProfileId }
      : { studioProfileId: connectionCode.studioProfileId };

  await prisma.externalChannel.updateMany({
    where: {
      provider: ExternalProvider.TELEGRAM,
      ...ownerWhere
    },
    data: { isActive: false }
  });

  const [channel] = await prisma.$transaction([
    prisma.externalChannel.create({
      data: {
        provider: ExternalProvider.TELEGRAM,
        ownerType: connectionCode.ownerType,
        photographerProfileId: connectionCode.photographerProfileId,
        studioProfileId: connectionCode.studioProfileId,
        telegramChatId: telegramUserData.chatId,
        telegramUserId: telegramUserData.userId,
        telegramUsername: telegramUserData.username,
        title: telegramUserData.title,
        isActive: true,
        connectedAt: new Date()
      }
    }),
    prisma.telegramConnectionCode.update({
      where: { id: connectionCode.id },
      data: { usedAt: new Date() }
    })
  ]);

  return channel;
}

export function getExternalChannelByTelegramChatId(chatId: string) {
  return prisma.externalChannel.findFirst({
    where: {
      provider: ExternalProvider.TELEGRAM,
      telegramChatId: chatId,
      isActive: true
    },
    include: {
      photographerProfile: { select: { id: true, userId: true, name: true } },
      studioProfile: {
        select: {
          id: true,
          ownerId: true,
          name: true,
          halls: { select: { id: true, name: true } }
        }
      }
    }
  });
}

export function logExternalMessage(input: {
  channelId?: string;
  externalMessageId: string;
  telegramChatId?: string;
  telegramUserId?: string;
  senderName?: string;
  senderUsername?: string;
  text?: string;
  rawPayload: unknown;
}) {
  return prisma.externalMessage.upsert({
    where: {
      provider_externalMessageId: {
        provider: ExternalProvider.TELEGRAM,
        externalMessageId: input.externalMessageId
      }
    },
    update: {
      channelId: input.channelId,
      text: input.text,
      rawPayload: input.rawPayload as object
    },
    create: {
      channelId: input.channelId,
      provider: ExternalProvider.TELEGRAM,
      externalMessageId: input.externalMessageId,
      telegramChatId: input.telegramChatId,
      telegramUserId: input.telegramUserId,
      senderName: input.senderName,
      senderUsername: input.senderUsername,
      text: input.text,
      rawPayload: input.rawPayload as object,
      status: ExternalMessageStatus.RECEIVED
    }
  });
}

async function createDraftAndAskConfirmation(
  channel: ConnectedExternalChannel,
  parsed: ParsedCalendarIntent,
  logged: ExternalMessage,
  chatId: string,
  owner?: Parameters<typeof createCalendarDraftFromMessage>[3]
) {
  if (parsed.needsClarification || !parsed.date || !parsed.startTime || !parsed.endTime) {
    await markMessage(logged.id, ExternalMessageStatus.FAILED, parsed.clarificationMessage);
    await sendErrorMessage(chatId, parsed.clarificationMessage ?? "Не понял дату или время.");
    return;
  }

  try {
    const draft = await createCalendarDraftFromMessage(channel, parsed, logged, owner);
    await markMessage(logged.id, ExternalMessageStatus.NEEDS_CONFIRMATION);
    await sendCalendarDraftConfirmation(chatId, draft);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось создать черновик.";
    await markMessage(logged.id, ExternalMessageStatus.FAILED, message);
    await sendErrorMessage(chatId, message);
  }
}

async function createLeadAndAskConfirmation(
  channel: ConnectedExternalChannel,
  parsed: ParsedBookingLeadIntent,
  logged: ExternalMessage,
  chatId: string,
  studioHallId?: string
) {
  if (parsed.needsClarification || !parsed.date || !parsed.startTime || !parsed.endTime) {
    await markMessage(logged.id, ExternalMessageStatus.FAILED, parsed.clarificationMessage);
    await sendErrorMessage(chatId, parsed.clarificationMessage ?? "Не понял дату или время для брони.");
    return;
  }

  try {
    const lead = await createBookingLeadFromTelegram({
      channel,
      parsed,
      externalMessageId: logged.id,
      externalSourceMessageId: logged.externalMessageId,
      originalText: logged.text ?? "",
      studioHallId
    });
    await markMessage(logged.id, ExternalMessageStatus.NEEDS_CONFIRMATION);
    await sendBookingLeadConfirmation(chatId, lead);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось создать заявку.";
    await markMessage(logged.id, ExternalMessageStatus.FAILED, message);
    await sendErrorMessage(chatId, message);
  }
}

async function handleBusyHallCommand(
  channel: ConnectedExternalChannel,
  text: string,
  logged: ExternalMessage,
  chatId: string
) {
  const halls = channel.studioProfile?.halls ?? [];
  if (halls.length === 0) {
    await markMessage(logged.id, ExternalMessageStatus.FAILED, "У студии нет залов.");
    await sendErrorMessage(chatId, "У студии пока нет залов.");
    return;
  }

  const body = text.replace(/^\/busy_hall(?:@\w+)?\s*/i, "");
  const hall = halls.find((item) =>
    body.toLowerCase().startsWith(item.name.toLowerCase())
  );
  if (!hall) {
    await markMessage(logged.id, ExternalMessageStatus.FAILED, "Зал не найден.");
    await sendErrorMessage(
      chatId,
      `Не нашел зал. Доступные залы:\n${halls.map((item) => `- ${item.name}`).join("\n")}`
    );
    return;
  }

  const parsed = parseNaturalBusyText(body.slice(hall.name.length).trim());
  await createDraftAndAskConfirmation(
    channel,
    parsed,
    logged,
    chatId,
    {
      type: "STUDIO_HALL",
      studioHallId: hall.id,
      createdById: channel.studioProfile?.ownerId
    }
  );
}

async function handleLeadHallCommand(
  channel: ConnectedExternalChannel,
  text: string,
  logged: ExternalMessage,
  chatId: string
) {
  const halls = channel.studioProfile?.halls ?? [];
  if (halls.length === 0) {
    await markMessage(logged.id, ExternalMessageStatus.FAILED, "У студии нет залов.");
    await sendErrorMessage(chatId, "У студии пока нет залов.");
    return;
  }

  const body = text.replace(/^\/(?:lead_hall|book_hall)(?:@\w+)?\s*/i, "");
  const hall = halls.find((item) =>
    body.toLowerCase().startsWith(item.name.toLowerCase())
  );
  if (!hall) {
    await markMessage(logged.id, ExternalMessageStatus.FAILED, "Зал не найден.");
    await sendErrorMessage(
      chatId,
      `Не нашел зал. Доступные залы:\n${halls.map((item) => `- ${item.name}`).join("\n")}`
    );
    return;
  }

  const parsed = parseTelegramIntent(
    `/lead_hall ${body.slice(hall.name.length).trim()}`
  );
  if (parsed.intent !== "CREATE_BOOKING_LEAD") {
    await markMessage(logged.id, ExternalMessageStatus.FAILED, parsed.clarificationMessage);
    await sendErrorMessage(chatId, parsed.clarificationMessage ?? helpMessage());
    return;
  }

  await createLeadAndAskConfirmation(channel, parsed, logged, chatId, hall.id);
}

async function sendStudioHalls(channel: ConnectedExternalChannel, chatId: string) {
  const halls = channel.studioProfile?.halls ?? [];
  if (halls.length === 0) {
    await sendMessage(chatId, "У студии пока нет залов.");
    return;
  }
  await sendMessage(
    chatId,
    `Залы студии:\n${halls.map((hall) => `- ${hall.name}`).join("\n")}`
  );
}

async function sendWeekSummary(channel: ConnectedExternalChannel, chatId: string) {
  const owner = resolveReadableOwner(channel);
  if (!owner) {
    await sendErrorMessage(
      chatId,
      "Укажите зал. Например:\n/busy_hall Loft 28.06 14:00-17:00"
    );
    return;
  }

  const startDate = dateKey(new Date());
  const range = {
    startTime: localDateTime(startDate, "00:00"),
    endTime: new Date(localDateTime(startDate, "00:00").getTime() + 7 * 24 * 60 * 60_000)
  };
  const events = await getCalendarEventsForDashboard(owner, range);
  if (events.length === 0) {
    await sendMessage(chatId, "На ближайшую неделю занятости нет.");
    return;
  }

  await sendMessage(
    chatId,
    events
      .slice(0, 20)
      .map(
        (event) =>
          `${formatDate(event.startTime)} ${timeLabel(event.startTime)}-${timeLabel(event.endTime)} · ${event.title}`
      )
      .join("\n")
  );
}

async function sendFreeSlots(
  channel: ConnectedExternalChannel,
  dateText: string,
  chatId: string
) {
  const owner = resolveReadableOwner(channel);
  if (!owner) {
    await sendErrorMessage(chatId, "Для студии с несколькими залами используйте /busy_hall.");
    return;
  }

  const parsedDate = parseDateExpression(dateText || "сегодня");
  if (!parsedDate?.date) {
    await sendErrorMessage(chatId, "Не понял дату. Например: /free завтра");
    return;
  }

  const slots = await getAvailableSlots(
    { owner, date: parsedDate.date, durationMinutes: 60 },
    undefined,
    { cleanupExpiredHolds: false }
  );
  await sendMessage(
    chatId,
    slots.length
      ? `Свободно ${formatDate(localDateTime(parsedDate.date, "12:00"))}:\n${slots
          .slice(0, 20)
          .map((slot) => `${slot.startLabel}-${slot.endLabel}`)
          .join("\n")}`
      : "Свободных слотов на эту дату нет."
  );
}

function resolveReadableOwner(channel: ConnectedExternalChannel) {
  if (channel.photographerProfileId) {
    return {
      type: "PHOTOGRAPHER" as const,
      photographerProfileId: channel.photographerProfileId
    };
  }
  const halls = channel.studioProfile?.halls ?? [];
  if (halls.length === 1) {
    return { type: "STUDIO_HALL" as const, studioHallId: halls[0].id };
  }
  return null;
}

function requireLogged(logged?: ExternalMessage) {
  if (!logged) throw new Error("External message log is required.");
  return logged;
}

function markMessage(
  messageId: string,
  status: ExternalMessageStatus,
  errorMessage?: string
) {
  return prisma.externalMessage.update({
    where: { id: messageId },
    data: {
      status,
      processedAt: new Date(),
      errorMessage
    }
  });
}

function senderName(message: TelegramMessage) {
  return [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ")
    || message.chat.title
    || message.chat.username
    || undefined;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    day: "numeric",
    month: "long"
  }).format(date);
}

function helpMessage() {
  return [
    "Я пока умею помогать с календарем. Например:",
    "Занят завтра с 14 до 17",
    "или",
    "/busy 28.06 14:00-17:00"
  ].join("\n");
}
