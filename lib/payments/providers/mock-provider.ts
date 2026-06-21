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

const DEFAULT_MOCK_SECRET = "framely-local-mock-webhook-secret";

export class MockPaymentProvider implements PaymentProviderClient {
  readonly provider = PaymentProvider.MOCK;

  async createCheckoutSession(
    input: CreateCheckoutSessionInput
  ): Promise<CreateCheckoutSessionResult> {
    return {
      checkoutUrl: `/checkout/mock?paymentId=${encodeURIComponent(input.paymentId)}`,
      providerPaymentId: `mock_${input.paymentId}`,
      amount: input.amount,
      currency: input.currency,
      status: PaymentStatus.PENDING
    };
  }

  async verifyWebhookSignature(input: VerifyWebhookSignatureInput) {
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
  return createHmacSignature(rawBody, getMockWebhookSecret());
}

function getMockWebhookSecret() {
  return process.env.MOCK_PAYMENT_WEBHOOK_SECRET ?? DEFAULT_MOCK_SECRET;
}
