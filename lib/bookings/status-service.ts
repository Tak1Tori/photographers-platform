import { BookingStatus, type Booking as PrismaBooking } from "@prisma/client";
import { cancelPlatformBookingEvent } from "@/lib/calendar/calendar-service";
import { addMinutes, dateKey, localDateTime } from "@/lib/calendar/time-utils";
import { canUseDatabase } from "@/lib/data/db";
import { prisma } from "@/lib/prisma";

type BookingSchedule = Pick<
  PrismaBooking,
  "date" | "startTime" | "endTime" | "durationHours"
>;

const autoCompletableStatuses = [
  BookingStatus.CONFIRMED,
  BookingStatus.IN_PROGRESS
];

export function getBookingStartDateTime(booking: BookingSchedule) {
  return localDateTime(dateKey(booking.date), booking.startTime);
}

export function getBookingEndDateTime(booking: BookingSchedule) {
  if (booking.endTime) {
    return localDateTime(dateKey(booking.date), booking.endTime);
  }

  return addMinutes(
    getBookingStartDateTime(booking),
    Math.max(booking.durationHours, 1) * 60
  );
}

export function isBeforeBookingStart(
  booking: BookingSchedule,
  now = new Date()
) {
  return now.getTime() < getBookingStartDateTime(booking).getTime();
}

export function isAfterBookingEnd(
  booking: BookingSchedule,
  now = new Date()
) {
  return now.getTime() >= getBookingEndDateTime(booking).getTime();
}

export function assertCanMoveBookingToInProgress(
  booking: BookingSchedule,
  now = new Date()
) {
  if (isBeforeBookingStart(booking, now)) {
    throw new Error("Нельзя перевести бронь в работу раньше даты и времени начала.");
  }

  if (isAfterBookingEnd(booking, now)) {
    throw new Error("Время брони уже закончилось. Статус будет обновлен автоматически.");
  }
}

export async function autoCompletePastBookings(now = new Date()) {
  if (!canUseDatabase()) {
    return { count: 0 };
  }

  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: autoCompletableStatuses }
    },
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      durationHours: true
    }
  });

  const completedIds = bookings
    .filter((booking) => isAfterBookingEnd(booking, now))
    .map((booking) => booking.id);

  if (completedIds.length === 0) {
    return { count: 0 };
  }

  const result = await prisma.booking.updateMany({
    where: {
      id: { in: completedIds },
      status: { in: autoCompletableStatuses }
    },
    data: {
      status: BookingStatus.COMPLETED,
      completedAt: now
    }
  });

  await Promise.all(
    completedIds.map((bookingId) =>
      cancelPlatformBookingEvent(bookingId).catch(() => null)
    )
  );

  return { count: result.count };
}
