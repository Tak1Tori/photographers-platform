CREATE TYPE "StudioConfirmationMode" AS ENUM ('PLATFORM_CALENDAR_AUTO', 'WHATSAPP_CONFIRMATION', 'MANUAL_DASHBOARD_CONFIRMATION');

CREATE TYPE "StudioConfirmationRequestStatus" AS ENUM ('PENDING_STUDIO_CONFIRMATION', 'ACCEPTED_BY_STUDIO', 'REJECTED_BY_STUDIO', 'EXPIRED', 'CANCELLED', 'CONVERTED_TO_BOOKING');

CREATE TYPE "StudioConfirmationRejectionReason" AS ENUM ('TIME_UNAVAILABLE', 'HALL_UNAVAILABLE', 'OTHER');

ALTER TABLE "StudioProfile"
ADD COLUMN "confirmationMode" "StudioConfirmationMode" NOT NULL DEFAULT 'PLATFORM_CALENDAR_AUTO',
ADD COLUMN "whatsappBookingPhone" TEXT,
ADD COLUMN "whatsappContactName" TEXT,
ADD COLUMN "whatsappResponseTimeoutMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "whatsappConfirmationEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "StudioConfirmationRequest" (
  "id" TEXT NOT NULL,
  "studioProfileId" TEXT NOT NULL,
  "studioHallId" TEXT NOT NULL,
  "bookingId" TEXT,
  "clientId" TEXT,
  "bookingType" "BookingType" NOT NULL DEFAULT 'STUDIO_ONLY',
  "status" "StudioConfirmationRequestStatus" NOT NULL DEFAULT 'PENDING_STUDIO_CONFIRMATION',
  "confirmationToken" TEXT NOT NULL,
  "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "rejectionReason" "StudioConfirmationRejectionReason",
  "rejectionComment" TEXT,
  "studioName" TEXT NOT NULL,
  "hallName" TEXT NOT NULL,
  "startTime" TIMESTAMP(3) NOT NULL,
  "endTime" TIMESTAMP(3) NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "totalServicePrice" INTEGER NOT NULL,
  "platformFeeAmount" INTEGER NOT NULL,
  "providerAmount" INTEGER NOT NULL,
  "clientName" TEXT,
  "clientPhone" TEXT,
  "clientEmail" TEXT,
  "clientComment" TEXT,
  "whatsappMessageText" TEXT,
  "whatsappOpenUrl" TEXT,
  "whatsappMessageTextAfterPayment" TEXT,
  "whatsappOpenUrlAfterPayment" TEXT,
  "sentToWhatsappAt" TIMESTAMP(3),
  "openedAt" TIMESTAMP(3),
  "rentalPurpose" TEXT,
  "shootDescription" TEXT,
  "needsEquipment" BOOLEAN,
  "selectedAmenities" JSONB,
  "peopleCount" INTEGER,
  "specialRequirements" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudioConfirmationRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudioConfirmationRequest_bookingId_key" ON "StudioConfirmationRequest"("bookingId");
CREATE UNIQUE INDEX "StudioConfirmationRequest_confirmationToken_key" ON "StudioConfirmationRequest"("confirmationToken");
CREATE INDEX "StudioConfirmationRequest_studioProfileId_status_createdAt_idx" ON "StudioConfirmationRequest"("studioProfileId", "status", "createdAt");
CREATE INDEX "StudioConfirmationRequest_clientId_status_createdAt_idx" ON "StudioConfirmationRequest"("clientId", "status", "createdAt");
CREATE INDEX "StudioConfirmationRequest_studioHallId_startTime_endTime_idx" ON "StudioConfirmationRequest"("studioHallId", "startTime", "endTime");
CREATE INDEX "StudioConfirmationRequest_status_tokenExpiresAt_idx" ON "StudioConfirmationRequest"("status", "tokenExpiresAt");

ALTER TABLE "StudioConfirmationRequest" ADD CONSTRAINT "StudioConfirmationRequest_studioProfileId_fkey" FOREIGN KEY ("studioProfileId") REFERENCES "StudioProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudioConfirmationRequest" ADD CONSTRAINT "StudioConfirmationRequest_studioHallId_fkey" FOREIGN KEY ("studioHallId") REFERENCES "StudioHall"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudioConfirmationRequest" ADD CONSTRAINT "StudioConfirmationRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudioConfirmationRequest" ADD CONSTRAINT "StudioConfirmationRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
