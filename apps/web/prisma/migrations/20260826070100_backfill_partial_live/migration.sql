-- History imported before the extension was installed can later gain live Run
-- events. It is neither submissions-only nor a complete live trajectory.
UPDATE "ProblemSession" AS session
SET "captureCompleteness" = 'PARTIAL_LIVE'
WHERE session."captureCompleteness" IN ('FINAL_ONLY', 'SUBMISSIONS_ONLY')
  AND EXISTS (
    SELECT 1
    FROM "Attempt" AS attempt
    WHERE attempt."sessionId" = session.id
      AND attempt.action = 'RUN'
  );
