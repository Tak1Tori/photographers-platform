import { PaymentProvider } from "@prisma/client";
import { CloudPaymentsProvider } from "@/lib/payments/providers/cloudpayments-provider";
import { FreedomPayProvider } from "@/lib/payments/providers/freedom-pay-provider";
import { KaspiProvider } from "@/lib/payments/providers/kaspi-provider";
import {
  assertMockPaymentsEnabled,
  MockPaymentProvider
} from "@/lib/payments/providers/mock-provider";
import type { PaymentProviderClient } from "@/lib/payments/types";

const providers: Partial<Record<PaymentProvider, PaymentProviderClient>> = {
  MOCK: new MockPaymentProvider(),
  CLOUDPAYMENTS: new CloudPaymentsProvider(),
  FREEDOM_PAY: new FreedomPayProvider(),
  KASPI: new KaspiProvider()
};

export function getPaymentProviderClient(provider = getConfiguredPaymentProvider()) {
  if (provider === PaymentProvider.MOCK) {
    assertMockPaymentsEnabled();
  }

  const client = providers[provider];
  if (!client) {
    throw new Error(`Payment provider ${provider} does not support hosted checkout yet`);
  }
  return client;
}

export function getConfiguredPaymentProvider(): PaymentProvider {
  const configured = process.env.PAYMENT_PROVIDER?.trim().toUpperCase();

  if (!configured || !Object.values(PaymentProvider).includes(configured as PaymentProvider)) {
    throw new Error("A supported PAYMENT_PROVIDER must be configured");
  }

  const provider = configured as PaymentProvider;
  if (provider === PaymentProvider.MOCK) {
    assertMockPaymentsEnabled();
  }

  return provider;
}

export function parsePaymentProvider(value: string) {
  const normalized = value.trim().replace(/-/g, "_").toUpperCase();
  if (!Object.values(PaymentProvider).includes(normalized as PaymentProvider)) {
    throw new Error("Unsupported payment provider");
  }
  return normalized as PaymentProvider;
}
