-- Lean Attempt fields for list/history/week review without full lesson JSON
ALTER TABLE "Attempt" ADD COLUMN IF NOT EXISTS "lessonTitle" TEXT;
ALTER TABLE "Attempt" ADD COLUMN IF NOT EXISTS "lessonLean" JSONB;

UPDATE "Attempt"
SET
  "lessonTitle" = COALESCE("lessonTitle", lesson->>'title'),
  "lessonLean" = COALESCE(
    "lessonLean",
    jsonb_strip_nulls(
      jsonb_build_object(
        'title', lesson->>'title',
        'situation', lesson->>'situation',
        'level', lesson->>'level',
        'goal', lesson->>'goal',
        'vocabulary', COALESCE(
          (
            SELECT jsonb_agg(jsonb_build_object('word', v->>'word', 'meaning', v->>'meaning'))
            FROM jsonb_array_elements(COALESCE(lesson->'vocabulary', '[]'::jsonb)) AS v
          ),
          '[]'::jsonb
        ),
        'frames', COALESCE(lesson->'frames', '[]'::jsonb),
        'recap', lesson->'recap'
      )
    )
  )
WHERE lesson IS NOT NULL;

-- Lesson bank audio counters for admin list without hydrating lesson blobs
ALTER TABLE "LessonContent" ADD COLUMN IF NOT EXISTS "audioTotal" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LessonContent" ADD COLUMN IF NOT EXISTS "audioReady" INTEGER NOT NULL DEFAULT 0;

UPDATE "LessonContent"
SET "audioTotal" = COALESCE(jsonb_array_length(lesson->'dialogue'), 0)
  + COALESCE(jsonb_array_length(lesson->'vocabulary'), 0)
WHERE "audioTotal" = 0;

-- Shell session uses planSource as hasPlan; keep legacy rows consistent
UPDATE "User"
SET "planSource" = COALESCE("planSource", 'curriculum')
WHERE plan IS NOT NULL AND "planSource" IS NULL;
