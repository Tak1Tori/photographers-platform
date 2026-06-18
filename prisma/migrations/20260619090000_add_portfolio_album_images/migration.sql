CREATE TABLE "PhotographerPortfolioImage" (
    "id" TEXT NOT NULL,
    "portfolioItemId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imagePublicId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotographerPortfolioImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PhotographerPortfolioImage_portfolioItemId_sortOrder_idx"
ON "PhotographerPortfolioImage"("portfolioItemId", "sortOrder");

ALTER TABLE "PhotographerPortfolioImage"
ADD CONSTRAINT "PhotographerPortfolioImage_portfolioItemId_fkey"
FOREIGN KEY ("portfolioItemId")
REFERENCES "PhotographerPortfolioItem"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "PhotographerPortfolioImage" ENABLE ROW LEVEL SECURITY;
