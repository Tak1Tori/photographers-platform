"use server";

import { CalendarEventSource, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import {
  createManualBusyEvent,
  deleteManualBusyEvent
} from "@/lib/calendar/calendar-service";
import { upsertAvailabilityRule } from "@/lib/calendar/availability-service";
import { localDateTime } from "@/lib/calendar/time-utils";
import { prisma } from "@/lib/prisma";
import type { AvailabilityRuleInput, CalendarOwner } from "@/lib/calendar/types";

type ActionResult = { success: boolean; error?: string };

export async function createManualBusyEventAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { session, owner } = await requireOwnedCalendar(formData);
    const date = String(formData.get("date") ?? "");
    const start = String(formData.get("startTime") ?? "");
    const end = String(formData.get("endTime") ?? "");
    const title = String(formData.get("title") ?? "").trim();
    const privateNote = String(formData.get("privateNote") ?? "").trim();
    if (!date || !start || !end) throw new Error("Заполните дату и время.");

    await createManualBusyEvent({
      owner,
      startTime: localDateTime(date, start),
      endTime: localDateTime(date, end),
      title,
      privateNote,
      createdById: session.user.id
    });
    revalidateCalendars();
    return { success: true };
  } catch (error) {
    return { success: false, error: getMessage(error) };
  }
}

export async function deleteManualBusyEventAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { owner } = await requireOwnedCalendar(formData);
    const eventId = String(formData.get("eventId") ?? "");
    const event = await prisma.calendarEvent.findUnique({ where: { id: eventId } });
    if (
      !event ||
      event.source !== CalendarEventSource.MANUAL_BUSY ||
      (owner.type === "PHOTOGRAPHER"
        ? event.photographerProfileId !== owner.photographerProfileId
        : event.studioHallId !== owner.studioHallId)
    ) {
      throw new Error("Событие не найдено.");
    }
    await deleteManualBusyEvent(eventId);
    revalidateCalendars();
    return { success: true };
  } catch (error) {
    return { success: false, error: getMessage(error) };
  }
}

export async function updateAvailabilityRuleAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { owner } = await requireOwnedCalendar(formData);
    const weekday = Number(formData.get("weekday"));
    const input: AvailabilityRuleInput = {
      startTime: String(formData.get("startTime") ?? ""),
      endTime: String(formData.get("endTime") ?? ""),
      isActive: formData.get("isActive") === "on",
      minDurationMinutes: Number(formData.get("minDurationMinutes") ?? 60),
      slotStepMinutes: Number(formData.get("slotStepMinutes") ?? 30),
      bufferBeforeMinutes: Number(formData.get("bufferBeforeMinutes") ?? 0),
      bufferAfterMinutes: Number(formData.get("bufferAfterMinutes") ?? 0)
    };
    await upsertAvailabilityRule(owner, weekday, input);
    revalidateCalendars();
    return { success: true };
  } catch (error) {
    return { success: false, error: getMessage(error) };
  }
}

async function requireOwnedCalendar(formData: FormData) {
  const session = await getSession();
  if (!session?.user) throw new Error("Необходимо войти в аккаунт.");
  const ownerType = String(formData.get("ownerType") ?? "");
  const ownerId = String(formData.get("ownerId") ?? "");

  if (ownerType === "PHOTOGRAPHER") {
    if (
      session.user.role !== UserRole.PHOTOGRAPHER &&
      session.user.role !== UserRole.ADMIN
    ) {
      throw new Error("Недостаточно прав.");
    }
    const profile = await prisma.photographerProfile.findUnique({
      where: { id: ownerId },
      select: { id: true, userId: true }
    });
    if (!profile || (session.user.role !== UserRole.ADMIN && profile.userId !== session.user.id)) {
      throw new Error("Календарь фотографа не найден.");
    }
    return {
      session,
      owner: {
        type: "PHOTOGRAPHER",
        photographerProfileId: profile.id
      } satisfies CalendarOwner
    };
  }

  if (ownerType === "STUDIO_HALL") {
    if (
      session.user.role !== UserRole.STUDIO_OWNER &&
      session.user.role !== UserRole.ADMIN
    ) {
      throw new Error("Недостаточно прав.");
    }
    const hall = await prisma.studioHall.findUnique({
      where: { id: ownerId },
      select: { id: true, studio: { select: { ownerId: true } } }
    });
    if (
      !hall ||
      (session.user.role !== UserRole.ADMIN && hall.studio.ownerId !== session.user.id)
    ) {
      throw new Error("Зал не найден.");
    }
    return {
      session,
      owner: { type: "STUDIO_HALL", studioHallId: hall.id } satisfies CalendarOwner
    };
  }

  throw new Error("Некорректный календарь.");
}

function revalidateCalendars() {
  revalidatePath("/dashboard/photographer");
  revalidatePath("/dashboard/photographer/calendar");
  revalidatePath("/dashboard/studio");
  revalidatePath("/dashboard/studio/calendar");
  revalidatePath("/booking");
  revalidatePath("/booking/new");
}

function getMessage(error: unknown) {
  return error instanceof Error ? error.message : "Не удалось обновить календарь.";
}
