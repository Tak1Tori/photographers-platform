-- Extend notification delivery channels for real Telegram notifications.
ALTER TYPE "NotificationChannel" ADD VALUE IF NOT EXISTS 'TELEGRAM';
ALTER TYPE "NotificationDeliveryStatus" ADD VALUE IF NOT EXISTS 'SKIPPED';

-- Create explicit Telegram connection state per platform user.
CREATE TYPE "TelegramConnectionStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');

CREATE TABLE "TelegramConnection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "telegramChatId" TEXT,
  "telegramUserId" TEXT,
  "telegramUsername" TEXT,
  "status" "TelegramConnectionStatus" NOT NULL DEFAULT 'PENDING',
  "connectionCode" TEXT,
  "codeExpiresAt" TIMESTAMP(3),
  "connectedAt" TIMESTAMP(3),
  "disconnectedAt" TIMESTAMP(3),
  "lastMessageAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TelegramConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TelegramConnection_telegramChatId_key" ON "TelegramConnection"("telegramChatId");
CREATE UNIQUE INDEX "TelegramConnection_connectionCode_key" ON "TelegramConnection"("connectionCode");
CREATE INDEX "TelegramConnection_userId_status_idx" ON "TelegramConnection"("userId", "status");
CREATE INDEX "TelegramConnection_connectionCode_codeExpiresAt_idx" ON "TelegramConnection"("connectionCode", "codeExpiresAt");

ALTER TABLE "TelegramConnection"
  ADD CONSTRAINT "TelegramConnection_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Delivery logs need the target user for channel settings and audits.
ALTER TABLE "NotificationDeliveryLog" ADD COLUMN "userId" TEXT;
ALTER TABLE "NotificationDeliveryLog" ADD COLUMN "providerMessageId" TEXT;
ALTER TABLE "NotificationDeliveryLog" ADD COLUMN "sentAt" TIMESTAMP(3);
ALTER TABLE "NotificationDeliveryLog" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "NotificationDeliveryLog" AS log
SET "userId" = notification."userId"
FROM "Notification" AS notification
WHERE log."notificationId" = notification."id";

ALTER TABLE "NotificationDeliveryLog" ALTER COLUMN "userId" SET NOT NULL;

CREATE INDEX "NotificationDeliveryLog_userId_channel_status_idx"
  ON "NotificationDeliveryLog"("userId", "channel", "status");

ALTER TABLE "NotificationDeliveryLog"
  ADD CONSTRAINT "NotificationDeliveryLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
