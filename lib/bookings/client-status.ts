import type { Booking } from "@/lib/types";

export function isClientBookingBeforeStart(booking: Booking, now = new Date()) {
  const start = getClientBookingStartDateTime(booking);

  if (!start) {
    return false;
  }

  return now.getTime() < start.getTime();
}

export function canClientBookingMoveToInProgress(
  booking: Booking,
  now = new Date()
) {
  const start = getClientBookingStartDateTime(booking);
  const end = getClientBookingEndDateTime(booking);

  if (!start || !end) {
    return true;
  }

  return now.getTime() >= start.getTime() && now.getTime() < end.getTime();
}

function getClientBookingStartDateTime(booking: Booking) {
  const date = booking.date.slice(0, 10);
  const time = normalizeTime(booking.time);
  const value = new Date(`${date}T${time}:00+05:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function getClientBookingEndDateTime(booking: Booking) {
  const start = getClientBookingStartDateTime(booking);

  if (!start) {
    return null;
  }

  return new Date(start.getTime() + Math.max(booking.durationHours, 1) * 60 * 60_000);
}

function normalizeTime(value: string) {
  const match = /^(\d{1,2}):([0-5]\d)/.exec(value);

  if (!match) {
    return "00:00";
  }

  return `${match[1].padStart(2, "0")}:${match[2]}`;
}
