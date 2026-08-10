import {
  AvailabilityHoldSource,
  AvailabilityHoldStatus,
  BookingLeadStatus,
  BookingPaymentStatus,
  BookingSource,
  BookingStatus,
  BookingType,
  CalendarEventSource,
  CalendarEventStatus,
  CalendarOwnerType,
  ExternalProvider,
  Prisma
} from "@prisma/client";
import { assertNoCalendarConflict } from "@/lib/calendar/conflict-service";
import { dateKey, localDateTime, timeLabel } from "@/lib/calendar/time-utils";
import { createDepositPaymentForBooking } from "@/lib/payments/payment-service";
import { calculateBookingPricing } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import {
  bookingLeadLinkExpiresAt,
  createPublicBookingToken,
  externalBookingUrl
} from "@/lib/booking-leads/external-booking-link-service";
import type {
  BookingLeadWithDetails,
  ExternalBookingClientInput
} from "@/lib/booking-leads/types";
import type {
  ConnectedExternalChannel,
  ParsedBookingLeadIntent
} from "@/lib/integrations/telegram/types";

const leadInclude = {
  photographerProfile: {
    select: { id: true, name: true, city: true, hourlyRate: true }
  },
  studioProfile: {
    select: { id: true, name: true, city: true, address: true }
  },
  studioHall: {
    select: {
      id: true,
      name: true,
      hourlyRate: true,
      capacity: true,
      studio: { select: { id: true, name: true, city: true, address: true } }
    }
  },
  externalMessage: {
    select: { id: true, externalMessageId: true, text: true }
  }
} satisfies Prisma.BookingLeadInclude;

export function getBookingLeadInclude() {
  return leadInclude;
}

export async function createBookingLeadFromTelegram(input: {
  channel: ConnectedExternalChannel;
  parsed: ParsedBookingLeadIntent;
  externalMessageId: string;
  externalSourceMessageId?: string;
  originalText: string;
  studioHallId?: string;
}) {
  if (
    input.parsed.needsClarification ||
    !input.parsed.date ||
    !input.parsed.startTime ||
    !input.parsed.endTime ||
    input.parsed.confidence < 70
  ) {
    throw new Error(input.parsed.clarificationMessage ?? "Не удалось распознать бронь.");
  }

  const owner = resolveLeadOwner(input.channel, input.parsed, input.studioHallId);
  const startTime = localDateTime(input.parsed.date, input.parsed.startTime);
  const endTime = localDateTime(input.parsed.date, input.parsed.endTime);

  return prisma.bookingLead.create({
    data: {
      source: "TELEGRAM",
      provider: ExternalProvider.TELEGRAM,
      externalChannelId: input.channel.id,
      externalMessageId: input.externalMessageId,
      externalSourceMessageId: input.externalSourceMessageId ?? input.externalMessageId,
      ownerType: owner.ownerType,
      bookingType: input.parsed.bookingType,
      photographerProfileId: owner.photographerProfileId,
      studioProfileId: owner.studioProfileId,
      studioHallId: owner.studioHallId,
      clientName: input.parsed.clientName,
      originalText: input.originalText,
      parsedStartTime: startTime,
      parsedEndTime: endTime,
      parsedDurationMinutes: input.parsed.durationMinutes,
      title: input.parsed.title ?? defaultLeadTitle(input.parsed.bookingType),
      notes: input.parsed.notes,
      confidence: input.parsed.confidence,
      status: BookingLeadStatus.NEEDS_CONFIRMATION
    },
    include: leadInclude
  });
}

export async function createExternalBookingLinkForLead(leadId: string) {
  await expireOldBookingLeads();

  return prisma.$transaction(
    async (tx) => {
      const lead = await tx.bookingLead.findUnique({
        where: { id: leadId },
        include: leadInclude
      });
      if (!lead) throw new Error("Заявка не найдена.");
      if (!lead.parsedStartTime || !lead.parsedEndTime) {
        throw new Error("В заявке нет даты или времени.");
      }
      if (
        lead.status === BookingLeadStatus.REJECTED ||
        lead.status === BookingLeadStatus.CANCELLED ||
        lead.status === BookingLeadStatus.CONVERTED_TO_BOOKING
      ) {
        throw new Error("Эта заявка уже обработана.");
      }

      const owner = ownerFromLead(lead);
      await assertNoCalendarConflict(owner, lead.parsedStartTime, lead.parsedEndTime, tx);

      const token = createPublicBookingToken();
      const expiresAt = bookingLeadLinkExpiresAt();
      const hold = await tx.availabilityHold.create({
        data: {
          ownerType: lead.ownerType,
          photographerProfileId: lead.photographerProfileId,
          studioHallId: lead.studioHallId,
          bookingLeadId: lead.id,
          source: AvailabilityHoldSource.TELEGRAM_LEAD,
          startTime: lead.parsedStartTime,
          endTime: lead.parsedEndTime,
          expiresAt,
          status: AvailabilityHoldStatus.ACTIVE
        }
      });

      const updated = await tx.bookingLead.update({
        where: { id: lead.id },
        data: {
          status: BookingLeadStatus.LINK_CREATED,
          publicToken: token,
          publicLinkExpiresAt: expiresAt,
          availabilityHoldId: hold.id,
          confirmedAt: new Date()
        },
        include: leadInclude
      });

      return {
        lead: updated,
        hold,
        url: externalBookingUrl(token)
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function markBookingLeadLinkSent(leadId: string) {
  return prisma.bookingLead.update({
    where: { id: leadId },
    data: { status: BookingLeadStatus.LINK_SENT },
    include: leadInclude
  });
}

export async function rejectBookingLead(leadId: string) {
  return prisma.$transaction(async (tx) => {
    const lead = await tx.bookingLead.findUnique({ where: { id: leadId } });
    if (!lead) throw new Error("Заявка не найдена.");
    if (lead.availabilityHoldId) {
      await tx.availabilityHold.updateMany({
        where: {
          id: lead.availabilityHoldId,
          status: AvailabilityHoldStatus.ACTIVE
        },
        data: { status: AvailabilityHoldStatus.CANCELLED }
      });
    }
    return tx.bookingLead.update({
      where: { id: lead.id },
      data: {
        status: BookingLeadStatus.REJECTED,
        rejectedAt: new Date()
      },
      include: leadInclude
    });
  });
}

export async function createBusyEventFromBookingLead(leadId: string) {
  return prisma.$transaction(async (tx) => {
    const lead = await tx.bookingLead.findUnique({ where: { id: leadId } });
    if (!lead || !lead.parsedStartTime || !lead.parsedEndTime) {
      throw new Error("Заявка не найдена или в ней нет времени.");
    }
    await assertNoCalendarConflict(
      ownerFromLead(lead),
      lead.parsedStartTime,
      lead.parsedEndTime,
      tx,
      { ignoreHoldId: lead.availabilityHoldId ?? undefined }
    );
    if (lead.availabilityHoldId) {
      await tx.availabilityHold.updateMany({
        where: { id: lead.availabilityHoldId, status: AvailabilityHoldStatus.ACTIVE },
        data: { status: AvailabilityHoldStatus.CANCELLED }
      });
    }
    await tx.calendarEvent.create({
      data: {
        ownerType: lead.ownerType,
        photographerProfileId: lead.photographerProfileId,
        studioHallId: lead.studioHallId,
        source: CalendarEventSource.TELEGRAM,
        status: CalendarEventStatus.BUSY,
        title: lead.title ?? "Внешняя заявка",
        privateNote: lead.originalText,
        startTime: lead.parsedStartTime,
        endTime: lead.parsedEndTime
      }
    });
    return tx.bookingLead.update({
      where: { id: lead.id },
      data: {
        status: BookingLeadStatus.CANCELLED,
        rejectedAt: new Date()
      },
      include: leadInclude
    });
  });
}

export async function getBookingLeadByPublicToken(token: string) {
  await expireOldBookingLeads();
  return prisma.bookingLead.findUnique({
    where: { publicToken: token },
    include: leadInclude
  });
}

export async function convertBookingLeadToBooking(
  token: string,
  client: ExternalBookingClientInput
) {
  const result = await prisma.$transaction(
    async (tx) => {
      const lead = await tx.bookingLead.findUnique({
        where: { publicToken: token },
        include: leadInclude
      });
      if (!lead) throw new Error("Ссылка на бронь не найдена.");
      if (!lead.parsedStartTime || !lead.parsedEndTime) {
        throw new Error("В заявке нет даты или времени.");
      }
      if (!lead.availabilityHoldId) {
        throw new Error("Время больше не удерживается.");
      }
      if (
        !lead.publicLinkExpiresAt ||
        lead.publicLinkExpiresAt < new Date() ||
        (lead.status !== BookingLeadStatus.LINK_CREATED &&
          lead.status !== BookingLeadStatus.LINK_SENT)
      ) {
        throw new Error("Ссылка истекла или уже обработана.");
      }

      const hold = await tx.availabilityHold.findUnique({
        where: { id: lead.availabilityHoldId }
      });
      if (
        !hold ||
        hold.status !== AvailabilityHoldStatus.ACTIVE ||
        hold.expiresAt < new Date()
      ) {
        throw new Error("Время больше не удерживается.");
      }

      await assertNoCalendarConflict(
        ownerFromLead(lead),
        lead.parsedStartTime,
        lead.parsedEndTime,
        tx,
        { ignoreHoldId: hold.id }
      );

      const durationHours = Math.max(Math.ceil((lead.parsedDurationMinutes ?? 60) / 60), 1);
      const pricing = calculateBookingPricing({
        bookingType: lead.bookingType,
        photographerPrice:
          lead.bookingType === BookingType.PHOTOGRAPHER_ONLY
            ? lead.photographerProfile?.hourlyRate ?? 0
            : 0,
        studioPrice:
          lead.bookingType === BookingType.STUDIO_ONLY ? lead.studioHall?.hourlyRate ?? 0 : 0,
        durationHours
      });
      const booking = await tx.booking.create({
        data: {
          bookingNumber: `BK-TG-${Date.now().toString(36).toUpperCase()}`,
          clientName: client.clientName,
          clientEmail: client.clientEmail,
          clientPhone: client.clientPhone,
          clientComment: client.clientComment,
          bookingType: lead.bookingType,
          photographerId: lead.photographerProfileId,
          studioId: lead.studioProfileId ?? lead.studioHall?.studio?.id ?? null,
          studioHallId: lead.studioHallId,
          shootType: lead.bookingType === BookingType.PHOTOGRAPHER_ONLY ? lead.title : null,
          rentalPurpose: lead.bookingType === BookingType.STUDIO_ONLY ? lead.title : null,
          date: new Date(`${dateKey(lead.parsedStartTime)}T00:00:00.000Z`),
          startTime: timeLabel(lead.parsedStartTime),
          endTime: timeLabel(lead.parsedEndTime),
          durationHours,
          photographerPrice: pricing.photographerTotal,
          studioPrice: pricing.studioTotal,
          serviceFee: pricing.serviceFee,
          totalPrice: pricing.totalPrice,
          settlementMode: pricing.settlementMode,
          totalServicePrice: pricing.totalServicePrice,
          platformFeeAmount: pricing.platformFeeAmount,
          providerAmount: pricing.providerAmount,
          depositAmount: pricing.depositAmount,
          paidAmount: 0,
          remainingAmount: pricing.remainingAmount,
          platformCommission: pricing.platformCommission,
          providerFee: pricing.providerFee,
          netPlatformRevenue: pricing.netPlatformRevenue,
          platformFeeStatus: "UNPAID",
          providerPaymentStatus: "EXTERNAL_PENDING",
          paymentStatus: BookingPaymentStatus.UNPAID,
          status: BookingStatus.PENDING_PLATFORM_FEE,
          source: BookingSource.TELEGRAM_LEAD,
          bookingLeadId: lead.id,
          externalSourceProvider: lead.provider,
          externalSourceMessageId: lead.externalSourceMessageId
        }
      });

      await tx.availabilityHold.update({
        where: { id: hold.id },
        data: { bookingId: booking.id }
      });
      await tx.bookingLead.update({
        where: { id: lead.id },
        data: {
          bookingId: booking.id,
          status: BookingLeadStatus.CONVERTED_TO_BOOKING,
          clientName: client.clientName,
          clientPhone: client.clientPhone,
          clientEmail: client.clientEmail,
          clientComment: client.clientComment,
          convertedAt: new Date()
        }
      });

      return booking;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  const paymentSession = await createDepositPaymentForBooking(result.id);
  return { booking: result, paymentSession };
}

export async function expireOldBookingLeads() {
  const now = new Date();
  const expired = await prisma.bookingLead.findMany({
    where: {
      status: { in: [BookingLeadStatus.LINK_CREATED, BookingLeadStatus.LINK_SENT] },
      publicLinkExpiresAt: { lt: now }
    },
    select: { id: true, availabilityHoldId: true }
  });
  if (expired.length === 0) return { count: 0 };
  const leadIds = expired.map((lead) => lead.id);
  const holdIds = expired.map((lead) => lead.availabilityHoldId).filter(Boolean) as string[];
  await prisma.$transaction([
    prisma.bookingLead.updateMany({
      where: { id: { in: leadIds } },
      data: { status: BookingLeadStatus.EXPIRED }
    }),
    prisma.availabilityHold.updateMany({
      where: { id: { in: holdIds }, status: AvailabilityHoldStatus.ACTIVE },
      data: { status: AvailabilityHoldStatus.EXPIRED }
    })
  ]);
  return { count: expired.length };
}

export async function listRecentBookingLeadsForOwner(input: {
  photographerProfileId?: string;
  studioProfileId?: string;
  studioHallId?: string;
  take?: number;
}) {
  await expireOldBookingLeads();
  return prisma.bookingLead.findMany({
    where: {
      photographerProfileId: input.photographerProfileId,
      studioProfileId: input.studioProfileId,
      studioHallId: input.studioHallId
    },
    include: leadInclude,
    orderBy: { createdAt: "desc" },
    take: input.take ?? 20
  });
}

function resolveLeadOwner(
  channel: ConnectedExternalChannel,
  parsed: ParsedBookingLeadIntent,
  studioHallId?: string
) {
  if (parsed.bookingType === BookingType.PHOTOGRAPHER_ONLY && channel.photographerProfileId) {
    return {
      ownerType: CalendarOwnerType.PHOTOGRAPHER,
      photographerProfileId: channel.photographerProfileId,
      studioProfileId: null,
      studioHallId: null
    };
  }

  const halls = channel.studioProfile?.halls ?? [];
  const selectedHallId =
    studioHallId ??
    (parsed.hallName
      ? halls.find((hall) => hall.name.toLowerCase() === parsed.hallName?.toLowerCase())?.id
      : undefined) ??
    (halls.length === 1 ? halls[0].id : undefined);

  if (parsed.bookingType === BookingType.STUDIO_ONLY && channel.studioProfileId && selectedHallId) {
    return {
      ownerType: CalendarOwnerType.STUDIO_HALL,
      photographerProfileId: null,
      studioProfileId: channel.studioProfileId,
      studioHallId: selectedHallId
    };
  }

  throw new Error("Укажите зал. Например: /lead_hall Loft завтра 14:00-16:00");
}

function ownerFromLead(lead: Pick<
  BookingLeadWithDetails,
  "ownerType" | "photographerProfileId" | "studioHallId"
>) {
  if (lead.ownerType === CalendarOwnerType.PHOTOGRAPHER && lead.photographerProfileId) {
    return {
      type: CalendarOwnerType.PHOTOGRAPHER,
      photographerProfileId: lead.photographerProfileId
    };
  }
  if (lead.ownerType === CalendarOwnerType.STUDIO_HALL && lead.studioHallId) {
    return { type: CalendarOwnerType.STUDIO_HALL, studioHallId: lead.studioHallId };
  }
  throw new Error("У заявки не выбран календарь.");
}

function defaultLeadTitle(bookingType: BookingType) {
  return bookingType === BookingType.STUDIO_ONLY
    ? "Внешняя заявка на студию"
    : "Внешняя заявка на съемку";
}
