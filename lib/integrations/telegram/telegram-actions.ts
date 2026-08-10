// Deprecated: Telegram now works as notification-only. These legacy calendar
// assistant actions are kept for historical data compatibility.
import {
  AvailabilityHoldStatus,
  BookingPaymentStatus,
  BookingStatus,
  CalendarDraftStatus,
  CalendarEventSource,
  CalendarEventStatus,
  CalendarDraftSource,
  CalendarOwnerType,
  type ExternalMessage
} from "@prisma/client";
import { ownerWhere } from "@/lib/calendar/availability-service";
import { dateKey, localDateTime } from "@/lib/calendar/time-utils";
import { prisma } from "@/lib/prisma";
import type {
  CalendarDraftWithMessage,
  ConnectedExternalChannel,
  ParsedCalendarIntent,
  TelegramUser
} from "@/lib/integrations/telegram/types";
import { ensureDraftCanBeConfirmed } from "@/lib/integrations/telegram/telegram-security";

type DraftOwnerInput =
  | { type: "PHOTOGRAPHER"; photographerProfileId: string; createdById?: string }
  | { type: "STUDIO_HALL"; studioHallId: string; createdById?: string };

export async function createCalendarDraftFromMessage(
  channel: ConnectedExternalChannel,
  parsed: ParsedCalendarIntent,
  message: ExternalMessage,
  owner?: DraftOwnerInput
) {
  if (!parsed.date || !parsed.startTime || !parsed.endTime || parsed.confidence < 70) {
    throw new Error("Не удалось уверенно распознать дату и время.");
  }

  const draftOwner = owner ?? resolveDefaultDraftOwner(channel);
  const startTime = localDateTime(parsed.date, parsed.startTime);
  const endTime = localDateTime(parsed.date, parsed.endTime);
  const title = parsed.title?.trim() || "Занято";

  return prisma.calendarDraft.create({
    data: {
      source: CalendarDraftSource.TELEGRAM,
      ownerType: draftOwner.type,
      photographerProfileId:
        draftOwner.type === "PHOTOGRAPHER" ? draftOwner.photographerProfileId : undefined,
      studioHallId: draftOwner.type === "STUDIO_HALL" ? draftOwner.studioHallId : undefined,
      externalMessageId: message.id,
      title,
      originalText: message.text ?? "",
      parsedStartTime: startTime,
      parsedEndTime: endTime,
      confidence: parsed.confidence,
      status: CalendarDraftStatus.PENDING,
      createdById: draftOwner.createdById,
      expiresAt: new Date(Date.now() + 30 * 60_000)
    }
  });
}

export async function confirmCalendarDraft(draftId: string, telegramUser: TelegramUser) {
  const draft = await getDraftWithMessage(draftId);
  ensureDraftCanBeConfirmed(draft, telegramUser);
  const event = await createCalendarEventFromDraft(draftId);
  return event;
}

export async function rejectCalendarDraft(draftId: string, telegramUser: TelegramUser) {
  const draft = await getDraftWithMessage(draftId);
  ensureDraftCanBeConfirmed(draft, telegramUser);
  return prisma.calendarDraft.update({
    where: { id: draftId },
    data: {
      status: CalendarDraftStatus.REJECTED,
      rejectedAt: new Date()
    }
  });
}

export async function createCalendarEventFromDraft(draftId: string) {
  return prisma.$transaction(async (tx) => {
    const draft = await tx.calendarDraft.findUnique({
      where: { id: draftId },
      include: {
        externalMessage: {
          include: {
            channel: {
              include: {
                photographerProfile: {
                  select: { id: true, userId: true, name: true }
                },
                studioProfile: {
                  select: {
                    id: true,
                    ownerId: true,
                    name: true,
                    halls: { select: { id: true, name: true } }
                  }
                }
              }
            }
          }
        }
      }
    });
    if (!draft || draft.status !== CalendarDraftStatus.PENDING) {
      throw new Error("Черновик не найден или уже обработан.");
    }
    if (!draft.parsedStartTime || !draft.parsedEndTime) {
      throw new Error("В черновике нет даты или времени.");
    }

    const owner =
      draft.ownerType === CalendarOwnerType.PHOTOGRAPHER
        ? {
            type: CalendarOwnerType.PHOTOGRAPHER,
            photographerProfileId: draft.photographerProfileId ?? undefined
          }
        : {
            type: CalendarOwnerType.STUDIO_HALL,
            studioHallId: draft.studioHallId ?? undefined
          };

    const hasConflict = await hasCalendarConflict(
      owner,
      draft.parsedStartTime,
      draft.parsedEndTime,
      tx
    );
    if (hasConflict) {
      throw new Error("Это время уже занято. Проверьте календарь.");
    }

    const updated = await tx.calendarDraft.update({
      where: { id: draft.id },
      data: {
        status: CalendarDraftStatus.CONFIRMED,
        confirmedAt: new Date(),
        confirmedById:
          draft.externalMessage?.channel?.photographerProfile?.userId ??
          draft.externalMessage?.channel?.studioProfile?.ownerId ??
          null
      }
    });

    const event = await tx.calendarEvent.create({
      data: {
        ownerType: draft.ownerType,
        photographerProfileId: draft.photographerProfileId,
        studioHallId: draft.studioHallId,
        source: CalendarEventSource.TELEGRAM,
        status: CalendarEventStatus.BUSY,
        title: draft.title?.trim() || "Занято",
        privateNote: draft.originalText,
        startTime: draft.parsedStartTime,
        endTime: draft.parsedEndTime,
        createdById: updated.confirmedById
      }
    });

    if (draft.externalMessageId) {
      await tx.externalMessage.update({
        where: { id: draft.externalMessageId },
        data: { status: "CONFIRMED", processedAt: new Date() }
      });
    }

    return event;
  });
}

export async function hasCalendarConflict(
  owner: { type: CalendarOwnerType; photographerProfileId?: string; studioHallId?: string },
  startTime: Date,
  endTime: Date,
  db: typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0] = prisma
) {
  const where = ownerWhere(owner);
  const [eventCount, holdCount, bookingCount] = await Promise.all([
    db.calendarEvent.count({
      where: {
        ...where,
        status: CalendarEventStatus.BUSY,
        startTime: { lt: endTime },
        endTime: { gt: startTime }
      }
    }),
    db.availabilityHold.count({
      where: {
        ...where,
        status: AvailabilityHoldStatus.ACTIVE,
        expiresAt: { gt: new Date() },
        startTime: { lt: endTime },
        endTime: { gt: startTime }
      }
    }),
    db.booking.count({
      where: {
        ...(owner.type === CalendarOwnerType.PHOTOGRAPHER
          ? { photographerId: owner.photographerProfileId }
          : { studioHallId: owner.studioHallId }),
        date: new Date(`${dateKey(startTime)}T00:00:00.000Z`),
        status: {
          notIn: [
            BookingStatus.CANCELLED,
            BookingStatus.DECLINED,
            BookingStatus.COMPLETED
          ]
        },
        startTime: { lt: timeFromDate(endTime) },
        endTime: { gt: timeFromDate(startTime) },
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
      }
    })
  ]);

  return eventCount + holdCount + bookingCount > 0;
}

function resolveDefaultDraftOwner(channel: ConnectedExternalChannel): DraftOwnerInput {
  if (channel.photographerProfileId && channel.photographerProfile) {
    return {
      type: "PHOTOGRAPHER",
      photographerProfileId: channel.photographerProfileId,
      createdById: channel.photographerProfile.userId
    };
  }

  const halls = channel.studioProfile?.halls ?? [];
  if (channel.studioProfileId && channel.studioProfile && halls.length === 1) {
    return {
      type: "STUDIO_HALL",
      studioHallId: halls[0].id,
      createdById: channel.studioProfile.ownerId
    };
  }

  throw new Error(
    "Укажите зал. Например:\n/busy_hall Loft 28.06 14:00-17:00"
  );
}

async function getDraftWithMessage(draftId: string): Promise<CalendarDraftWithMessage | null> {
  return prisma.calendarDraft.findUnique({
    where: { id: draftId },
    include: {
      externalMessage: {
        include: {
          channel: {
            include: {
              photographerProfile: {
                select: { id: true, userId: true, name: true }
              },
              studioProfile: {
                select: {
                  id: true,
                  ownerId: true,
                  name: true,
                  halls: { select: { id: true, name: true } }
                }
              }
            }
          }
        }
      }
    }
  });
}

function timeFromDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}
