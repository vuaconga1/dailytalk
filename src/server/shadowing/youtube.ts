import "server-only";
import type { CaptionWord } from "@/domain/shadowing/cues";
import { Problem } from "@/lib/errors";

/** Accepts watch / youtu.be / shorts / embed links or a bare 11-character id. */
export function parseYoutubeId(input: string): string | null {
  const value = input.trim();
  if (/^[\w-]{11}$/.test(value)) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = url.searchParams.get("v") ?? url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/)?.[1] ?? null;
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

export type YoutubeVideo = { title: string; durationSec: number | null; words: CaptionWord[]; source: string };

/** The Android innertube client still returns caption track URLs without a proof-of-origin token. */
const CLIENT = {
  ua: "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
  context: { client: { clientName: "ANDROID", clientVersion: "20.10.38", androidSdkVersion: 34, hl: "en" } },
};

type CaptionTrack = { baseUrl: string; languageCode: string; kind?: string };
type Json3 = { events?: { tStartMs?: number; dDurationMs?: number; aAppend?: number; segs?: { utf8?: string; tOffsetMs?: number }[] }[] };

const NOISE = /^\[[^\]]*\]$|^♪+$/;
const MAX_WORD_SECONDS = 1.5;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "User-Agent": CLIENT.ua, ...init?.headers }, cache: "no-store" });
  if (!res.ok) throw new Problem(`YouTube trả lỗi ${res.status}. Thử lại sau hoặc dán phụ đề SRT/VTT.`, 502);
  return (await res.json()) as T;
}

export async function fetchYoutubeVideo(videoId: string): Promise<YoutubeVideo> {
  const player = await fetchJson<{
    playabilityStatus?: { status?: string; reason?: string };
    videoDetails?: { title?: string; lengthSeconds?: string };
    captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } };
  }>("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ context: CLIENT.context, videoId }),
  });
  const status = player.playabilityStatus?.status;
  if (status && status !== "OK") {
    throw new Problem(`YouTube không cho lấy video này (${player.playabilityStatus?.reason ?? status}). Hãy dán phụ đề SRT/VTT.`, 422);
  }
  const tracks = (player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []).filter((t) => t.languageCode?.startsWith("en"));
  const track = tracks.find((t) => t.kind !== "asr") ?? tracks[0];
  if (!track) throw new Problem("Video không có phụ đề tiếng Anh. Hãy dán phụ đề SRT/VTT.", 422);
  const url = `${track.baseUrl.replace(/&fmt=[^&]*/g, "")}&fmt=json3`;
  const words = json3Words(await fetchJson<Json3>(url));
  if (!words.length) throw new Problem("Phụ đề YouTube trống. Hãy dán phụ đề SRT/VTT.", 422);
  const length = Number(player.videoDetails?.lengthSeconds);
  return {
    title: player.videoDetails?.title?.trim() || videoId,
    durationSec: Number.isFinite(length) && length > 0 ? Math.round(length) : null,
    words,
    source: `youtube:${track.languageCode}${track.kind === "asr" ? ":asr" : ""}`,
  };
}

type Piece = { text: string; start: number; end: number };

/** Splits timed text pieces into words, sharing each piece's span by word length. */
function piecesToWords(pieces: Piece[]): CaptionWord[] {
  const words: CaptionWord[] = [];
  let speakerChange = false;
  for (const piece of pieces) {
    const parts = piece.text.split(/\s+/).filter(Boolean);
    const total = parts.reduce((n, p) => n + Math.max(1, p.length), 0);
    let t = piece.start;
    for (const part of parts) {
      const d = ((piece.end - piece.start) * Math.max(1, part.length)) / total;
      const s = t;
      t += d;
      if (/^(>>|-|–)$/.test(part)) {
        speakerChange = true;
        continue;
      }
      if (NOISE.test(part)) continue;
      words.push({ w: part, s, e: t, ...(speakerChange ? { sp: 1 as const } : {}) });
      speakerChange = false;
    }
  }
  for (let i = 0; i < words.length; i++) {
    const next = words[i + 1]?.s ?? Infinity;
    words[i].e = Math.max(words[i].s, Math.min(words[i].e, next, words[i].s + Math.max(MAX_WORD_SECONDS, words[i].w.length * 0.12)));
    words[i].s = Math.round(words[i].s * 1000) / 1000;
    words[i].e = Math.round(words[i].e * 1000) / 1000;
  }
  return words;
}

function json3Words(data: Json3): CaptionWord[] {
  const pieces: Piece[] = [];
  for (const event of data.events ?? []) {
    if (!event.segs || event.aAppend) continue;
    const start = (event.tStartMs ?? 0) / 1000;
    const end = start + (event.dDurationMs ?? 0) / 1000;
    event.segs.forEach((seg, i) => {
      const text = (seg.utf8 ?? "").replace(/\n/g, " ").trim();
      if (!text) return;
      const segStart = start + (seg.tOffsetMs ?? 0) / 1000;
      const nextOffset = event.segs![i + 1]?.tOffsetMs;
      pieces.push({ text, start: segStart, end: nextOffset !== undefined ? start + nextOffset / 1000 : end });
    });
  }
  pieces.sort((a, b) => a.start - b.start);
  for (let i = 0; i < pieces.length - 1; i++) pieces[i].end = Math.min(pieces[i].end, Math.max(pieces[i].start, pieces[i + 1].start));
  return piecesToWords(pieces);
}

const TIMESTAMP = /(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/;

function seconds(stamp: string): number | null {
  const m = TIMESTAMP.exec(stamp);
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, "0")) / 1000;
}

/** Parses pasted SRT or WebVTT subtitles into timed words. */
export function subtitleWords(text: string): CaptionWord[] {
  const pieces: Piece[] = [];
  for (const block of text.replace(/\r/g, "").split(/\n{2,}/)) {
    const lines = block.split("\n");
    const at = lines.findIndex((l) => l.includes("-->"));
    if (at < 0) continue;
    const [from, to] = lines[at].split("-->");
    const start = seconds(from);
    const end = seconds(to);
    if (start === null || end === null) continue;
    const body = lines
      .slice(at + 1)
      .join(" ")
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .trim();
    if (body) pieces.push({ text: body, start, end: Math.max(start, end) });
  }
  pieces.sort((a, b) => a.start - b.start);
  // Rolling auto-captions repeat the previous line; keep only the new text of each block.
  const deduped: Piece[] = [];
  for (const p of pieces) {
    const prev = deduped[deduped.length - 1];
    if (prev && p.text.startsWith(prev.text) && p.text !== prev.text) deduped.push({ ...p, text: p.text.slice(prev.text.length).trim() });
    else if (!prev || p.text !== prev.text) deduped.push(p);
  }
  return piecesToWords(deduped.filter((p) => p.text));
}

const ABBREVIATION = /^(?:mr|mrs|ms|dr|prof|sr|jr|vs|etc|e\.g|i\.e)\.$/i;
const MAX_LINE_WORDS = 28;
const PAUSE_BREAK = 1.2;

/**
 * First draft of the transcript: one sentence per line, split at sentence punctuation, speaker
 * changes and (for unpunctuated captions) long pauses. Staff can edit it afterwards.
 */
export function captionTranscript(words: CaptionWord[]): string {
  const lines: string[][] = [];
  let line: string[] = [];
  const flush = () => {
    if (line.length) lines.push(line);
    line = [];
  };
  words.forEach((word, i) => {
    const prev = words[i - 1];
    if (line.length && (word.sp || (prev && word.s - prev.e > PAUSE_BREAK && !/[,;:]$/.test(prev.w)) || line.length >= MAX_LINE_WORDS)) flush();
    line.push(word.w);
    if (/[.!?]["'”’]?$/.test(word.w) && !ABBREVIATION.test(word.w)) flush();
  });
  flush();
  return lines
    .map((l) => {
      const text = l.join(" ");
      return text.charAt(0).toUpperCase() + text.slice(1);
    })
    .join("\n");
}
