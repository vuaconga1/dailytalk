import type { Lesson, LevelId, Recap } from "@/domain/types";

/** Lesson fields needed for history cards, week reviews, and course reports — no dialogue/roleplay. */
export type LessonLean = {
  title: string;
  situation: string;
  level: LevelId;
  goal: string;
  vocabulary: { word: string; meaning: string }[];
  frames: string[];
  recap?: Recap;
};

export function toLessonLean(lesson: Lesson): LessonLean {
  return {
    title: lesson.title,
    situation: lesson.situation,
    level: lesson.level,
    goal: lesson.goal,
    vocabulary: lesson.vocabulary.map((v) => ({ word: v.word, meaning: v.meaning })),
    frames: [...lesson.frames],
    ...(lesson.recap ? { recap: lesson.recap } : {}),
  };
}

export function normalizeLessonLean(raw: unknown, fallbackTitle = ""): LessonLean {
  if (raw && typeof raw === "object") {
    const l = raw as Partial<LessonLean>;
    if (typeof l.title === "string" && Array.isArray(l.vocabulary) && Array.isArray(l.frames)) {
      return {
        title: l.title,
        situation: typeof l.situation === "string" ? l.situation : "",
        level: (l.level as LevelId) || "elementary",
        goal: typeof l.goal === "string" ? l.goal : "",
        vocabulary: l.vocabulary.map((v) => ({ word: v.word, meaning: v.meaning })),
        frames: l.frames.filter((f): f is string => typeof f === "string"),
        ...(l.recap ? { recap: l.recap } : {}),
      };
    }
  }
  return {
    title: fallbackTitle,
    situation: "",
    level: "elementary",
    goal: "",
    vocabulary: [],
    frames: [],
  };
}
