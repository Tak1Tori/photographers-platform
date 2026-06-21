import {
  AvailabilityHoldStatus,
  BookingType,
  CalendarEventSource,
  CalendarEventStatus,
  type Prisma,
  type PrismaClient
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAvailabilityRules, ownerWhere } from "@/lib/calendar/availability-service";
import { dateKey, localDateTime, weekdayInAlmaty } from "@/lib/calendar/time-utils";
import type {
  CalendarOwner,
  DashboardCalendarEvent,
  ManualBusyEventInput,
  TimeRange
} from "@/lib/calendar/types";

type DbClient = Prisma.TransactionClient | PrismaClient;

export function createManualBusyEvent(input: ManualBusyEventInput) {
  if (input.endTime <= input.startTime) {
    throw new Error("Время окончания должно быть позже начала.");
  }
  return prisma.calendarEvent.create({
    data: {
      ownerType: input.owner.type,
      photographerProfileId: input.owner.photographerProfileId,
      studioHallId: input.owner.studioHallId,
      source: CalendarEventSource.MANUAL_BUSY,
      title: input.title?.trim() || "Занято",
      privateNote: input.privateNote?.trim() || null,
      startTime: input.startTime,
      endTime: input.endTime,
      createdById: input.createdById
    }
  });
}

export async function updateManualBusyEvent(
  eventId: string,
  input: Omit<ManualBusyEventInput, "owner">
) {
  return prisma.calendarEvent.update({
    where: { id: eventId },
    data: {
      title: input.title?.trim() || "Занято",
      privateNote: input.privateNote?.trim() || null,
      startTime: input.startTime,
      endTime: input.endTime
    }
  });
}

export async function deleteManualBusyEvent(eventId: string) {
  return prisma.calendarEvent.update({
    where: { id: eventId },
    data: { status: CalendarEventStatus.CANCELLED }
  });
}

export function getCalendarEventsForOwner(owner: CalendarOwner, range: TimeRange) {
  return prisma.calendarEvent.findMany({
    where: {
      ...ownerWhere(owner),
      status: CalendarEventStatus.BUSY,
      startTime: { lt: range.endTime },
      endTime: { gt: range.startTime }
    },
    orderBy: { startTime: "asc" }
  });
}

export async function getCalendarEventsForDashboard(
  owner: CalendarOwner,
  range: TimeRange
): Promise<DashboardCalendarEvent[]> {
  const [events, holds] = await Promise.all([
    getCalendarEventsForOwner(owner, range),
    prisma.availabilityHold.findMany({
      where: {
        ...ownerWhere(owner),
        status: AvailabilityHoldStatus.ACTIVE,
        expiresAt: { gt: new Date() },
        startTime: { lt: range.endTime },
        endTime: { gt: range.startTime }
      },
      orderBy: { startTime: "asc" }
    })
  ]);

  return [
    ...events.map((event) => ({
      id: event.id,
      source: event.source,
      title:
        event.source === CalendarEventSource.PLATFORM_BOOKING
          ? "Бронь платформы"
          : event.title || "Занято",
      privateNote: event.privateNote ?? undefined,
      startTime: event.startTime,
      endTime: event.endTime,
      canDelete: event.source === CalendarEventSource.MANUAL_BUSY
    })),
    ...holds.map((hold) => ({
      id: hold.id,
      source: "ACTIVE_HOLD" as const,
      title: "Время удерживается",
      startTime: hold.startTime,
      endTime: hold.endTime,
      canDelete: false
    }))
  ].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

export async function createPlatformBookingEvent(
  bookingId: string,
  db: DbClient = prisma
) {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error("Booking not found");
  const date = dateKey(booking.date);
  const startTime = localDateTime(date, booking.startTime);
  const endTime = localDateTime(date, booking.endTime);
  const owners: CalendarOwner[] = [];
  if (booking.bookingType !== BookingType.STUDIO_ONLY && booking.photographerId) {
    owners.push({ type: "PHOTOGRAPHER", photographerProfileId: booking.photographerId });
  }
  if (booking.bookingType !== BookingType.PHOTOGRAPHER_ONLY && booking.studioHallId) {
    owners.push({ type: "STUDIO_HALL", studioHallId: booking.studioHallId });
  }

  const created = [];
  for (const owner of owners) {
    const existing = await db.calendarEvent.findFirst({
      where: {
        ...ownerWhere(owner),
        bookingId,
        source: CalendarEventSource.PLATFORM_BOOKING
      }
    });
    const rules = await getAvailabilityRules(owner, db);
    const rule = rules.find((item) => item.weekday === weekdayInAlmaty(startTime));
    const data = {
      status: CalendarEventStatus.BUSY,
      startTime,
      endTime,
      bufferBeforeMinutes: rule?.bufferBeforeMinutes ?? 0,
      bufferAfterMinutes: rule?.bufferAfterMinutes ?? 0
    };
    created.push(
      existing
        ? await db.calendarEvent.update({ where: { id: existing.id }, data })
        : await db.calendarEvent.create({
            data: {
              ...data,
              ownerType: owner.type,
              photographerProfileId: owner.photographerProfileId,
              studioHallId: owner.studioHallId,
              bookingId,
              source: CalendarEventSource.PLATFORM_BOOKING,
              title: `Бронь ${booking.bookingNumber}`
            }
          })
    );
  }
  return created;
}

export function cancelPlatformBookingEvent(
  bookingId: string,
  db: DbClient = prisma
) {
  return db.calendarEvent.updateMany({
    where: { bookingId, source: CalendarEventSource.PLATFORM_BOOKING },
    data: { status: CalendarEventStatus.CANCELLED }
  });
}
