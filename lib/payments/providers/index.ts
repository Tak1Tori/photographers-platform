import { PaymentProvider } from "@prisma/client";
import { CloudPaymentsProvider } from "@/lib/payments/providers/cloudpayments-provider";
import { FreedomPayProvider } from "@/lib/payments/providers/freedom-pay-provider";
import { KaspiProvider } from "@/lib/payments/providers/kaspi-provider";
import { MockPaymentProvider } from "@/lib/payments/providers/mock-provider";
import type { PaymentProviderClient } from "@/lib/payments/types";

const providers: Partial<Record<PaymentProvider, PaymentProviderClient>> = {
  MOCK: new MockPaymentProvider(),
  CLOUDPAYMENTS: new CloudPaymentsProvider(),
  FREEDOM_PAY: new FreedomPayProvider(),
  KASPI: new KaspiProvider()
};

export function getPaymentProviderClient(provider = getConfiguredPaymentProvider()) {
  const client = providers[provider];
  if (!client) {
    throw new Error(`Payment provider ${provider} does not support hosted checkout yet`);
  }
  return client;
}

export function getConfiguredPaymentProvider(): PaymentProvider {
  const configured = String(process.env.PAYMENT_PROVIDER ?? "MOCK").toUpperCase();
  return Object.values(PaymentProvider).includes(configured as PaymentProvider)
    ? (configured as PaymentProvider)
    : PaymentProvider.MOCK;
}

export function parsePaymentProvider(value: string) {
  const normalized = value.trim().replace(/-/g, "_").toUpperCase();
  if (!Object.values(PaymentProvider).includes(normalized as PaymentProvider)) {
    throw new Error("Unsupported payment provider");
  }
  return normalized as PaymentProvider;
}
