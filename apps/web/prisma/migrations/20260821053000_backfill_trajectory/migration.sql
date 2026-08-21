UPDATE "ProblemSession" AS session
SET "trajectoryStatus" = 'ANALYZED'
WHERE EXISTS (
  SELECT 1 FROM "SessionAnalysis" AS analysis WHERE analysis."sessionId" = session.id
);

UPDATE "ProblemSession" AS session
SET "trajectoryStatus" = 'AVAILABLE'
WHERE session."trajectoryStatus" = 'NONE'
  AND (SELECT COUNT(*) FROM "Attempt" AS attempt WHERE attempt."sessionId" = session.id) >= 2;
