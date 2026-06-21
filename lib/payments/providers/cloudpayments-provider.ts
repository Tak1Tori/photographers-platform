import {
  PaymentProvider,
  PaymentStatus
} from "@prisma/client";
import { HostedProviderBase } from "@/lib/payments/providers/hosted-provider-base";
import type {
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
  NormalizedWebhookEvent,
  ParseWebhookEventInput
} from "@/lib/payments/types";

export class CloudPaymentsProvider extends HostedProviderBase {
  readonly provider = PaymentProvider.CLOUDPAYMENTS;
  protected readonly webhookSecretEnv = "CLOUDPAYMENTS_WEBHOOK_SECRET";

  async createCheckoutSession(
    input: CreateCheckoutSessionInput
  ): Promise<CreateCheckoutSessionResult> {
    if (!process.env.CLOUDPAYMENTS_PUBLIC_ID || !process.env.CLOUDPAYMENTS_API_SECRET) {
      this.notConfigured("CloudPayments credentials are not configured");
    }

    // Hosted checkout API contract must be finalized against the merchant account documentation.
    this.notConfigured(
      `CloudPayments hosted checkout adapter is not enabled for payment ${input.paymentId}`
    );
  }

  async parseWebhookEvent(input: ParseWebhookEventInput): Promise<NormalizedWebhookEvent> {
    const payload = JSON.parse(input.rawBody) as Record<string, unknown>;
    return normalizeGenericPayload(this.provider, payload);
  }
}

export function normalizeGenericPayload(
  provider: PaymentProvider,
  payload: Record<string, unknown>
): NormalizedWebhookEvent {
  const providerPaymentId = String(
    payload.providerPaymentId ?? payload.transactionId ?? payload.id ?? ""
  );
  const amount = Number(payload.amount);
  const currency = String(payload.currency ?? "KZT");
  const eventType = String(payload.eventType ?? payload.type ?? "payment.updated");
  const rawStatus = String(payload.status ?? "").toUpperCase();
  const status = normalizeStatus(rawStatus);

  if (!providerPaymentId || !Number.isSafeInteger(amount)) {
    throw new Error("Invalid provider webhook payload");
  }

  return {
    provider,
    providerPaymentId,
    amount,
    currency,
    eventType,
    status,
    rawPayload: payload,
    providerFee: Number.isSafeInteger(payload.providerFee)
      ? Number(payload.providerFee)
      : undefined
  };
}

function normalizeStatus(status: string): PaymentStatus {
  if (["PAID", "COMPLETED", "SUCCESS", "SUCCEEDED"].includes(status)) {
    return PaymentStatus.PAID;
  }
  if (["FAILED", "DECLINED", "ERROR"].includes(status)) return PaymentStatus.FAILED;
  if (["CANCELLED", "CANCELED", "VOIDED"].includes(status)) {
    return PaymentStatus.CANCELLED;
  }
  if (status === "REFUNDED") return PaymentStatus.REFUNDED;
  return PaymentStatus.PENDING;
}
