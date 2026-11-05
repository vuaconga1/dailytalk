import type { PartOfSpeech } from "@/lib/frames";
import type { FrequencyId, LevelId } from "@/lib/profile-options";

export type { FrequencyId, LevelId, PartOfSpeech };

export type FrameNote = {
  /** Vietnamese meaning of the frame. */
  meaning: string;
  /** Vietnamese breakdown, e.g. "I've sent you + tài liệu + for + mục đích". */
  structure: string;
  /** Vietnamese: when and how to use it. */
  usage: string;
};

/** All parts of one day share the same workplace situation. */
export type Lesson = {
  /** Shared-bank key (LessonContent.key) or a static fallback id. */
  id: string;
  title: string;
  /** Vietnamese description of the situation. */
  situation: string;
  level: LevelId;
  /** Vietnamese objective of the day. */
  goal: string;
  /** `ipa` / `pos` are absent on lessons saved before they existed. */
  vocabulary: {
    word: string;
    meaning: string;
    ipa?: string;
    pos?: PartOfSpeech;
    example?: string;
    /** Study day the word was learned on (review lessons only). */
    day?: number;
  }[];
  /** Key sentence frames; the first is the main one. */
  frames: string[];
  /** Vietnamese guide per frame (same order); absent on older lessons. */
  frameNotes?: FrameNote[];
  /** Shadowing lines (alternating speakers). */
  dialogue: string[];
  roleplay: { role: string; goal: string; opening: string };
  /** Review days teach nothing new: vocabulary and frames come from these earlier days. */
  recap?: Recap;
  version: number;
};

export type Recap = {
  days: { day: number; title: string }[];
  /** Every frame of those days; `frames` holds the ones practised today. */
  frames: { frame: string; day: number; note?: FrameNote }[];
  /** Day each of today's `frames` comes from (same order). */
  frameDays: number[];
};

export type SkillId = "reflex" | "vocabulary" | "pronunciation" | "structure" | "fluency" | "politeness" | "listening";

export type Classification = {
  level: LevelId;
  level_label: string;
  summary_vi: string;
  priorities: { skill: SkillId; label: string; why_vi: string }[];
};

export type LearnerProfile = {
  industry: string;
  industry_other: string;
  position: string;
  position_other: string;
  audiences: string[];
  goals: string[];
  self_level: LevelId;
  frequency: FrequencyId;
  /** Desired study length, 1–6 months; absent on profiles saved before the field existed. */
  duration_months?: number;
  study_time: string;
  timezone: "Asia/Ho_Chi_Minh";
  reminders: boolean;
  classification: Classification;
  /** Adjusted from real session results; starts at the classified level. */
  working_level: LevelId;
};

export type PlanDay = {
  day: number;
  /** English situation title */
  title: string;
  /** Vietnamese description */
  situation: string;
  focus: string;
  skill: SkillId;
  /** Curriculum entry ("cluster:index:audience"); absent on older AI-made roadmaps. */
  ref?: string;
};

/** Reference roadmap: titles only, detailed content is created on the study day. */
export type StudyPlan = {
  goal: string;
  days: PlanDay[];
};

export type Turn = {
  role: "assistant" | "user";
  text: string;
  input_mode?: "voice" | "text";
};

export type GoalStatus = "achieved" | "needs_review" | "insufficient_evidence";
export type LevelSignal = "below" | "match" | "above";

export type LanguageError = {
  /** Short Vietnamese label, e.g. "Thiếu mạo từ a/an" */
  issue: string;
  /** Exact learner utterance */
  example: string;
  correction: string;
};

export type Summary = {
  overview: string;
  strengths: string[];
  improvements: string[];
  next_step: string;
  goal_status: GoalStatus;
  evidence: string[];
  /** Absent on summaries saved before error tracking existed. */
  errors?: LanguageError[];
  /** Words / sentence frames to revisit. */
  review_items?: string[];
  /** Performance relative to the lesson level: "below" = it was too hard. */
  level_signal?: LevelSignal;
  mode: "demo" | "openai";
  /** Lesson frames the learner used in the conversation; absent on older summaries. */
  frames_used?: string[];
  turn_count: number;
  voice_turns: number;
  pronunciation_note: string;
};

export type PracticeView = {
  id: string;
  deadline: number;
  ended: boolean;
  turns: Turn[];
};

export type AttemptView = {
  id: string;
  day: number;
  localDate: string;
  lesson: Lesson;
  focus: string | null;
  /** The next day exists but waits for a consultant to activate the account. */
  locked: boolean;
  wordsDone: boolean;
  shadowDone: boolean;
  completed: boolean;
  summary: Summary | null;
  practice: PracticeView | null;
};

/** Review of one study week (roadmap days 1–7, 8–14, …, 29–30). */
export type WeekReview = {
  week: number;
  fromDay: number;
  toDay: number;
  /** Days in the week (7, or 2 for the last week). */
  total: number;
  done: number;
  achieved: number;
  turns: number;
  voiceTurns: number;
  /** Days opened so far; status is null while the day is not completed. */
  days: { day: number; title: string; status: GoalStatus | null }[];
  words: { word: string; meaning: string }[];
  /** `used`: the learner said it in that day's conversation. */
  frames: { frame: string; day: number; used: boolean }[];
  /** Recurring errors, most frequent first. */
  errors: { issue: string; count: number; correction: string }[];
  review: string[];
};

export type HistoryItem = {
  day: number;
  date: string;
  title: string;
  situation?: string;
  level?: LevelId;
  goal?: string;
  completed: boolean;
  summary: Summary | null;
};
