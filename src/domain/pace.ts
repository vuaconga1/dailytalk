import type { LearnerProfile, Lesson } from "@/domain/types";

/** Learners older than this get a lighter daily load. */
export const LIGHT_PACE_AFTER_AGE = 40;
/** Light pace: 5 new words per 2 study days (3 on odd days, 2 on even days). */
const LIGHT_WORDS = (day: number) => (day % 2 === 1 ? 3 : 2);
const LIGHT_FRAMES = 2;
const LIGHT_DIALOGUE_LINES = 4;

export function isLightPace(profile: Pick<LearnerProfile, "age"> | null | undefined): boolean {
  return (profile?.age ?? 0) > LIGHT_PACE_AFTER_AGE;
}

/** Fewer words, sentence frames and shadowing lines; the lesson snapshot keeps the reduced content. */
export function lightenLesson(lesson: Lesson, day: number): Lesson {
  const frames = lesson.frames.slice(0, LIGHT_FRAMES);
  const recap = lesson.recap && { ...lesson.recap, frameDays: lesson.recap.frameDays.slice(0, frames.length) };
  return {
    ...lesson,
    vocabulary: lesson.vocabulary.slice(0, LIGHT_WORDS(day)),
    frames,
    ...(lesson.frameNotes ? { frameNotes: lesson.frameNotes.slice(0, frames.length) } : {}),
    dialogue: lesson.dialogue.slice(0, LIGHT_DIALOGUE_LINES),
    roleplay: { ...lesson.roleplay, goal: lesson.roleplay.goal.replace(/\b\d+ mẫu câu/g, `${frames.length} mẫu câu`) },
    ...(recap ? { recap } : {}),
  };
}
