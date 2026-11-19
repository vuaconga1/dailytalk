import { createHash } from "node:crypto";
import { profileLabels } from "@/domain/profile";
import { INDUSTRIES, OTHER, slugify, type GradeLevelId, type LevelId, type TeachingPurposeId } from "@/domain/profile-options";
import type { LearnerProfile, Lesson, PlanDay, StudyPlan } from "@/domain/types";
import { INDUSTRY_MEMBERS } from "./members";
import { INTERVIEW_DAYS, TRAVEL_DAYS } from "./modules";
import {
  WORK_AUDIENCES,
  type Audience,
  type Cluster,
  type ClusterId,
  type CurriculumDay,
  type DayPack,
  type GradeTrack,
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
  literature: "Giảng dạy Văn",
  math: "Giảng dạy Toán",
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
  literature: () => import("@/data/curriculum/literature").then((m) => m.literature),
  math: () => import("@/data/curriculum/math").then((m) => m.math),
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

const GENERIC_CLASS: Record<GradeLevelId, { className: string; gradeLabel: string }> = {
  preschool: { className: "the preschool class", gradeLabel: "preschool" },
  primary: { className: "the primary class", gradeLabel: "grade 3" },
  lower_secondary: { className: "the lower-secondary class", gradeLabel: "grade 8" },
  upper_secondary: { className: "the upper-secondary class", gradeLabel: "grade 11" },
};

const PARENT_SLOTS = [15, 16, 21, 25];
const COLLEAGUE_SLOTS = [17, 20, 27];
const MANAGER_SLOTS = [18, 19];
const STUDENT_PURPOSES: TeachingPurposeId[] = ["teach_lesson", "guide_practice", "give_feedback"];

function applySlots(days: CurriculumDay[], slots: number[], pack: DayPack | undefined) {
  if (!pack) return;
  for (const n of slots) {
    const lesson = pack[n];
    if (lesson) days[n - 1] = lesson;
  }
}

/** Student base, with adult packs added or removed according to the selected purposes. */
export function assembleDays(cluster: Cluster, track: GradeTrack | null, purposes: TeachingPurposeId[] | undefined): CurriculumDay[] {
  const days = [...(track?.days ?? cluster.days)];
  const selected = new Set(purposes ?? []);
  if (track) {
    if (selected.has("talk_parents")) applySlots(days, PARENT_SLOTS, track.packs.talk_parents);
    if (selected.has("talk_colleagues")) applySlots(days, COLLEAGUE_SLOTS, track.packs.talk_colleagues);
    if (selected.has("report_manager")) applySlots(days, MANAGER_SLOTS, track.packs.report_manager);
    return days;
  }
  if (selected.size && cluster.studentSlots) {
    if (!selected.has("talk_parents")) applySlots(days, PARENT_SLOTS, cluster.studentSlots);
    if (!selected.has("talk_colleagues")) applySlots(days, COLLEAGUE_SLOTS, cluster.studentSlots);
    if (!selected.has("report_manager")) applySlots(days, MANAGER_SLOTS, cluster.studentSlots);
  }
  return days;
}

function audiencesFor(profile: LearnerProfile): Audience[] {
  const purposes = profile.teaching_purposes ?? [];
  const gated = purposes.length > 0;
  const allow = new Set<Audience>();
  for (const audience of WORK_AUDIENCES) {
    if (!profile.audiences.includes(audience)) continue;
    if (gated && audience === "partners" && !purposes.includes("talk_parents")) continue;
    if (gated && audience === "colleagues" && !purposes.includes("talk_colleagues")) continue;
    if (gated && audience === "managers" && !purposes.includes("report_manager")) continue;
    allow.add(audience);
  }
  if (purposes.some((purpose) => STUDENT_PURPOSES.includes(purpose))) allow.add("customers");
  if (purposes.includes("talk_parents")) allow.add("partners");
  if (purposes.includes("talk_colleagues")) allow.add("colleagues");
  if (purposes.includes("report_manager")) allow.add("managers");
  return [...allow];
}

type Context = {
  cluster: Cluster;
  track: GradeTrack | null;
  assembled: CurriculumDay[];
  member: Member;
  jobVi: string;
  audiences: Audience[];
  gradeLevel?: GradeLevelId;
};

async function contextOf(profile: LearnerProfile): Promise<Context> {
  const member = memberFor(profile);
  const cluster = await loadCluster(member.cluster);
  const gradeLevel = profile.grade_level ?? (cluster.tracks ? "lower_secondary" : undefined);
  const track = gradeLevel && cluster.tracks ? cluster.tracks[gradeLevel] : null;
  return {
    cluster,
    track,
    assembled: assembleDays(cluster, track, profile.teaching_purposes),
    member,
    jobVi: lowerFirst(profileLabels(profile).position),
    audiences: audiencesFor(profile),
    gradeLevel,
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
  if (ctx.track) {
    vars.grade = ctx.track.gradeLabel;
    if (!ctx.member.vars?.class) vars.class = ctx.track.className;
  } else if (ctx.gradeLevel) {
    const generic = GENERIC_CLASS[ctx.gradeLevel];
    vars.grade = generic.gradeLabel;
    if (!ctx.member.vars?.class) vars.class = generic.className;
  }
  if (audience) {
    const [en, vi] = ctx.track?.people?.[audience] ?? ctx.member.people?.[audience] ?? ctx.cluster.people[audience];
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
  const days = source === ctx.cluster.id ? ctx.assembled : MODULES[source];
  const day = days?.[index];
  if (!day) return null;
  const picked = source === ctx.cluster.id ? pickAudience(day, ctx.audiences) : ((audience || null) as Audience | null);
  return {
    day,
    source,
    index,
    audience: picked,
  };
}

/** 30-day reference roadmap for the learner's cluster, audiences and goals. */
export async function buildPlan(profile: LearnerProfile): Promise<StudyPlan> {
  const ctx = await contextOf(profile);
  const refs: string[] = ctx.assembled.map((d, i) => `${ctx.cluster.id}:${i}:${pickAudience(d, ctx.audiences) ?? ""}`);
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
  const subject = ctx.cluster.id === "literature" ? "Văn" : ctx.cluster.id === "math" ? "Toán" : "";
  const purposes = profile.teaching_purposes ?? [];
  const goal = subject
    ? `Sau 30 ngày, bạn tự tin dùng tiếng Anh khi dạy ${subject}: ${[
        "giảng bài và giao bài cho học sinh",
        purposes.includes("talk_parents") ? "trao đổi với phụ huynh" : "",
        purposes.includes("talk_colleagues") ? "trao đổi với đồng nghiệp" : "",
        purposes.includes("report_manager") ? "báo cáo với quản lý" : "",
      ]
        .filter(Boolean)
        .join(", ")}.`
    : `Sau 30 ngày, bạn tự tin dùng tiếng Anh trong công việc ${ctx.jobVi}: ${ctx.cluster.summary}.`;
  return {
    goal,
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
