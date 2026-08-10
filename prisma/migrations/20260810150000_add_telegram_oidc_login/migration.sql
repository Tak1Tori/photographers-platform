ALTER TABLE "User" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

CREATE TABLE "TelegramLoginIntent" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "telegramSubject" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "username" TEXT,
    "image" TEXT,
    "phone" TEXT NOT NULL,
    "phoneVerifiedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "userId" TEXT,
    "sessionTokenHash" TEXT,
    "sessionTokenExpiresAt" TIMESTAMP(3),
    "sessionTokenUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramLoginIntent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TelegramLoginIntent_tokenHash_key" ON "TelegramLoginIntent"("tokenHash");
CREATE UNIQUE INDEX "TelegramLoginIntent_sessionTokenHash_key" ON "TelegramLoginIntent"("sessionTokenHash");
CREATE INDEX "TelegramLoginIntent_telegramSubject_expiresAt_idx" ON "TelegramLoginIntent"("telegramSubject", "expiresAt");
CREATE INDEX "TelegramLoginIntent_expiresAt_idx" ON "TelegramLoginIntent"("expiresAt");

ALTER TABLE "TelegramLoginIntent"
ADD CONSTRAINT "TelegramLoginIntent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
