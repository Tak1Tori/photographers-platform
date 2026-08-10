import { dateKey, timeLabel } from "@/lib/calendar/time-utils";

type ConfirmationMessageRequest = {
  id: string;
  confirmationToken: string;
  studioName: string;
  hallName: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  totalServicePrice: number;
  platformFeeAmount: number;
  providerAmount: number;
  clientName?: string | null;
  clientPhone?: string | null;
  studioProfile?: {
    whatsappBookingPhone?: string | null;
    whatsappContactName?: string | null;
  } | null;
};

export function getPublicAppUrl() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  return raw.replace(/\/$/, "");
}

export function buildStudioConfirmationUrl(token: string) {
  return `${getPublicAppUrl()}/studio-confirm/${token}`;
}

export function buildStudioWaitingUrl(requestId: string) {
  return `/booking/studio-confirmation/${requestId}`;
}

export function normalizeWhatsappPhone(phone?: string | null) {
  return String(phone ?? "").replace(/\D/g, "");
}

export function buildWhatsappOpenUrl(phone: string | null | undefined, message: string) {
  const normalized = normalizeWhatsappPhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function buildStudioWhatsappMessage(request: ConfirmationMessageRequest) {
  const durationHours = formatDurationHours(request.durationMinutes);
  const managerLine = request.studioProfile?.whatsappContactName
    ? `Контакт: ${request.studioProfile.whatsappContactName}`
    : null;

  return [
    "Framely: новая заявка на аренду студии",
    "",
    managerLine,
    `Студия: ${request.studioName}`,
    `Зал: ${request.hallName}`,
    `Дата: ${formatDate(request.startTime)}`,
    `Время: ${timeLabel(request.startTime)}-${timeLabel(request.endTime)}`,
    `Длительность: ${durationHours}`,
    `Стоимость аренды: ${formatPrice(request.totalServicePrice)}`,
    `Сервисный сбор платформы: ${formatPrice(request.platformFeeAmount)}`,
    `Оплата студии напрямую: ${formatPrice(request.providerAmount)}`,
    request.clientName ? `Клиент: ${request.clientName}` : null,
    "",
    "Подтвердите или отклоните заявку:",
    buildStudioConfirmationUrl(request.confirmationToken)
  ].filter(Boolean).join("\n");
}

export function buildStudioWhatsappMessageAfterPayment(request: ConfirmationMessageRequest) {
  return [
    "Framely: клиент оплатил сервисный сбор",
    "",
    `Заявка: ${request.id}`,
    `Студия: ${request.studioName}`,
    `Зал: ${request.hallName}`,
    `Дата: ${formatDate(request.startTime)}`,
    `Время: ${timeLabel(request.startTime)}-${timeLabel(request.endTime)}`,
    `Оплата студии напрямую: ${formatPrice(request.providerAmount)}`,
    "",
    request.clientName ? `Клиент: ${request.clientName}` : null,
    request.clientPhone ? `Телефон: ${request.clientPhone}` : null,
  ].filter(Boolean).join("\n");
}

function formatDate(date: Date) {
  return dateKey(date).split("-").reverse().join(".");
}

function formatDurationHours(durationMinutes: number) {
  const hours = durationMinutes / 60;
  return Number.isInteger(hours) ? `${hours} ч` : `${durationMinutes} мин`;
}

function formatPrice(value: number) {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₸`;
}
