import "server-only";
import { framesUsed } from "@/domain/frames";
import type { GoalStatus, LearnerProfile, Lesson, LevelSignal, Summary, Turn } from "@/domain/types";
import { AIError } from "@/lib/errors";
import { isDemo, isRecord, isText, learnerContext, text, type Usage } from "./config";
import { COACH_PROMPT, SUMMARY_PROMPT } from "./prompts";

type BaseSummary = Omit<Summary, "mode" | "frames_used" | "turn_count" | "voice_turns" | "pronunciation_note">;

const GOAL_STATUSES: GoalStatus[] = ["achieved", "needs_review", "insufficient_evidence"];
const LEVEL_SIGNALS: LevelSignal[] = ["below", "match", "above"];

/** Rule-based coach: follows the counterpart's lines of the lesson dialogue, then asks for missing frames. */
export function scriptedReply(lesson: Lesson, turns: Turn[]): string {
  const said = turns.filter((t) => t.role === "user").map((t) => t.text);
  const used = framesUsed(lesson.frames, said);
  const unused = lesson.frames.filter((_, i) => !used[i]);
  const follow = lesson.dialogue.filter((_, i) => i % 2 === 0).slice(1);
  const n = said.length;
  return n <= follow.length
    ? `${["Nice!", "Great.", "I see."][(n - 1) % 3]} ${follow[n - 1]}`
    : unused.length
      ? `Well done. Now try today’s pattern: “${unused[0]}”. Can you make your own sentence?`
      : "Excellent! You used all four patterns today. You can finish the session to see your feedback.";
}

export async function reply(profile: LearnerProfile, lesson: Lesson, turns: Turn[], maxTurns: number): Promise<[string, Usage]> {
  if (isDemo) return [scriptedReply(lesson, turns), {}];
  const said = turns.filter((t) => t.role === "user").map((t) => t.text);
  const used = framesUsed(lesson.frames, said);
  const unused = lesson.frames.filter((_, i) => !used[i]);
  const { title, situation, level, frames, vocabulary, roleplay } = lesson;
  const [out, usage] = await text(
    COACH_PROMPT,
    {
      learner: learnerContext(profile),
      lesson: { title, situation, level, frames, vocabulary: vocabulary.map((v) => `${v.word}: ${v.meaning}`), roleplay },
      frames_not_used_yet: unused,
      turn_number: said.length,
      turns_left: Math.max(0, maxTurns - said.length),
      conversation: turns.slice(-12),
    },
    false,
  );
  return [(out as string).trim(), usage];
}

export function demoSummary(lesson: Lesson, utterances: string[]): BaseSummary {
  if (!utterances.length) {
    return {
      overview: "Bạn chưa gửi câu trả lời nào trong phiên hội thoại hôm nay.",
      strengths: [],
      improvements: [`Thực hành lại ${lesson.frames.length} mẫu câu của bài`],
      next_step: "Nghe lại đoạn mẫu và tự nói một câu không dùng gợi ý.",
      goal_status: "insufficient_evidence",
      evidence: [],
      errors: [],
      review_items: lesson.frames.slice(0, 5),
    };
  }
  const usedFlags = framesUsed(lesson.frames, utterances);
  const usedFrames = lesson.frames.filter((_, i) => usedFlags[i]);
  const missed = lesson.frames.filter((_, i) => !usedFlags[i]);
  const long = utterances.filter((u) => u.split(/\s+/).filter(Boolean).length >= 6);
  const strengths = [`Hoàn thành tình huống “${lesson.title}” với ${utterances.length} lượt phản hồi`];
  if (usedFrames.length) strengths.push(`Vận dụng ${usedFrames.length}/${lesson.frames.length} mẫu câu, ví dụ “${usedFrames[0]}”`);
  if (long.length) strengths.push("Trả lời bằng câu hoàn chỉnh, rõ ý và đúng ngữ cảnh");
  const improvements = ["Mở rộng câu trả lời bằng một chi tiết cụ thể: thời gian, địa điểm hoặc lý do"];
  if (missed.length) improvements.unshift(`Dùng thêm ${missed.length} mẫu câu chưa nói: “${missed[0]}”${missed.length > 1 ? "…" : ""}`);
  const ok = utterances.length >= 3;
  const said = utterances.join(" ").toLowerCase();
  const unusedWords = lesson.vocabulary.map((v) => v.word).filter((w) => !said.includes(w.toLowerCase()));
  return {
    errors: [],
    review_items: [...missed, ...unusedWords].slice(0, 5),
    level_signal: !ok ? "below" : long.length >= 3 && !missed.length ? "above" : "match",
    overview:
      (ok ? "Buổi học tốt! " : "Bạn đã bắt đầu tốt. ") +
      `Bạn đã thực hành tình huống “${lesson.title}” và ` +
      (ok ? "đạt mục tiêu giao tiếp của buổi học." : "cần thêm vài lượt nói để đạt mục tiêu."),
    strengths,
    improvements,
    next_step: "Nghe lại đoạn mẫu ở tốc độ 1× và tự nói lại mẫu câu với thông tin công việc của bạn.",
    goal_status: ok ? "achieved" : "needs_review",
    evidence: (long.length ? long : utterances).slice(0, 2),
  };
}

export async function summarize(profile: LearnerProfile, lesson: Lesson, turns: Turn[]): Promise<[BaseSummary, Usage]> {
  const utterances = turns.filter((t) => t.role === "user").map((t) => t.text);
  if (isDemo) return [demoSummary(lesson, utterances), {}];
  const [obj, usage] = await text(
    SUMMARY_PROMPT,
    {
      learner: learnerContext(profile),
      lesson: {
        title: lesson.title,
        situation: lesson.situation,
        level: lesson.level,
        goal: lesson.goal,
        roleplay_task: lesson.roleplay.goal,
        frames: lesson.frames,
        words: lesson.vocabulary.map((v) => v.word),
      },
      frames_not_used: lesson.frames.filter((_, i) => !framesUsed(lesson.frames, utterances)[i]),
      utterances,
    },
    true,
  );
  const invalid = () => new AIError("Tổng kết chưa hợp lệ.");
  if (!isRecord(obj)) throw invalid();
  for (const key of ["overview", "next_step"]) if (!isText(obj[key], 1500)) throw invalid();
  for (const key of ["strengths", "improvements", "evidence"]) {
    const list = obj[key];
    if (!Array.isArray(list) || list.length > 3 || list.some((t) => !isText(t, 1000))) throw invalid();
  }
  if (!GOAL_STATUSES.includes(obj.goal_status as GoalStatus)) throw invalid();
  const errors = Array.isArray(obj.errors) ? obj.errors : [];
  const reviewItems = Array.isArray(obj.review_items) ? obj.review_items : [];
  if (
    errors.length > 3 ||
    errors.some((e) => !isRecord(e) || !isText(e.issue, 200) || !isText(e.example, 1000) || !isText(e.correction, 1000)) ||
    reviewItems.length > 5 ||
    reviewItems.some((t) => !isText(t, 200))
  ) {
    throw invalid();
  }
  const levelSignal = LEVEL_SIGNALS.includes(obj.level_signal as LevelSignal) ? (obj.level_signal as LevelSignal) : undefined;
  const summary = {
    ...obj,
    errors,
    review_items: reviewItems,
    level_signal: levelSignal,
  } as unknown as BaseSummary;
  if ([...summary.evidence, ...(summary.errors ?? []).map((e) => e.example)].some((e) => !utterances.includes(e))) {
    throw new AIError("Bằng chứng đánh giá không khớp bản ghi.");
  }
  if (!utterances.length) {
    Object.assign(summary, {
      goal_status: "insufficient_evidence",
      strengths: [],
      evidence: [],
      errors: [],
      level_signal: undefined,
    });
  }
  return [summary, usage];
}
