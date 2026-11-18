import { createHash } from "node:crypto";
import { profileLabels } from "@/domain/profile";
import { INDUSTRIES, OTHER, slugify, type LevelId } from "@/domain/profile-options";
import type { LearnerProfile, Lesson, PlanDay, StudyPlan } from "@/domain/types";
import { INDUSTRY_MEMBERS } from "./members";
import { INTERVIEW_DAYS, TRAVEL_DAYS } from "./modules";
import {
  WORK_AUDIENCES,
  type Audience,
  type Cluster,
  type ClusterId,
  type CurriculumDay,
  type Member,
} from "./types";

/** Authored content targets short, simple sentences; other levels are adapted by AI when available. */
export const CURRICULUM_LEVEL: LevelId = "elementary";
const CURRICULUM_VERSION = 2;

/** Labels without loading 30-day blobs — used by bank metadata. */
export const CLUSTER_LABELS: Record<ClusterId, string> = {
  sales: "Tư vấn & bán hàng",
  support: "Chăm sóc & hỗ trợ khách hàng",
  office: "Văn phòng – hành chính – nhân sự",
  finance_legal: "Tài chính – kế toán – pháp lý",
  creative: "Marketing – sáng tạo",
  tech: "Công nghệ",
  engineering: "Kỹ thuật – sản xuất – công trường",
  logistics: "Logistics – xuất nhập khẩu – mua hàng",
  hospitality: "Dịch vụ khách: du lịch, nhà hàng, làm đẹp",
  healthcare: "Y tế – chăm sóc sức khỏe",
  education: "Giáo dục – huấn luyện",
  research: "Nghiên cứu – khoa học",
  operations: "Vận hành – an ninh – khẩn cấp",
  household: "Dịch vụ gia đình",
};

const CLUSTER_LOADERS: Record<ClusterId, () => Promise<Cluster>> = {
  sales: () => import("@/data/curriculum/sales").then((m) => m.sales),
  support: () => import("@/data/curriculum/support").then((m) => m.support),
  office: () => import("@/data/curriculum/office").then((m) => m.office),
  finance_legal: () => import("@/data/curriculum/finance_legal").then((m) => m.finance_legal),
  creative: () => import("@/data/curriculum/creative").then((m) => m.creative),
  tech: () => import("@/data/curriculum/tech").then((m) => m.tech),
  engineering: () => import("@/data/curriculum/engineering").then((m) => m.engineering),
  logistics: () => import("@/data/curriculum/logistics").then((m) => m.logistics),
  hospitality: () => import("@/data/curriculum/hospitality").then((m) => m.hospitality),
  healthcare: () => import("@/data/curriculum/healthcare").then((m) => m.healthcare),
  education: () => import("@/data/curriculum/education").then((m) => m.education),
  research: () => import("@/data/curriculum/research").then((m) => m.research),
  operations: () => import("@/data/curriculum/operations").then((m) => m.operations),
  household: () => import("@/data/curriculum/household").then((m) => m.household),
};

const clusterCache = new Map<ClusterId, Promise<Cluster>>();

/** Loads one job-cluster curriculum module (cached). Avoids pulling all 14 files on every soft-nav. */
export function loadCluster(id: ClusterId): Promise<Cluster> {
  let hit = clusterCache.get(id);
  if (!hit) {
    hit = CLUSTER_LOADERS[id]();
    clusterCache.set(id, hit);
  }
  return hit;
}

/** All clusters — for validation scripts / audio gen, not learner hot paths. */
export async function loadAllClusters(): Promise<Record<ClusterId, Cluster>> {
  const ids = Object.keys(CLUSTER_LOADERS) as ClusterId[];
  const entries = await Promise.all(ids.map(async (id) => [id, await loadCluster(id)] as const));
  return Object.fromEntries(entries) as Record<ClusterId, Cluster>;
}

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

async function contextOf(profile: LearnerProfile): Promise<Context> {
  const member = memberFor(profile);
  return {
    cluster: await loadCluster(member.cluster),
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
export async function buildPlan(profile: LearnerProfile): Promise<StudyPlan> {
  const ctx = await contextOf(profile);
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
export async function renderLesson(ref: string, profile: LearnerProfile, level: LevelId): Promise<Lesson | null> {
  const ctx = await contextOf(profile);
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
export async function curriculumMeta(profile: LearnerProfile): Promise<{
  cluster: string;
  job: string;
}> {
  const member = memberFor(profile);
  return { cluster: CLUSTER_LABELS[member.cluster], job: member.job };
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
