import { Problem } from "@/lib/errors";
import {
  AUDIENCES,
  FREQUENCIES,
  GENDERS,
  GOALS,
  INDUSTRIES,
  labelOf,
  LEVEL_IDS,
  MAX_DURATION_MONTHS,
  OTHER,
  type FrequencyId,
  type GenderId,
  type LevelId,
} from "@/domain/profile-options";
import { isStudyTime } from "@/lib/time";
import type { LearnerProfile } from "@/domain/types";

export type ProfileInput = Omit<LearnerProfile, "classification" | "working_level">;

export const OTHER_MAX = 100;
export const NAME_MAX = 80;
export const MIN_AGE = 10;
export const MAX_AGE = 100;

export function readLearnerName(body: Record<string, unknown>): string {
  const name = str(body, "name", NAME_MAX);
  if (!name) throw new Problem("Hãy nhập tên của bạn.");
  return name;
}

function str(body: Record<string, unknown>, key: string, max: number): string {
  const v = body[key] ?? "";
  if (typeof v !== "string" || v.trim().length > max) throw new Problem(`Thông tin chưa hợp lệ: ${key}`);
  return v.trim();
}

function ids(body: Record<string, unknown>, key: string, allowed: Set<string>, label: string): string[] {
  const v = body[key];
  if (!Array.isArray(v) || !v.length || v.some((x) => typeof x !== "string" || !allowed.has(x))) {
    throw new Problem(`Hãy chọn ít nhất một mục: ${label}.`);
  }
  return [...new Set(v as string[])];
}

/** Validates the learning-profile form plus desired duration, study time and reminders. */
export function readProfileInput(body: Record<string, unknown>): ProfileInput {
  const industry = str(body, "industry", 40);
  const sector = INDUSTRIES.find((i) => i.id === industry);
  if (!sector) throw new Problem("Hãy chọn công việc.");
  const industryOther = industry === OTHER ? str(body, "industry_other", OTHER_MAX) : "";
  if (industry === OTHER && !industryOther) throw new Problem("Hãy nhập công việc của bạn.");

  const position = str(body, "position", 40);
  if (!sector.positions.some((p) => p.id === position)) throw new Problem("Hãy chọn vị trí.");
  const positionOther = position === OTHER ? str(body, "position_other", OTHER_MAX) : "";
  if (position === OTHER && !positionOther) throw new Problem("Hãy nhập vị trí của bạn.");

  const selfLevel = str(body, "self_level", 20) as LevelId;
  if (!LEVEL_IDS.includes(selfLevel)) throw new Problem("Hãy chọn trình độ hiện tại.");
  const frequency = str(body, "frequency", 20) as FrequencyId;
  if (!FREQUENCIES.some((f) => f.id === frequency)) throw new Problem("Hãy chọn tần suất sử dụng tiếng Anh.");

  const duration = Number(str(body, "duration_months", 2));
  if (!Number.isInteger(duration) || duration < 1 || duration > MAX_DURATION_MONTHS) throw new Problem("Hãy chọn thời gian học mong muốn.");

  const studyTime = str(body, "study_time", 5);
  if (!isStudyTime(studyTime)) throw new Problem("Giờ học dùng định dạng HH:MM.");

  const age = Number(str(body, "age", 3));
  if (!Number.isInteger(age) || age < MIN_AGE || age > MAX_AGE) throw new Problem(`Tuổi phải từ ${MIN_AGE} đến ${MAX_AGE}.`);

  const gender = str(body, "gender", 10) as GenderId;
  if (!GENDERS.some((g) => g.id === gender)) throw new Problem("Hãy chọn giới tính.");

  return {
    age,
    gender,
    industry,
    industry_other: industryOther,
    position,
    position_other: positionOther,
    audiences: ids(body, "audiences", new Set(AUDIENCES.map((a) => a.id)), "đối tượng giao tiếp"),
    goals: ids(body, "goals", new Set(GOALS.map((g) => g.id)), "mục tiêu học tiếng Anh"),
    self_level: selfLevel,
    frequency,
    duration_months: duration,
    study_time: studyTime,
    timezone: "Asia/Ho_Chi_Minh",
    reminders: body.reminders === true,
  };
}

/** Human-readable labels; "Khác" resolves to the learner's own text. */
export function profileLabels(p: Pick<LearnerProfile, "industry" | "industry_other" | "position" | "position_other" | "audiences" | "goals">) {
  const sector = INDUSTRIES.find((i) => i.id === p.industry);
  return {
    industry: p.industry === OTHER ? p.industry_other : (sector?.label ?? p.industry),
    position: p.position === OTHER ? p.position_other : (sector?.positions.find((x) => x.id === p.position)?.label ?? p.position),
    audiences: p.audiences.map((a) => labelOf(AUDIENCES, a) ?? a),
    goals: p.goals.map((g) => labelOf(GOALS, g) ?? g),
  };
}

/** Profiles from the old survey (domain/role/assessment) must redo onboarding. */
export function isCurrentProfile(profile: unknown): profile is LearnerProfile {
  return typeof profile === "object" && profile !== null && "industry" in profile && "classification" in profile;
}
