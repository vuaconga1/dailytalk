"use client";

import type { CueTiming } from "@/domain/shadowing/cues";
import { scoreTone, type ShadowingGrade } from "@/domain/shadowing/scoring";
import type { TranscriptLine } from "@/domain/shadowing/transcript";
import { KaraokeText } from "./karaoke-text";
import { AlignedTranscript, TONE_BADGE, TONE_LABEL } from "./shadowing-result";
import type { TimeStore } from "./use-youtube-player";
import { clock } from "./video-panel";

export function SentenceCard(props: {
  index: number;
  line: TranscriptLine;
  cue: CueTiming | undefined;
  ipa: string | null;
  time: TimeStore;
  onWordClick?: (seconds: number) => void;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-navy/10 bg-gradient-to-br from-navy-soft/70 to-white p-4 sm:p-5">
      <div className="flex min-w-0 gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-navy text-[11px] font-bold text-white">
          {String(props.index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1 text-lg break-words sm:text-xl">
          {props.line.speaker && <b className="mr-1 text-teal">{props.line.speaker}:</b>}
          {props.cue ? (
            <KaraokeText cue={props.cue} time={props.time} variant="hero" onWordClick={props.onWordClick} className="inline font-medium" />
          ) : (
            <span className="font-medium text-navy">{props.line.text}</span>
          )}
          {props.ipa && <p className="mt-2 font-mono text-xs break-words text-muted sm:text-sm">{props.ipa}</p>}
        </div>
      </div>
    </div>
  );
}

export function MicButton({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className="grid size-20 place-items-center rounded-full bg-navy text-white shadow-[0_10px_30px_-8px_rgba(9,23,52,0.55)] ring-8 ring-navy/5 transition hover:scale-105 hover:bg-navy-light active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
      >
        <svg className="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
        </svg>
      </button>
      <b className="text-sm text-navy">{label}</b>
      <small className="text-xs text-muted">Nên đeo tai nghe để tránh tiếng loa lọt vào micro.</small>
    </div>
  );
}

const BARS = [0.5, 0.8, 0.35, 1, 0.6, 0.9, 0.45, 0.75, 0.4, 0.65];

export function RecordingMeter(props: {
  phase: "starting" | "recording" | "processing";
  elapsedMs: number;
  limitSec: number;
  liveText: string;
  onStop: () => void;
  badge?: string;
}) {
  const processing = props.phase === "processing";
  const status = props.phase === "starting" ? "Đang mở micro…" : processing ? "Đang xử lý giọng nói…" : "Đang nghe… nói xong bấm nút đỏ để dừng.";
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={props.onStop}
          disabled={props.phase !== "recording"}
          aria-label="Dừng ghi âm"
          className="grid size-16 shrink-0 place-items-center rounded-full bg-rose-600 text-white shadow-[0_10px_26px_-8px_rgba(225,29,72,0.6)] ring-8 ring-rose-100 transition hover:bg-rose-700 disabled:opacity-80"
        >
          {processing || props.phase === "starting" ? (
            <span className="size-6 animate-spin rounded-full border-[3px] border-white/40 border-t-white" />
          ) : (
            <span className="size-5 rounded-[5px] bg-white" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-lg font-bold text-navy">
              {clock(props.elapsedMs / 1000)} / {clock(props.limitSec)}
            </span>
            {props.badge && <span className="badge badge-gold !py-0.5 text-[11px]">{props.badge}</span>}
          </div>
          <p className="text-xs text-muted" role="status">
            {status}
          </p>
        </div>
        <div className="flex h-10 items-center gap-1" aria-hidden>
          {BARS.map((h, i) => (
            <span
              key={i}
              className={`w-1.5 rounded-full bg-rose-500 ${props.phase === "recording" ? "animate-pulse" : "opacity-30"}`}
              style={{ height: `${h * 100}%`, animationDelay: `${i * 90}ms`, animationDuration: `${700 + (i % 3) * 200}ms` }}
            />
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-dashed border-line bg-slate-50 p-3">
        <div className="mb-1 text-[11px] font-bold tracking-wider text-muted uppercase">Hệ thống đang nghe bạn đọc:</div>
        <p className="min-h-6 text-sm break-words text-slate-700">{props.liveText || <span className="text-slate-400">…</span>}</p>
      </div>
    </div>
  );
}

export function SentenceGrade(props: {
  grade: ShadowingGrade;
  url: string | null;
  isLast: boolean;
  onRetry: () => void;
  onReplay: () => void;
  onNext: () => void;
}) {
  const tone = scoreTone(props.grade.score);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full border px-3 py-1 text-lg font-extrabold ${TONE_BADGE[tone]}`}>{props.grade.score}%</span>
        <b className="text-navy">{TONE_LABEL[tone]}</b>
        <span className="text-xs text-muted">
          {props.grade.correctCount}/{props.grade.totalWords} từ khớp
        </span>
      </div>
      <div className="rounded-xl border border-line bg-white p-3">
        <AlignedTranscript words={props.grade.wordResults} />
      </div>
      {props.url && (
        <div>
          <div className="mb-1 text-[11px] font-bold tracking-wider text-muted uppercase">Giọng của bạn</div>
          <audio controls src={props.url} className="h-9 w-full" />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-outline !py-2.5 text-xs" onClick={props.onRetry}>
          🎤 Ghi âm lại
        </button>
        <button type="button" className="btn btn-secondary !py-2.5 text-xs" onClick={props.onReplay}>
          ▶ Nghe câu mẫu
        </button>
        {!props.isLast && (
          <button type="button" className="btn !py-2.5 text-xs" onClick={props.onNext}>
            Câu tiếp theo →
          </button>
        )}
      </div>
    </div>
  );
}
