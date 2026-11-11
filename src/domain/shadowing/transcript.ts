/** Sentence splitting shared by the learner page, scoring and cue alignment; must stay deterministic. */

export type TranscriptLine = { speaker: string | null; text: string };

const SPEAKER = /^([A-Z][A-Za-z.'’]*(?: [A-Z][A-Za-z.'’]*){0,2}):\s+/;
const SENTENCE = /[^.!?]+(?:[.!?]+["'”’]?|$)/g;
const ABBREVIATION = /(?:^|\s)(?:mr|mrs|ms|dr|prof|sr|jr|vs|etc|e\.g|i\.e)\.$/i;
/** "e.g." / "i.e." are cut after their first letter by SENTENCE. */
const PARTIAL_ABBREVIATION = /(?:^|\s)(?:e|i)\.$/;

export function transcriptLines(transcript: string): TranscriptLine[] {
  const out: TranscriptLine[] = [];
  for (const raw of transcript.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const match = SPEAKER.exec(line);
    const speaker = match ? match[1] : null;
    const body = match ? line.slice(match[0].length) : line;
    const spans: { start: number; end: number }[] = [];
    for (const m of body.matchAll(SENTENCE)) {
      const text = m[0].trim();
      if (!text) continue;
      const span = { start: m.index, end: m.index + m[0].length };
      const prev = spans[spans.length - 1];
      const prevText = prev && body.slice(prev.start, prev.end).trim();
      const joins =
        prevText !== undefined &&
        (ABBREVIATION.test(prevText) || PARTIAL_ABBREVIATION.test(prevText) || (/\d\.$/.test(prevText) && /^\d/.test(text)));
      if (joins) prev.end = span.end;
      else spans.push(span);
    }
    spans.forEach((s, i) => out.push({ speaker: i === 0 ? speaker : null, text: body.slice(s.start, s.end).trim() }));
  }
  return out;
}

/** What the learner actually says: sentences without speaker labels. */
export function spokenText(transcript: string): string {
  return transcriptLines(transcript)
    .map((l) => l.text)
    .join(" ");
}

/** Case/punctuation-insensitive key, so small edits elsewhere keep a sentence's annotation. */
export function lineKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}']+/gu, " ")
    .trim();
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}
