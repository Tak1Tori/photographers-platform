ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'EDITOR';

ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

UPDATE "User"
SET "phone" = '+' || regexp_replace("phone", '\\D', '', 'g')
WHERE "phone" IS NOT NULL;

CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
