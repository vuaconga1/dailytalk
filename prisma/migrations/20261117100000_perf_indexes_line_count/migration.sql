-- Performance: indexes for admin/cron filters + lean shadowing list lineCount
CREATE INDEX IF NOT EXISTS "User_accessEndsAt_idx" ON "User"("accessEndsAt");
CREATE INDEX IF NOT EXISTS "User_lockAt_idx" ON "User"("lockAt");
CREATE INDEX IF NOT EXISTS "Attempt_userId_completed_localDate_idx" ON "Attempt"("userId", "completed", "localDate");
ALTER TABLE "ShadowingExercise" ADD COLUMN IF NOT EXISTS "lineCount" INTEGER;
