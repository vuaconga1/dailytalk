-- Paid-plan reminder channels on the learner
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reminderChannels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Payment: planId + days replace months (idempotent for DBs that never had months)
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "planId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "days" INTEGER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Payment' AND column_name = 'months'
  ) THEN
    EXECUTE $sql$
      UPDATE "Payment"
      SET
        "days" = COALESCE("days", GREATEST(COALESCE("months", 1), 1) * 30),
        "planId" = COALESCE(
          "planId",
          CASE WHEN "amount" = 99000 THEN 'email' ELSE 'full' END
        )
      WHERE "planId" IS NULL OR "days" IS NULL
    $sql$;
  ELSE
    UPDATE "Payment"
    SET
      "days" = COALESCE("days", 30),
      "planId" = COALESCE(
        "planId",
        CASE WHEN "amount" = 99000 THEN 'email' ELSE 'full' END
      )
    WHERE "planId" IS NULL OR "days" IS NULL;
  END IF;
END $$;

UPDATE "Payment" SET "days" = 30 WHERE "days" IS NULL;
UPDATE "Payment" SET "planId" = CASE WHEN "amount" = 99000 THEN 'email' ELSE 'full' END WHERE "planId" IS NULL;

ALTER TABLE "Payment" ALTER COLUMN "planId" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "days" SET NOT NULL;

ALTER TABLE "Payment" DROP COLUMN IF EXISTS "months";

CREATE INDEX IF NOT EXISTS "Payment_userId_planId_status_idx" ON "Payment"("userId", "planId", "status");
