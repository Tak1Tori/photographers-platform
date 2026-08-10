-- Platform fee only settlement model.

CREATE TYPE "SettlementMode" AS ENUM ('PLATFORM_FEE_ONLY', 'AGENT_FULL_COLLECTION');
CREATE TYPE "ProviderPaymentStatus" AS ENUM ('NOT_TRACKED', 'EXTERNAL_PENDING', 'EXTERNAL_PAID', 'EXTERNAL_CANCELLED');
CREATE TYPE "PlatformFeeStatus" AS ENUM ('UNPAID', 'PAID', 'REFUND_REQUESTED', 'REFUNDED', 'NON_REFUNDABLE');
CREATE TYPE "CancellationReason" AS ENUM (
  'CLIENT_CHANGED_PLANS',
  'CLIENT_NO_SHOW',
  'PROVIDER_CANCELLED',
  'PROVIDER_NO_SHOW',
  'WEATHER',
  'TECHNICAL_ERROR',
  'DOUBLE_BOOKING',
  'PLATFORM_ERROR',
  'OTHER'
);

ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'PENDING_PLATFORM_FEE';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'RESCHEDULE_REQUESTED';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'RESCHEDULED';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'CANCELLED_BY_CLIENT';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'CANCELLED_BY_PROVIDER';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'CANCELLED_BY_PLATFORM';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'NO_SHOW_CLIENT';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'NO_SHOW_PROVIDER';
ALTER TYPE "PaymentType" ADD VALUE IF NOT EXISTS 'PLATFORM_FEE';

ALTER TABLE "Booking"
  ADD COLUMN "settlementMode" "SettlementMode" NOT NULL DEFAULT 'PLATFORM_FEE_ONLY',
  ADD COLUMN "totalServicePrice" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "platformFeeAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "providerAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "platformFeePaidAt" TIMESTAMP(3),
  ADD COLUMN "platformFeeStatus" "PlatformFeeStatus" NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN "providerPaymentStatus" "ProviderPaymentStatus" NOT NULL DEFAULT 'EXTERNAL_PENDING',
  ADD COLUMN "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxFreeReschedules" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledById" TEXT,
  ADD COLUMN "cancellationReason" "CancellationReason",
  ADD COLUMN "cancellationComment" TEXT;

UPDATE "Booking"
SET
  "totalServicePrice" = GREATEST("totalPrice" - "serviceFee", 0),
  "platformFeeAmount" = "serviceFee",
  "providerAmount" = GREATEST("totalPrice" - "serviceFee", 0),
  "platformFeeStatus" = CASE
    WHEN "paymentStatus" IN ('DEPOSIT_PAID', 'FINAL_PAYMENT_PENDING', 'FULLY_PAID') THEN 'PAID'::"PlatformFeeStatus"
    WHEN "paymentStatus" = 'REFUNDED' THEN 'REFUNDED'::"PlatformFeeStatus"
    ELSE 'UNPAID'::"PlatformFeeStatus"
  END,
  "providerPaymentStatus" = CASE
    WHEN "paymentStatus" = 'FULLY_PAID' THEN 'EXTERNAL_PAID'::"ProviderPaymentStatus"
    WHEN "status" IN ('CANCELLED', 'DECLINED') THEN 'EXTERNAL_CANCELLED'::"ProviderPaymentStatus"
    ELSE 'EXTERNAL_PENDING'::"ProviderPaymentStatus"
  END,
  "platformFeePaidAt" = CASE
    WHEN "paymentStatus" IN ('DEPOSIT_PAID', 'FINAL_PAYMENT_PENDING', 'FULLY_PAID') THEN COALESCE("fullyPaidAt", "updatedAt")
    ELSE NULL
  END
WHERE "totalServicePrice" = 0 AND "platformFeeAmount" = 0 AND "providerAmount" = 0;

CREATE INDEX "Booking_platformFeeStatus_createdAt_idx" ON "Booking"("platformFeeStatus", "createdAt");
CREATE INDEX "Booking_providerPaymentStatus_createdAt_idx" ON "Booking"("providerPaymentStatus", "createdAt");
CREATE INDEX "Booking_cancelledById_idx" ON "Booking"("cancelledById");

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_cancelledById_fkey"
  FOREIGN KEY ("cancelledById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
