import {
  BookingPaymentStatus,
  BookingStatus as PrismaBookingStatus,
  BookingType,
  ProfileStatus
} from "@prisma/client";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { availableSlots, mockBookings } from "@/lib/mock-data";
import { canUseDatabase } from "@/lib/data/db";
import { mapBooking, mapSlots } from "@/lib/data/mappers";
import { calculateBookingPricing } from "@/lib/pricing";
import { createDepositPaymentForBooking } from "@/lib/payments/payment-service";
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
    prisma.style.findFirst({
      where: { OR: [{ id: input.styleId }, { slug: input.styleId }] }
    }),
    prisma.photographerProfile.findUnique({
      where: { id: input.photographerId }
    }),
    input.studioHallId
      ? prisma.studioHall.findUnique({ where: { id: input.studioHallId } })
      : prisma.studioHall.findFirst({ where: { studioId: input.studioId } })
  ]);

  if (!style) {
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
      styleId: style.id,
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
      depositAmount: pricing.depositAmount,
      paidAmount: 0,
      remainingAmount: pricing.totalPrice,
      platformCommission: pricing.platformCommission,
      providerFee: pricing.providerFee,
      netPlatformRevenue: pricing.netPlatformRevenue,
      paymentStatus: BookingPaymentStatus.UNPAID,
      status: PrismaBookingStatus.PENDING,
    }
  });

  await reserveBookingOrRollback(booking.id);
  return booking;
}

export async function createPhotographerOnlyBooking(input: CreatePhotographerOnlyBookingInput) {
  if (!canUseDatabase()) {
    throw new Error("DATABASE_URL is not configured");
  }

  const photographer = await prisma.photographerProfile.findUnique({
    where: { id: input.photographerId }
  });

  if (!photographer) {
    throw new Error("Фотограф не найден.");
  }

  if (photographer.status !== ProfileStatus.PUBLISHED) {
    throw new Error("Этот фотограф пока недоступен для бронирования.");
  }

  const pricing = calculateBookingPricing({
    bookingType: BookingType.PHOTOGRAPHER_ONLY,
    photographerPrice: photographer.hourlyRate,
    studioPrice: 0,
    durationHours: input.durationHours
  });
  const bookingNumber = `BK-PH-${Date.now().toString().slice(-7)}`;
  const endTime = calculateEndTime(input.startTime, input.durationHours);

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
        durationHours: input.durationHours,
        photographerPrice: pricing.photographerTotal,
        studioPrice: 0,
        serviceFee: pricing.serviceFee,
        totalPrice: pricing.totalPrice,
        depositAmount: pricing.depositAmount,
        paidAmount: 0,
        remainingAmount: pricing.totalPrice,
        platformCommission: pricing.platformCommission,
        providerFee: pricing.providerFee,
        netPlatformRevenue: pricing.netPlatformRevenue,
        paymentStatus: BookingPaymentStatus.UNPAID,
        status: PrismaBookingStatus.PENDING
      }
    });

  await reserveBookingOrRollback(booking.id);
  let paymentSession;
  try {
    paymentSession = await createDepositPaymentForBooking(booking.id);
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
        depositAmount: pricing.depositAmount,
        paidAmount: 0,
        remainingAmount: pricing.totalPrice,
        platformCommission: pricing.platformCommission,
        providerFee: pricing.providerFee,
        netPlatformRevenue: pricing.netPlatformRevenue,
        paymentStatus: BookingPaymentStatus.UNPAID,
        status: PrismaBookingStatus.PENDING
      }
    });

  await reserveBookingOrRollback(booking.id);
  let paymentSession;
  try {
    paymentSession = await createDepositPaymentForBooking(booking.id);
  } catch (error) {
    await cancelBookingHolds(booking.id);
    throw error;
  }

  return { booking, paymentSession };
}

export async function getBookingById(id: string) {
  if (!canUseDatabase()) {
    return getMockRuntimeBookings().find((item) => item.id === id);
  }

  try {
    const booking = await prisma.booking.findFirst({
      where: { OR: [{ id }, { bookingNumber: id }] },
      include: bookingInclude
    });
    return booking ? mapBooking(booking) : getMockRuntimeBookings().find((item) => item.id === id);
  } catch {
    return getMockRuntimeBookings().find((item) => item.id === id);
  }
}

export async function getAllBookings() {
  if (!canUseDatabase()) {
    return getMockRuntimeBookings();
  }

  try {
    const bookings = await prisma.booking.findMany({
      include: bookingInclude,
      orderBy: { createdAt: "desc" }
    });
    return bookings.length > 0 ? bookings.map(mapBooking) : getMockRuntimeBookings();
  } catch {
    return getMockRuntimeBookings();
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
    styleId: input.styleId,
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
    remainingAmount: pricing.totalPrice,
    paymentStatus: "UNPAID",
    status: "Pending"
  };
}

export function saveMockRuntimeBooking(booking: Booking) {
  const existing = getStoredMockBookings();
  const next = [booking, ...existing.filter((item) => item.id !== booking.id)].slice(0, 20);
  cookies().set(MOCK_BOOKINGS_COOKIE, encodeURIComponent(JSON.stringify(next)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export function markMockRuntimeBookingDepositPaid(bookingId: string) {
  const booking = getMockRuntimeBookings().find((item) => item.id === bookingId);

  if (!booking) {
    return null;
  }

  const paidBooking: Booking = {
    ...booking,
    paidAmount: booking.depositAmount,
    remainingAmount: Math.max(booking.totalAmount - booking.depositAmount, 0),
    paymentStatus:
      booking.depositAmount >= booking.totalAmount ? "FULLY_PAID" : "DEPOSIT_PAID"
  };

  saveMockRuntimeBooking(paidBooking);
  return paidBooking;
}

function getMockRuntimeBookings() {
  const stored = getStoredMockBookings();
  const storedIds = new Set(stored.map((booking) => booking.id));
  return [...stored, ...mockBookings.filter((booking) => !storedIds.has(booking.id))];
}

function getStoredMockBookings(): Booking[] {
  const raw = cookies().get(MOCK_BOOKINGS_COOKIE)?.value;

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

function calculateEndTime(startTime: string, durationHours: number) {
  const [hour = "0"] = startTime.split(":");
  return `${String(Number(hour) + durationHours).padStart(2, "0")}:00`;
}

async function reserveBookingOrRollback(bookingId: string) {
  try {
    await createHoldsForBooking(bookingId);
  } catch (error) {
    await prisma.booking.delete({ where: { id: bookingId } }).catch(() => undefined);
    throw error;
  }
}
