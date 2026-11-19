-- Vocabulary page filters the shared lesson bank by industry and position.
CREATE INDEX IF NOT EXISTS "LessonContent_industry_position_idx" ON "LessonContent"("industry", "position");
