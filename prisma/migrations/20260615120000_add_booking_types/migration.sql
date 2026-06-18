CREATE TYPE "BookingType" AS ENUM (
  'FULL_SHOOT',
  'PHOTOGRAPHER_ONLY',
  'STUDIO_ONLY'
);

ALTER TABLE "Booking"
  ADD COLUMN "bookingType" "BookingType" NOT NULL DEFAULT 'FULL_SHOOT',
  ADD COLUMN "shootType" TEXT,
  ADD COLUMN "shootDescription" TEXT,
  ADD COLUMN "locationType" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "district" TEXT,
  ADD COLUMN "addressDetails" TEXT,
  ADD COLUMN "peopleCount" INTEGER,
  ADD COLUMN "equipmentNeeded" JSONB,
  ADD COLUMN "specialRequirements" TEXT,
  ADD COLUMN "rentalPurpose" TEXT,
  ADD COLUMN "needsEquipment" BOOLEAN,
  ADD COLUMN "selectedAmenities" JSONB;

ALTER TABLE "Booking" DROP CONSTRAINT "Booking_photographerId_fkey";
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_studioId_fkey";
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_studioHallId_fkey";

ALTER TABLE "Booking" ALTER COLUMN "photographerId" DROP NOT NULL;
ALTER TABLE "Booking" ALTER COLUMN "studioId" DROP NOT NULL;
ALTER TABLE "Booking" ALTER COLUMN "studioHallId" DROP NOT NULL;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_photographerId_fkey"
  FOREIGN KEY ("photographerId") REFERENCES "PhotographerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_studioId_fkey"
  FOREIGN KEY ("studioId") REFERENCES "StudioProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_studioHallId_fkey"
  FOREIGN KEY ("studioHallId") REFERENCES "StudioHall"("id") ON DELETE SET NULL ON UPDATE CASCADE;
