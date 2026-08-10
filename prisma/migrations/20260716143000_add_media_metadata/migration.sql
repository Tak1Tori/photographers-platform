CREATE TYPE "MediaProvider" AS ENUM ('CLOUDINARY', 'SUPABASE', 'LOCAL');

ALTER TABLE "PhotographerProfile"
  ADD COLUMN "avatarProvider" "MediaProvider",
  ADD COLUMN "avatarBytes" INTEGER,
  ADD COLUMN "avatarOriginalBytes" INTEGER,
  ADD COLUMN "avatarWidth" INTEGER,
  ADD COLUMN "avatarHeight" INTEGER,
  ADD COLUMN "avatarFormat" TEXT,
  ADD COLUMN "avatarMediaType" "AlbumMediaType" NOT NULL DEFAULT 'IMAGE';

ALTER TABLE "PhotographerPortfolioItem"
  ADD COLUMN "mediaType" "AlbumMediaType" NOT NULL DEFAULT 'IMAGE',
  ADD COLUMN "provider" "MediaProvider",
  ADD COLUMN "bytes" INTEGER,
  ADD COLUMN "originalBytes" INTEGER,
  ADD COLUMN "width" INTEGER,
  ADD COLUMN "height" INTEGER,
  ADD COLUMN "format" TEXT;

ALTER TABLE "PhotographerPortfolioImage"
  ADD COLUMN "provider" "MediaProvider",
  ADD COLUMN "bytes" INTEGER,
  ADD COLUMN "originalBytes" INTEGER,
  ADD COLUMN "width" INTEGER,
  ADD COLUMN "height" INTEGER,
  ADD COLUMN "format" TEXT;

ALTER TABLE "StudioProfile"
  ADD COLUMN "imageProvider" "MediaProvider",
  ADD COLUMN "imageBytes" INTEGER,
  ADD COLUMN "imageOriginalBytes" INTEGER,
  ADD COLUMN "imageWidth" INTEGER,
  ADD COLUMN "imageHeight" INTEGER,
  ADD COLUMN "imageFormat" TEXT,
  ADD COLUMN "imageMediaType" "AlbumMediaType" NOT NULL DEFAULT 'IMAGE';

ALTER TABLE "StudioHall"
  ADD COLUMN "imageProvider" "MediaProvider",
  ADD COLUMN "imageBytes" INTEGER,
  ADD COLUMN "imageOriginalBytes" INTEGER,
  ADD COLUMN "imageWidth" INTEGER,
  ADD COLUMN "imageHeight" INTEGER,
  ADD COLUMN "imageFormat" TEXT,
  ADD COLUMN "imageMediaType" "AlbumMediaType" NOT NULL DEFAULT 'IMAGE';

ALTER TABLE "StudioHallImage"
  ADD COLUMN "provider" "MediaProvider",
  ADD COLUMN "bytes" INTEGER,
  ADD COLUMN "originalBytes" INTEGER,
  ADD COLUMN "width" INTEGER,
  ADD COLUMN "height" INTEGER,
  ADD COLUMN "format" TEXT;
