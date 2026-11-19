import type { Audience, CurriculumDay, Frame } from "@/domain/curriculum/types";
import type { PartOfSpeech } from "@/domain/frames";
import type { SkillId } from "@/domain/types";

export type Word = [string, string, PartOfSpeech, string];

const ROLE: Record<Audience, string> = {
  customers: "{a_person} in {class}",
  partners: "a parent talking with you",
  colleagues: "a colleague talking with you",
  managers: "your academic manager",
};

/** One study day. Even dialogue lines must use the frames, in order. */
export function day(p: {
  title: string;
  situation: string;
  skill: SkillId;
  focus: string;
  goal: string;
  with?: Audience[];
  role?: string;
  words: Word[];
  frames: Frame[];
  lines: [string, string, string, string, string, string, string, string];
}): CurriculumDay {
  const withWhom = p.with ?? ["customers"];
  return {
    title: p.title,
    situation: p.situation,
    skill: p.skill,
    focus: p.focus,
    goal: p.goal,
    with: withWhom,
    words: p.words,
    frames: p.frames,
    dialogue: [...p.lines],
    roleplay: [p.role ?? ROLE[withWhom[0]], p.goal, p.lines[0]],
  };
}
