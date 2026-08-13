CREATE TABLE "PendingRegistration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "acceptedTermsVersion" TEXT NOT NULL,
    "acceptedPrivacyVersion" TEXT NOT NULL,
    "telegramGatewayRequestId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "resendAvailableAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingRegistration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PendingRegistration_phone_key" ON "PendingRegistration"("phone");
CREATE UNIQUE INDEX "PendingRegistration_telegramGatewayRequestId_key"
ON "PendingRegistration"("telegramGatewayRequestId");
CREATE INDEX "PendingRegistration_expiresAt_idx" ON "PendingRegistration"("expiresAt");

ALTER TABLE public."PendingRegistration" ENABLE ROW LEVEL SECURITY;
