"use server";

import { BookingType, UserRole } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { getAvailableSlots } from "@/lib/calendar/availability-service";
import { expireOldHolds } from "@/lib/calendar/hold-service";
import { createHoldsForBooking } from "@/lib/calendar/hold-service";
import { prisma } from "@/lib/prisma";
import type { ClientAvailableSlot } from "@/lib/calendar/types";

export interface AvailableSlotsRequest {
  bookingType: BookingType;
  date: string;
  durationMinutes: number;
  photographerId?: string;
  studioHallId?: string;
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      return { success: false, slots: [], error: "Выберите дату." };
    }
    if (
      !Number.isInteger(input.durationMinutes) ||
      input.durationMinutes < 30 ||
      input.durationMinutes > 12 * 60
    ) {
      return { success: false, slots: [], error: "Некорректная длительность." };
    }

    await expireOldHolds();

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
      return { success: true, slots: serialize(slots) };
    }

    if (input.bookingType === BookingType.STUDIO_ONLY) {
      if (!input.studioHallId) throw new Error("Зал не выбран.");
      const slots = await getAvailableSlots({
        owner: { type: "STUDIO_HALL", studioHallId: input.studioHallId },
        date: input.date,
        durationMinutes: input.durationMinutes
      }, undefined, { cleanupExpiredHolds: false });
      return { success: true, slots: serialize(slots) };
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
    const hallStarts = new Map(hallSlots.map((slot) => [slot.startLabel, slot]));
    const intersection = photographerSlots.filter((slot) => {
      const hallSlot = hallStarts.get(slot.startLabel);
      return hallSlot?.endLabel === slot.endLabel;
    });
    return { success: true, slots: serialize(intersection) };
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
