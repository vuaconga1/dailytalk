import { createHash } from "node:crypto";
import { profileLabels } from "@/lib/profile";
import { INDUSTRIES, OTHER, slugify, type LevelId } from "@/lib/profile-options";
import type { LearnerProfile, Lesson, PlanDay, StudyPlan } from "@/lib/types";
import { creative } from "./clusters/creative";
import { education } from "./clusters/education";
import { engineering } from "./clusters/engineering";
import { finance_legal } from "./clusters/finance_legal";
import { healthcare } from "./clusters/healthcare";
import { hospitality } from "./clusters/hospitality";
import { household } from "./clusters/household";
import { logistics } from "./clusters/logistics";
import { office } from "./clusters/office";
import { operations } from "./clusters/operations";
import { research } from "./clusters/research";
import { sales } from "./clusters/sales";
import { support } from "./clusters/support";
import { tech } from "./clusters/tech";
import { INDUSTRY_MEMBERS } from "./members";
import { INTERVIEW_DAYS, TRAVEL_DAYS } from "./modules";
import { WORK_AUDIENCES, type Audience, type Cluster, type ClusterId, type CurriculumDay, type Member } from "./types";

export const CLUSTERS: Record<ClusterId, Cluster> = {
  sales,
  support,
  office,
  finance_legal,
  creative,
  tech,
  engineering,
  logistics,
  hospitality,
  healthcare,
  education,
  research,
  operations,
  household,
};

/** Authored content targets short, simple sentences; other levels are adapted by AI when available. */
export const CURRICULUM_LEVEL: LevelId = "elementary";
const CURRICULUM_VERSION = 2;

const MODULES: Record<string, CurriculumDay[]> = {
  travel: TRAVEL_DAYS,
  interview: INTERVIEW_DAYS,
};
/** Roadmap refs that point at the travel / interview modules rather than the job cluster. */
export function isModuleRef(ref: string | undefined): boolean {
  return Boolean(ref && ref.split(":")[0] in MODULES);
}
const TRAVEL_SLOTS = [19, 20];
const INTERVIEW_SLOTS = [26, 27];

/** Position label slug → member, per industry. */
const POSITION_INDEX = new Map(
  Object.entries(INDUSTRY_MEMBERS).map(([industry, { positions }]) => [
    industry,
    new Map(Object.entries(positions).map(([label, member]) => [slugify(label), member])),
  ]),
);

export function memberFor(profile: Pick<LearnerProfile, "industry" | "position">): Member {
  const industry = INDUSTRY_MEMBERS[profile.industry] ?? INDUSTRY_MEMBERS[OTHER];
  if (profile.position === OTHER) return industry.fallback;
  return POSITION_INDEX.get(profile.industry)?.get(profile.position) ?? industry.fallback;
}

function article(word: string): string {
  const first = word.split(/[\s/]/)[0];
  if (/^[A-Z&]{2,}$/.test(first)) return /^[AEFHILMNORSX]/.test(first) ? "an" : "a";
  return /^(?:[aeio]|u(?!s|ni))/i.test(word) ? "an" : "a";
}

function lowerFirst(s: string): string {
  return s.length > 1 && s[1] === s[1].toLowerCase() ? s[0].toLowerCase() + s.slice(1) : s;
}

type Context = {
  cluster: Cluster;
  member: Member;
  jobVi: string;
  audiences: Audience[];
};

function contextOf(profile: LearnerProfile): Context {
  const member = memberFor(profile);
  return {
    cluster: CLUSTERS[member.cluster],
    member,
    jobVi: lowerFirst(profileLabels(profile).position),
    audiences: WORK_AUDIENCES.filter((a) => profile.audiences.includes(a)),
  };
}

function varsFor(ctx: Context, audience: Audience | null): Record<string, string> {
  const vars: Record<string, string> = {
    ...ctx.cluster.vars,
    ...ctx.member.vars,
    job: ctx.member.job,
    job_vi: ctx.jobVi,
  };
  vars.a_job = `${article(ctx.member.job)} ${ctx.member.job}`;
  if (audience) {
    const [en, vi] = ctx.member.people?.[audience] ?? ctx.cluster.people[audience];
    Object.assign(vars, {
      person: en,
      person_vi: vi,
      a_person: `${article(en)} ${en}`,
    });
  }
  return vars;
}

/** Replaces {key} placeholders; {Key} capitalises the value. Unknown keys are left as-is. */
export function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (all, key: string) => {
    const lower = key[0].toLowerCase() + key.slice(1);
    const value = vars[lower];
    if (value === undefined) return all;
    return key[0] !== lower[0] ? value[0].toUpperCase() + value.slice(1) : value;
  });
}

function pickAudience(day: CurriculumDay, learner: Audience[]): Audience | null {
  if (!day.with.length) return null;
  return day.with.find((a) => learner.includes(a)) ?? day.with[0];
}

type DayRef = {
  day: CurriculumDay;
  source: string;
  index: number;
  audience: Audience | null;
};

function resolveRef(ref: string, ctx: Context): DayRef | null {
  const [source, i, audience] = ref.split(":");
  const index = Number(i);
  const days = source === ctx.cluster.id ? ctx.cluster.days : MODULES[source];
  const day = days?.[index];
  if (!day) return null;
  return {
    day,
    source,
    index,
    audience: (audience || null) as Audience | null,
  };
}

/** 30-day reference roadmap for the learner's cluster, audiences and goals. */
export function buildPlan(profile: LearnerProfile): StudyPlan {
  const ctx = contextOf(profile);
  const refs: string[] = ctx.cluster.days.map((d, i) => `${ctx.cluster.id}:${i}:${pickAudience(d, ctx.audiences) ?? ""}`);
  if (profile.audiences.includes("travel")) TRAVEL_SLOTS.forEach((day, i) => (refs[day - 1] = `travel:${i}:`));
  if (profile.audiences.includes("recruiters")) INTERVIEW_SLOTS.forEach((day, i) => (refs[day - 1] = `interview:${i}:`));

  const days: PlanDay[] = refs.map((ref, i) => {
    const r = resolveRef(ref, ctx)!;
    const vars = varsFor(ctx, r.audience);
    return {
      day: i + 1,
      title: fill(r.day.title, vars),
      situation: fill(r.day.situation, vars),
      focus: fill(r.day.focus, vars),
      skill: r.day.skill,
      ref,
    };
  });
  return {
    goal: `Sau 30 ngày, bạn tự tin dùng tiếng Anh trong công việc ${ctx.jobVi}: ${ctx.cluster.summary}.`,
    days,
  };
}

/** Full lesson for a roadmap entry, filled for this learner. Null when the ref is unknown. */
export function renderLesson(ref: string, profile: LearnerProfile, level: LevelId): Lesson | null {
  const ctx = contextOf(profile);
  const r = resolveRef(ref, ctx);
  if (!r) return null;
  const vars = varsFor(ctx, r.audience);
  const f = (s: string) => fill(s, vars);
  const dialogue = r.day.dialogue.map(f);
  const vocabulary = r.day.words.map(([word, ipa, pos, meaning]) => {
    const example = dialogue.find((line) => line.toLowerCase().includes(word.toLowerCase()));
    return {
      word,
      ipa,
      pos,
      meaning: f(meaning),
      ...(example ? { example } : {}),
    };
  });
  const [role, task, opening] = r.day.roleplay.map(f);
  const content = {
    title: f(r.day.title),
    situation: f(r.day.situation),
    goal: f(r.day.goal),
    vocabulary,
    frames: r.day.frames.map((x) => f(x.en)),
    frameNotes: r.day.frames.map((x) => ({
      meaning: f(x.vi),
      structure: f(x.structure),
      usage: f(x.usage),
    })),
    dialogue,
    roleplay: { role, goal: task, opening },
  };
  const hash = createHash("sha256").update(JSON.stringify(content)).digest("hex").slice(0, 12);
  return {
    id: `cur-${r.source}-${r.index + 1}-${hash}`,
    level,
    version: CURRICULUM_VERSION,
    ...content,
  };
}

/** Labels stored with bank entries: the cluster and the English job title. */
export function curriculumMeta(profile: LearnerProfile): {
  cluster: string;
  job: string;
} {
  const member = memberFor(profile);
  return { cluster: CLUSTERS[member.cluster].label, job: member.job };
}

/** Every (industry, position) the form offers, with the cluster it learns with. */
export function coverage() {
  return INDUSTRIES.flatMap((industry) =>
    industry.positions.map((p) => ({
      industry: industry.id,
      position: p.id,
      label: p.label,
      member: memberFor({ industry: industry.id, position: p.id }),
    })),
  );
}
