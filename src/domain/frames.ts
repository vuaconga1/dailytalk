/** Sentence-frame matching and word labels shared by the server, the validator and the lesson UI. */

export const PARTS_OF_SPEECH = {
  n: "danh từ",
  v: "động từ",
  adj: "tính từ",
  adv: "trạng từ",
  prep: "giới từ",
  phr: "cụm từ",
  phrv: "cụm động từ",
} as const;
export type PartOfSpeech = keyof typeof PARTS_OF_SPEECH;
export const POS_IDS = Object.keys(PARTS_OF_SPEECH) as PartOfSpeech[];

const CONTRACTIONS: [RegExp, string][] = [
  [/\bi'm\b/g, "i am"],
  [/\b(you|we|they)'re\b/g, "$1 are"],
  [/\b(he|she|it|that|there|what|where|who|here)'s\b/g, "$1 is"],
  [/\b(i|you|we|they)'ve\b/g, "$1 have"],
  [/\b(i|you|we|they|he|she|it)'ll\b/g, "$1 will"],
  [/\b(i|you|we|they|he|she|it)'d\b/g, "$1 would"],
  [/\blet's\b/g, "let us"],
  [/\bcan't\b/g, "cannot"],
  [/\bwon't\b/g, "will not"],
  [/\b(\w+)n't\b/g, "$1 not"],
];

/** Lower-case words only, contractions expanded; `{placeholders}` survive as words. */
export function normalizeWords(s: string): string {
  let out = s.toLowerCase().replace(/[’‘]/g, "'");
  for (const [re, to] of CONTRACTIONS) out = out.replace(re, to);
  return out.replace(/[^a-z0-9'{}_]+/g, " ").trim();
}

/** Fixed parts of a frame ("I've sent you … for …" → ["i have sent you", "for"]). */
export function frameParts(frame: string): string[] {
  return frame.split("…").map(normalizeWords).filter(Boolean);
}

/** True when every fixed part of the frame appears in the sentence, in order. */
export function usesFrame(frame: string, sentence: string): boolean {
  const line = ` ${normalizeWords(sentence)} `;
  let from = 0;
  for (const part of frameParts(frame)) {
    const at = line.indexOf(` ${part} `, from);
    if (at < 0) return false;
    from = at + part.length + 1;
  }
  return true;
}

/** Index of the first frame the sentence uses, or -1. */
export function frameIndexIn(frames: string[], sentence: string): number {
  return frames.findIndex((f) => usesFrame(f, sentence));
}

/** Frames used by at least one of the sentences. */
export function framesUsed(frames: string[], sentences: string[]): boolean[] {
  return frames.map((f) => sentences.some((s) => usesFrame(f, s)));
}
