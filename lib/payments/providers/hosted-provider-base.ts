import type { PaymentProvider } from "@prisma/client";
import {
  createHmacSignature,
  safeCompareSignatures
} from "@/lib/payments/payment-security";
import type {
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
  NormalizedWebhookEvent,
  ParseWebhookEventInput,
  PaymentProviderClient,
  VerifyWebhookSignatureInput
} from "@/lib/payments/types";

export abstract class HostedProviderBase implements PaymentProviderClient {
  abstract readonly provider: PaymentProvider;
  protected abstract readonly webhookSecretEnv: string;

  abstract createCheckoutSession(
    input: CreateCheckoutSessionInput
  ): Promise<CreateCheckoutSessionResult>;

  async verifyWebhookSignature(input: VerifyWebhookSignatureInput) {
    const secret = process.env[this.webhookSecretEnv];
    if (!secret) return false;
    const expected = createHmacSignature(input.rawBody, secret);
    return safeCompareSignatures(expected, input.signature);
  }

  abstract parseWebhookEvent(
    input: ParseWebhookEventInput
  ): Promise<NormalizedWebhookEvent>;

  protected notConfigured(message: string): never {
    throw new Error(message);
  }
}
