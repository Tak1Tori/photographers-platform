"use server";

import { redirect } from "next/navigation";
import { canUseDatabase } from "@/lib/data/db";
import { markMockRuntimeBookingDepositPaid } from "@/lib/data/bookings";
import {
  markPaymentAsCancelled,
  markPaymentAsPaid
} from "@/lib/payments/payment-service";
import { notifyDepositPaid } from "@/lib/notifications/notification-service";

export async function confirmMockPaymentAction(formData: FormData): Promise<void> {
  const paymentId = String(formData.get("paymentId") ?? "");

  if (!paymentId) {
    redirect("/styles");
  }

  if (!canUseDatabase()) {
    markMockRuntimeBookingDepositPaid(paymentId);
    redirect(`/booking/success?bookingNumber=${encodeURIComponent(paymentId)}`);
  }

  const payment = await markPaymentAsPaid(paymentId);
  const bookingNumber = payment?.booking.bookingNumber;
  if (payment?.bookingId) {
    await notifyDepositPaid(payment.bookingId);
  }

  if (!bookingNumber) {
    redirect("/styles");
  }

  redirect(`/booking/success?bookingNumber=${encodeURIComponent(bookingNumber)}`);
}

export async function cancelMockPaymentAction(formData: FormData): Promise<void> {
  const paymentId = String(formData.get("paymentId") ?? "");

  if (!paymentId) {
    redirect("/styles");
  }

  if (!canUseDatabase()) {
    redirect(`/checkout/mock?paymentId=${encodeURIComponent(paymentId)}&cancelled=1`);
  }

  await markPaymentAsCancelled(paymentId);
  redirect(`/checkout/mock?paymentId=${encodeURIComponent(paymentId)}&cancelled=1`);
}
