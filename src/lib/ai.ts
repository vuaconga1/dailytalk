/** Server-only AI adapter. All models are configurable; no paid calls in demo. */
import "server-only";
import OpenAI, { toFile } from "openai";
import { AIError } from "@/lib/errors";
import { framesUsed, POS_IDS, usesFrame, type PartOfSpeech } from "@/lib/frames";
import { profileLabels } from "@/lib/profile";
import { COACH_PROMPT, lessonPrompt, SELECT_PROMPT, SUMMARY_PROMPT, transcribePrompt, VOICE_STYLE } from "@/lib/prompts";
import { LEVEL_IDS, levelInfo } from "@/lib/profile-options";
import type { GoalStatus, LearnerProfile, Lesson, LevelId, LevelSignal, PlanDay, Summary, Turn } from "@/lib/types";

export type Usage = Record<string, unknown>;
type BaseSummary = Omit<Summary, "mode" | "frames_used" | "turn_count" | "voice_turns" | "pronunciation_note">;

const GOAL_STATUSES: GoalStatus[] = ["achieved", "needs_review", "insufficient_evidence"];
const LEVEL_SIGNALS: LevelSignal[] = ["below", "match", "above"];

function readConfig() {
  const mode = process.env.AI_MODE?.trim() || "demo";
  if (mode !== "demo" && mode !== "openai") throw new Error("AI_MODE must be demo or openai");
  const config = {
    mode,
    key: process.env.OPENAI_API_KEY?.trim() ?? "",
    model: process.env.OPENAI_TEXT_MODEL?.trim() ?? "",
    stt: process.env.OPENAI_TRANSCRIBE_MODEL?.trim() ?? "",
    tts: process.env.OPENAI_TTS_MODEL?.trim() ?? "",
    voice: process.env.OPENAI_VOICE?.trim() || "alloy",
  } as const;
  if (mode === "openai" && !(config.key && config.model && config.stt && config.tts)) {
    throw new Error("AI_MODE=openai cần OPENAI_API_KEY và đủ ba tên model. Xem .env.example.");
  }
  return config;
}

export const aiConfig = readConfig();
export const isDemo = aiConfig.mode === "demo";

let client: OpenAI | null = null;
function openai(): OpenAI {
  client ??= new OpenAI({
    apiKey: aiConfig.key,
    timeout: 60_000,
    maxRetries: 0,
  });
  return client;
}

async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AIError) throw error;
    throw new AIError("Không kết nối được dịch vụ AI. Hãy thử lại sau.", {
      cause: error,
    });
  }
}

async function text(instructions: string, data: unknown, jsonMode: boolean, maxTokens = 2400): Promise<[unknown, Usage]> {
  const result = await call(() =>
    openai().responses.create({
      model: aiConfig.model,
      instructions,
      input: JSON.stringify(data),
      max_output_tokens: jsonMode ? maxTokens : 400,
      store: false,
      ...(jsonMode ? { text: { format: { type: "json_object" as const } } } : {}),
    }),
  );
  const out = result.output_text;
  if (!out) throw new AIError("AI chưa trả về nội dung hợp lệ.");
  let value: unknown = out;
  if (jsonMode) {
    try {
      value = JSON.parse(out);
    } catch {
      throw new AIError("AI chưa trả về nội dung hợp lệ.");
    }
  }
  return [value, (result.usage ?? {}) as unknown as Usage];
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown, max: number): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const isTextList = (v: unknown, min: number, max: number, len: number): v is string[] =>
  Array.isArray(v) && v.length >= min && v.length <= max && v.every((t) => isText(t, len));

/** What the AI needs to know about the learner (labels, never raw ids). */
function learnerContext(profile: LearnerProfile) {
  const labels = profileLabels(profile);
  return {
    industry: labels.industry,
    position: labels.position,
    communicates_with: labels.audiences,
    goals: labels.goals,
    level: levelInfo(profile.working_level ?? profile.classification.level).label,
    priorities: profile.classification.priorities.map((p) => p.label),
  };
}

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

export async function reply(profile: LearnerProfile, lesson: Lesson, turns: Turn[], maxTurns: number): Promise<[string, Usage]> {
  const said = turns.filter((t) => t.role === "user").map((t) => t.text);
  const used = framesUsed(lesson.frames, said);
  const unused = lesson.frames.filter((_, i) => !used[i]);
  if (isDemo) {
    // The coach follows the counterpart's lines of the shadowing dialogue, then asks for missing frames.
    const follow = lesson.dialogue.filter((_, i) => i % 2 === 0).slice(1);
    const n = said.length;
    const line =
      n <= follow.length
        ? `${["Nice!", "Great.", "I see."][(n - 1) % 3]} ${follow[n - 1]}`
        : unused.length
          ? `Well done. Now try today’s pattern: “${unused[0]}”. Can you make your own sentence?`
          : "Excellent! You used all four patterns today. You can finish the session to see your feedback.";
    return [line, {}];
  }
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

function demoSummary(lesson: Lesson, utterances: string[]): BaseSummary {
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

/** `lesson` gives the model today's words so they are spelled right (the learner's errors are kept). */
export async function transcribe(audio: Buffer, mime: string, lesson?: Lesson): Promise<string> {
  if (isDemo) throw new AIError("Ghi âm để AI nhận dạng cần cấu hình API; demo hỗ trợ nhập câu.");
  const ext = mime.includes("mp4") ? "mp4" : mime.includes("webm") ? "webm" : mime.includes("ogg") ? "ogg" : "wav";
  const file = await toFile(audio, `recording.${ext}`, { type: mime });
  const result = await call(() =>
    openai().audio.transcriptions.create({
      file,
      model: aiConfig.stt,
      language: "en",
      ...(lesson ? { prompt: transcribePrompt(lesson) } : {}),
    }),
  );
  return result.text.trim();
}

export async function speech(input: string): Promise<Buffer> {
  if (isDemo) throw new AIError("Demo dùng giọng đọc có sẵn của trình duyệt.");
  const res = await call(() =>
    openai().audio.speech.create({
      model: aiConfig.tts,
      voice: aiConfig.voice,
      input,
      // Only the gpt-4o TTS family accepts style instructions; older models reject the field.
      ...(aiConfig.tts.startsWith("gpt-4o") ? { instructions: VOICE_STYLE } : {}),
      response_format: "mp3",
    }),
  );
  return Buffer.from(await res.arrayBuffer());
}
