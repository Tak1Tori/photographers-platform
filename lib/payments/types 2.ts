export type ProviderPaymentStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";

export interface CreatePaymentSessionInput {
  paymentId: string;
  bookingNumber: string;
  amount: number;
  currency: string;
}

export interface CreatePaymentSessionResult {
  paymentId: string;
  checkoutUrl: string;
  providerPaymentId: string;
  amount: number;
  currency: string;
  status: ProviderPaymentStatus;
}

export interface ConfirmPaymentInput {
  paymentId: string;
  providerPaymentId?: string | null;
}

export interface ConfirmPaymentResult {
  providerPaymentId: string;
  status: ProviderPaymentStatus;
  paidAt?: Date;
}

export interface PaymentProviderAdapter {
  createPaymentSession(input: CreatePaymentSessionInput): Promise<CreatePaymentSessionResult>;
  confirmPayment(input: ConfirmPaymentInput): Promise<ConfirmPaymentResult>;
}
