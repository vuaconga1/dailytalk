import { coverage } from "@/domain/curriculum";
import type { Cluster, ClusterId, CurriculumDay, GradeId } from "@/domain/curriculum/types";
import { PARTS_OF_SPEECH, type PartOfSpeech } from "@/domain/frames";
import { GRADE_LEVELS, INDUSTRIES } from "@/domain/profile-options";

export type VocabWord = {
  word: string;
  ipa: string;
  pos: string;
  posLabel: string;
  meaning: string;
  /** First dialogue line that contains the word, when available. */
  example?: string;
};

export type VocabGroup = {
  id: string;
  label: string;
  words: VocabWord[];
};

export type CatalogPosition = {
  id: string;
  label: string;
  job: string;
  clusterLabel: string;
  count: number;
  groups: VocabGroup[];
};

export type CatalogIndustry = {
  id: string;
  label: string;
  positions: CatalogPosition[];
};

const GRADE_ORDER: GradeId[] = ["preschool", "primary", "lower_secondary", "upper_secondary"];

function wordOf(word: string, ipa: string, pos: string, meaning: string, example?: string): VocabWord | null {
  const clean = word.trim();
  const gloss = meaning.trim();
  if (!clean || !gloss) return null;
  const known = pos in PARTS_OF_SPEECH ? (pos as PartOfSpeech) : null;
  const sample = example?.trim();
  return {
    word: clean,
    ipa: ipa.trim(),
    pos: known ?? "",
    posLabel: known ? PARTS_OF_SPEECH[known] : "",
    meaning: gloss,
    ...(sample ? { example: sample } : {}),
  };
}

function exampleOf(word: string, dialogue: string[] | undefined): string | undefined {
  const needle = word.trim().toLowerCase();
  if (!needle || !dialogue?.length) return undefined;
  return dialogue.find((line) => line.toLowerCase().includes(needle));
}

function collect(days: CurriculumDay[]): Map<string, VocabWord> {
  const map = new Map<string, VocabWord>();
  for (const day of days) {
    for (const [word, ipa, pos, meaning] of day.words ?? []) {
      const item = wordOf(word, ipa, pos, meaning, exampleOf(word, day.dialogue));
      if (!item) continue;
      const key = item.word.toLowerCase();
      const prev = map.get(key);
      if (!prev) {
        map.set(key, item);
        continue;
      }
      if (!prev.example && item.example) map.set(key, { ...prev, example: item.example });
    }
  }
  return map;
}

function listed(map: Map<string, VocabWord>, skip?: Set<string>): VocabWord[] {
  return [...map.values()]
    .filter((item) => !skip?.has(item.word.toLowerCase()))
    .sort((a, b) => a.word.localeCompare(b.word, "en"));
}

function groupsFor(cluster: Cluster): VocabGroup[] {
  if (!cluster.tracks) {
    return [{ id: "course", label: "Từ trong 30 ngày học", words: listed(collect(cluster.days)) }];
  }

  const byGrade = new Map<GradeId, Map<string, VocabWord>>();
  for (const grade of GRADE_ORDER) {
    const track = cluster.tracks[grade];
    if (track) byGrade.set(grade, collect(track.days));
  }
  const gradeMaps = [...byGrade.values()];
  const shared = new Set<string>();
  const first = gradeMaps[0];
  if (first && gradeMaps.length > 1) {
    for (const key of first.keys()) {
      if (gradeMaps.every((map) => map.has(key))) shared.add(key);
    }
  }

  const groups: VocabGroup[] = [];
  if (shared.size) {
    groups.push({
      id: "shared",
      label: "Dùng ở mọi cấp",
      words: listed(new Map([...first].filter(([key]) => shared.has(key)))),
    });
  }
  for (const grade of GRADE_ORDER) {
    const map = byGrade.get(grade);
    if (!map) continue;
    const words = listed(map, shared.size ? shared : undefined);
    if (!words.length) continue;
    const label = GRADE_LEVELS.find((item) => item.id === grade)?.label ?? grade;
    groups.push({ id: grade, label, words });
  }

  const packs = collect(
    GRADE_ORDER.flatMap((grade) =>
      Object.values(cluster.tracks?.[grade]?.packs ?? {}).flatMap((pack) => Object.values(pack).filter((day): day is CurriculumDay => Boolean(day))),
    ),
  );
  const shown = new Set(groups.flatMap((group) => group.words.map((word) => word.word.toLowerCase())));
  const meeting = listed(packs, shown);
  if (meeting.length) {
    groups.push({ id: "meetings", label: "Họp phụ huynh, đồng nghiệp và quản lý", words: meeting });
  }
  return groups;
}

/** Full vocabulary index for every industry and position the onboarding form offers. */
export function buildVocabularyIndex(clusters: Record<ClusterId, Cluster>): CatalogIndustry[] {
  const rows = coverage();
  return INDUSTRIES.map((industry) => ({
    id: industry.id,
    label: industry.label,
    positions: industry.positions.flatMap((position) => {
      const row = rows.find((item) => item.industry === industry.id && item.position === position.id);
      if (!row) return [];
      const cluster = clusters[row.member.cluster];
      if (!cluster) return [];
      const groups = groupsFor(cluster);
      const count = new Set(groups.flatMap((group) => group.words.map((word) => word.word.toLowerCase()))).size;
      return [
        {
          id: position.id,
          label: position.label,
          job: row.member.job,
          clusterLabel: cluster.label,
          count,
          groups,
        },
      ];
    }),
  })).filter((industry) => industry.positions.length > 0);
}
