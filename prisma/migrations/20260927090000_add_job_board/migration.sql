CREATE TYPE "JobPostStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SELECTED', 'PAUSED', 'CLOSED', 'EXPIRED');
CREATE TYPE "JobResponseStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'JOB_RESPONSE_CREATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'JOB_RESPONSE_ACCEPTED';

CREATE TABLE "JobPost" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "startTime" TEXT NOT NULL,
  "durationHours" INTEGER NOT NULL,
  "budget" INTEGER NOT NULL,
  "styleId" TEXT,
  "status" "JobPostStatus" NOT NULL DEFAULT 'PUBLISHED',
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "selectedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "JobPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobResponse" (
  "id" TEXT NOT NULL,
  "jobPostId" TEXT NOT NULL,
  "photographerId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "quotedPrice" INTEGER NOT NULL,
  "status" "JobResponseStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "JobResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JobResponse_jobPostId_photographerId_key"
  ON "JobResponse"("jobPostId", "photographerId");
CREATE INDEX "JobPost_status_expiresAt_publishedAt_idx"
  ON "JobPost"("status", "expiresAt", "publishedAt");
CREATE INDEX "JobPost_city_date_status_idx"
  ON "JobPost"("city", "date", "status");
CREATE INDEX "JobPost_clientId_createdAt_idx"
  ON "JobPost"("clientId", "createdAt");
CREATE INDEX "JobPost_styleId_status_idx"
  ON "JobPost"("styleId", "status");
CREATE INDEX "JobResponse_photographerId_status_createdAt_idx"
  ON "JobResponse"("photographerId", "status", "createdAt");
CREATE INDEX "JobResponse_jobPostId_status_createdAt_idx"
  ON "JobResponse"("jobPostId", "status", "createdAt");

ALTER TABLE "JobPost"
  ADD CONSTRAINT "JobPost_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobPost"
  ADD CONSTRAINT "JobPost_styleId_fkey"
  FOREIGN KEY ("styleId") REFERENCES "Style"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobResponse"
  ADD CONSTRAINT "JobResponse_jobPostId_fkey"
  FOREIGN KEY ("jobPostId") REFERENCES "JobPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobResponse"
  ADD CONSTRAINT "JobResponse_photographerId_fkey"
  FOREIGN KEY ("photographerId") REFERENCES "PhotographerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobPost" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobResponse" ENABLE ROW LEVEL SECURITY;
