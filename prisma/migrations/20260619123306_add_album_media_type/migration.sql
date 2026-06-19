CREATE TYPE "AlbumMediaType" AS ENUM ('IMAGE', 'VIDEO');

ALTER TABLE "PhotographerPortfolioImage"
ADD COLUMN "mediaType" "AlbumMediaType" NOT NULL DEFAULT 'IMAGE';
