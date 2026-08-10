// Deprecated: Telegram now works as notification-only. This legacy parser is
// kept for historical data compatibility and should not be used by the webhook.
import {
  dateKey,
  localDateTime,
  timeFromMinutes
} from "@/lib/calendar/time-utils";
import type {
  ParsedBookingLeadIntent,
  ParsedCalendarIntent,
  ParsedTelegramIntent
} from "@/lib/integrations/telegram/types";

type ParserContext = {
  now?: Date;
  timezone?: string;
};

const weekdayMap: Record<string, number> = {
  воскресенье: 0,
  вс: 0,
  понедельник: 1,
  пн: 1,
  вторник: 2,
  вт: 2,
  среда: 3,
  среду: 3,
  ср: 3,
  четверг: 4,
  чт: 4,
  пятница: 5,
  пятницу: 5,
  пт: 5,
  суббота: 6,
  субботу: 6,
  сб: 6
};

export function parseCalendarIntent(
  text: string,
  context: ParserContext = {}
): ParsedCalendarIntent {
  const normalized = normalizeText(text);
  if (!looksLikeBusyIntent(normalized)) {
    return {
      intent: "CREATE_BUSY_EVENT",
      confidence: 0,
      needsClarification: true,
      clarificationMessage: helpHint()
    };
  }

  const parsed = parseNaturalBusyText(text, context);
  return {
    ...parsed,
    needsClarification: parsed.confidence < 70,
    clarificationMessage:
      parsed.confidence < 70
        ? "Не понял дату или время. Например: «Занят завтра с 14 до 17»."
        : undefined
  };
}

export function parseTelegramIntent(
  text: string,
  context: ParserContext = {}
): ParsedTelegramIntent {
  const command = getCommand(text);
  const normalized = normalizeText(text);

  if (command === "/lead" || command === "/book") {
    return parseBookingLeadCommand(text, "PHOTOGRAPHER_ONLY", context);
  }

  if (command === "/lead_hall" || command === "/book_hall") {
    return parseBookingLeadCommand(text, "STUDIO_ONLY", context);
  }

  if (command === "/busy" || command === "/busy_hall") {
    return {
      ...parseBusyCommand(text, context),
      needsClarification: false
    };
  }

  if (looksLikeBookingLeadIntent(normalized)) {
    return parseNaturalBookingLeadText(text, context);
  }

  if (looksLikeBusyIntent(normalized)) {
    return parseCalendarIntent(text, context);
  }

  return {
    intent: "UNKNOWN",
    confidence: 0,
    needsClarification: true,
    clarificationMessage: helpHint()
  };
}

export function parseBusyCommand(
  text: string,
  context: ParserContext = {}
): ParsedCalendarIntent {
  const commandless = text.replace(/^\/(?:busy|busy_hall)(?:@\w+)?\s*/i, "");
  return parseNaturalBusyText(commandless, context);
}

export function parseNaturalBusyText(
  text: string,
  context: ParserContext = {}
): ParsedCalendarIntent {
  const normalized = normalizeText(text);
  const date = parseDateExpression(normalized, context.timezone ?? "Asia/Almaty", context.now);
  const timeRange = parseTimeRange(normalized);
  const title = extractTitle(text, date?.matchedText, timeRange?.matchedText);
  const confidence = calculateConfidence({
    hasDate: Boolean(date?.date),
    hasTime: Boolean(timeRange),
    looksBusy: looksLikeBusyIntent(normalized),
    title: Boolean(title)
  });

  return {
    intent: "CREATE_BUSY_EVENT",
    date: date?.date,
    startTime: timeRange?.startTime,
    endTime: timeRange?.endTime,
    title,
    confidence
  };
}

export function parseBookingLeadCommand(
  text: string,
  bookingType: "PHOTOGRAPHER_ONLY" | "STUDIO_ONLY" = "PHOTOGRAPHER_ONLY",
  context: ParserContext = {}
): ParsedBookingLeadIntent {
  const commandless = text.replace(/^\/(?:lead|book|lead_hall|book_hall)(?:@\w+)?\s*/i, "");
  return parseBookingLeadText(commandless, bookingType, context, true);
}

export function parseNaturalBookingLeadText(
  text: string,
  context: ParserContext = {}
): ParsedBookingLeadIntent {
  const bookingType =
    /\b(зал|студия|studio|hall|аренда)\b/i.test(normalizeText(text))
      ? "STUDIO_ONLY"
      : "PHOTOGRAPHER_ONLY";
  return parseBookingLeadText(text, bookingType, context, false);
}

function parseBookingLeadText(
  text: string,
  bookingType: "PHOTOGRAPHER_ONLY" | "STUDIO_ONLY",
  context: ParserContext,
  commandForced: boolean
): ParsedBookingLeadIntent {
  const normalized = normalizeText(text);
  const date = parseDateExpression(normalized, context.timezone ?? "Asia/Almaty", context.now);
  const timeRange = parseTimeRange(normalized);
  const durationMinutes = timeRange
    ? toMinutes(timeRange.endTime) - toMinutes(timeRange.startTime)
    : undefined;
  const title = extractLeadTitle(text, date?.matchedText, timeRange?.matchedText);
  const missingFields = [
    !date?.date ? "date" : undefined,
    !timeRange ? "time" : undefined
  ].filter(Boolean) as string[];
  const confidence = calculateLeadConfidence({
    hasDate: Boolean(date?.date),
    hasTime: Boolean(timeRange),
    commandForced,
    looksLead: looksLikeBookingLeadIntent(normalized),
    title: Boolean(title)
  });

  return {
    intent: "CREATE_BOOKING_LEAD",
    bookingType,
    ownerType: bookingType === "STUDIO_ONLY" ? "STUDIO_HALL" : "PHOTOGRAPHER",
    date: date?.date,
    startTime: timeRange?.startTime,
    endTime: timeRange?.endTime,
    durationMinutes,
    clientName: extractClientName(text, date?.matchedText, timeRange?.matchedText),
    hallName: bookingType === "STUDIO_ONLY"
      ? extractHallName(text, date?.matchedText, timeRange?.matchedText)
      : undefined,
    title,
    notes: title,
    confidence,
    missingFields,
    needsClarification: confidence < 70 || missingFields.length > 0,
    clarificationMessage:
      confidence < 70 || missingFields.length > 0
        ? "Не понял дату или время для брони. Например: /lead Айдана завтра 14:00-16:00"
        : undefined
  };
}

export function parseDateExpression(
  text: string,
  _timezone = "Asia/Almaty",
  now = new Date()
) {
  const today = localNoon(dateKey(now));

  if (/\bсегодня\b/i.test(text)) {
    return { date: dateKey(today), matchedText: "сегодня" };
  }
  if (/\bзавтра\b/i.test(text)) {
    const date = addDays(today, 1);
    return { date: dateKey(date), matchedText: "завтра" };
  }
  if (/\bпослезавтра\b/i.test(text)) {
    const date = addDays(today, 2);
    return { date: dateKey(date), matchedText: "послезавтра" };
  }

  const numeric = /\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/.exec(text);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    const year = normalizeYear(numeric[3], today);
    const date = localNoon(
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    );
    const normalizedDate = date < today && !numeric[3]
      ? localNoon(`${year + 1}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`)
      : date;
    return { date: dateKey(normalizedDate), matchedText: numeric[0] };
  }

  const monthName = new RegExp(
    "\\b(\\d{1,2})\\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\\b",
    "i"
  ).exec(text);
  if (monthName) {
    const month = monthNames.indexOf(monthName[2].toLowerCase()) + 1;
    const year = today.getFullYear();
    const date = localNoon(
      `${year}-${String(month).padStart(2, "0")}-${String(Number(monthName[1])).padStart(2, "0")}`
    );
    const normalizedDate =
      date < today
        ? localNoon(`${year + 1}-${String(month).padStart(2, "0")}-${String(Number(monthName[1])).padStart(2, "0")}`)
        : date;
    return { date: dateKey(normalizedDate), matchedText: monthName[0] };
  }

  for (const [word, weekday] of Object.entries(weekdayMap)) {
    const pattern = new RegExp(`\\b(?:в\\s+)?${word}\\b`, "i");
    const match = pattern.exec(text);
    if (match) {
      const delta = (weekday - today.getDay() + 7) % 7 || 7;
      return { date: dateKey(addDays(today, delta)), matchedText: match[0] };
    }
  }

  return null;
}

export function parseTimeRange(text: string) {
  const normalized = text
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  const range =
    /(?:с\s*)?(\d{1,2})(?::(\d{2}))?\s*(?:-|до|по)\s*(\d{1,2})(?::(\d{2}))?/i.exec(
      normalized
    );
  if (!range) return null;

  const start = normalizeHourMinute(range[1], range[2]);
  const end = normalizeHourMinute(range[3], range[4]);
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  if (endMinutes <= startMinutes) return null;

  return {
    startTime: start,
    endTime: end,
    matchedText: range[0].trim()
  };
}

export function calculateConfidence(input: {
  hasDate: boolean;
  hasTime: boolean;
  looksBusy: boolean;
  title?: boolean;
}) {
  let score = 0;
  if (input.hasDate) score += 40;
  if (input.hasTime) score += 40;
  if (input.looksBusy) score += 15;
  if (input.title) score += 5;
  return Math.min(score, 100);
}

function looksLikeBusyIntent(text: string) {
  return /\b(занят|занята|занято|заняты|busy|личная|перерыв|недоступен|недоступна)\b/i.test(text)
    || Boolean(parseTimeRange(text));
}

function looksLikeBookingLeadIntent(text: string) {
  return /\b(бронь|забронировать|забронируй|booking|book|клиент|клиентка|хочет|хотят|съемка|съёмка|аренда|депозит)\b/i.test(text);
}

function calculateLeadConfidence(input: {
  hasDate: boolean;
  hasTime: boolean;
  commandForced: boolean;
  looksLead: boolean;
  title?: boolean;
}) {
  let score = 0;
  if (input.hasDate) score += 35;
  if (input.hasTime) score += 35;
  if (input.commandForced) score += 20;
  else if (input.looksLead) score += 20;
  if (input.title) score += 10;
  return Math.min(score, 100);
}

function extractTitle(text: string, datePart?: string, timePart?: string) {
  let value = text
    .replace(/^\/(?:busy|busy_hall)(?:@\w+)?\s*/i, "")
    .replace(/\b(занят|занята|занято|заняты|busy)\b/gi, "")
    .trim();
  if (datePart) value = value.replace(new RegExp(escapeRegExp(datePart), "i"), "");
  if (timePart) value = value.replace(new RegExp(escapeRegExp(timePart), "i"), "");
  value = value
    .replace(/\b(с|до|по|в)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return value.length > 1 ? value.slice(0, 80) : undefined;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/ё/g, "е").trim();
}

function getCommand(value: string) {
  const match = /^\/([a-z_]+)(?:@\w+)?/i.exec(value.trim());
  return match ? `/${match[1].toLowerCase()}` : undefined;
}

function normalizeHourMinute(hours: string, minutes?: string) {
  const hour = Number(hours);
  const minute = Number(minutes ?? 0);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error("Некорректное время.");
  }
  return timeFromMinutes(hour * 60 + minute);
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function localNoon(value: string) {
  return localDateTime(value, "12:00");
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizeYear(value: string | undefined, fallback: Date) {
  if (!value) return fallback.getFullYear();
  const year = Number(value);
  return year < 100 ? 2000 + year : year;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function helpHint() {
  return [
    "Я умею помогать с календарем и заявками на бронь. Например:",
    "Занят завтра с 14 до 17",
    "/lead Айдана завтра 14:00-16:00",
    "или",
    "/busy 28.06 14:00-17:00"
  ].join("\n");
}

function extractLeadTitle(text: string, datePart?: string, timePart?: string) {
  let value = text
    .replace(/^\/(?:lead|book|lead_hall|book_hall)(?:@\w+)?\s*/i, "")
    .replace(/\b(клиент|клиентка|хочет|хотят|забронировать|забронируй|бронь|съемка|съёмка|аренда)\b/gi, "")
    .trim();
  if (datePart) value = value.replace(new RegExp(escapeRegExp(datePart), "i"), "");
  if (timePart) value = value.replace(new RegExp(escapeRegExp(timePart), "i"), "");
  value = value.replace(/\s+/g, " ").trim();
  return value.length > 1 ? value.slice(0, 120) : undefined;
}

function extractClientName(text: string, datePart?: string, timePart?: string) {
  let value = text
    .replace(/^\/(?:lead|book|lead_hall|book_hall)(?:@\w+)?\s*/i, "")
    .trim();
  if (datePart) value = value.replace(new RegExp(escapeRegExp(datePart), "i"), "");
  if (timePart) value = value.replace(new RegExp(escapeRegExp(timePart), "i"), "");
  value = value
    .replace(/\b(клиент|клиентка|хочет|хотят|забронировать|забронируй|бронь|съемка|съёмка|аренда|зал|студия)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const first = value.split(/\s+/).find((part) => /^[A-Za-zА-Яа-яЁё]{2,}$/.test(part));
  return first ? capitalize(first).slice(0, 60) : undefined;
}

function extractHallName(text: string, datePart?: string, timePart?: string) {
  let value = text
    .replace(/^\/(?:lead_hall|book_hall)(?:@\w+)?\s*/i, "")
    .trim();
  if (datePart) value = value.replace(new RegExp(escapeRegExp(datePart), "i"), "");
  if (timePart) value = value.replace(new RegExp(escapeRegExp(timePart), "i"), "");
  value = value.replace(/\s+/g, " ").trim();
  return value.split(/\s+/).slice(0, 3).join(" ").slice(0, 80) || undefined;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const monthNames = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря"
];
