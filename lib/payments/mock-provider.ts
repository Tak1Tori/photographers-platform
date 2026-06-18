import type {
  ConfirmPaymentInput,
  ConfirmPaymentResult,
  CreatePaymentSessionInput,
  CreatePaymentSessionResult,
  PaymentProviderAdapter
} from "@/lib/payments/types";

export class MockPaymentProvider implements PaymentProviderAdapter {
  async createPaymentSession(input: CreatePaymentSessionInput): Promise<CreatePaymentSessionResult> {
    return {
      paymentId: input.paymentId,
      checkoutUrl: `/checkout/mock?paymentId=${encodeURIComponent(input.paymentId)}`,
      providerPaymentId: `mock_${input.paymentId}`,
      amount: input.amount,
      currency: input.currency,
      status: "PENDING"
    };
  }

  async confirmPayment(input: ConfirmPaymentInput): Promise<ConfirmPaymentResult> {
    return {
      providerPaymentId: input.providerPaymentId ?? `mock_${input.paymentId}`,
      status: "PAID",
      paidAt: new Date()
    };
  }
}
