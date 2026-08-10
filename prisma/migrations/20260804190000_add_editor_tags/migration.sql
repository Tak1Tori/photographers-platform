CREATE TABLE "EditorTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorTag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EditorTag_slug_key" ON "EditorTag"("slug");

CREATE TABLE "_EditorTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX "_EditorTags_AB_unique" ON "_EditorTags"("A", "B");
CREATE INDEX "_EditorTags_B_index" ON "_EditorTags"("B");

ALTER TABLE "_EditorTags" ADD CONSTRAINT "_EditorTags_A_fkey"
  FOREIGN KEY ("A") REFERENCES "EditorTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_EditorTags" ADD CONSTRAINT "_EditorTags_B_fkey"
  FOREIGN KEY ("B") REFERENCES "PhotographerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "EditorTag" ("id", "name", "slug", "createdAt", "updatedAt")
VALUES ('editor-tag-montage', 'Монтаж', 'montazh', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

UPDATE "User"
SET "role" = 'EDITOR'
WHERE "id" = 'cmrnnnrvr0001jj04rsh21enr';

INSERT INTO "_EditorTags" ("A", "B")
SELECT "EditorTag"."id", "PhotographerProfile"."id"
FROM "EditorTag"
CROSS JOIN "PhotographerProfile"
WHERE "EditorTag"."slug" = 'montazh'
  AND "PhotographerProfile"."id" = 'cmrnnnrwe0003jj04j8k7gxcy'
ON CONFLICT ("A", "B") DO NOTHING;

DELETE FROM "_PhotographerStyles"
WHERE "A" = 'cmrnnnrwe0003jj04j8k7gxcy'
  AND "B" IN (SELECT "id" FROM "Style" WHERE "slug" = 'montazh');
