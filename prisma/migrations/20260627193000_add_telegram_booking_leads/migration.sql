-- CreateEnum
CREATE TYPE "AvailabilityHoldSource" AS ENUM ('BOOKING_FLOW', 'TELEGRAM_LEAD');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('PLATFORM', 'TELEGRAM_LEAD', 'ADMIN');

-- CreateEnum
CREATE TYPE "BookingLeadSource" AS ENUM ('TELEGRAM');

-- CreateEnum
CREATE TYPE "BookingLeadStatus" AS ENUM (
  'NEW',
  'NEEDS_CONFIRMATION',
  'CONFIRMED_BY_PROVIDER',
  'LINK_CREATED',
  'LINK_SENT',
  'CONVERTED_TO_BOOKING',
  'EXPIRED',
  'REJECTED',
  'CANCELLED'
);

-- AlterTable
ALTER TABLE "AvailabilityHold"
  ADD COLUMN "bookingLeadId" TEXT,
  ADD COLUMN "source" "AvailabilityHoldSource" NOT NULL DEFAULT 'BOOKING_FLOW';

-- AlterTable
ALTER TABLE "Booking"
  ADD COLUMN "source" "BookingSource" NOT NULL DEFAULT 'PLATFORM',
  ADD COLUMN "bookingLeadId" TEXT,
  ADD COLUMN "externalSourceProvider" "ExternalProvider",
  ADD COLUMN "externalSourceMessageId" TEXT;

-- CreateTable
CREATE TABLE "BookingLead" (
  "id" TEXT NOT NULL,
  "source" "BookingLeadSource" NOT NULL,
  "provider" "ExternalProvider" NOT NULL,
  "externalChannelId" TEXT,
  "externalMessageId" TEXT,
  "externalSourceMessageId" TEXT,
  "ownerType" "CalendarOwnerType" NOT NULL,
  "bookingType" "BookingType" NOT NULL,
  "photographerProfileId" TEXT,
  "studioProfileId" TEXT,
  "studioHallId" TEXT,
  "clientName" TEXT,
  "clientPhone" TEXT,
  "clientEmail" TEXT,
  "clientComment" TEXT,
  "originalText" TEXT NOT NULL,
  "parsedStartTime" TIMESTAMP(3),
  "parsedEndTime" TIMESTAMP(3),
  "parsedDurationMinutes" INTEGER,
  "title" TEXT,
  "notes" TEXT,
  "confidence" INTEGER NOT NULL DEFAULT 0,
  "status" "BookingLeadStatus" NOT NULL DEFAULT 'NEEDS_CONFIRMATION',
  "bookingId" TEXT,
  "availabilityHoldId" TEXT,
  "publicToken" TEXT,
  "publicLinkExpiresAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "convertedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BookingLead_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BookingLead_owner_check" CHECK (
    ("ownerType" = 'PHOTOGRAPHER' AND "bookingType" = 'PHOTOGRAPHER_ONLY' AND "photographerProfileId" IS NOT NULL AND "studioHallId" IS NULL)
    OR
    ("ownerType" = 'STUDIO_HALL' AND "bookingType" = 'STUDIO_ONLY' AND "studioHallId" IS NOT NULL AND "photographerProfileId" IS NULL)
  ),
  CONSTRAINT "BookingLead_range_check" CHECK (
    "parsedStartTime" IS NULL OR "parsedEndTime" IS NULL OR "parsedEndTime" > "parsedStartTime"
  ),
  CONSTRAINT "BookingLead_confidence_check" CHECK ("confidence" >= 0 AND "confidence" <= 100)
);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingLeadId_key" ON "Booking"("bookingLeadId");
CREATE INDEX "Booking_source_createdAt_idx" ON "Booking"("source", "createdAt");
CREATE INDEX "AvailabilityHold_bookingLeadId_status_idx" ON "AvailabilityHold"("bookingLeadId", "status");
CREATE UNIQUE INDEX "BookingLead_bookingId_key" ON "BookingLead"("bookingId");
CREATE UNIQUE INDEX "BookingLead_availabilityHoldId_key" ON "BookingLead"("availabilityHoldId");
CREATE UNIQUE INDEX "BookingLead_publicToken_key" ON "BookingLead"("publicToken");
CREATE INDEX "BookingLead_photographerProfileId_status_createdAt_idx" ON "BookingLead"("photographerProfileId", "status", "createdAt");
CREATE INDEX "BookingLead_studioProfileId_status_createdAt_idx" ON "BookingLead"("studioProfileId", "status", "createdAt");
CREATE INDEX "BookingLead_studioHallId_status_createdAt_idx" ON "BookingLead"("studioHallId", "status", "createdAt");
CREATE INDEX "BookingLead_publicToken_publicLinkExpiresAt_idx" ON "BookingLead"("publicToken", "publicLinkExpiresAt");
CREATE INDEX "BookingLead_provider_externalSourceMessageId_idx" ON "BookingLead"("provider", "externalSourceMessageId");
CREATE INDEX "BookingLead_status_publicLinkExpiresAt_idx" ON "BookingLead"("status", "publicLinkExpiresAt");

-- AddForeignKey
ALTER TABLE "AvailabilityHold" ADD CONSTRAINT "AvailabilityHold_bookingLeadId_fkey" FOREIGN KEY ("bookingLeadId") REFERENCES "BookingLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_bookingLeadId_fkey" FOREIGN KEY ("bookingLeadId") REFERENCES "BookingLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingLead" ADD CONSTRAINT "BookingLead_externalChannelId_fkey" FOREIGN KEY ("externalChannelId") REFERENCES "ExternalChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingLead" ADD CONSTRAINT "BookingLead_externalMessageId_fkey" FOREIGN KEY ("externalMessageId") REFERENCES "ExternalMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingLead" ADD CONSTRAINT "BookingLead_photographerProfileId_fkey" FOREIGN KEY ("photographerProfileId") REFERENCES "PhotographerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingLead" ADD CONSTRAINT "BookingLead_studioProfileId_fkey" FOREIGN KEY ("studioProfileId") REFERENCES "StudioProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingLead" ADD CONSTRAINT "BookingLead_studioHallId_fkey" FOREIGN KEY ("studioHallId") REFERENCES "StudioHall"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingLead" ADD CONSTRAINT "BookingLead_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingLead" ADD CONSTRAINT "BookingLead_availabilityHoldId_fkey" FOREIGN KEY ("availabilityHoldId") REFERENCES "AvailabilityHold"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BookingLead" ENABLE ROW LEVEL SECURITY;
