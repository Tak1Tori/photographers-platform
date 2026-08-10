-- Existing records predate verified-phone authentication. Normalize them before
-- Telegram OIDC begins using User.phone as a possible account-linking key.
-- The existing User_phone_key index remains the only uniqueness constraint.
DO $$
DECLARE
  invalid_phone_count INTEGER;
  duplicate_phone_count INTEGER;
BEGIN
  -- Keep the verification and update together while the unique phone key is in use.
  LOCK TABLE "User" IN SHARE ROW EXCLUSIVE MODE;

  WITH normalized AS (
    SELECT
      "id",
      CASE
        WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^7[0-9]{10}$'
          THEN '+' || regexp_replace("phone", '[^0-9]', '', 'g')
        WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^8[0-9]{10}$'
          THEN '+7' || substring(regexp_replace("phone", '[^0-9]', '', 'g') FROM 2)
        WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^[0-9]{10}$'
          THEN '+7' || regexp_replace("phone", '[^0-9]', '', 'g')
        ELSE NULL
      END AS normalized_phone
    FROM "User"
    WHERE "phone" IS NOT NULL
  )
  SELECT count(*) INTO invalid_phone_count
  FROM normalized
  WHERE normalized_phone IS NULL;

  IF invalid_phone_count > 0 THEN
    RAISE EXCEPTION
      'Cannot normalize User.phone: % non-Kazakhstan phone value(s) require manual review',
      invalid_phone_count;
  END IF;

  WITH normalized AS (
    SELECT CASE
      WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^7[0-9]{10}$'
        THEN '+' || regexp_replace("phone", '[^0-9]', '', 'g')
      WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^8[0-9]{10}$'
        THEN '+7' || substring(regexp_replace("phone", '[^0-9]', '', 'g') FROM 2)
      WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^[0-9]{10}$'
        THEN '+7' || regexp_replace("phone", '[^0-9]', '', 'g')
      ELSE NULL
    END AS normalized_phone
    FROM "User"
    WHERE "phone" IS NOT NULL
  )
  SELECT count(*) INTO duplicate_phone_count
  FROM (
    SELECT normalized_phone
    FROM normalized
    GROUP BY normalized_phone
    HAVING count(*) > 1
  ) duplicates;

  IF duplicate_phone_count > 0 THEN
    RAISE EXCEPTION
      'Cannot normalize User.phone: % normalized phone collision(s) require manual resolution',
      duplicate_phone_count;
  END IF;

  UPDATE "User"
  SET "phone" = CASE
    WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^7[0-9]{10}$'
      THEN '+' || regexp_replace("phone", '[^0-9]', '', 'g')
    WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^8[0-9]{10}$'
      THEN '+7' || substring(regexp_replace("phone", '[^0-9]', '', 'g') FROM 2)
    WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^[0-9]{10}$'
      THEN '+7' || regexp_replace("phone", '[^0-9]', '', 'g')
  END
  WHERE "phone" IS NOT NULL;
END $$;

ALTER TABLE "TelegramLoginIntent" ADD COLUMN "pendingLinkUserId" TEXT;

CREATE INDEX "TelegramLoginIntent_pendingLinkUserId_expiresAt_idx"
  ON "TelegramLoginIntent"("pendingLinkUserId", "expiresAt");

ALTER TABLE "TelegramLoginIntent"
ADD CONSTRAINT "TelegramLoginIntent_pendingLinkUserId_fkey"
FOREIGN KEY ("pendingLinkUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
