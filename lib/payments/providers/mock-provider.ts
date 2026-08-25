import {
  PaymentProvider,
  PaymentStatus
} from "@prisma/client";
import { createHmacSignature, safeCompareSignatures } from "@/lib/payments/payment-security";
import type {
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
  NormalizedWebhookEvent,
  ParseWebhookEventInput,
  PaymentProviderClient,
  VerifyWebhookSignatureInput
} from "@/lib/payments/types";

export function isMockPaymentsEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.ENABLE_MOCK_PAYMENTS === "true";
}

export function assertMockPaymentsEnabled() {
  if (!isMockPaymentsEnabled()) {
    throw new Error("Mock payments are disabled");
  }
}

export class MockPaymentProvider implements PaymentProviderClient {
  readonly provider = PaymentProvider.MOCK;

  async createCheckoutSession(
    input: CreateCheckoutSessionInput
  ): Promise<CreateCheckoutSessionResult> {
    assertMockPaymentsEnabled();

    return {
      checkoutUrl: `/checkout/mock?paymentId=${encodeURIComponent(input.paymentId)}`,
      providerPaymentId: `mock_${input.paymentId}`,
      amount: input.amount,
      currency: input.currency,
      status: PaymentStatus.PENDING
    };
  }

  async verifyWebhookSignature(input: VerifyWebhookSignatureInput) {
    assertMockPaymentsEnabled();

    const expected = createHmacSignature(input.rawBody, getMockWebhookSecret());
    return safeCompareSignatures(expected, input.signature);
  }

  async parseWebhookEvent(input: ParseWebhookEventInput): Promise<NormalizedWebhookEvent> {
    const payload = JSON.parse(input.rawBody) as {
      providerPaymentId?: string;
      status?: PaymentStatus;
      amount?: number;
      currency?: string;
      eventType?: string;
    };

    const amount = payload.amount;
    if (
      !payload.providerPaymentId ||
      !payload.status ||
      !Number.isSafeInteger(amount)
    ) {
      throw new Error("Invalid mock webhook payload");
    }

    return {
      provider: PaymentProvider.MOCK,
      providerPaymentId: payload.providerPaymentId,
      status: payload.status,
      amount: amount as number,
      currency: payload.currency ?? "KZT",
      eventType: payload.eventType ?? `payment.${payload.status.toLowerCase()}`,
      rawPayload: payload
    };
  }
}

export function signMockWebhookPayload(rawBody: string) {
  assertMockPaymentsEnabled();
  return createHmacSignature(rawBody, getMockWebhookSecret());
}

function getMockWebhookSecret() {
  const secret = process.env.MOCK_PAYMENT_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("MOCK_PAYMENT_WEBHOOK_SECRET must be configured when mock payments are enabled");
  }
  return secret;
}
