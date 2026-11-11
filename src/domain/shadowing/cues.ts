/** Sentence and word timing for the karaoke view and per-sentence playback. */
import { alignSequences, normalizeWord, speechWordsMatch } from "./scoring";
import { transcriptLines } from "./transcript";

export type TimedWord = { w: string; s: number; e: number };
/** A word of the YouTube caption track; `sp` marks a speaker change before it. */
export type CaptionWord = TimedWord & { sp?: 1 };
/** Timing of one transcript sentence; `words` has one entry per whitespace-separated token. */
export type CueTiming = { start: number; end: number; words: TimedWord[] };
export type StoredCues = { version: 2; aligner: "youtube-captions"; videoId: string; lines: ({ text: string } & CueTiming)[] };

const LEAD_IN = 0.15;
const TAIL = 0.25;

export function displayWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

const round = (x: number) => Math.round(x * 100) / 100;

/**
 * Maps every transcript word onto the caption word it aligns with (word-level Levenshtein),
 * interpolating words the captions lack. Staff edits to the transcript therefore keep their timing.
 */
export function buildCues(transcript: string, captionWords: CaptionWord[], videoId: string): StoredCues | null {
  const lines = transcriptLines(transcript);
  if (!lines.length || !captionWords.length) return null;
  const tokens = lines.flatMap((line, li) => displayWords(line.text).map((w) => ({ li, w })));
  const ops = alignSequences(
    tokens.map((t) => normalizeWord(t.w) || "\u0001"),
    captionWords.map((c) => normalizeWord(c.w) || "\u0001"),
    speechWordsMatch,
  );
  const times: ({ s: number; e: number } | null)[] = tokens.map(() => null);
  for (const op of ops) {
    if (op.kind === "match" || op.kind === "sub") times[op.i] = { s: captionWords[op.j].s, e: captionWords[op.j].e };
  }
  if (!times.some(Boolean)) return null;

  for (let k = 0; k < times.length; ) {
    if (times[k]) {
      k++;
      continue;
    }
    let end = k;
    while (end < times.length && !times[end]) end++;
    const from = k > 0 ? times[k - 1]!.e : times[end]!.s;
    const to = end < times.length ? Math.max(from, times[end]!.s) : from;
    const step = (to - from) / (end - k);
    for (let x = k; x < end; x++) times[x] = { s: from + step * (x - k), e: from + step * (x - k + 1) };
    k = end;
  }

  let last = 0;
  const raw = lines.map((line, li) => {
    const words = tokens
      .map((t, k) => ({ t, time: times[k]! }))
      .filter(({ t }) => t.li === li)
      .map(({ t, time }) => {
        const s = Math.max(time.s, last);
        const e = Math.max(time.e, s);
        last = s;
        return { w: t.w, s, e };
      });
    return { text: line.text, words, start: words[0]?.s ?? last, end: words[words.length - 1]?.e ?? last };
  });

  // Lead-in/tail padding shares the gap between neighbours so padded sentences never overlap.
  const padded = raw.map((line) => ({ start: line.start, end: line.end }));
  for (let i = 0; i < raw.length; i++) {
    const next = raw[i + 1];
    if (!next) padded[i].end = raw[i].end + TAIL;
    else {
      const gap = Math.max(0, next.start - raw[i].end);
      const tail = gap >= LEAD_IN + TAIL ? TAIL : (gap * TAIL) / (LEAD_IN + TAIL);
      padded[i].end = raw[i].end + tail;
      padded[i + 1].start = next.start - Math.min(LEAD_IN, gap - tail);
    }
  }
  padded[0].start = Math.max(0, raw[0].start - LEAD_IN);

  return {
    version: 2,
    aligner: "youtube-captions",
    videoId,
    lines: raw.map((line, i) => ({
      text: line.text,
      start: round(padded[i].start),
      end: round(Math.max(padded[i].end, padded[i].start)),
      words: line.words.map((w) => ({ w: w.w, s: round(w.s), e: round(w.e) })),
    })),
  };
}

const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x) && x >= 0;

/** Stored cues are used only if they still describe this exact video and transcript. */
export function validateCues(raw: unknown, transcript: string, videoId: string): CueTiming[] | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Omit<Partial<StoredCues>, "version"> & { version?: unknown };
  if ((data.version !== 1 && data.version !== 2) || data.videoId !== videoId || !Array.isArray(data.lines)) return null;
  const lines = transcriptLines(transcript);
  if (data.lines.length !== lines.length) return null;
  const out: CueTiming[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cue = data.lines[i] as Partial<StoredCues["lines"][number]> | undefined;
    if (!cue || cue.text !== lines[i].text || !finite(cue.start) || !finite(cue.end)) return null;
    const end = Math.max(cue.start, cue.end);
    const words =
      data.version === 2 && Array.isArray(cue.words)
        ? cue.words.filter((w): w is TimedWord => !!w && typeof w.w === "string" && finite(w.s) && finite(w.e))
        : [];
    out.push({
      start: cue.start,
      end,
      words: words.length === displayWords(lines[i].text).length ? words : estimateWords(lines[i].text, cue.start, end),
    });
  }
  return out;
}

/** Word timing inside [start, end] weighted by letters and trailing punctuation. */
export function estimateWords(text: string, start: number, end: number): TimedWord[] {
  const words = displayWords(text);
  if (!words.length) return [];
  const weights = words.map((w) => {
    let weight = Math.max(2, (w.match(/[\p{L}\p{N}]/gu) ?? []).length);
    if (/[.!?]["'”’]?$/.test(w)) weight += 2.5;
    else if (/[,;:\-–—]$/.test(w)) weight += 1.5;
    return weight;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  const span = Math.max(end - start, words.length * 0.05);
  let t = start;
  return words.map((w, i) => {
    const d = Math.max(0.05, (weights[i] / total) * span);
    const word = { w, s: t, e: t + d };
    t += d;
    return word;
  });
}

/** Without cues: split the video duration by sentence length (+6 characters of pause each). */
export function estimateCues(transcript: string, duration: number): CueTiming[] {
  const lines = transcriptLines(transcript);
  const weights = lines.map((l) => l.text.length + 6);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let t = 0;
  return lines.map((line, i) => {
    const start = t;
    t += (weights[i] / total) * Math.max(duration, 1);
    return { start, end: t, words: estimateWords(line.text, start, t) };
  });
}

/** Last sentence that has started at time t (0 before the first one). */
export function lineIndexAt(cues: CueTiming[], t: number): number {
  let lo = 0;
  let hi = cues.length - 1;
  let found = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/** Last word that has started at time t, or -1 before the first word. */
export function wordIndexAt(words: TimedWord[], t: number): number {
  let found = -1;
  for (let i = 0; i < words.length && words[i].s <= t; i++) found = i;
  return found;
}
