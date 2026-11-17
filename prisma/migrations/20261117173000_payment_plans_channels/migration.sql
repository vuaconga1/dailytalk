-- Paid-plan reminder channels on the learner
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reminderChannels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Payment: planId + days replace months
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "planId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "days" INTEGER;

-- Backfill from legacy months-based rows (1 month ≈ 30 days; amount 99000 → email, else full)
UPDATE "Payment"
SET
  "days" = COALESCE("days", GREATEST(COALESCE("months", 1), 1) * 30),
  "planId" = COALESCE(
    "planId",
    CASE WHEN "amount" = 99000 THEN 'email' ELSE 'full' END
  )
WHERE "planId" IS NULL OR "days" IS NULL;

ALTER TABLE "Payment" ALTER COLUMN "planId" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "days" SET NOT NULL;

ALTER TABLE "Payment" DROP COLUMN IF EXISTS "months";

CREATE INDEX IF NOT EXISTS "Payment_userId_planId_status_idx" ON "Payment"("userId", "planId", "status");
