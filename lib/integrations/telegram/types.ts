// Deprecated: Telegram now works as notification-only. These legacy calendar
// assistant types are kept for historical data compatibility.
import type {
  BookingType,
  CalendarDraft,
  CalendarOwnerType,
  ExternalChannel,
  ExternalMessage,
  StudioHall
} from "@prisma/client";

export interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date?: number;
  text?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramWebhookPayload {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
  [key: string]: unknown;
}

export interface ParsedCalendarIntent {
  intent: "CREATE_BUSY_EVENT";
  date?: string;
  startTime?: string;
  endTime?: string;
  title?: string;
  confidence: number;
  needsClarification?: boolean;
  clarificationMessage?: string;
}

export interface ParsedBookingLeadIntent {
  intent: "CREATE_BOOKING_LEAD";
  bookingType: Extract<BookingType, "PHOTOGRAPHER_ONLY" | "STUDIO_ONLY">;
  ownerType: Extract<CalendarOwnerType, "PHOTOGRAPHER" | "STUDIO_HALL">;
  date?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  clientName?: string;
  hallName?: string;
  title?: string;
  notes?: string;
  confidence: number;
  missingFields: string[];
  needsClarification?: boolean;
  clarificationMessage?: string;
}

export interface ParsedUnknownTelegramIntent {
  intent: "UNKNOWN";
  confidence: 0;
  needsClarification: true;
  clarificationMessage: string;
}

export type ParsedTelegramIntent =
  | ParsedCalendarIntent
  | ParsedBookingLeadIntent
  | ParsedUnknownTelegramIntent;

export interface TelegramActionResult {
  success: boolean;
  message?: string;
  error?: string;
}

export type ConnectedExternalChannel = ExternalChannel & {
  photographerProfile?: { id: string; userId: string; name: string } | null;
  studioProfile?: {
    id: string;
    ownerId: string;
    name: string;
    halls: Array<Pick<StudioHall, "id" | "name">>;
  } | null;
};

export type CalendarDraftWithMessage = CalendarDraft & {
  externalMessage?: (ExternalMessage & { channel?: ConnectedExternalChannel | null }) | null;
};

export interface TelegramUserData {
  chatId: string;
  userId?: string;
  username?: string;
  title?: string;
}
