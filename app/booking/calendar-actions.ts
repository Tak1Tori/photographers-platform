"use server";

import {
  AvailabilityHoldStatus,
  BookingPaymentStatus,
  BookingStatus,
  BookingType,
  CalendarEventStatus,
  UserRole
} from "@prisma/client";
import { getSession } from "@/lib/auth";
import { getAvailableSlots, ownerWhere } from "@/lib/calendar/availability-service";
import { expireOldHolds } from "@/lib/calendar/hold-service";
import { createHoldsForBooking } from "@/lib/calendar/hold-service";
import {
  addMinutes,
  dateKey,
  dayRange,
  localDateTime,
  minutesFromTime,
  timeFromMinutes,
  timeLabel,
  weekdayInAlmaty
} from "@/lib/calendar/time-utils";
import { prisma } from "@/lib/prisma";
import type { AvailableSlot, CalendarOwner, ClientAvailableSlot } from "@/lib/calendar/types";

export interface AvailableSlotsRequest {
  bookingType: BookingType;
  date: string;
  durationMinutes: number;
  photographerId?: string;
  studioHallId?: string;
}

export interface BookingCalendarDay {
  date: string;
  status: "AVAILABLE" | "UNAVAILABLE" | "PAST";
  availableCount: number;
  firstSlotLabel?: string;
  lastSlotEndLabel?: string;
}

export interface BookingCalendarRequest
  extends Omit<AvailableSlotsRequest, "date"> {
  month: string;
}

export interface ClientBookingSlot extends ClientAvailableSlot {
  status: "AVAILABLE" | "BUSY" | "UNAVAILABLE";
}

export async function getBookingCalendarDaysAction(
  input: BookingCalendarRequest
): Promise<{ success: boolean; days: BookingCalendarDay[]; error?: string }> {
  try {
    const session = await getSession();
    if (
      !session?.user ||
      (session.user.role !== UserRole.CLIENT && session.user.role !== UserRole.ADMIN)
    ) {
      return {
        success: false,
        days: [],
        error: "Войдите как клиент, чтобы увидеть календарь."
      };
    }
    if (!/^\d{4}-\d{2}$/.test(input.month)) {
      return { success: false, days: [], error: "Некорректный месяц." };
    }
    if (
      !Number.isInteger(input.durationMinutes) ||
      input.durationMinutes < 30 ||
      input.durationMinutes > 12 * 60
    ) {
      return { success: false, days: [], error: "Некорректная длительность." };
    }

    await expireOldHolds();

    const today = dateKey(new Date());
    const monthStart = new Date(`${input.month}-01T12:00:00+05:00`);
    const daysInMonth = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() + 1,
      0
    ).getDate();
    const days: BookingCalendarDay[] = [];

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${input.month}-${String(day).padStart(2, "0")}`;
      if (date < today) {
        days.push({ date, status: "PAST", availableCount: 0 });
        continue;
      }

      const slots = await getCalendarPreviewSlots(input, date);
      days.push({
        date,
        status: slots.length > 0 ? "AVAILABLE" : "UNAVAILABLE",
        availableCount: slots.length,
        firstSlotLabel: slots[0]?.startLabel,
        lastSlotEndLabel: slots.at(-1)?.endLabel
      });
    }

    return { success: true, days };
  } catch (error) {
    return {
      success: false,
      days: [],
      error: error instanceof Error ? error.message : "Не удалось загрузить календарь."
    };
  }
}

export async function getBookingDaySlotsAction(
  input: AvailableSlotsRequest
): Promise<{ success: boolean; slots: ClientBookingSlot[]; error?: string }> {
  try {
    const session = await getSession();
    if (
      !session?.user ||
      (session.user.role !== UserRole.CLIENT && session.user.role !== UserRole.ADMIN)
    ) {
      return {
        success: false,
        slots: [],
        error: "Войдите как клиент, чтобы увидеть свободное время."
      };
    }
    validateSlotsRequest(input);

    await expireOldHolds();

    const baseOwner = getBaseCalendarOwner(input);
    const allSlots = await getAllCandidateSlots(
      baseOwner,
      input.date,
      input.durationMinutes
    );
    const availableSlots = await getAvailableBookingSlots(input);
    const availableKeys = new Set(
      availableSlots.map((slot) => `${slot.startLabel}-${slot.endLabel}`)
    );
    const busyKeys = await getBusySlotKeys(input, allSlots);

    return {
      success: true,
      slots: allSlots.map((slot) => {
        const key = `${slot.startLabel}-${slot.endLabel}`;
        return {
          value: slot.startLabel,
          label: slot.startLabel,
          endLabel: slot.endLabel,
          status: availableKeys.has(key)
            ? "AVAILABLE"
            : busyKeys.has(key)
              ? "BUSY"
              : "UNAVAILABLE"
        };
      })
    };
  } catch (error) {
    return {
      success: false,
      slots: [],
      error: error instanceof Error ? error.message : "Не удалось загрузить слоты."
    };
  }
}

export async function getAvailableSlotsAction(
  input: AvailableSlotsRequest
): Promise<{ success: boolean; slots: ClientAvailableSlot[]; error?: string }> {
  try {
    const session = await getSession();
    if (
      !session?.user ||
      (session.user.role !== UserRole.CLIENT && session.user.role !== UserRole.ADMIN)
    ) {
      return {
        success: false,
        slots: [],
        error: "Войдите как клиент, чтобы увидеть свободное время."
      };
    }
    validateSlotsRequest(input);

    await expireOldHolds();

    const slots = await getAvailableBookingSlots(input);
    return { success: true, slots: serialize(slots) };
  } catch (error) {
    return {
      success: false,
      slots: [],
      error: error instanceof Error ? error.message : "Не удалось загрузить слоты."
    };
  }
}

export const requestAvailableSlotsForFullShootAction = getAvailableSlotsAction;

export async function createHoldForBookingAction(bookingId: string) {
  try {
    const session = await getSession();
    if (!session?.user) return { success: false, error: "Необходимо войти." };
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { clientId: true }
    });
    if (
      !booking ||
      (session.user.role !== UserRole.ADMIN && booking.clientId !== session.user.id)
    ) {
      return { success: false, error: "Бронь не найдена." };
    }
    const holds = await createHoldsForBooking(bookingId);
    return { success: true, holdIds: holds.map((hold) => hold.id) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Не удалось удержать время."
    };
  }
}

export async function expireOldHoldsAction() {
  const session = await getSession();
  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    return { success: false, error: "Недостаточно прав." };
  }
  const result = await expireOldHolds();
  return { success: true, expired: result.count };
}

function serialize(
  slots: Awaited<ReturnType<typeof getAvailableSlots>>
): ClientAvailableSlot[] {
  return slots.map((slot) => ({
    value: slot.startLabel,
    label: slot.startLabel,
    endLabel: slot.endLabel
  }));
}

async function getCalendarPreviewSlots(input: BookingCalendarRequest, date: string) {
  if (input.photographerId) {
    const slots = await getAvailableSlots({
      owner: {
        type: "PHOTOGRAPHER",
        photographerProfileId: input.photographerId
      },
      date,
      durationMinutes: input.durationMinutes
    }, undefined, { cleanupExpiredHolds: false });
    return slots.filter(isFullHourSlot);
  }

  if (input.studioHallId) {
    const slots = await getAvailableSlots({
      owner: { type: "STUDIO_HALL", studioHallId: input.studioHallId },
      date,
      durationMinutes: input.durationMinutes
    }, undefined, { cleanupExpiredHolds: false });
    return slots.filter(isFullHourSlot);
  }

  throw new Error("Для календаря выберите фотографа или зал.");
}

function validateSlotsRequest(input: AvailableSlotsRequest) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new Error("Выберите дату.");
  }
  if (
    !Number.isInteger(input.durationMinutes) ||
    input.durationMinutes < 30 ||
    input.durationMinutes > 12 * 60
  ) {
    throw new Error("Некорректная длительность.");
  }
}

function getBaseCalendarOwner(input: AvailableSlotsRequest): CalendarOwner {
  if (input.photographerId) {
    return {
      type: "PHOTOGRAPHER",
      photographerProfileId: input.photographerId
    };
  }

  if (input.studioHallId) {
    return { type: "STUDIO_HALL", studioHallId: input.studioHallId };
  }

  throw new Error("Для календаря выберите фотографа или зал.");
}

async function getAvailableBookingSlots(input: AvailableSlotsRequest) {
  if (input.bookingType === BookingType.PHOTOGRAPHER_ONLY) {
    if (!input.photographerId) throw new Error("Фотограф не выбран.");
    const slots = await getAvailableSlots({
      owner: {
        type: "PHOTOGRAPHER",
        photographerProfileId: input.photographerId
      },
      date: input.date,
      durationMinutes: input.durationMinutes
    }, undefined, { cleanupExpiredHolds: false });
    return slots.filter(isFullHourSlot);
  }

  if (input.bookingType === BookingType.STUDIO_ONLY) {
    if (!input.studioHallId) throw new Error("Зал не выбран.");
    const slots = await getAvailableSlots({
      owner: { type: "STUDIO_HALL", studioHallId: input.studioHallId },
      date: input.date,
      durationMinutes: input.durationMinutes
    }, undefined, { cleanupExpiredHolds: false });
    return slots.filter(isFullHourSlot);
  }

  if (!input.photographerId || !input.studioHallId) {
    throw new Error("Для съёмки под ключ выберите фотографа и зал.");
  }

  const [photographerSlots, hallSlots] = await Promise.all([
    getAvailableSlots({
      owner: {
        type: "PHOTOGRAPHER",
        photographerProfileId: input.photographerId
      },
      date: input.date,
      durationMinutes: input.durationMinutes
    }, undefined, { cleanupExpiredHolds: false }),
    getAvailableSlots({
      owner: { type: "STUDIO_HALL", studioHallId: input.studioHallId },
      date: input.date,
      durationMinutes: input.durationMinutes
    }, undefined, { cleanupExpiredHolds: false })
  ]);
  const hourlyHallSlots = hallSlots.filter(isFullHourSlot);
  const hallStarts = new Map(hourlyHallSlots.map((slot) => [slot.startLabel, slot]));
  return photographerSlots.filter(isFullHourSlot).filter((slot) => {
    const hallSlot = hallStarts.get(slot.startLabel);
    return hallSlot?.endLabel === slot.endLabel;
  });
}

async function getBusySlotKeys(input: AvailableSlotsRequest, slots: AvailableSlot[]) {
  const owners = getCalendarOwnersForRequest(input);
  const busyRanges = (
    await Promise.all(owners.map((owner) => getActualBusyRanges(owner, input.date)))
  ).flat();
  const keys = new Set<string>();

  for (const slot of slots) {
    const isExactBusyRange = busyRanges.some((range) =>
      sameTimeRange(slot.startTime, slot.endTime, range.startTime, range.endTime)
    );
    if (isExactBusyRange) {
      keys.add(`${slot.startLabel}-${slot.endLabel}`);
    }
  }

  return keys;
}

async function getActualBusyRanges(owner: CalendarOwner, date: string) {
  const range = dayRange(date);
  const [events, holds, bookings] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: {
        ...ownerWhere(owner),
        status: CalendarEventStatus.BUSY,
        startTime: { lt: range.endTime },
        endTime: { gt: range.startTime }
      },
      select: { startTime: true, endTime: true }
    }),
    prisma.availabilityHold.findMany({
      where: {
        ...ownerWhere(owner),
        status: AvailabilityHoldStatus.ACTIVE,
        expiresAt: { gt: new Date() },
        startTime: { lt: range.endTime },
        endTime: { gt: range.startTime }
      },
      select: { startTime: true, endTime: true }
    }),
    prisma.booking.findMany({
      where: {
        ...(owner.type === "PHOTOGRAPHER"
          ? { photographerId: owner.photographerProfileId }
          : { studioHallId: owner.studioHallId }),
        date: new Date(`${date}T00:00:00.000Z`),
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

  return [
    ...events,
    ...holds,
    ...bookings.map((booking) => {
      const bookingDate = dateKey(booking.date);
      return {
        startTime: localDateTime(bookingDate, booking.startTime),
        endTime: localDateTime(bookingDate, booking.endTime)
      };
    })
  ];
}

function sameTimeRange(
  firstStart: Date,
  firstEnd: Date,
  secondStart: Date,
  secondEnd: Date
) {
  return (
    firstStart.getTime() === secondStart.getTime() &&
    firstEnd.getTime() === secondEnd.getTime()
  );
}

function isFullHourSlot(slot: Pick<AvailableSlot, "startLabel">) {
  return minutesFromTime(slot.startLabel) % 60 === 0;
}

function getCalendarOwnersForRequest(input: AvailableSlotsRequest): CalendarOwner[] {
  if (input.bookingType === BookingType.PHOTOGRAPHER_ONLY) {
    if (!input.photographerId) throw new Error("Фотограф не выбран.");
    return [{ type: "PHOTOGRAPHER", photographerProfileId: input.photographerId }];
  }

  if (input.bookingType === BookingType.STUDIO_ONLY) {
    if (!input.studioHallId) throw new Error("Зал не выбран.");
    return [{ type: "STUDIO_HALL", studioHallId: input.studioHallId }];
  }

  if (!input.photographerId || !input.studioHallId) {
    throw new Error("Для съёмки под ключ выберите фотографа и зал.");
  }

  return [
    { type: "PHOTOGRAPHER", photographerProfileId: input.photographerId },
    { type: "STUDIO_HALL", studioHallId: input.studioHallId }
  ];
}

async function getAllCandidateSlots(
  owner: CalendarOwner,
  date: string,
  durationMinutes: number
): Promise<AvailableSlot[]> {
  const weekday = weekdayInAlmaty(localDateTime(date, "12:00"));
  const rule = await prisma.availabilityRule.findFirst({
    where:
      owner.type === "PHOTOGRAPHER"
        ? {
            ownerType: owner.type,
            photographerProfileId: owner.photographerProfileId,
            weekday,
            isActive: true
          }
        : {
            ownerType: owner.type,
            studioHallId: owner.studioHallId,
            weekday,
            isActive: true
          }
  });

  if (!rule || durationMinutes < rule.minDurationMinutes) return [];

  const startMinute = minutesFromTime(rule.startTime);
  const endMinute = minutesFromTime(rule.endTime);
  if (endMinute <= startMinute) return [];

  const slots: AvailableSlot[] = [];
  const firstWholeHour = Math.ceil(startMinute / 60) * 60;
  for (
    let candidateMinute = firstWholeHour;
    candidateMinute + durationMinutes <= endMinute;
    candidateMinute += 60
  ) {
    const startTime = localDateTime(date, timeFromMinutes(candidateMinute));
    const endTime = addMinutes(startTime, durationMinutes);
    slots.push({
      startTime,
      endTime,
      startLabel: timeLabel(startTime),
      endLabel: timeLabel(endTime)
    });
  }

  return slots;
}
