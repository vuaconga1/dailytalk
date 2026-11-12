import "server-only";
import type { Practice } from "@/generated/prisma/client";
import { reply, scriptedReply } from "@/server/ai/coach";
import { AIError, Problem } from "@/lib/errors";
import type { LearnerProfile, Lesson, Turn } from "@/domain/types";
import { MAX_TURNS, type SaveTurns } from "./practice";
import { logUsageLater, reserveProviderCall } from "./usage";

type TurnInput = {
  userId: string;
  profile: LearnerProfile;
  practice: Practice;
  lesson: Lesson;
  text: string;
  inputMode: "voice" | "text";
  aiOff: boolean;
  recordOnly?: boolean;
  save: SaveTurns;
};

/** Adds the learner's line and the coach's answer (scripted when the AI is off or fails). */
export async function takeTurn({ userId, profile, practice, lesson, text, inputMode, aiOff, recordOnly, save }: TurnInput) {
  const turns = [...(practice.turns as Turn[])];
  if (turns.length > MAX_TURNS * 2) throw new Problem(`Đã đạt giới hạn ${MAX_TURNS} lượt cho phiên này.`, 409);
  turns.push({ role: "user", text, input_mode: inputMode });
  // Speech recorded before the deadline is kept, but the conversation does not go on past it.
  if (recordOnly || practice.deadline.getTime() <= Date.now()) {
    await save(turns);
    return { turns, aiOff };
  }
  let answer = "";
  if (!aiOff) {
    try {
      await reserveProviderCall(userId, "conversation", true);
      const [line, usage] = await reply(profile, lesson, turns, MAX_TURNS);
      answer = line;
      logUsageLater(userId, "conversation", usage);
    } catch (error) {
      if (!(error instanceof AIError) && !(error instanceof Problem)) throw error;
      aiOff = true;
    }
  }
  if (aiOff) answer = scriptedReply(lesson, turns);
  turns.push({ role: "assistant", text: answer });
  await save(turns);
  return { turns, aiOff };
}
