import {
  PaymentStatus,
  PaymentType,
  Prisma
} from "@prisma/client";
import {
  getPaymentProviderClient
} from "@/lib/payments/providers";
import {
  getPaymentByProviderPaymentId,
  markPaymentAsFailed,
  markPaymentAsPaid,
  cancelPayment
} from "@/lib/payments/payment-service";
import {
  requireIntegerMoney,
  requireKzt
} from "@/lib/payments/payment-security";
import {
  notifyDepositPaid,
  notifyFullyPaid
} from "@/lib/notifications/notification-service";
import { prisma } from "@/lib/prisma";
import type {
  NormalizedWebhookEvent
} from "@/lib/payments/types";
import type { PaymentProvider } from "@prisma/client";

export async function handlePaymentWebhook(
  provider: PaymentProvider,
  request: Request
) {
  const rawBody = await request.text();
  const client = getPaymentProviderClient(provider);
  const signature = getWebhookSignature(request.headers);
  const signatureValid = await client.verifyWebhookSignature({
    rawBody,
    signature,
    headers: request.headers
  });
  const rawPayload = parsePayloadForLog(rawBody);

  const log = await prisma.paymentWebhookLog.create({
    data: {
      provider,
      eventType: "unparsed",
      payload: rawPayload as Prisma.InputJsonValue,
      signatureValid
    }
  });

  if (!signatureValid) {
    await finishWebhookLog(log.id, {
      processingError: "Invalid webhook signature"
    });
    return { status: 401, body: { ok: false, error: "Invalid signature" } };
  }

  try {
    const event = await client.parseWebhookEvent({
      rawBody,
      headers: request.headers
    });
    const payment = await getPaymentByProviderPaymentId(event.providerPaymentId);

    await prisma.paymentWebhookLog.update({
      where: { id: log.id },
      data: {
        eventType: event.eventType,
        providerPaymentId: event.providerPaymentId,
        paymentId: payment?.id,
        bookingId: payment?.bookingId
      }
    });

    if (!payment) throw new Error("Payment not found for providerPaymentId");
    validateWebhookEvent(payment, event, provider);

    if (payment.status === PaymentStatus.PAID && event.status === PaymentStatus.PAID) {
      await finishWebhookLog(log.id, { processed: true });
      return { status: 200, body: { ok: true, idempotent: true } };
    }

    if (event.status === PaymentStatus.PAID) {
      const updated = await processPaidEvent(payment.id, event);
      if (updated?.bookingId) {
        if (payment.type === PaymentType.DEPOSIT) {
          await notifyDepositPaid(updated.bookingId);
        } else if (payment.type === PaymentType.FINAL_PAYMENT) {
          await notifyFullyPaid(updated.bookingId);
        }
      }
    } else if (event.status === PaymentStatus.FAILED) {
      await processFailedEvent(payment.id, event);
    } else if (event.status === PaymentStatus.CANCELLED) {
      await processCancelledEvent(payment.id, event);
    }

    await finishWebhookLog(log.id, { processed: true });
    return { status: 200, body: { ok: true } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    await finishWebhookLog(log.id, { processingError: message });
    return { status: 400, body: { ok: false, error: message } };
  }
}

export async function validateWebhookSignature(
  provider: PaymentProvider,
  request: Request,
  rawBody: string
) {
  return getPaymentProviderClient(provider).verifyWebhookSignature({
    rawBody,
    signature: getWebhookSignature(request.headers),
    headers: request.headers
  });
}

export function processPaidEvent(paymentId: string, event: NormalizedWebhookEvent) {
  return markPaymentAsPaid(paymentId, {
    providerPaymentId: event.providerPaymentId,
    eventType: event.eventType,
    providerFee: event.providerFee,
    rawPayload: event.rawPayload
  });
}

export function processFailedEvent(paymentId: string, event: NormalizedWebhookEvent) {
  return markPaymentAsFailed(paymentId, {
    providerPaymentId: event.providerPaymentId,
    eventType: event.eventType,
    providerFee: event.providerFee,
    rawPayload: event.rawPayload
  });
}

export function processCancelledEvent(paymentId: string, event: NormalizedWebhookEvent) {
  return cancelPayment(paymentId, {
    reason: `Provider webhook: ${event.eventType}`
  });
}

function validateWebhookEvent(
  payment: NonNullable<Awaited<ReturnType<typeof getPaymentByProviderPaymentId>>>,
  event: NormalizedWebhookEvent,
  provider: PaymentProvider
) {
  if (payment.provider !== provider || event.provider !== provider) {
    throw new Error("Webhook provider mismatch");
  }
  requireIntegerMoney(event.amount, "event.amount");
  requireKzt(event.currency);
  if (event.amount !== payment.amount) throw new Error("Webhook amount mismatch");
  if (event.currency.toUpperCase() !== payment.currency.toUpperCase()) {
    throw new Error("Webhook currency mismatch");
  }
  if (
    payment.status !== PaymentStatus.PENDING &&
    payment.status !== event.status
  ) {
    throw new Error(`Unexpected payment status ${payment.status}`);
  }
}

async function finishWebhookLog(
  id: string,
  input: { processed?: boolean; processingError?: string }
) {
  await prisma.paymentWebhookLog.update({
    where: { id },
    data: {
      processed: input.processed ?? false,
      processingError: input.processingError,
      processedAt: input.processed ? new Date() : undefined
    }
  });
}

function getWebhookSignature(headers: Headers) {
  return (
    headers.get("x-payment-signature") ??
    headers.get("content-hmac") ??
    headers.get("x-webhook-signature")
  );
}

function parsePayloadForLog(rawBody: string) {
  try {
    return JSON.parse(rawBody) as Prisma.InputJsonValue;
  } catch {
    return { rawBody };
  }
}
