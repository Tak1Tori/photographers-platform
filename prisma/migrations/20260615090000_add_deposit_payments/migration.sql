CREATE TYPE "BookingPaymentStatus" AS ENUM ('UNPAID', 'DEPOSIT_PAID', 'PAID', 'REFUNDED', 'FAILED');
CREATE TYPE "PaymentProvider" AS ENUM ('MOCK', 'CLOUDPAYMENTS', 'KASPI', 'MANUAL');
CREATE TYPE "PaymentType" AS ENUM ('DEPOSIT', 'FULL_PAYMENT', 'REFUND');

ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED');

ALTER TABLE "Payment"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "PaymentStatus"
  USING (
    CASE
      WHEN "status"::text = 'MOCK_PAID' THEN 'PAID'
      WHEN "status"::text = 'MOCK_PENDING' THEN 'PENDING'
      ELSE "status"::text
    END
  )::"PaymentStatus";

DROP TYPE "PaymentStatus_old";

ALTER TABLE "Booking"
  ADD COLUMN "depositAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "paidAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "remainingAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "paymentStatus" "BookingPaymentStatus" NOT NULL DEFAULT 'UNPAID';

ALTER TABLE "Payment"
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'KZT',
  ADD COLUMN "providerPaymentId" TEXT,
  ADD COLUMN "type" "PaymentType" NOT NULL DEFAULT 'DEPOSIT',
  ADD COLUMN "metadata" JSONB;

ALTER TABLE "Payment"
  ALTER COLUMN "provider" TYPE "PaymentProvider"
  USING (
    CASE
      WHEN lower("provider"::text) = 'mock' THEN 'MOCK'
      ELSE upper("provider"::text)
    END
  )::"PaymentProvider",
  ALTER COLUMN "provider" SET DEFAULT 'MOCK';

ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_bookingId_key";
