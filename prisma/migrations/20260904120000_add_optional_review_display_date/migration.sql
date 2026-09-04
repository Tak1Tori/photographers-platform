-- Keep the record timestamp separate from the optional date shown with a review.
ALTER TABLE "public"."Review" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
