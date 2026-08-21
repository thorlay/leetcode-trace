CREATE TABLE "ProblemTag" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "ProblemTag_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Problem"
  ADD COLUMN "frontendId" TEXT,
  ADD COLUMN "isPremium" BOOLEAN,
  ADD COLUMN "acceptanceRate" DOUBLE PRECISION,
  ADD COLUMN "likes" INTEGER,
  ADD COLUMN "dislikes" INTEGER;

CREATE UNIQUE INDEX "ProblemTag_problemId_slug_key" ON "ProblemTag"("problemId", "slug");
CREATE INDEX "ProblemTag_slug_idx" ON "ProblemTag"("slug");

ALTER TABLE "ProblemTag" ADD CONSTRAINT "ProblemTag_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
