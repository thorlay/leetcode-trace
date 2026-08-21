CREATE TABLE "ProblemPattern" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "patternKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "evidence" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProblemPattern_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProblemPattern_problemId_patternKey_key" ON "ProblemPattern"("problemId", "patternKey");
CREATE INDEX "ProblemPattern_patternKey_idx" ON "ProblemPattern"("patternKey");

ALTER TABLE "ProblemPattern" ADD CONSTRAINT "ProblemPattern_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
