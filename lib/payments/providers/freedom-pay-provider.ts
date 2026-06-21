import { PaymentProvider } from "@prisma/client";
import {
  normalizeGenericPayload
} from "@/lib/payments/providers/cloudpayments-provider";
import { HostedProviderBase } from "@/lib/payments/providers/hosted-provider-base";
import type {
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
  ParseWebhookEventInput
} from "@/lib/payments/types";

export class FreedomPayProvider extends HostedProviderBase {
  readonly provider = PaymentProvider.FREEDOM_PAY;
  protected readonly webhookSecretEnv = "FREEDOM_PAY_WEBHOOK_SECRET";

  async createCheckoutSession(
    input: CreateCheckoutSessionInput
  ): Promise<CreateCheckoutSessionResult> {
    if (!process.env.FREEDOM_PAY_MERCHANT_ID || !process.env.FREEDOM_PAY_SECRET_KEY) {
      this.notConfigured("Freedom Pay credentials are not configured");
    }
    this.notConfigured(
      `Freedom Pay hosted checkout adapter is not enabled for payment ${input.paymentId}`
    );
  }

  async parseWebhookEvent(input: ParseWebhookEventInput) {
    return normalizeGenericPayload(
      this.provider,
      JSON.parse(input.rawBody) as Record<string, unknown>
    );
  }
}
