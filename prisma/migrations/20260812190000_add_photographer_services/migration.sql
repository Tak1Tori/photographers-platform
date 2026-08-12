CREATE TABLE "PhotographerService" (
    "id" TEXT NOT NULL,
    "photographerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "included" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotographerService_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Booking"
  ADD COLUMN "photographerServiceId" TEXT,
  ADD COLUMN "photographerServiceTitle" TEXT,
  ADD COLUMN "photographerServicePrice" INTEGER,
  ADD COLUMN "photographerServiceDurationMinutes" INTEGER;

CREATE INDEX "PhotographerService_photographerId_isActive_sortOrder_idx"
ON "PhotographerService"("photographerId", "isActive", "sortOrder");

CREATE INDEX "Booking_photographerServiceId_idx"
ON "Booking"("photographerServiceId");

ALTER TABLE "PhotographerService"
ADD CONSTRAINT "PhotographerService_photographerId_fkey"
FOREIGN KEY ("photographerId") REFERENCES "PhotographerProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Booking"
ADD CONSTRAINT "Booking_photographerServiceId_fkey"
FOREIGN KEY ("photographerServiceId") REFERENCES "PhotographerService"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PhotographerService" ENABLE ROW LEVEL SECURITY;
