-- CreateEnum
CREATE TYPE "CalendarOwnerType" AS ENUM ('PHOTOGRAPHER', 'STUDIO_HALL');

-- CreateEnum
CREATE TYPE "CalendarEventSource" AS ENUM ('PLATFORM_BOOKING', 'MANUAL_BUSY', 'SYSTEM_HOLD');

-- CreateEnum
CREATE TYPE "CalendarEventStatus" AS ENUM ('BUSY', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AvailabilityHoldStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CONVERTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "AvailabilityRule" (
    "id" TEXT NOT NULL,
    "ownerType" "CalendarOwnerType" NOT NULL,
    "photographerProfileId" TEXT,
    "studioHallId" TEXT,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "minDurationMinutes" INTEGER NOT NULL DEFAULT 60,
    "slotStepMinutes" INTEGER NOT NULL DEFAULT 30,
    "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
    "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AvailabilityRule_owner_check" CHECK (
      ("ownerType" = 'PHOTOGRAPHER' AND "photographerProfileId" IS NOT NULL AND "studioHallId" IS NULL)
      OR
      ("ownerType" = 'STUDIO_HALL' AND "studioHallId" IS NOT NULL AND "photographerProfileId" IS NULL)
    ),
    CONSTRAINT "AvailabilityRule_weekday_check" CHECK ("weekday" BETWEEN 0 AND 6),
    CONSTRAINT "AvailabilityRule_duration_check" CHECK (
      "minDurationMinutes" > 0 AND "slotStepMinutes" > 0
      AND "bufferBeforeMinutes" >= 0 AND "bufferAfterMinutes" >= 0
    )
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "ownerType" "CalendarOwnerType" NOT NULL,
    "photographerProfileId" TEXT,
    "studioHallId" TEXT,
    "bookingId" TEXT,
    "source" "CalendarEventSource" NOT NULL,
    "status" "CalendarEventStatus" NOT NULL DEFAULT 'BUSY',
    "title" TEXT,
    "privateNote" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
    "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CalendarEvent_owner_check" CHECK (
      ("ownerType" = 'PHOTOGRAPHER' AND "photographerProfileId" IS NOT NULL AND "studioHallId" IS NULL)
      OR
      ("ownerType" = 'STUDIO_HALL' AND "studioHallId" IS NOT NULL AND "photographerProfileId" IS NULL)
    ),
    CONSTRAINT "CalendarEvent_range_check" CHECK ("endTime" > "startTime"),
    CONSTRAINT "CalendarEvent_buffer_check" CHECK (
      "bufferBeforeMinutes" >= 0 AND "bufferAfterMinutes" >= 0
    )
);

-- CreateTable
CREATE TABLE "AvailabilityHold" (
    "id" TEXT NOT NULL,
    "ownerType" "CalendarOwnerType" NOT NULL,
    "photographerProfileId" TEXT,
    "studioHallId" TEXT,
    "bookingId" TEXT,
    "userId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "AvailabilityHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityHold_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AvailabilityHold_owner_check" CHECK (
      ("ownerType" = 'PHOTOGRAPHER' AND "photographerProfileId" IS NOT NULL AND "studioHallId" IS NULL)
      OR
      ("ownerType" = 'STUDIO_HALL' AND "studioHallId" IS NOT NULL AND "photographerProfileId" IS NULL)
    ),
    CONSTRAINT "AvailabilityHold_range_check" CHECK ("endTime" > "startTime")
);

-- CreateIndex
CREATE INDEX "AvailabilityRule_photographerProfileId_weekday_isActive_idx" ON "AvailabilityRule"("photographerProfileId", "weekday", "isActive");
CREATE INDEX "AvailabilityRule_studioHallId_weekday_isActive_idx" ON "AvailabilityRule"("studioHallId", "weekday", "isActive");
CREATE INDEX "CalendarEvent_photographerProfileId_status_startTime_endTime_idx" ON "CalendarEvent"("photographerProfileId", "status", "startTime", "endTime");
CREATE INDEX "CalendarEvent_studioHallId_status_startTime_endTime_idx" ON "CalendarEvent"("studioHallId", "status", "startTime", "endTime");
CREATE INDEX "CalendarEvent_bookingId_source_idx" ON "CalendarEvent"("bookingId", "source");
CREATE INDEX "AvailabilityHold_photographerProfileId_status_expiresAt_start_idx" ON "AvailabilityHold"("photographerProfileId", "status", "expiresAt", "startTime", "endTime");
CREATE INDEX "AvailabilityHold_studioHallId_status_expiresAt_startTime_end_idx" ON "AvailabilityHold"("studioHallId", "status", "expiresAt", "startTime", "endTime");
CREATE INDEX "AvailabilityHold_bookingId_status_idx" ON "AvailabilityHold"("bookingId", "status");

-- AddForeignKey
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_photographerProfileId_fkey" FOREIGN KEY ("photographerProfileId") REFERENCES "PhotographerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_studioHallId_fkey" FOREIGN KEY ("studioHallId") REFERENCES "StudioHall"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_photographerProfileId_fkey" FOREIGN KEY ("photographerProfileId") REFERENCES "PhotographerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_studioHallId_fkey" FOREIGN KEY ("studioHallId") REFERENCES "StudioHall"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AvailabilityHold" ADD CONSTRAINT "AvailabilityHold_photographerProfileId_fkey" FOREIGN KEY ("photographerProfileId") REFERENCES "PhotographerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AvailabilityHold" ADD CONSTRAINT "AvailabilityHold_studioHallId_fkey" FOREIGN KEY ("studioHallId") REFERENCES "StudioHall"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AvailabilityHold" ADD CONSTRAINT "AvailabilityHold_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AvailabilityHold" ADD CONSTRAINT "AvailabilityHold_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed sensible defaults for existing marketplace profiles.
INSERT INTO "AvailabilityRule" (
  "id", "ownerType", "photographerProfileId", "weekday", "startTime", "endTime",
  "isActive", "minDurationMinutes", "slotStepMinutes", "bufferBeforeMinutes",
  "bufferAfterMinutes", "createdAt", "updatedAt"
)
SELECT
  md5(random()::text || clock_timestamp()::text || p."id" || day::text),
  'PHOTOGRAPHER'::"CalendarOwnerType",
  p."id",
  day,
  CASE WHEN day = 6 THEN '11:00' ELSE '10:00' END,
  CASE WHEN day = 6 THEN '18:00' ELSE '20:00' END,
  true, 60, 30, 0, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "PhotographerProfile" p
CROSS JOIN generate_series(1, 6) AS day;

INSERT INTO "AvailabilityRule" (
  "id", "ownerType", "studioHallId", "weekday", "startTime", "endTime",
  "isActive", "minDurationMinutes", "slotStepMinutes", "bufferBeforeMinutes",
  "bufferAfterMinutes", "createdAt", "updatedAt"
)
SELECT
  md5(random()::text || clock_timestamp()::text || h."id" || day::text),
  'STUDIO_HALL'::"CalendarOwnerType",
  h."id",
  day,
  '09:00', '22:00', true, 60, 30, 0, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "StudioHall" h
CROSS JOIN generate_series(0, 6) AS day;

-- Backfill already paid/confirmed bookings into dashboard calendar events.
INSERT INTO "CalendarEvent" (
  "id", "ownerType", "photographerProfileId", "bookingId", "source", "status",
  "title", "startTime", "endTime", "createdAt", "updatedAt"
)
SELECT
  md5(random()::text || clock_timestamp()::text || b."id" || 'photographer'),
  'PHOTOGRAPHER'::"CalendarOwnerType",
  b."photographerId",
  b."id",
  'PLATFORM_BOOKING'::"CalendarEventSource",
  'BUSY'::"CalendarEventStatus",
  'Бронь ' || b."bookingNumber",
  ((b."date"::date + b."startTime"::time) AT TIME ZONE 'Asia/Almaty'),
  ((b."date"::date + b."endTime"::time) AT TIME ZONE 'Asia/Almaty'),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Booking" b
WHERE b."photographerId" IS NOT NULL
  AND b."status" NOT IN ('CANCELLED', 'DECLINED')
  AND (
    b."paymentStatus" IN ('DEPOSIT_PAID', 'FINAL_PAYMENT_PENDING', 'FULLY_PAID')
    OR b."status" IN ('CONFIRMED', 'IN_PROGRESS')
  );

INSERT INTO "CalendarEvent" (
  "id", "ownerType", "studioHallId", "bookingId", "source", "status",
  "title", "startTime", "endTime", "createdAt", "updatedAt"
)
SELECT
  md5(random()::text || clock_timestamp()::text || b."id" || 'hall'),
  'STUDIO_HALL'::"CalendarOwnerType",
  b."studioHallId",
  b."id",
  'PLATFORM_BOOKING'::"CalendarEventSource",
  'BUSY'::"CalendarEventStatus",
  'Бронь ' || b."bookingNumber",
  ((b."date"::date + b."startTime"::time) AT TIME ZONE 'Asia/Almaty'),
  ((b."date"::date + b."endTime"::time) AT TIME ZONE 'Asia/Almaty'),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Booking" b
WHERE b."studioHallId" IS NOT NULL
  AND b."status" NOT IN ('CANCELLED', 'DECLINED')
  AND (
    b."paymentStatus" IN ('DEPOSIT_PAID', 'FINAL_PAYMENT_PENDING', 'FULLY_PAID')
    OR b."status" IN ('CONFIRMED', 'IN_PROGRESS')
  );

-- The app accesses these tables only from authenticated server-side Prisma code.
ALTER TABLE "AvailabilityRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CalendarEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AvailabilityHold" ENABLE ROW LEVEL SECURITY;
