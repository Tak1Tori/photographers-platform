"use server";

import { UserRole } from "@prisma/client";
import {
  createBooking,
  createMockRuntimeBooking,
  saveMockRuntimeBooking
} from "@/lib/data/bookings";
import { getSession } from "@/lib/auth";
import { canUseDatabase } from "@/lib/data/db";
import { notifyBookingCreated } from "@/lib/notifications/notification-service";
import { createDepositPaymentForBooking } from "@/lib/payments/payment-service";
import { cancelBookingHolds } from "@/lib/calendar/hold-service";
import type { CreateBookingInput, CreateBookingResult } from "@/lib/types";

export async function createBookingAction(
  input: CreateBookingInput
): Promise<CreateBookingResult> {
  const session = await getSession();
  if (!session?.user || session.user.role !== UserRole.CLIENT) {
    return { success: false, error: "Войдите как клиент, чтобы создать и оплатить бронь." };
  }
  const bookingInput: CreateBookingInput = {
    ...input,
    clientId: session.user.id
  };
  const required: Array<[keyof CreateBookingInput, string]> = [
    ["clientName", "Name is required"],
    ["clientPhone", "Phone is required"],
    ["clientEmail", "Email is required"],
    ["date", "Date is required"],
    ["startTime", "Time slot is required"],
    ["durationHours", "Duration is required"]
  ];

  for (const [key, message] of required) {
    if (!bookingInput[key]) {
      return { success: false, error: message };
    }
  }

  if (!canUseDatabase()) {
    const bookingNumber = `MOCK-${Date.now().toString().slice(-6)}`;
    saveMockRuntimeBooking(createMockRuntimeBooking(bookingInput, bookingNumber));

    return {
      success: true,
      bookingNumber,
      checkoutUrl: `/checkout/mock?paymentId=${bookingNumber}`
    };
  }

  try {
    const booking = await createBooking(bookingInput);
    await notifyBookingCreated(booking.id);
    let paymentSession;
    try {
      paymentSession = await createDepositPaymentForBooking(booking.id);
    } catch (error) {
      await cancelBookingHolds(booking.id);
      throw error;
    }
    return {
      success: true,
      bookingNumber: booking.bookingNumber,
      paymentId: paymentSession.paymentId,
      checkoutUrl: paymentSession.checkoutUrl
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create booking"
    };
  }
}
