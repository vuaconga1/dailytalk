import "server-only";
import { LEVEL_IDS } from "@/domain/profile-options";
import type { GoalStatus, LearnerProfile, LevelId, LevelSignal, PlanDay } from "@/domain/types";
import { AIError } from "@/lib/errors";
import { isDemo, isRecord, isText, learnerContext, text, type Usage } from "./config";
import type { DayTarget } from "./lesson";
import { SELECT_PROMPT } from "./prompts";

export type DayChoice = DayTarget & { selectedBy: "plan" | "rule" | "openai" };

export type RecentSession = {
  title: string;
  situation: string;
  level: LevelId;
  goalStatus: GoalStatus;
  levelSignal?: LevelSignal;
  errors: string[];
  reviewItems: string[];
};

/**
 * The roadmap is only a reference: before each study day the situation and difficulty are
 * re-decided from recent results, choosing between today's roadmap entry and situations that
 * were not achieved recently. Demo mode uses a rule; OpenAI mode asks the model to choose and
 * write the focus, falling back to the rule if its answer does not validate.
 */
export async function adaptDay(
  profile: LearnerProfile,
  planned: PlanDay,
  planDays: PlanDay[],
  recent: RecentSession[],
  useAi = true,
): Promise<[DayChoice, Usage]> {
  const level = profile.working_level ?? profile.classification.level;
  const studiedTwice = (title: string) => recent[0]?.title === title && recent[1]?.title === title;
  const retry = [...new Set(recent.filter((r) => r.goalStatus !== "achieved").map((r) => r.title))]
    .filter((t) => t !== planned.title && !studiedTwice(t))
    .slice(0, 2)
    .map((title) => {
      const entry = planDays.find((d) => d.title === title);
      return {
        title,
        situation: entry?.situation ?? recent.find((r) => r.title === title)!.situation,
        ref: entry?.ref,
      };
    });
  const candidates = [{ title: planned.title, situation: planned.situation, ref: planned.ref }, ...retry];

  const rule = (): DayChoice => {
    const last = recent[0];
    const again =
      last && last.goalStatus !== "achieved" && recent[1]?.title !== last.title ? retry.find((c) => c.title === last.title) : undefined;
    if (again)
      return {
        ...again,
        level,
        focus: `Ôn lại “${again.title}” vì buổi trước chưa đạt mục tiêu`,
        selectedBy: "rule",
      };
    return {
      ...candidates[0],
      focus: planned.focus,
      level,
      selectedBy: "plan",
    };
  };
  if (!useAi || isDemo || !recent.length) return [rule(), {}];

  try {
    const [obj, usage] = await text(
      SELECT_PROMPT,
      {
        learner: learnerContext(profile),
        working_level: level,
        candidates: candidates.map(({ title, situation }, i) => ({
          pick: i,
          title,
          situation,
        })),
        recent_sessions: recent.slice(0, 5),
      },
      true,
    );
    const lvl = (isRecord(obj) ? obj.level : null) as LevelId;
    const pick = isRecord(obj) ? obj.pick : null;
    const ok =
      isRecord(obj) &&
      typeof pick === "number" &&
      Number.isInteger(pick) &&
      pick >= 0 &&
      pick < candidates.length &&
      isText(obj.focus, 300) &&
      LEVEL_IDS.includes(lvl) &&
      Math.abs(LEVEL_IDS.indexOf(lvl) - LEVEL_IDS.indexOf(level)) <= 1;
    if (!ok) return [rule(), usage];
    return [
      {
        ...candidates[pick as number],
        focus: (obj.focus as string).trim(),
        level: lvl,
        selectedBy: "openai",
      },
      usage,
    ];
  } catch (error) {
    if (error instanceof AIError) return [rule(), {}];
    throw error;
  }
}
