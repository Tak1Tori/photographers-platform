import type {
  PaymentProvider,
  PaymentStatus,
  PaymentType
} from "@prisma/client";

export interface CreateCheckoutSessionInput {
  paymentId: string;
  bookingId: string;
  bookingNumber: string;
  amount: number;
  currency: string;
  type: PaymentType;
  description: string;
  successUrl: string;
  cancelUrl: string;
  customer?: {
    id?: string;
    name: string;
    email: string;
    phone: string;
  };
}

export interface CreateCheckoutSessionResult {
  providerPaymentId: string;
  checkoutUrl: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
}

export interface VerifyWebhookSignatureInput {
  rawBody: string;
  signature: string | null;
  headers: Headers;
}

export interface ParseWebhookEventInput {
  rawBody: string;
  headers: Headers;
}

export interface NormalizedWebhookEvent {
  provider: PaymentProvider;
  providerPaymentId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  eventType: string;
  rawPayload: unknown;
  providerFee?: number;
}

export interface RefundPaymentInput {
  providerPaymentId: string;
  amount: number;
  currency: string;
  reason?: string;
}

export interface PaymentProviderClient {
  readonly provider: PaymentProvider;
  createCheckoutSession(
    input: CreateCheckoutSessionInput
  ): Promise<CreateCheckoutSessionResult>;
  verifyWebhookSignature(input: VerifyWebhookSignatureInput): Promise<boolean>;
  parseWebhookEvent(input: ParseWebhookEventInput): Promise<NormalizedWebhookEvent>;
  refundPayment?(input: RefundPaymentInput): Promise<{ providerRefundId: string }>;
}

export interface ProviderPaymentData {
  actorId?: string;
  providerPaymentId?: string;
  eventType?: string;
  providerFee?: number;
  rawPayload?: unknown;
}
