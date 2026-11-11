/**
 * Content-match scoring without AI: word-level Levenshtein alignment between the model text and
 * what the browser recognizer heard. The score is WER-based, not a pronunciation score.
 */
import { spokenText } from "./transcript";

export type WordToken = { raw: string; norm: string };

export type WordResult =
  | { status: "correct"; expected: string; actual: string }
  | { status: "incorrect"; expected: string; actual: string; nearMiss: boolean }
  | { status: "missing"; expected: string }
  | { status: "extra"; actual: string };

export type ErrorSummary = {
  missing: string[];
  incorrect: { expected: string; actual: string }[];
  extra: string[];
};

export type ShadowingGrade = {
  score: number;
  wer: number;
  totalWords: number;
  correctCount: number;
  substitutionCount: number;
  deletionCount: number;
  insertionCount: number;
  normalizedText: string;
  wordResults: WordResult[];
  errorSummary: ErrorSummary;
};

const PUNCTUATION = /[.,!?:;"()[\]{}…“”«»]/g;

/** British → American spellings, applied to both sides so either spelling counts. */
export function canonicalizeSpelling(word: string): string {
  return word
    .replace(/^([a-z']{3,})our(s?)$/, "$1or$2")
    .replace(/^([a-z']{2,})tre(s?)$/, "$1ter$2")
    .replace(/^([a-z']{3,})is(e|es|ed|ing)$/, "$1iz$2")
    .replace(/^([a-z']{4,})ll(ed|ing|er)$/, "$1l$2");
}

export function normalizeWord(raw: string): string {
  const word = raw
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(PUNCTUATION, "")
    .replace(/^'+|'+$/g, "");
  return canonicalizeSpelling(word);
}

export function tokenize(text: string): WordToken[] {
  return text
    .normalize("NFKC")
    .split(/\s+/)
    .flatMap((t) => t.split(/[-–—]+/))
    .filter(Boolean)
    .map((raw) => ({ raw, norm: normalizeWord(raw) }))
    .filter((t) => t.norm);
}

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function numberWords(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : "");
  return `${ONES[Math.floor(n / 100)]} hundred` + (n % 100 ? ` ${numberWords(n % 100)}` : "");
}

/** Recognizers write "12" where transcripts say "twelve" (and vice versa). */
export function spellOutNumbers(text: string): string {
  return text
    .replace(/\b(\d{1,2}):(\d{2})\b/g, (_, h: string, m: string) => (m === "00" ? h : `${h} ${m}`))
    .replace(/(?<!\d[.,]?)\b\d{1,3}\b(?![.,]?\d)/g, (d) => numberWords(Number(d)));
}

const HOMOPHONES = [
  "to too two", "there their theyre", "your youre", "its", "no know", "right write", "here hear", "by buy bye",
  "for four", "one won", "weather whether", "where wear", "new knew", "see sea", "be bee", "our hour", "son sun",
  "meet meat", "week weak", "through threw", "eight ate", "whole hole", "piece peace", "wait weight", "would wood",
  "i eye", "ok okay", "mom mum", "gray grey", "cent sent", "made maid", "tail tale", "male mail", "allowed aloud",
  "flour flower", "fair fare", "pair pear", "plane plain", "break brake", "road rode", "steal steel", "dear deer",
  "night knight", "not knot", "which witch", "whose whos", "were",
];
const HOMOPHONE_KEY = new Map(
  HOMOPHONES.flatMap((group) => {
    const words = group.split(" ");
    return words.map((w) => [w, words[0]] as const);
  }),
);

export function soundKey(norm: string): string {
  const word = norm.replace(/'/g, "");
  return HOMOPHONE_KEY.get(word) ?? word;
}

/** Character-level Levenshtein; stops early once the distance must exceed `max`. */
export function charDistance(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      row.push(v);
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length];
}

const SUFFIXES = new Set(["s", "es", "d", "ed"]);

/** Lenient match for speech: homophones, spelling variants, -s/-ed endings, one typo in long words. */
export function speechWordsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const x = soundKey(a);
  const y = soundKey(b);
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length >= 3 && long.startsWith(short) && SUFFIXES.has(long.slice(short.length))) return true;
  if (short.length >= 5) {
    const limit = short.length >= 9 ? 2 : 1;
    return charDistance(x, y, limit) <= limit;
  }
  return false;
}

export type AlignOp =
  | { kind: "match" | "sub"; i: number; j: number }
  | { kind: "del"; i: number }
  | { kind: "ins"; j: number };

const MAX_CELLS = 40_000_000;

/**
 * Word-level Levenshtein alignment (match 0, substitute/delete/insert 1). Traceback prefers
 * diagonal match → diagonal substitution → deletion → insertion.
 */
export function alignSequences(a: string[], b: string[], same: (x: string, y: string) => boolean): AlignOp[] {
  const ids = new Map<string, number>();
  const intern = (s: string) => {
    let id = ids.get(s);
    if (id === undefined) ids.set(s, (id = ids.size));
    return id;
  };
  const ai = a.map(intern);
  const bi = b.map(intern);
  const vocab = ids.size;
  const words = [...ids.keys()];
  const cache = new Map<number, boolean>();
  const eq = (i: number, j: number) => {
    const x = ai[i];
    const y = bi[j];
    if (x === y) return true;
    const key = x * vocab + y;
    let hit = cache.get(key);
    if (hit === undefined) cache.set(key, (hit = same(words[x], words[y])));
    return hit;
  };

  let head = 0;
  while (head < a.length && head < b.length && eq(head, head)) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && eq(a.length - 1 - tail, b.length - 1 - tail)) tail++;

  const n = a.length - head - tail;
  const m = b.length - head - tail;
  if ((n + 1) * (m + 1) > MAX_CELLS) throw new RangeError("Văn bản quá dài để chấm.");

  const w = m + 1;
  const cost = n + m < 65_535 ? new Uint16Array((n + 1) * w) : new Uint32Array((n + 1) * w);
  for (let j = 0; j <= m; j++) cost[j] = j;
  for (let i = 1; i <= n; i++) {
    cost[i * w] = i;
    for (let j = 1; j <= m; j++) {
      const diag = cost[(i - 1) * w + j - 1] + (eq(head + i - 1, head + j - 1) ? 0 : 1);
      cost[i * w + j] = Math.min(diag, cost[(i - 1) * w + j] + 1, cost[i * w + j - 1] + 1);
    }
  }

  const middle: AlignOp[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const here = cost[i * w + j];
    if (i > 0 && j > 0) {
      const diag = cost[(i - 1) * w + j - 1];
      const matched = eq(head + i - 1, head + j - 1);
      if ((matched && here === diag) || (!matched && here === diag + 1)) {
        middle.push({ kind: matched ? "match" : "sub", i: head + i - 1, j: head + j - 1 });
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && here === cost[(i - 1) * w + j] + 1) {
      middle.push({ kind: "del", i: head + i - 1 });
      i--;
    } else {
      middle.push({ kind: "ins", j: head + j - 1 });
      j--;
    }
  }
  middle.reverse();

  const ops: AlignOp[] = [];
  for (let k = 0; k < head; k++) ops.push({ kind: "match", i: k, j: k });
  ops.push(...middle);
  for (let k = tail; k > 0; k--) ops.push({ kind: "match", i: a.length - k, j: b.length - k });
  return ops;
}

export function alignWords(expected: WordToken[], actual: WordToken[]): WordResult[] {
  const ops = alignSequences(
    expected.map((t) => t.norm),
    actual.map((t) => t.norm),
    speechWordsMatch,
  );
  return ops.map((op): WordResult => {
    if (op.kind === "del") return { status: "missing", expected: expected[op.i].raw };
    if (op.kind === "ins") return { status: "extra", actual: actual[op.j].raw };
    const e = expected[op.i];
    const a = actual[op.j];
    if (op.kind === "match") return { status: "correct", expected: e.raw, actual: a.raw };
    const limit = Math.max(1, Math.floor(e.norm.length / 4));
    return { status: "incorrect", expected: e.raw, actual: a.raw, nearMiss: charDistance(e.norm, a.norm, limit) <= limit };
  });
}

/** Grades recognized speech against one text (a sentence or the spoken transcript). */
export function gradeText(expectedText: string, recognized: string): ShadowingGrade {
  const expected = tokenize(spellOutNumbers(expectedText));
  if (!expected.length) throw new RangeError("Bài chưa có nội dung để chấm.");
  const actual = tokenize(spellOutNumbers(recognized));
  const wordResults = alignWords(expected, actual);
  const errorSummary: ErrorSummary = { missing: [], incorrect: [], extra: [] };
  let correctCount = 0;
  for (const r of wordResults) {
    if (r.status === "correct") correctCount++;
    else if (r.status === "missing") errorSummary.missing.push(r.expected);
    else if (r.status === "extra") errorSummary.extra.push(r.actual);
    else errorSummary.incorrect.push({ expected: r.expected, actual: r.actual });
  }
  const substitutionCount = errorSummary.incorrect.length;
  const deletionCount = errorSummary.missing.length;
  const insertionCount = errorSummary.extra.length;
  const wer = (substitutionCount + deletionCount + insertionCount) / expected.length;
  return {
    score: Math.round(Math.max(0, 100 * (1 - wer))),
    wer,
    totalWords: expected.length,
    correctCount,
    substitutionCount,
    deletionCount,
    insertionCount,
    normalizedText: actual.map((t) => t.norm).join(" "),
    wordResults,
    errorSummary,
  };
}

export function gradeShadowing(transcript: string, recognized: string): ShadowingGrade {
  return gradeText(spokenText(transcript), recognized);
}

const MAX_SEGMENTS = 200;
const MAX_ALTERNATIVES = 5;

/**
 * For each finalized recognizer segment, keeps the alternative whose words best fit the model
 * text's vocabulary (ties keep the recognizer's first choice). Null when no usable segments.
 */
export function pickClosestAlternatives(referenceText: string, segments: unknown): string | null {
  if (!Array.isArray(segments)) return null;
  const valid = segments
    .slice(0, MAX_SEGMENTS)
    .map((seg) => (Array.isArray(seg) ? seg.filter((s): s is string => typeof s === "string" && s.trim() !== "").slice(0, MAX_ALTERNATIVES) : []))
    .filter((seg) => seg.length);
  if (!valid.length) return null;
  const vocab = new Set(tokenize(spellOutNumbers(referenceText)).map((t) => soundKey(t.norm)));
  const picked = valid.map((alternatives) => {
    let best = alternatives[0];
    let bestHits = -Infinity;
    for (const alt of alternatives) {
      const words = tokenize(spellOutNumbers(alt));
      const known = words.filter((t) => vocab.has(soundKey(t.norm))).length;
      const hits = known - (words.length - known) / 2;
      if (hits > bestHits) {
        best = alt;
        bestHits = hits;
      }
    }
    return best.trim();
  });
  return picked.join(" ").trim() || null;
}

export function scoreTone(score: number): "great" | "good" | "low" {
  return score >= 80 ? "great" : score >= 60 ? "good" : "low";
}
