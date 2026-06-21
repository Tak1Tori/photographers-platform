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

export class KaspiProvider extends HostedProviderBase {
  readonly provider = PaymentProvider.KASPI;
  protected readonly webhookSecretEnv = "KASPI_WEBHOOK_SECRET";

  async createCheckoutSession(
    input: CreateCheckoutSessionInput
  ): Promise<CreateCheckoutSessionResult> {
    if (!process.env.KASPI_API_KEY) {
      this.notConfigured("Kaspi API credentials are not configured");
    }
    this.notConfigured(
      `Kaspi hosted checkout adapter is not enabled for payment ${input.paymentId}`
    );
  }

  async parseWebhookEvent(input: ParseWebhookEventInput) {
    return normalizeGenericPayload(
      this.provider,
      JSON.parse(input.rawBody) as Record<string, unknown>
    );
  }
}
