-- CreateEnum
CREATE TYPE "ExternalProvider" AS ENUM ('TELEGRAM');

-- CreateEnum
CREATE TYPE "ExternalChannelOwnerType" AS ENUM ('PHOTOGRAPHER', 'STUDIO');

-- CreateEnum
CREATE TYPE "ExternalMessageStatus" AS ENUM ('RECEIVED', 'IGNORED', 'PARSED', 'NEEDS_CONFIRMATION', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "CalendarDraftSource" AS ENUM ('TELEGRAM');

-- CreateEnum
CREATE TYPE "CalendarDraftStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "CalendarEventSource" ADD VALUE 'TELEGRAM';

-- CreateTable
CREATE TABLE "ExternalChannel" (
    "id" TEXT NOT NULL,
    "provider" "ExternalProvider" NOT NULL,
    "ownerType" "ExternalChannelOwnerType" NOT NULL,
    "photographerProfileId" TEXT,
    "studioProfileId" TEXT,
    "telegramChatId" TEXT,
    "telegramUserId" TEXT,
    "telegramUsername" TEXT,
    "title" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalChannel_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ExternalChannel_owner_check" CHECK (
      ("ownerType" = 'PHOTOGRAPHER' AND "photographerProfileId" IS NOT NULL AND "studioProfileId" IS NULL)
      OR
      ("ownerType" = 'STUDIO' AND "studioProfileId" IS NOT NULL AND "photographerProfileId" IS NULL)
    )
);

-- CreateTable
CREATE TABLE "ExternalMessage" (
    "id" TEXT NOT NULL,
    "channelId" TEXT,
    "provider" "ExternalProvider" NOT NULL,
    "externalMessageId" TEXT NOT NULL,
    "telegramChatId" TEXT,
    "telegramUserId" TEXT,
    "senderName" TEXT,
    "senderUsername" TEXT,
    "text" TEXT,
    "rawPayload" JSONB NOT NULL,
    "status" "ExternalMessageStatus" NOT NULL DEFAULT 'RECEIVED',
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarDraft" (
    "id" TEXT NOT NULL,
    "source" "CalendarDraftSource" NOT NULL,
    "ownerType" "CalendarOwnerType" NOT NULL,
    "photographerProfileId" TEXT,
    "studioHallId" TEXT,
    "externalMessageId" TEXT,
    "title" TEXT,
    "originalText" TEXT NOT NULL,
    "parsedStartTime" TIMESTAMP(3),
    "parsedEndTime" TIMESTAMP(3),
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "status" "CalendarDraftStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarDraft_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CalendarDraft_owner_check" CHECK (
      ("ownerType" = 'PHOTOGRAPHER' AND "photographerProfileId" IS NOT NULL AND "studioHallId" IS NULL)
      OR
      ("ownerType" = 'STUDIO_HALL' AND "studioHallId" IS NOT NULL AND "photographerProfileId" IS NULL)
    ),
    CONSTRAINT "CalendarDraft_range_check" CHECK (
      "parsedStartTime" IS NULL OR "parsedEndTime" IS NULL OR "parsedEndTime" > "parsedStartTime"
    ),
    CONSTRAINT "CalendarDraft_confidence_check" CHECK ("confidence" >= 0 AND "confidence" <= 100)
);

-- CreateTable
CREATE TABLE "TelegramConnectionCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ownerType" "ExternalChannelOwnerType" NOT NULL,
    "photographerProfileId" TEXT,
    "studioProfileId" TEXT,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramConnectionCode_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TelegramConnectionCode_owner_check" CHECK (
      ("ownerType" = 'PHOTOGRAPHER' AND "photographerProfileId" IS NOT NULL AND "studioProfileId" IS NULL)
      OR
      ("ownerType" = 'STUDIO' AND "studioProfileId" IS NOT NULL AND "photographerProfileId" IS NULL)
    )
);

-- CreateIndex
CREATE INDEX "ExternalChannel_provider_telegramChatId_isActive_idx" ON "ExternalChannel"("provider", "telegramChatId", "isActive");
CREATE INDEX "ExternalChannel_photographerProfileId_isActive_idx" ON "ExternalChannel"("photographerProfileId", "isActive");
CREATE INDEX "ExternalChannel_studioProfileId_isActive_idx" ON "ExternalChannel"("studioProfileId", "isActive");
CREATE UNIQUE INDEX "ExternalMessage_provider_externalMessageId_key" ON "ExternalMessage"("provider", "externalMessageId");
CREATE INDEX "ExternalMessage_channelId_createdAt_idx" ON "ExternalMessage"("channelId", "createdAt");
CREATE INDEX "ExternalMessage_provider_status_createdAt_idx" ON "ExternalMessage"("provider", "status", "createdAt");
CREATE INDEX "ExternalMessage_telegramChatId_createdAt_idx" ON "ExternalMessage"("telegramChatId", "createdAt");
CREATE INDEX "CalendarDraft_photographerProfileId_status_createdAt_idx" ON "CalendarDraft"("photographerProfileId", "status", "createdAt");
CREATE INDEX "CalendarDraft_studioHallId_status_createdAt_idx" ON "CalendarDraft"("studioHallId", "status", "createdAt");
CREATE INDEX "CalendarDraft_externalMessageId_idx" ON "CalendarDraft"("externalMessageId");
CREATE INDEX "CalendarDraft_status_expiresAt_idx" ON "CalendarDraft"("status", "expiresAt");
CREATE UNIQUE INDEX "TelegramConnectionCode_code_key" ON "TelegramConnectionCode"("code");
CREATE INDEX "TelegramConnectionCode_userId_ownerType_createdAt_idx" ON "TelegramConnectionCode"("userId", "ownerType", "createdAt");
CREATE INDEX "TelegramConnectionCode_code_expiresAt_usedAt_idx" ON "TelegramConnectionCode"("code", "expiresAt", "usedAt");

-- AddForeignKey
ALTER TABLE "ExternalChannel" ADD CONSTRAINT "ExternalChannel_photographerProfileId_fkey" FOREIGN KEY ("photographerProfileId") REFERENCES "PhotographerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalChannel" ADD CONSTRAINT "ExternalChannel_studioProfileId_fkey" FOREIGN KEY ("studioProfileId") REFERENCES "StudioProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalMessage" ADD CONSTRAINT "ExternalMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ExternalChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarDraft" ADD CONSTRAINT "CalendarDraft_photographerProfileId_fkey" FOREIGN KEY ("photographerProfileId") REFERENCES "PhotographerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarDraft" ADD CONSTRAINT "CalendarDraft_studioHallId_fkey" FOREIGN KEY ("studioHallId") REFERENCES "StudioHall"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarDraft" ADD CONSTRAINT "CalendarDraft_externalMessageId_fkey" FOREIGN KEY ("externalMessageId") REFERENCES "ExternalMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarDraft" ADD CONSTRAINT "CalendarDraft_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarDraft" ADD CONSTRAINT "CalendarDraft_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TelegramConnectionCode" ADD CONSTRAINT "TelegramConnectionCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramConnectionCode" ADD CONSTRAINT "TelegramConnectionCode_photographerProfileId_fkey" FOREIGN KEY ("photographerProfileId") REFERENCES "PhotographerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramConnectionCode" ADD CONSTRAINT "TelegramConnectionCode_studioProfileId_fkey" FOREIGN KEY ("studioProfileId") REFERENCES "StudioProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The app accesses these tables through authenticated server-side Prisma code.
ALTER TABLE "ExternalChannel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExternalMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CalendarDraft" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TelegramConnectionCode" ENABLE ROW LEVEL SECURITY;
