ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';

ALTER TYPE "BookingPaymentStatus" ADD VALUE IF NOT EXISTS 'DEPOSIT_PENDING';
ALTER TYPE "BookingPaymentStatus" ADD VALUE IF NOT EXISTS 'FINAL_PAYMENT_PENDING';
ALTER TYPE "BookingPaymentStatus" RENAME VALUE 'PAID' TO 'FULLY_PAID';

ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'FREEDOM_PAY';
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'PAYBOX';

ALTER TYPE "PaymentType" RENAME VALUE 'FULL_PAYMENT' TO 'FINAL_PAYMENT';

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FINAL_PAYMENT_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FULLY_PAID';

CREATE TYPE "PayoutStatus" AS ENUM (
  'NOT_READY',
  'PAYOUT_PENDING',
  'PAID_OUT',
  'ON_HOLD',
  'CANCELLED'
);

ALTER TABLE "Booking"
  ADD COLUMN "platformCommission" INTEGER,
  ADD COLUMN "providerFee" INTEGER,
  ADD COLUMN "netPlatformRevenue" INTEGER,
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "finalPaymentRequestedAt" TIMESTAMP(3),
  ADD COLUMN "fullyPaidAt" TIMESTAMP(3),
  ADD COLUMN "payoutStatus" "PayoutStatus",
  ADD COLUMN "payoutAmount" INTEGER;

UPDATE "Booking"
SET
  "platformCommission" = "serviceFee",
  "providerFee" = 0,
  "netPlatformRevenue" = "serviceFee"
WHERE "platformCommission" IS NULL;

ALTER TABLE "Payment"
  ADD COLUMN "providerCheckoutUrl" TEXT,
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "failedAt" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3);

UPDATE "Payment"
SET "paidAt" = "updatedAt"
WHERE "status" = 'PAID' AND "paidAt" IS NULL;

CREATE UNIQUE INDEX "Payment_providerPaymentId_key"
  ON "Payment"("providerPaymentId");
CREATE INDEX "Payment_bookingId_type_status_idx"
  ON "Payment"("bookingId", "type", "status");
CREATE INDEX "Payment_provider_status_createdAt_idx"
  ON "Payment"("provider", "status", "createdAt");

CREATE INDEX "Booking_clientId_createdAt_idx"
  ON "Booking"("clientId", "createdAt");
CREATE INDEX "Booking_photographerId_status_idx"
  ON "Booking"("photographerId", "status");
CREATE INDEX "Booking_studioId_status_idx"
  ON "Booking"("studioId", "status");
CREATE INDEX "Booking_paymentStatus_createdAt_idx"
  ON "Booking"("paymentStatus", "createdAt");

CREATE TABLE "PaymentWebhookLog" (
  "id" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "eventType" TEXT NOT NULL,
  "providerPaymentId" TEXT,
  "paymentId" TEXT,
  "bookingId" TEXT,
  "payload" JSONB NOT NULL,
  "signatureValid" BOOLEAN NOT NULL,
  "processed" BOOLEAN NOT NULL DEFAULT false,
  "processingError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "PaymentWebhookLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentAuditLog" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT,
  "bookingId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentWebhookLog_provider_providerPaymentId_idx"
  ON "PaymentWebhookLog"("provider", "providerPaymentId");
CREATE INDEX "PaymentWebhookLog_processed_createdAt_idx"
  ON "PaymentWebhookLog"("processed", "createdAt");
CREATE INDEX "PaymentWebhookLog_bookingId_createdAt_idx"
  ON "PaymentWebhookLog"("bookingId", "createdAt");
CREATE INDEX "PaymentAuditLog_bookingId_createdAt_idx"
  ON "PaymentAuditLog"("bookingId", "createdAt");
CREATE INDEX "PaymentAuditLog_paymentId_createdAt_idx"
  ON "PaymentAuditLog"("paymentId", "createdAt");

ALTER TABLE "PaymentWebhookLog"
  ADD CONSTRAINT "PaymentWebhookLog_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentWebhookLog"
  ADD CONSTRAINT "PaymentWebhookLog_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentAuditLog"
  ADD CONSTRAINT "PaymentAuditLog_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentAuditLog"
  ADD CONSTRAINT "PaymentAuditLog_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentWebhookLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentAuditLog" ENABLE ROW LEVEL SECURITY;
