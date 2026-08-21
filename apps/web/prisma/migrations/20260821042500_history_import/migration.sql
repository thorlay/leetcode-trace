CREATE TYPE "CaptureCompleteness" AS ENUM ('FINAL_ONLY', 'SUBMISSIONS_ONLY', 'FULL');
CREATE TYPE "TrajectoryStatus" AS ENUM ('NONE', 'AVAILABLE', 'ANALYZED');

ALTER TABLE "Problem"
  ADD COLUMN "difficulty" TEXT,
  ADD COLUMN "firstSolvedAt" TIMESTAMP(3),
  ADD COLUMN "lastSolvedAt" TIMESTAMP(3);

ALTER TABLE "ProblemSession"
  ADD COLUMN "captureCompleteness" "CaptureCompleteness" NOT NULL DEFAULT 'FULL',
  ADD COLUMN "trajectoryStatus" "TrajectoryStatus" NOT NULL DEFAULT 'NONE';

ALTER TABLE "Attempt"
  ADD COLUMN "submissionId" TEXT,
  ADD COLUMN "runtime" TEXT,
  ADD COLUMN "memory" TEXT;

CREATE UNIQUE INDEX "Attempt_submissionId_key" ON "Attempt"("submissionId");
