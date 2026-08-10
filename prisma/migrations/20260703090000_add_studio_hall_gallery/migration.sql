CREATE TABLE "StudioHallImage" (
  "id" TEXT NOT NULL,
  "studioHallId" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "imagePublicId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudioHallImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudioHallImage_studioHallId_sortOrder_idx" ON "StudioHallImage"("studioHallId", "sortOrder");

ALTER TABLE "StudioHallImage" ADD CONSTRAINT "StudioHallImage_studioHallId_fkey" FOREIGN KEY ("studioHallId") REFERENCES "StudioHall"("id") ON DELETE CASCADE ON UPDATE CASCADE;
