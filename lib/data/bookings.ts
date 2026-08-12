import {
  BookingPaymentStatus,
  BookingStatus as PrismaBookingStatus,
  BookingType,
  PlatformFeeStatus,
  ProviderPaymentStatus,
  ProfileStatus,
  StudioConfirmationMode
} from "@prisma/client";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { availableSlots, mockBookings } from "@/lib/mock-data";
import { canUseDatabase } from "@/lib/data/db";
import { mapBooking, mapSlots } from "@/lib/data/mappers";
import {
  isMissingPhotographerServiceSchema,
  rethrowUnexpectedDatabaseError
} from "@/lib/data/photographer-services-rollout";
import {
  calculateBookingPricing,
  calculatePhotographerServicePricing
} from "@/lib/pricing";
import { minutesFromTime, timeFromMinutes } from "@/lib/calendar/time-utils";
import { createPlatformFeePaymentForBooking } from "@/lib/payments/payment-service";
import { autoCompletePastBookings } from "@/lib/bookings/status-service";
import { createStudioConfirmationRequest } from "@/lib/studio-confirmations/studio-confirmation-service";
import { buildStudioWaitingUrl } from "@/lib/studio-confirmations/whatsapp-message-builder";
import {
  cancelBookingHolds,
  createHoldsForBooking
} from "@/lib/calendar/hold-service";
import type {
  Booking,
  BookingStatus,
  CreateBookingInput,
  CreatePhotographerOnlyBookingInput,
  CreateStudioOnlyBookingInput
} from "@/lib/types";

const bookingInclude = {
  style: true,
  photographer: true,
  photographerService: true,
  studio: true,
  studioHall: true
};
const MOCK_BOOKINGS_COOKIE = "photo_booking_mock_bookings";

export async function createBooking(input: CreateBookingInput) {
  if (!canUseDatabase()) {
    throw new Error("DATABASE_URL is not configured");
  }

  const bookingNumber = `BK-${Date.now().toString().slice(-6)}`;
  const endTime = `${String(Number(input.startTime.slice(0, 2)) + input.durationHours).padStart(2, "0")}:00`;
  const [style, photographer, studioHall] = await Promise.all([
    input.styleId
      ? prisma.style.findFirst({
          where: { OR: [{ id: input.styleId }, { slug: input.styleId }] }
        })
      : Promise.resolve(null),
    prisma.photographerProfile.findUnique({
      where: { id: input.photographerId }
    }),
    input.studioHallId
      ? prisma.studioHall.findUnique({ where: { id: input.studioHallId } })
      : prisma.studioHall.findFirst({ where: { studioId: input.studioId } })
  ]);

  if (input.styleId && !style) {
    throw new Error("Style not found");
  }

  if (!studioHall) {
    throw new Error("Studio hall not found");
  }
  if (!photographer || photographer.status !== ProfileStatus.PUBLISHED) {
    throw new Error("Photographer is not available");
  }
  if (studioHall.studioId !== input.studioId || studioHall.status !== "ACTIVE") {
    throw new Error("Studio hall is not available");
  }

  const pricing = calculateBookingPricing({
    bookingType: BookingType.FULL_SHOOT,
    photographerPrice: photographer.hourlyRate,
    studioPrice: studioHall.hourlyRate,
    durationHours: input.durationHours
  });

  const booking = await prisma.booking.create({
    data: {
      bookingNumber,
      clientId: input.clientId,
      clientName: input.clientName,
      clientEmail: input.clientEmail,
      clientPhone: input.clientPhone,
      clientComment: input.clientComment,
      bookingType: "FULL_SHOOT",
      styleId: style?.id ?? null,
      photographerId: input.photographerId,
      studioId: input.studioId,
      studioHallId: studioHall.id,
      date: new Date(`${input.date}T00:00:00.000Z`),
      startTime: input.startTime,
      endTime,
      durationHours: input.durationHours,
      photographerPrice: pricing.photographerTotal,
      studioPrice: pricing.studioTotal,
      serviceFee: pricing.serviceFee,
      totalPrice: pricing.totalPrice,
      settlementMode: pricing.settlementMode,
      totalServicePrice: pricing.totalServicePrice,
      platformFeeAmount: pricing.platformFeeAmount,
      providerAmount: pricing.providerAmount,
      platformFeeStatus: PlatformFeeStatus.UNPAID,
      providerPaymentStatus: ProviderPaymentStatus.EXTERNAL_PENDING,
      depositAmount: pricing.depositAmount,
      paidAmount: 0,
      remainingAmount: pricing.remainingAmount,
      platformCommission: pricing.platformCommission,
      providerFee: pricing.providerFee,
      netPlatformRevenue: pricing.netPlatformRevenue,
      paymentStatus: BookingPaymentStatus.UNPAID,
      status: PrismaBookingStatus.PENDING_PLATFORM_FEE,
    }
  });

  await reserveBookingOrRollback(booking.id);
  return booking;
}

export async function createPhotographerOnlyBooking(input: CreatePhotographerOnlyBookingInput) {
  if (!canUseDatabase()) {
    throw new Error("DATABASE_URL is not configured");
  }

  const photographer = await prisma.photographerProfile.findFirst({
    where: {
      id: input.photographerId,
      user: { role: "PHOTOGRAPHER" }
    }
  });

  if (!photographer) {
    throw new Error("Фотограф не найден.");
  }

  if (photographer.status !== ProfileStatus.PUBLISHED) {
    throw new Error("Этот фотограф пока недоступен для бронирования.");
  }

  const selectedService = input.serviceId
    ? await prisma.photographerService.findFirst({
        where: {
          id: input.serviceId,
          photographerId: photographer.id,
          isActive: true
        }
      })
    : null;

  if (input.serviceId && !selectedService) {
    throw new Error("Выбранная услуга больше недоступна. Обновите страницу и выберите другую.");
  }

  const legacyDurationHours = input.durationHours;
  const isValidLegacyDuration =
    Number.isInteger(legacyDurationHours) &&
    legacyDurationHours !== undefined &&
    legacyDurationHours >= 1 &&
    legacyDurationHours <= 24;
  if (!selectedService && !isValidLegacyDuration) {
    throw new Error("Некорректная длительность бронирования.");
  }

  const durationMinutes = selectedService
    ? selectedService.durationMinutes
    : legacyDurationHours! * 60;
  const durationHours = Math.max(1, Math.ceil(durationMinutes / 60));
  const pricing = selectedService
    ? calculatePhotographerServicePricing(selectedService.price)
    : calculateBookingPricing({
        bookingType: BookingType.PHOTOGRAPHER_ONLY,
        photographerPrice: photographer.hourlyRate,
        studioPrice: 0,
        durationHours: legacyDurationHours!
      });
  const bookingNumber = `BK-PH-${Date.now().toString().slice(-7)}`;
  const endTime = calculateEndTime(input.startTime, durationMinutes);

  const booking = await prisma.booking.create({
      data: {
        bookingNumber,
        clientId: input.clientId,
        clientName: input.clientName,
        clientEmail: input.clientEmail,
        clientPhone: input.clientPhone,
        bookingType: BookingType.PHOTOGRAPHER_ONLY,
        styleId: null,
        photographerId: photographer.id,
        photographerServiceId: selectedService?.id ?? null,
        photographerServiceTitle: selectedService?.title ?? null,
        photographerServicePrice: selectedService?.price ?? null,
        photographerServiceDurationMinutes: selectedService?.durationMinutes ?? null,
        studioId: null,
        studioHallId: null,
        shootType: input.shootType,
        shootDescription: input.shootDescription,
        locationType: input.locationType,
        city: input.city,
        district: input.district || null,
        addressDetails: input.addressDetails || null,
        peopleCount: input.peopleCount,
        equipmentNeeded: input.equipmentNeeded,
        specialRequirements: input.specialRequirements || null,
        date: new Date(`${input.date}T00:00:00.000Z`),
        startTime: input.startTime,
        endTime,
        durationHours,
        photographerPrice: pricing.photographerTotal,
        studioPrice: 0,
        serviceFee: pricing.serviceFee,
        totalPrice: pricing.totalPrice,
        settlementMode: pricing.settlementMode,
        totalServicePrice: pricing.totalServicePrice,
        platformFeeAmount: pricing.platformFeeAmount,
        providerAmount: pricing.providerAmount,
        platformFeeStatus: PlatformFeeStatus.UNPAID,
        providerPaymentStatus: ProviderPaymentStatus.EXTERNAL_PENDING,
        depositAmount: pricing.depositAmount,
        paidAmount: 0,
        remainingAmount: pricing.remainingAmount,
        platformCommission: pricing.platformCommission,
        providerFee: pricing.providerFee,
        netPlatformRevenue: pricing.netPlatformRevenue,
        paymentStatus: BookingPaymentStatus.UNPAID,
        status: PrismaBookingStatus.PENDING_PLATFORM_FEE
      }
    });

  await reserveBookingOrRollback(booking.id);
  let paymentSession;
  try {
    paymentSession = await createPlatformFeePaymentForBooking(booking.id);
  } catch (error) {
    await cancelBookingHolds(booking.id);
    throw error;
  }

  return {
    booking,
    paymentSession
  };
}

export async function createStudioOnlyBooking(input: CreateStudioOnlyBookingInput) {
  if (!canUseDatabase()) {
    throw new Error("DATABASE_URL is not configured");
  }

  const hall = await prisma.studioHall.findUnique({
    where: { id: input.studioHallId },
    include: { studio: true }
  });

  if (!hall) {
    throw new Error("Зал не найден.");
  }

  if (input.studioId && hall.studioId !== input.studioId) {
    throw new Error("Выбранный зал не относится к этой студии.");
  }

  if (hall.studio.status !== ProfileStatus.PUBLISHED) {
    throw new Error("Эта студия пока недоступна для бронирования.");
  }

  if (hall.status !== "ACTIVE") {
    throw new Error("Этот зал сейчас недоступен для бронирования.");
  }

  if (input.peopleCount && input.peopleCount > hall.capacity) {
    throw new Error(`Вместимость зала: ${hall.capacity} человек.`);
  }

  if (
    hall.studio.confirmationMode === StudioConfirmationMode.WHATSAPP_CONFIRMATION &&
    hall.studio.whatsappConfirmationEnabled
  ) {
    const confirmationRequest = await createStudioConfirmationRequest(input);

    return {
      requiresStudioConfirmation: true,
      confirmationRequest,
      confirmationRequestId: confirmationRequest.id,
      waitingUrl: buildStudioWaitingUrl(confirmationRequest.id),
      platformFeeAmount: confirmationRequest.platformFeeAmount,
      whatsappOpenUrl: confirmationRequest.whatsappOpenUrl ?? undefined
    };
  }

  const pricing = calculateBookingPricing({
    bookingType: BookingType.STUDIO_ONLY,
    photographerPrice: 0,
    studioPrice: hall.hourlyRate,
    durationHours: input.durationHours
  });
  const bookingNumber = `BK-ST-${Date.now().toString().slice(-7)}`;
  const endTime = calculateEndTime(input.startTime, input.durationHours);

  const booking = await prisma.booking.create({
      data: {
        bookingNumber,
        clientId: input.clientId,
        clientName: input.clientName,
        clientEmail: input.clientEmail,
        clientPhone: input.clientPhone,
        bookingType: BookingType.STUDIO_ONLY,
        styleId: null,
        photographerId: null,
        studioId: hall.studioId,
        studioHallId: hall.id,
        rentalPurpose: input.rentalPurpose,
        needsEquipment: input.needsEquipment,
        selectedAmenities: input.selectedAmenities,
        shootDescription: input.shootDescription,
        peopleCount: input.peopleCount,
        specialRequirements: input.specialRequirements || null,
        date: new Date(`${input.date}T00:00:00.000Z`),
        startTime: input.startTime,
        endTime,
        durationHours: input.durationHours,
        photographerPrice: 0,
        studioPrice: pricing.studioTotal,
        serviceFee: pricing.serviceFee,
        totalPrice: pricing.totalPrice,
        settlementMode: pricing.settlementMode,
        totalServicePrice: pricing.totalServicePrice,
        platformFeeAmount: pricing.platformFeeAmount,
        providerAmount: pricing.providerAmount,
        platformFeeStatus: PlatformFeeStatus.UNPAID,
        providerPaymentStatus: ProviderPaymentStatus.EXTERNAL_PENDING,
        depositAmount: pricing.depositAmount,
        paidAmount: 0,
        remainingAmount: pricing.remainingAmount,
        platformCommission: pricing.platformCommission,
        providerFee: pricing.providerFee,
        netPlatformRevenue: pricing.netPlatformRevenue,
        paymentStatus: BookingPaymentStatus.UNPAID,
        status: PrismaBookingStatus.PENDING_PLATFORM_FEE
      }
    });

  await reserveBookingOrRollback(booking.id);
  let paymentSession;
  try {
    paymentSession = await createPlatformFeePaymentForBooking(booking.id);
  } catch (error) {
    await cancelBookingHolds(booking.id);
    throw error;
  }

  return { booking, paymentSession };
}

export async function getBookingById(id: string) {
  if (!canUseDatabase()) {
    return (await getMockRuntimeBookings()).find((item) => item.id === id);
  }

  try {
    await autoCompletePastBookings();

    const booking = await prisma.booking.findFirst({
      where: { OR: [{ id }, { bookingNumber: id }] },
      include: bookingInclude
    });
    return booking
      ? mapBooking(booking)
      : (await getMockRuntimeBookings()).find((item) => item.id === id);
  } catch (error) {
    if (isMissingPhotographerServiceSchema(error)) {
      return (await getMockRuntimeBookings()).find((item) => item.id === id);
    }
    return rethrowUnexpectedDatabaseError("Failed to load booking", error);
  }
}

export async function getAllBookings() {
  if (!canUseDatabase()) {
    return getMockRuntimeBookings();
  }

  try {
    await autoCompletePastBookings();

    const bookings = await prisma.booking.findMany({
      include: bookingInclude,
      orderBy: { createdAt: "desc" }
    });
    return bookings.length > 0 ? bookings.map(mapBooking) : getMockRuntimeBookings();
  } catch (error) {
    if (isMissingPhotographerServiceSchema(error)) {
      return getMockRuntimeBookings();
    }
    return rethrowUnexpectedDatabaseError("Failed to load bookings", error);
  }
}

export async function getPhotographerBookings(photographerId: string) {
  const bookings = await getAllBookings();
  return bookings.filter((booking) => booking.photographerId === photographerId);
}

export async function getStudioBookings(studioId: string) {
  const bookings = await getAllBookings();
  return bookings.filter((booking) => booking.studioId === studioId);
}

export async function updateBookingStatus(bookingId: string, status: BookingStatus) {
  if (!canUseDatabase()) {
    throw new Error("DATABASE_URL is not configured");
  }

  const prismaStatus = status.toUpperCase() as PrismaBookingStatus;
  return prisma.booking.update({
    where: { id: bookingId },
    data: { status: prismaStatus }
  });
}

export async function getAvailableBookingSlots(photographerId: string, studioId: string) {
  if (!canUseDatabase()) {
    return availableSlots;
  }

  try {
    const studio = await prisma.studioProfile.findUnique({
      where: { id: studioId },
      include: { halls: true }
    });
    const hallIds = studio?.halls.map((hall) => hall.id) ?? [];
    const [photographerSlots, hallSlots] = await Promise.all([
      prisma.availabilitySlot.findMany({
        where: { photographerId, isAvailable: true }
      }),
      prisma.availabilitySlot.findMany({
        where: { studioHallId: { in: hallIds }, isAvailable: true }
      })
    ]);

    const hallKeys = new Set(
      hallSlots.map((slot) => `${slot.date.toISOString().slice(0, 10)}-${slot.startTime}`)
    );
    const intersected = photographerSlots.filter((slot) =>
      hallKeys.has(`${slot.date.toISOString().slice(0, 10)}-${slot.startTime}`)
    );

    return intersected.length > 0 ? mapSlots(intersected) : availableSlots;
  } catch {
    return availableSlots;
  }
}

export function createMockRuntimeBooking(input: CreateBookingInput, bookingNumber: string): Booking {
  const pricing = calculateBookingPricing({
    bookingType: BookingType.FULL_SHOOT,
    photographerPrice: input.photographerPrice,
    studioPrice: input.studioPrice,
    durationHours: input.durationHours
  });

  return {
    id: bookingNumber,
    dbId: bookingNumber,
    clientId: input.clientId ?? input.clientEmail,
    clientName: input.clientName,
    clientEmail: input.clientEmail,
    clientPhone: input.clientPhone,
    clientComment: input.clientComment,
    bookingType: "FULL_SHOOT",
    photographerId: input.photographerId,
    studioId: input.studioId,
    styleId: input.styleId ?? "",
    hallName: "Selected hall",
    date: input.date,
    time: input.startTime,
    durationHours: input.durationHours,
    photographerTotal: pricing.photographerTotal,
    studioTotal: pricing.studioTotal,
    serviceFee: pricing.serviceFee,
    totalAmount: pricing.totalPrice,
    depositAmount: pricing.depositAmount,
    paidAmount: 0,
    remainingAmount: pricing.remainingAmount,
    totalServicePrice: pricing.totalServicePrice,
    platformFeeAmount: pricing.platformFeeAmount,
    providerAmount: pricing.providerAmount,
    platformFeeStatus: "UNPAID",
    providerPaymentStatus: "EXTERNAL_PENDING",
    paymentStatus: "UNPAID",
    status: "Pending"
  };
}

export async function saveMockRuntimeBooking(booking: Booking) {
  const existing = await getStoredMockBookings();
  const next = [booking, ...existing.filter((item) => item.id !== booking.id)].slice(0, 20);
  const cookieStore = await cookies();
  cookieStore.set(MOCK_BOOKINGS_COOKIE, encodeURIComponent(JSON.stringify(next)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export async function markMockRuntimeBookingDepositPaid(bookingId: string) {
  const booking = (await getMockRuntimeBookings()).find((item) => item.id === bookingId);

  if (!booking) {
    return null;
  }

  const paidBooking: Booking = {
    ...booking,
    paidAmount: booking.depositAmount,
    remainingAmount: booking.providerAmount ?? Math.max(booking.totalAmount - booking.depositAmount, 0),
    platformFeeStatus: "PAID",
    paymentStatus: "DEPOSIT_PAID",
    status: "Confirmed"
  };

  await saveMockRuntimeBooking(paidBooking);
  return paidBooking;
}

async function getMockRuntimeBookings() {
  const stored = await getStoredMockBookings();
  const storedIds = new Set(stored.map((booking) => booking.id));
  return [...stored, ...mockBookings.filter((booking) => !storedIds.has(booking.id))];
}

async function getStoredMockBookings(): Promise<Booking[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(MOCK_BOOKINGS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    return Array.isArray(parsed) ? (parsed as Booking[]) : [];
  } catch {
    return [];
  }
}

function calculateEndTime(startTime: string, durationMinutes: number) {
  return timeFromMinutes(minutesFromTime(startTime) + durationMinutes);
}

async function reserveBookingOrRollback(bookingId: string) {
  try {
    await createHoldsForBooking(bookingId);
  } catch (error) {
    await prisma.booking.delete({ where: { id: bookingId } }).catch(() => undefined);
    throw error;
  }
}
