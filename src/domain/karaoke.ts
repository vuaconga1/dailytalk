export interface Token {
  text: string;
  start: number;
  end: number;
}

export interface CueWord {
  text: string;
  s: number;
  e: number;
}

/**
 * Splits text into non-whitespace tokens with their start and end character positions.
 */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const regex = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    tokens.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return tokens;
}

/**
 * Maps an onboundary event character index to a token index.
 */
export function tokenIndexAtChar(tokens: Token[], charIndex: number): number {
  if (tokens.length === 0) return -1;
  if (charIndex <= tokens[0].start) return 0;
  if (charIndex >= tokens[tokens.length - 1].start) return tokens.length - 1;

  for (let i = 0; i < tokens.length; i++) {
    const nextStart = i + 1 < tokens.length ? tokens[i + 1].start : Infinity;
    if (charIndex >= tokens[i].start && charIndex < nextStart) {
      return i;
    }
  }

  return tokens.length - 1;
}

/**
 * Computes relative weight for a word token based on character count and punctuation pauses.
 */
function getWordWeight(word: string): number {
  let weight = Math.max(1, word.length);
  if (/[.!?]+$/.test(word)) {
    weight += 4;
  } else if (/[,;:]+$/.test(word)) {
    weight += 2;
  }
  return weight;
}

/**
 * Splits the given time range [startSec, endSec] across words by character count,
 * with extra weight for punctuation pause points (, . ! ?).
 */
export function estimateWordTimings(text: string, startSec: number, endSec: number): CueWord[] {
  const tokens = tokenize(text);
  if (tokens.length === 0) return [];

  const totalDuration = Math.max(0, endSec - startSec);
  if (totalDuration === 0 || tokens.length === 1) {
    return tokens.map((token) => ({ text: token.text, s: startSec, e: endSec }));
  }

  const weights = tokens.map((t) => getWordWeight(t.text));
  const totalWeight = weights.reduce((acc, w) => acc + w, 0);

  let currentStart = startSec;
  return tokens.map((token, i) => {
    const fraction = totalWeight > 0 ? weights[i] / totalWeight : 1 / tokens.length;
    const duration = fraction * totalDuration;
    const s = currentStart;
    const e = i === tokens.length - 1 ? endSec : s + duration;
    currentStart = e;
    return {
      text: token.text,
      s,
      e,
    };
  });
}

/**
 * Estimates reading duration in seconds for a sentence based on words per minute (default 150 wpm).
 */
export function estimateSentenceSeconds(text: string, wpm = 150): number {
  const tokens = tokenize(text);
  if (tokens.length === 0) return 0;
  return (tokens.length / Math.max(1, wpm)) * 60;
}

/**
 * Finds the index of the active word at playback time t (seconds).
 */
export function wordIndexAt(words: CueWord[], t: number): number {
  if (words.length === 0) return -1;
  if (t < words[0].s) return 0;
  if (t >= words[words.length - 1].e) return words.length - 1;

  for (let i = 0; i < words.length; i++) {
    const nextStart = i + 1 < words.length ? words[i + 1].s : words[i].e;
    if (t >= words[i].s && t < nextStart) {
      return i;
    }
  }

  return words.length - 1;
}

