import "server-only";
import { POS_IDS, usesFrame, type PartOfSpeech } from "@/domain/frames";
import type { LearnerProfile, Lesson, LevelId } from "@/domain/types";
import { AIError } from "@/lib/errors";
import { isRecord, isText, isTextList, learnerContext, text, type Usage } from "./config";
import { lessonPrompt } from "./prompts";

/** `ref` points at the authored curriculum entry when there is one. */
export type DayTarget = {
  title: string;
  situation: string;
  focus: string;
  level: LevelId;
  ref?: string;
};

/**
 * Detailed content for ONE situation. With `base` (an authored curriculum lesson) the model only
 * rewrites it for the target level, keeping the situation and sentence-frame structure.
 */
export async function generateLesson(
  profile: LearnerProfile,
  target: DayTarget,
  base?: Lesson,
): Promise<[Omit<Lesson, "id" | "version">, Usage]> {
  const [obj, usage] = await text(
    lessonPrompt(Boolean(base)),
    {
      target: { title: target.title, situation: target.situation, focus: target.focus, level: target.level },
      learner: learnerContext(profile),
      ...(base
        ? {
            base_lesson: {
              title: base.title,
              situation: base.situation,
              goal: base.goal,
              vocabulary: base.vocabulary,
              frames: base.frames.map((en, i) => ({
                en,
                ...base.frameNotes?.[i],
              })),
              dialogue: base.dialogue,
              roleplay: base.roleplay,
            },
          }
        : {}),
    },
    true,
    4000,
  );
  const invalid = () => new AIError("Nội dung bài học chưa hợp lệ.");
  if (!isRecord(obj) || !isText(obj.title, 120) || !isText(obj.goal, 300)) throw invalid();
  const { vocabulary: vocab, frames, dialogue, roleplay: rp } = obj;
  if (!isTextList(dialogue, 8, 8, 250)) throw invalid();
  const allLines = dialogue.join(" ").toLowerCase();
  const learnerLines = dialogue.filter((_, i) => i % 2 === 1);
  if (
    !Array.isArray(vocab) ||
    vocab.length !== 5 ||
    vocab.some(
      (v) =>
        !isRecord(v) ||
        !isText(v.word, 60) ||
        !allLines.includes(v.word.trim().toLowerCase()) ||
        !isText(v.ipa, 80) ||
        !POS_IDS.includes(v.pos as PartOfSpeech) ||
        !isText(v.meaning, 120),
    ) ||
    !Array.isArray(frames) ||
    frames.length !== 4 ||
    frames.some(
      (f) =>
        !isRecord(f) ||
        !isText(f.en, 150) ||
        !learnerLines.some((l) => usesFrame(f.en as string, l)) ||
        !isText(f.meaning, 200) ||
        !isText(f.structure, 200) ||
        !isText(f.usage, 400),
    ) ||
    !isRecord(rp) ||
    !isText(rp.role, 120) ||
    !isText(rp.goal, 300) ||
    !isText(rp.opening, 250)
  ) {
    throw invalid();
  }
  const lines = dialogue.map((d) => d.trim());
  return [
    {
      title: obj.title.trim(),
      situation: target.situation,
      level: target.level,
      goal: obj.goal.trim(),
      vocabulary: (vocab as Record<string, string>[]).map((v) => {
        const word = v.word.trim();
        const example = lines.find((l) => l.toLowerCase().includes(word.toLowerCase()));
        return {
          word,
          ipa: v.ipa.trim().replace(/^\/|\/$/g, ""),
          pos: v.pos as PartOfSpeech,
          meaning: v.meaning.trim(),
          example,
        };
      }),
      frames: (frames as Record<string, string>[]).map((f) => f.en.trim()),
      frameNotes: (frames as Record<string, string>[]).map((f) => ({
        meaning: f.meaning.trim(),
        structure: f.structure.trim(),
        usage: f.usage.trim(),
      })),
      dialogue: lines,
      roleplay: {
        role: rp.role.trim(),
        goal: rp.goal.trim(),
        opening: rp.opening.trim(),
      },
    },
    usage,
  ];
}
