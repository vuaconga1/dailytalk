/**
 * Validates the authored 30-day curriculum: structure, placeholders, position coverage.
 *
 *   npm run check:curriculum
 *   npm run check:curriculum -- --cluster sales     (one cluster only)
 */
import { buildPlan, coverage, isModuleRef, loadAllClusters, loadCluster, renderLesson } from "../src/domain/curriculum";
import { readProfileInput } from "../src/domain/profile";
import { INDUSTRY_MEMBERS } from "../src/domain/curriculum/members";
import { buildReviewLesson, REVIEW_DAYS, reviewSources } from "../src/domain/curriculum/review";
import { INTERVIEW_DAYS, TRAVEL_DAYS } from "../src/domain/curriculum/modules";
import { WORK_AUDIENCES, type CurriculumDay } from "../src/domain/curriculum/types";
import { POS_IDS, usesFrame } from "../src/domain/frames";
import { INDUSTRIES, slugify } from "../src/domain/profile-options";
import type { LearnerProfile, Lesson } from "../src/domain/types";

const only = process.argv.includes("--cluster") ? process.argv[process.argv.indexOf("--cluster") + 1] : null;
const problems: string[] = [];
const err = (where: string, msg: string) => problems.push(`${where}: ${msg}`);
/** US English IPA: plain letters that are IPA symbols plus the special ones; c q x y are spelling, not IPA. */
const IPA = /^[abdefghijklmnoprstuvwzɪəæʊʌɑɒɔɛɜθðʃʒŋɡɝɚɾɹˈˌː ]+$/;
const SKILLS = ["reflex", "vocabulary", "pronunciation", "structure", "fluency", "politeness", "listening"];

function checkDay(where: string, d: CurriculumDay, needsAudience: boolean) {
  if (!d.title?.trim() || d.title.length > 120) err(where, "title missing or > 120 chars");
  if (!d.situation?.trim() || d.situation.length > 300) err(where, "situation missing or > 300 chars");
  if (!d.focus?.trim() || !d.goal?.trim()) err(where, "focus/goal missing");
  if (!SKILLS.includes(d.skill)) err(where, `bad skill ${d.skill}`);
  if (needsAudience && (!d.with.length || d.with.some((a) => !WORK_AUDIENCES.includes(a)))) err(where, "with must list work audiences");
  if (d.dialogue.length !== 8 || d.dialogue.some((l) => !l?.trim() || l.length > 250))
    err(where, "dialogue must be exactly 8 lines ≤ 250 chars");
  const text = d.dialogue.join(" ").toLowerCase();
  if (!Array.isArray(d.words) || d.words.length !== 5) err(where, "words must be exactly 5");
  for (const w of Array.isArray(d.words) ? d.words : []) {
    const [word, ipa, pos, meaning] = w;
    if (w.length !== 4 || ![word, ipa, meaning].every((x) => x?.trim()))
      err(where, `word ${JSON.stringify(w)} must be [word, ipa, pos, nghĩa]`);
    else if (/[{}]/.test(word)) err(where, `word "${word}" must not contain placeholders`);
    else if (!text.includes(word.toLowerCase())) err(where, `word "${word}" does not appear in the dialogue`);
    if (ipa && !IPA.test(ipa)) err(where, `ipa "${ipa}" of "${word}" has non-IPA characters (no slashes, no c q x y)`);
    if (!POS_IDS.includes(pos)) err(where, `pos "${pos}" of "${word}" must be one of ${POS_IDS.join(", ")}`);
  }
  if (!Array.isArray(d.frames) || d.frames.length !== 4) err(where, "frames must be exactly 4");
  const learner = d.dialogue.filter((_, i) => i % 2 === 1);
  for (const f of Array.isArray(d.frames) ? d.frames : []) {
    if (![f.en, f.vi, f.structure, f.usage].every((x) => typeof x === "string" && x.trim()))
      err(where, `frame ${JSON.stringify(f)} needs en, vi, structure, usage`);
    else if (!f.en.includes("…") || /[/()]/.test(f.en) || f.en.length > 120)
      err(where, `frame "${f.en}" needs a … slot, no / or ( ), ≤ 120 chars`);
    else if (!learner.some((l) => usesFrame(f.en, l))) err(where, `frame "${f.en}" is not used in any learner (even) line`);
  }
  if (d.roleplay.length !== 3 || d.roleplay.some((x) => !x?.trim() || x.length > 300)) err(where, "roleplay must be [role, task, opening]");
}

/** Words must be new inside a cluster's 30 days. */
function checkNewWords(where: string, days: CurriculumDay[]) {
  const seen = new Map<string, number>();
  days.forEach((d, i) => {
    for (const [word] of Array.isArray(d.words) ? d.words : []) {
      const key = word?.toLowerCase().trim();
      if (!key) continue;
      if (seen.has(key)) err(where, `word "${word}" repeats on days ${seen.get(key)! + 1} and ${i + 1}`);
      else seen.set(key, i);
    }
  });
}

async function main() {
  const CLUSTERS = await loadAllClusters();
  for (const cluster of Object.values(CLUSTERS)) {
    if (only && cluster.id !== only) continue;
    if (cluster.days.length !== 30) err(cluster.id, `has ${cluster.days.length} days, needs 30`);
    for (const a of WORK_AUDIENCES) if (!cluster.people[a]?.[0] || !cluster.people[a]?.[1]) err(cluster.id, `people.${a} missing`);
    cluster.days.forEach((d, i) => checkDay(`${cluster.id} day ${i + 1}`, d, true));
    checkNewWords(cluster.id, cluster.days);
    if (cluster.tracks) {
      for (const track of Object.values(cluster.tracks)) {
        const where = `${cluster.id}/${track.grade}`;
        if (track.days.length !== 30) err(where, `has ${track.days.length} days, needs 30`);
        track.days.forEach((d, i) => checkDay(`${where} day ${i + 1}`, d, true));
        const packs = Object.values(track.packs);
        const packDays = packs.flatMap((pack) => Object.values(pack).filter((lesson) => lesson != null));
        for (const pack of packs) {
          for (const [n, lesson] of Object.entries(pack)) {
            if (lesson) checkDay(`${where} pack ${n}`, lesson, true);
          }
        }
        checkNewWords(where, [...track.days, ...packDays]);
      }
    }
    if (cluster.studentSlots) {
      const blob = JSON.stringify(cluster.days).toLowerCase();
      for (const [n, lesson] of Object.entries(cluster.studentSlots)) {
        if (!lesson) continue;
        checkDay(`${cluster.id} student slot ${n}`, lesson, true);
        for (const [word] of lesson.words) {
          if (blob.includes(word.toLowerCase())) err(`${cluster.id} student slot ${n}`, `word "${word}" already appears in the base 30`);
        }
      }
    }
  }
  if (!only) {
    [...TRAVEL_DAYS, ...INTERVIEW_DAYS].forEach((d, i) => checkDay(`module ${i}`, d, false));
    checkNewWords("modules", [...TRAVEL_DAYS, ...INTERVIEW_DAYS]);
    if (TRAVEL_DAYS.length !== 2 || INTERVIEW_DAYS.length !== 2) err("modules", "travel and interview need 2 days each");
  }

  // Member vars must exist in the cluster; every offered position must be mapped explicitly.
  const labels = new Map(INDUSTRIES.map((i) => [i.id, new Set(i.positions.map((p) => p.id))]));
  for (const [industry, { fallback, positions }] of Object.entries(INDUSTRY_MEMBERS)) {
    if (!labels.has(industry)) err("members", `unknown industry ${industry}`);
    for (const [label, member] of [["(fallback)", fallback] as const, ...Object.entries(positions)]) {
      if (label !== "(fallback)" && !labels.get(industry)?.has(slugify(label)))
        err("members", `${industry}: "${label}" is not in profile-options`);
      const clusterVars = (await loadCluster(member.cluster)).vars;
      for (const key of Object.keys(member.vars ?? {})) {
        if (!(key in clusterVars))
          err("members", `${industry}/${label}: var {${key}} not defined in cluster ${member.cluster}`);
      }
    }
  }
  for (const { industry, position, label } of coverage()) {
    if (position !== "other" && !Object.keys(INDUSTRY_MEMBERS[industry]?.positions ?? {}).some((l) => slugify(l) === position)) {
      err("members", `${industry}: position "${label}" has no mapping`);
    }
  }

  // Render every position × audience combination and look for unfilled placeholders.
  const base = {
    industry_other: "",
    position_other: "",
    goals: ["meetings"],
    self_level: "elementary",
    frequency: "weekly",
    study_time: "20:00",
    timezone: "Asia/Ho_Chi_Minh",
    reminders: false,
    classification: {
      level: "elementary",
      level_label: "",
      summary_vi: "",
      priorities: [],
    },
    working_level: "elementary",
  } as const;
  let rendered = 0;
  let reviews = 0;
  for (const { industry, position, member } of coverage()) {
    if (only && member.cluster !== only) continue;
    for (const audiences of [
      [...WORK_AUDIENCES],
      ["customers"],
      ["partners"],
      ["managers"],
      ["colleagues"],
      ["customers", "travel", "recruiters"],
    ]) {
      const profile = {
        ...base,
        industry,
        position,
        audiences,
      } as unknown as LearnerProfile;
      const plan = await buildPlan(profile);
      if (plan.days.length !== 30) err(`${industry}/${position}`, "plan is not 30 days");
      const lessons = new Map<number, Lesson>();
      for (const day of plan.days) {
        let lesson;
        try {
          lesson = await renderLesson(day.ref!, profile, "elementary");
        } catch (e) {
          err(`${member.cluster} ${day.ref}`, `render failed: ${(e as Error).message}`);
          continue;
        }
        if (!lesson) {
          err(`${industry}/${position}`, `ref ${day.ref} does not render`);
          continue;
        }
        rendered++;
        lessons.set(day.day, lesson);
        const left = JSON.stringify([day, lesson]).match(/\{[A-Za-z_]+\}/g);
        if (left) err(`${industry}/${position} ${day.ref}`, `unfilled ${[...new Set(left)].join(" ")}`);
      }
      for (const day of REVIEW_DAYS) {
        const where = `${member.cluster} review day ${day} [${audiences.join(",")}]`;
        const sources = reviewSources(day).flatMap((d) =>
          lessons.has(d) ? [{ day: d, lesson: lessons.get(d)!, module: isModuleRef(plan.days[d - 1].ref) }] : [],
        );
        const r = buildReviewLesson(lessons.get(day)!, sources);
        reviews++;
        if (sources.length !== 6) err(where, `has ${sources.length} source days, needs 6`);
        if (r.frames.length !== 4 || r.dialogue.length !== 8) err(where, `${r.frames.length} frames / ${r.dialogue.length} lines, needs 4 / 8`);
        const learner = r.dialogue.filter((_, i) => i % 2 === 1);
        r.frames.forEach((f, i) => !usesFrame(f, learner[i] ?? "") && err(where, `frame "${f}" is not in learner line ${i + 1}`));
        if (r.vocabulary.length !== 30) err(where, `recaps ${r.vocabulary.length} words, needs 30`);
      }
    }
  }

  if (!only) {
    const body = {
      industry_other: "",
      position_other: "",
      audiences: ["customers"],
      goals: ["meetings"],
      self_level: "elementary",
      frequency: "weekly",
      duration_months: "3",
      age: "32",
      gender: "female",
      study_time: "20:30",
      reminders: false,
    };
    const mustThrow = (extra: Record<string, unknown>, message: string) => {
      try {
        readProfileInput({ ...body, ...extra });
        err("profile", `accepted ${message}`);
      } catch (error) {
        if ((error as Error).message !== message) err("profile", `${message} got "${(error as Error).message}"`);
      }
    };
    mustThrow({ industry: "education", position: "giao_vien" }, "Hãy chọn cấp học bạn đang dạy.");
    mustThrow({ industry: "education", position: "giao_vien", grade_level: "primary" }, "Hãy chọn ít nhất một mục đích học tiếng Anh.");
    mustThrow(
      { industry: "education", position: "giao_vien", grade_level: "nope", teaching_purposes: ["teach_lesson"] },
      "Hãy chọn cấp học bạn đang dạy.",
    );
    const sales = readProfileInput({
      ...body,
      industry: "sales",
      position: "nhan_vien_kinh_doanh",
      grade_level: "primary",
      teaching_purposes: ["teach_lesson"],
    });
    if ("grade_level" in sales || "teaching_purposes" in sales) err("profile", "stored teaching fields for a non-teaching job");
    const teacher = readProfileInput({
      ...body,
      industry: "education",
      position: "giao_vien_van",
      grade_level: "upper_secondary",
      teaching_purposes: ["teach_lesson", "teach_lesson"],
    });
    if (teacher.grade_level !== "upper_secondary" || teacher.teaching_purposes?.join() !== "teach_lesson") {
      err("profile", "did not keep grade and a unique purpose list");
    }

    const planOf = async (over: Record<string, unknown>) =>
      buildPlan({
        ...base,
        industry: "education",
        position: "giao_vien_van",
        audiences: ["customers", "colleagues"],
        grade_level: "upper_secondary",
        teaching_purposes: ["teach_lesson"],
        ...over,
      } as unknown as LearnerProfile);
    const lit = await planOf({});
    const situation = (plan: { days: { situation: string; title: string }[] }, n: number) => plan.days[n - 1];
    if (!situation(lit, 2).situation.includes("the grade 11 literature class")) err("literature", "upper secondary class name missing");
    for (const n of [17, 20, 27]) {
      if (situation(lit, n).situation.includes("đồng nghiệp")) err("literature", `day ${n} still talks with a colleague`);
    }
    for (const n of [15, 16, 21, 25]) {
      if (situation(lit, n).situation.includes("phụ huynh")) err("literature", `day ${n} still talks with a parent`);
    }
    for (const n of [18, 19]) {
      if (situation(lit, n).situation.includes("quản lý")) err("literature", `day ${n} still talks with a manager`);
    }
    const withTeam = await planOf({ teaching_purposes: ["teach_lesson", "talk_colleagues"] });
    if (!situation(withTeam, 17).situation.includes("đồng nghiệp")) err("literature", "colleague purpose did not add day 17");
    if (situation(withTeam, 5).situation.includes("đồng nghiệp")) err("literature", "day 5 became a colleague lesson");
    const withParents = await planOf({ teaching_purposes: ["teach_lesson", "talk_parents"] });
    if (!situation(withParents, 15).situation.includes("phụ huynh")) err("literature", "parent purpose did not add day 15");
    const withManager = await planOf({ teaching_purposes: ["teach_lesson", "report_manager"] });
    if (!situation(withManager, 18).situation.includes("quản lý")) err("literature", "manager purpose did not add day 18");
    const counting = await planOf({ position: "giao_vien_toan", grade_level: "preschool", teaching_purposes: ["teach_lesson"] });
    if (!situation(counting, 2).situation.includes("the counting time")) err("math", "preschool class name missing");
    if (situation(lit, 5).title === situation(counting, 5).title) err("tracks", "literature and math day 5 titles match");
    const primaryTeacher = await planOf({ position: "giao_vien", grade_level: "primary" });
    if (!situation(primaryTeacher, 2).situation.includes("the primary class")) err("education", "primary class name missing");
    const lecturer = await planOf({ position: "giang_vien", grade_level: "upper_secondary" });
    if (!situation(lecturer, 2).situation.includes("the lecture")) err("education", "lecturer lost the lecture class name");
    const coach = await planOf({
      industry: "sports",
      position: "huan_luyen_vien_the_thao",
      grade_level: undefined,
      teaching_purposes: undefined,
    });
    if (situation(coach, 20).title !== "Cover for a sick colleague") err("education", "coach lost the colleague cover lesson");
    if (situation(coach, 21).title !== "Review: talk with parents and plan support") err("education", "coach lost the parent review");
    const classOnly = await planOf({ position: "giao_vien", grade_level: "lower_secondary", teaching_purposes: ["teach_lesson"] });
    if (situation(classOnly, 20).title === "Cover for a sick colleague") err("education", "teacher without colleague purpose still covers a class");
    if (!situation(classOnly, 21).title.includes("last six lessons")) err("education", "teacher without parent purpose still reviews a parent meeting");
  }

  const unique = [...new Set(problems)];
  const shown = process.argv.includes("--all") ? unique.length : 80;
  for (const p of unique.slice(0, shown)) console.log(`✗ ${p}`);
  if (unique.length > shown) console.log(`… and ${unique.length - shown} more (--all to list every problem)`);
  console.log(`${unique.length ? "FAILED" : "OK"}: ${unique.length} problem(s), ${rendered} lessons rendered, ${reviews} review lessons built.`);
  process.exitCode = unique.length ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
