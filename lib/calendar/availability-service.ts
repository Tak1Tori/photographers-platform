import {
  AvailabilityHoldStatus,
  BookingPaymentStatus,
  BookingStatus,
  CalendarEventStatus,
  type Prisma
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { expireOldHolds } from "@/lib/calendar/hold-service";
import {
  addMinutes,
  dateKey,
  dayRange,
  localDateTime,
  minutesFromTime,
  rangesOverlap,
  timeFromMinutes,
  timeLabel,
  weekdayInAlmaty
} from "@/lib/calendar/time-utils";
import type {
  AvailabilityQueryInput,
  AvailabilityRuleInput,
  AvailableSlot,
  CalendarOwner
} from "@/lib/calendar/types";

type DbClient = Prisma.TransactionClient | typeof prisma;

export async function getAvailabilityRules(owner: CalendarOwner, db: DbClient = prisma) {
  return db.availabilityRule.findMany({
    where: ownerWhere(owner),
    orderBy: { weekday: "asc" }
  });
}

export async function upsertAvailabilityRule(
  owner: CalendarOwner,
  weekday: number,
  input: AvailabilityRuleInput
) {
  validateOwner(owner);
  validateRule(weekday, input);
  const existing = await prisma.availabilityRule.findFirst({
    where: { ...ownerWhere(owner), weekday }
  });
  const data = {
    ownerType: owner.type,
    photographerProfileId: owner.photographerProfileId,
    studioHallId: owner.studioHallId,
    weekday,
    ...input
  };

  return existing
    ? prisma.availabilityRule.update({ where: { id: existing.id }, data })
    : prisma.availabilityRule.create({ data });
}

export async function disableAvailabilityRule(ruleId: string) {
  return prisma.availabilityRule.update({
    where: { id: ruleId },
    data: { isActive: false }
  });
}

export async function getAvailableSlots(
  input: AvailabilityQueryInput,
  db: DbClient = prisma,
  options: { cleanupExpiredHolds?: boolean } = {}
): Promise<AvailableSlot[]> {
  validateOwner(input.owner);
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes <= 0) return [];
  if (db === prisma && options.cleanupExpiredHolds !== false) await expireOldHolds();

  const day = weekdayInAlmaty(localDateTime(input.date, "12:00"));
  const rule = await db.availabilityRule.findFirst({
    where: { ...ownerWhere(input.owner), weekday: day, isActive: true }
  });

  if (!rule || input.durationMinutes < rule.minDurationMinutes) return [];

  const startMinute = minutesFromTime(rule.startTime);
  const endMinute = minutesFromTime(rule.endTime);
  if (endMinute <= startMinute) return [];

  const range = dayRange(input.date);
  const [events, holds, bookings] = await Promise.all([
    db.calendarEvent.findMany({
      where: {
        ...ownerWhere(input.owner),
        status: CalendarEventStatus.BUSY,
        startTime: { lt: range.endTime },
        endTime: { gt: range.startTime }
      }
    }),
    db.availabilityHold.findMany({
      where: {
        ...ownerWhere(input.owner),
        status: AvailabilityHoldStatus.ACTIVE,
        expiresAt: { gt: new Date() },
        startTime: { lt: range.endTime },
        endTime: { gt: range.startTime }
      }
    }),
    db.booking.findMany({
      where: {
        ...(input.owner.type === "PHOTOGRAPHER"
          ? { photographerId: input.owner.photographerProfileId }
          : { studioHallId: input.owner.studioHallId }),
        date: new Date(`${input.date}T00:00:00.000Z`),
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
      select: { date: true, startTime: true, endTime: true }
    })
  ]);

  const slots: AvailableSlot[] = [];
  for (
    let candidateMinute = startMinute;
    candidateMinute + input.durationMinutes <= endMinute;
    candidateMinute += rule.slotStepMinutes
  ) {
    const startTime = localDateTime(input.date, timeFromMinutes(candidateMinute));
    const endTime = addMinutes(startTime, input.durationMinutes);
    const candidateStart = addMinutes(startTime, -rule.bufferBeforeMinutes);
    const candidateEnd = addMinutes(endTime, rule.bufferAfterMinutes);
    const conflictsWithEvent = events.some((event) =>
      rangesOverlap(
        candidateStart,
        candidateEnd,
        addMinutes(event.startTime, -event.bufferBeforeMinutes),
        addMinutes(event.endTime, event.bufferAfterMinutes)
      )
    );
    const conflictsWithHold = holds.some((hold) =>
      rangesOverlap(candidateStart, candidateEnd, hold.startTime, hold.endTime)
    );
    const conflictsWithBooking = bookings.some((booking) => {
      const bookingDate = dateKey(booking.date);
      return rangesOverlap(
        candidateStart,
        candidateEnd,
        localDateTime(bookingDate, booking.startTime),
        localDateTime(bookingDate, booking.endTime)
      );
    });

    if (!conflictsWithEvent && !conflictsWithHold && !conflictsWithBooking) {
      slots.push({
        startTime,
        endTime,
        startLabel: timeLabel(startTime),
        endLabel: timeLabel(endTime)
      });
    }
  }

  return slots;
}

export function ownerWhere(owner: CalendarOwner) {
  validateOwner(owner);
  return owner.type === "PHOTOGRAPHER"
    ? { ownerType: owner.type, photographerProfileId: owner.photographerProfileId! }
    : { ownerType: owner.type, studioHallId: owner.studioHallId! };
}

export function validateOwner(owner: CalendarOwner) {
  const photographerOwner =
    owner.type === "PHOTOGRAPHER" &&
    Boolean(owner.photographerProfileId) &&
    !owner.studioHallId;
  const hallOwner =
    owner.type === "STUDIO_HALL" &&
    Boolean(owner.studioHallId) &&
    !owner.photographerProfileId;
  if (!photographerOwner && !hallOwner) throw new Error("Некорректный владелец календаря.");
}

function validateRule(weekday: number, input: AvailabilityRuleInput) {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    throw new Error("Некорректный день недели.");
  }
  const start = minutesFromTime(input.startTime);
  const end = minutesFromTime(input.endTime);
  if (end <= start) throw new Error("Время окончания должно быть позже начала.");
  for (const value of [
    input.minDurationMinutes,
    input.slotStepMinutes,
    input.bufferBeforeMinutes,
    input.bufferAfterMinutes
  ]) {
    if (!Number.isInteger(value) || value < 0) throw new Error("Некорректные параметры расписания.");
  }
  if (input.minDurationMinutes < 1 || input.slotStepMinutes < 1) {
    throw new Error("Минимальная длительность и шаг должны быть больше нуля.");
  }
}
