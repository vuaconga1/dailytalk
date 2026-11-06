import type { PartOfSpeech } from "@/domain/frames";
import type { SkillId } from "@/domain/types";

/** A sentence frame with its Vietnamese guide (meaning, structure, usage). */
export type Frame = {
  en: string;
  vi: string;
  structure: string;
  usage: string;
};

/** Work audiences that change who the learner talks to inside a cluster lesson. */
export type Audience = "customers" | "partners" | "managers" | "colleagues";
export const WORK_AUDIENCES: Audience[] = ["customers", "partners", "managers", "colleagues"];

export type ClusterId =
  | "sales"
  | "support"
  | "office"
  | "finance_legal"
  | "creative"
  | "tech"
  | "engineering"
  | "logistics"
  | "hospitality"
  | "healthcare"
  | "education"
  | "research"
  | "operations"
  | "household";

/**
 * One authored study day. Text may contain placeholders filled per learner:
 *   {person} {person_vi}  – the counterpart for the chosen audience ("client" / "khách hàng")
 *   {a_person}            – with article ("a client", "an engineer")
 *   {job} {a_job} {job_vi} – the learner's position (English / Vietnamese)
 *   any key of the cluster's `vars` (e.g. {product})
 * A capitalised key ({Person}, {Product}) capitalises the value.
 */
export type CurriculumDay = {
  /** Short English title. */
  title: string;
  /** One Vietnamese sentence describing the concrete situation. */
  situation: string;
  skill: SkillId;
  /** Short Vietnamese focus of the day. */
  focus: string;
  /** Vietnamese objective: what the learner can do after the lesson. */
  goal: string;
  /** Audiences this situation suits, in order of preference; the first is the default. */
  with: Audience[];
  /**
   * Exactly 5 new words or chunks: [word, IPA without slashes (US), part of speech, nghĩa].
   * No placeholders; each must appear in the dialogue and be new within the cluster.
   */
  words: [word: string, ipa: string, pos: PartOfSpeech, meaning: string][];
  /** Exactly 4 sentence frames; "…" marks the slot. Each is used in a learner line of the dialogue. */
  frames: Frame[];
  /** Exactly 8 shadowing lines; odd lines (1st, 3rd…) = counterpart, even lines = learner. */
  dialogue: string[];
  /** [who the coach plays (English), Vietnamese task for the learner, coach's first English line]. */
  roleplay: [role: string, task: string, opening: string];
};

export type Cluster = {
  id: ClusterId;
  label: string;
  /** Vietnamese: the communication this group shares. */
  summary: string;
  /** Counterpart per audience: [English, Vietnamese]. */
  people: Record<Audience, [en: string, vi: string]>;
  /** Default small words; positions may override them. */
  vars: Record<string, string>;
  /** Exactly 30 days. Days 19–20 and 26–27 may be replaced by the travel / interview modules. */
  days: CurriculumDay[];
};

export type Member = {
  cluster: ClusterId;
  /** English job title, e.g. "sales executive". */
  job: string;
  vars?: Record<string, string>;
  people?: Partial<Record<Audience, [en: string, vi: string]>>;
};
