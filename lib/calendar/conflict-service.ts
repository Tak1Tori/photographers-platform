import {
  AvailabilityHoldStatus,
  BookingPaymentStatus,
  BookingStatus,
  CalendarEventStatus,
  type Prisma
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ownerWhere, validateOwner } from "@/lib/calendar/availability-service";
import {
  addMinutes,
  dateKey,
  localDateTime,
  minutesBetween,
  rangesOverlap,
  weekdayInAlmaty
} from "@/lib/calendar/time-utils";
import type { CalendarOwner } from "@/lib/calendar/types";

type DbClient = Prisma.TransactionClient | typeof prisma;

export async function checkTimeRangeConflict(
  owner: CalendarOwner,
  startTime: Date,
  endTime: Date,
  db: DbClient = prisma,
  options: { ignoreBookingId?: string } = {}
) {
  return (await getConflictReason(owner, startTime, endTime, db, options)) !== null;
}

export async function assertNoCalendarConflict(
  owner: CalendarOwner,
  startTime: Date,
  endTime: Date,
  db: DbClient = prisma,
  options: { ignoreBookingId?: string } = {}
) {
  const reason = await getConflictReason(owner, startTime, endTime, db, options);
  if (reason) throw new Error(reason);
}

export async function getConflictReason(
  owner: CalendarOwner,
  startTime: Date,
  endTime: Date,
  db: DbClient = prisma,
  options: { ignoreBookingId?: string } = {}
) {
  validateOwner(owner);
  if (!(startTime instanceof Date) || !(endTime instanceof Date) || endTime <= startTime) {
    return "Время окончания должно быть позже начала.";
  }

  const weekday = weekdayInAlmaty(startTime);
  const rule = await db.availabilityRule.findFirst({
    where: { ...ownerWhere(owner), weekday, isActive: true }
  });
  if (!rule) return "На выбранную дату нет рабочего расписания.";

  const workingStart = localDateTime(dateKey(startTime), rule.startTime);
  const workingEnd = localDateTime(dateKey(startTime), rule.endTime);
  if (
    startTime < workingStart ||
    endTime > workingEnd ||
    minutesBetween(startTime, endTime) < rule.minDurationMinutes
  ) {
    return "Выбранное время находится вне рабочего расписания.";
  }

  const bufferedStart = addMinutes(startTime, -rule.bufferBeforeMinutes);
  const bufferedEnd = addMinutes(endTime, rule.bufferAfterMinutes);
  const [events, holds, bookings] = await Promise.all([
    db.calendarEvent.findMany({
      where: {
        ...ownerWhere(owner),
        status: CalendarEventStatus.BUSY,
        bookingId: options.ignoreBookingId ? { not: options.ignoreBookingId } : undefined,
        startTime: { lt: bufferedEnd },
        endTime: { gt: bufferedStart }
      }
    }),
    db.availabilityHold.findMany({
      where: {
        ...ownerWhere(owner),
        status: AvailabilityHoldStatus.ACTIVE,
        expiresAt: { gt: new Date() },
        bookingId: options.ignoreBookingId ? { not: options.ignoreBookingId } : undefined,
        startTime: { lt: bufferedEnd },
        endTime: { gt: bufferedStart }
      }
    }),
    db.booking.findMany({
      where: {
        id: options.ignoreBookingId ? { not: options.ignoreBookingId } : undefined,
        ...(owner.type === "PHOTOGRAPHER"
          ? { photographerId: owner.photographerProfileId }
          : { studioHallId: owner.studioHallId }),
        status: { notIn: [BookingStatus.CANCELLED, BookingStatus.DECLINED] },
        OR: [
          {
            paymentStatus: {
              in: [
                BookingPaymentStatus.DEPOSIT_PAID,
                BookingPaymentStatus.FINAL_PAYMENT_PENDING,
                BookingPaymentStatus.FULLY_PAID
              ]
            }
          },
          { status: { in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS] } }
        ]
      },
      select: { id: true, date: true, startTime: true, endTime: true }
    })
  ]);

  if (
    events.some((event) =>
      rangesOverlap(
        bufferedStart,
        bufferedEnd,
        addMinutes(event.startTime, -event.bufferBeforeMinutes),
        addMinutes(event.endTime, event.bufferAfterMinutes)
      )
    ) ||
    holds.some((hold) =>
      rangesOverlap(bufferedStart, bufferedEnd, hold.startTime, hold.endTime)
    ) ||
    bookings.some((booking) => {
      const bookingDate = dateKey(booking.date);
      return rangesOverlap(
        bufferedStart,
        bufferedEnd,
        localDateTime(bookingDate, booking.startTime),
        localDateTime(bookingDate, booking.endTime)
      );
    })
  ) {
    return "Это время уже занято. Выберите другой слот.";
  }

  return null;
}
