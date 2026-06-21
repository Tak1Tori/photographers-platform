"use server";

import {
  PaymentProvider,
  PaymentStatus
} from "@prisma/client";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canUseDatabase } from "@/lib/data/db";
import { markMockRuntimeBookingDepositPaid } from "@/lib/data/bookings";
import {
  getPaymentById
} from "@/lib/payments/payment-service";
import {
  signMockWebhookPayload
} from "@/lib/payments/providers/mock-provider";
import {
  handlePaymentWebhook
} from "@/lib/payments/webhook-service";

export async function confirmMockPaymentAction(formData: FormData): Promise<void> {
  const paymentId = String(formData.get("paymentId") ?? "");

  if (!paymentId) {
    redirect("/styles");
  }

  if (!canUseDatabase()) {
    markMockRuntimeBookingDepositPaid(paymentId);
    redirect(`/booking/success?bookingNumber=${encodeURIComponent(paymentId)}`);
  }

  const payment = await requireAccessibleMockPayment(paymentId);
  const rawBody = JSON.stringify({
    providerPaymentId: payment.providerPaymentId,
    status: PaymentStatus.PAID,
    amount: payment.amount,
    currency: payment.currency,
    eventType: "payment.paid"
  });
  const response = await handlePaymentWebhook(
    PaymentProvider.MOCK,
    new Request("http://localhost/api/payments/webhooks/mock", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-payment-signature": signMockWebhookPayload(rawBody)
      },
      body: rawBody
    })
  );

  if (response.status !== 200) {
    redirect(`/checkout/mock?paymentId=${encodeURIComponent(paymentId)}&error=1`);
  }

  redirect(
    `/booking/success?bookingNumber=${encodeURIComponent(payment.booking.bookingNumber)}`
  );
}

export async function cancelMockPaymentAction(formData: FormData): Promise<void> {
  const paymentId = String(formData.get("paymentId") ?? "");

  if (!paymentId) {
    redirect("/styles");
  }

  if (!canUseDatabase()) {
    redirect(`/checkout/mock?paymentId=${encodeURIComponent(paymentId)}&cancelled=1`);
  }

  const payment = await requireAccessibleMockPayment(paymentId);
  const rawBody = JSON.stringify({
    providerPaymentId: payment.providerPaymentId,
    status: PaymentStatus.CANCELLED,
    amount: payment.amount,
    currency: payment.currency,
    eventType: "payment.cancelled"
  });
  await handlePaymentWebhook(
    PaymentProvider.MOCK,
    new Request("http://localhost/api/payments/webhooks/mock", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-payment-signature": signMockWebhookPayload(rawBody)
      },
      body: rawBody
    })
  );
  redirect(`/checkout/mock?paymentId=${encodeURIComponent(paymentId)}&cancelled=1`);
}

async function requireAccessibleMockPayment(paymentId: string) {
  const [session, payment] = await Promise.all([getSession(), getPaymentById(paymentId)]);
  if (!session?.user || !payment) throw new Error("Payment not found");
  if (
    session.user.role !== "ADMIN" &&
    payment.booking.clientId !== session.user.id
  ) {
    throw new Error("Access denied");
  }
  if (payment.provider !== PaymentProvider.MOCK) {
    throw new Error("This action supports only MOCK payments");
  }
  if (payment.status !== PaymentStatus.PENDING) {
    throw new Error("Payment is not pending");
  }
  return payment;
}
