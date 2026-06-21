import {
  AvailabilityHoldStatus,
  BookingType,
  Prisma,
  type PrismaClient
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertNoCalendarConflict } from "@/lib/calendar/conflict-service";
import { dateKey, localDateTime } from "@/lib/calendar/time-utils";
import type { CalendarOwner } from "@/lib/calendar/types";

type DbClient = Prisma.TransactionClient | PrismaClient;
const holdDurationMs = 15 * 60_000;

export async function createAvailabilityHold(
  owner: CalendarOwner,
  userId: string | undefined,
  startTime: Date,
  endTime: Date,
  bookingId?: string,
  db: DbClient = prisma
) {
  await assertNoCalendarConflict(owner, startTime, endTime, db, {
    ignoreBookingId: bookingId
  });
  return db.availabilityHold.create({
    data: {
      ownerType: owner.type,
      photographerProfileId: owner.photographerProfileId,
      studioHallId: owner.studioHallId,
      bookingId,
      userId,
      startTime,
      endTime,
      expiresAt: new Date(Date.now() + holdDurationMs)
    }
  });
}

export async function createHoldsForBooking(bookingId: string) {
  return prisma.$transaction(
    async (tx) => {
      await expireOldHolds(tx);
      const booking = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!booking) throw new Error("Booking not found");
      if (!booking.clientId) throw new Error("Для удержания времени нужен клиент.");

      const bookingDate = dateKey(booking.date);
      const startTime = localDateTime(bookingDate, booking.startTime);
      const endTime = localDateTime(bookingDate, booking.endTime);
      const owners: CalendarOwner[] = [];

      if (
        booking.bookingType !== BookingType.STUDIO_ONLY &&
        booking.photographerId
      ) {
        owners.push({
          type: "PHOTOGRAPHER",
          photographerProfileId: booking.photographerId
        });
      }
      if (
        booking.bookingType !== BookingType.PHOTOGRAPHER_ONLY &&
        booking.studioHallId
      ) {
        owners.push({ type: "STUDIO_HALL", studioHallId: booking.studioHallId });
      }
      if (owners.length === 0) throw new Error("Для брони не выбран календарь.");

      const holds = [];
      for (const owner of owners) {
        holds.push(
          await createAvailabilityHold(
            owner,
            booking.clientId,
            startTime,
            endTime,
            booking.id,
            tx
          )
        );
      }
      return holds;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function convertHoldToBooking(
  holdId: string,
  bookingId: string,
  db: DbClient = prisma
) {
  return db.availabilityHold.update({
    where: { id: holdId },
    data: { bookingId, status: AvailabilityHoldStatus.CONVERTED }
  });
}

export async function convertBookingHolds(bookingId: string, db: DbClient = prisma) {
  return db.availabilityHold.updateMany({
    where: {
      bookingId,
      status: AvailabilityHoldStatus.ACTIVE,
      expiresAt: { gt: new Date() }
    },
    data: { status: AvailabilityHoldStatus.CONVERTED }
  });
}

export async function expireOldHolds(db: DbClient = prisma) {
  return db.availabilityHold.updateMany({
    where: {
      status: AvailabilityHoldStatus.ACTIVE,
      expiresAt: { lt: new Date() }
    },
    data: { status: AvailabilityHoldStatus.EXPIRED }
  });
}

export async function cancelHold(holdId: string, db: DbClient = prisma) {
  return db.availabilityHold.update({
    where: { id: holdId },
    data: { status: AvailabilityHoldStatus.CANCELLED }
  });
}

export async function cancelBookingHolds(bookingId: string, db: DbClient = prisma) {
  return db.availabilityHold.updateMany({
    where: { bookingId, status: AvailabilityHoldStatus.ACTIVE },
    data: { status: AvailabilityHoldStatus.CANCELLED }
  });
}

export async function getActiveHoldForBooking(bookingId: string) {
  await expireOldHolds();
  return prisma.availabilityHold.findFirst({
    where: {
      bookingId,
      status: AvailabilityHoldStatus.ACTIVE,
      expiresAt: { gt: new Date() }
    }
  });
}
