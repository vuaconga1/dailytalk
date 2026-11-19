import "server-only";
import { loadAllClusters } from "@/domain/curriculum";
import { normalizeLesson } from "@/domain/content";
import { PARTS_OF_SPEECH, type PartOfSpeech } from "@/domain/frames";
import { buildVocabularyIndex, type CatalogIndustry, type VocabGroup, type VocabWord } from "@/domain/vocabulary-catalog";
import { prisma } from "@/server/db";

let cached: Promise<CatalogIndustry[]> | null = null;

/** Authored curriculum vocabulary, grouped by industry and position. Cached for the server process. */
export function vocabularyIndex(): Promise<CatalogIndustry[]> {
  if (!cached) {
    cached = loadAllClusters()
      .then((clusters) => buildVocabularyIndex(clusters))
      .catch((error) => {
        cached = null;
        throw error;
      });
  }
  return cached;
}

function bankWord(raw: {
  word?: string;
  ipa?: string;
  pos?: string;
  meaning?: string;
  example?: string;
}): VocabWord | null {
  const word = raw.word?.trim() ?? "";
  const meaning = raw.meaning?.trim() ?? "";
  if (!word || !meaning) return null;
  const pos = raw.pos && raw.pos in PARTS_OF_SPEECH ? (raw.pos as PartOfSpeech) : null;
  const example = raw.example?.trim();
  return {
    word,
    ipa: raw.ipa?.trim() ?? "",
    pos: pos ?? "",
    posLabel: pos ? PARTS_OF_SPEECH[pos] : "",
    meaning,
    ...(example ? { example } : {}),
  };
}

/** Words saved in the shared lesson bank for this job, excluding ones already in the curriculum lists. */
export async function bankVocabulary(clusterLabel: string, job: string, seen: Set<string>): Promise<VocabWord[]> {
  const rows = await prisma.lessonContent.findMany({
    where: { industry: clusterLabel, position: job },
    select: { lesson: true },
  });
  const extra = new Map<string, VocabWord>();
  for (const row of rows) {
    const lesson = normalizeLesson(row.lesson);
    for (const item of lesson.vocabulary) {
      const withExample =
        item.example?.trim() ||
        lesson.dialogue.find((line) => line.toLowerCase().includes((item.word ?? "").toLowerCase()));
      const word = bankWord({ ...item, example: withExample || undefined });
      if (!word) continue;
      const key = word.word.toLowerCase();
      if (seen.has(key) || extra.has(key)) continue;
      extra.set(key, word);
    }
  }
  return [...extra.values()].sort((a, b) => a.word.localeCompare(b.word, "en"));
}

export async function vocabularyGroups(clusterLabel: string, job: string, groups: VocabGroup[]): Promise<VocabGroup[]> {
  const seen = new Set(groups.flatMap((group) => group.words.map((word) => word.word.toLowerCase())));
  const extra = await bankVocabulary(clusterLabel, job, seen);
  if (!extra.length) return groups;
  return [...groups, { id: "bank", label: "Thêm từ đã lưu trong ngân hàng bài học", words: extra }];
}
