ALTER TABLE "ProblemSession"
  ADD COLUMN "initialAssessment" "SelfAssessment",
  ADD COLUMN "solutionConsulted" BOOLEAN NOT NULL DEFAULT false;
