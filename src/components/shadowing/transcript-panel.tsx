"use client";

import { useEffect, useRef } from "react";
import type { CueTiming } from "@/domain/shadowing/cues";
import { scoreTone, type ShadowingGrade } from "@/domain/shadowing/scoring";
import type { TranscriptLine } from "@/domain/shadowing/transcript";
import type { LineAnnotation } from "@/domain/shadowing/types";
import { KaraokeText } from "./karaoke-text";
import { AlignedTranscript, TONE_BADGE } from "./shadowing-result";
import type { YoutubePlayer } from "./use-youtube-player";

export type FontSize = "sm" | "base" | "lg";
const FONT_SIZES: FontSize[] = ["sm", "base", "lg"];
const TEXT_CLASS: Record<FontSize, string> = { sm: "text-sm", base: "text-[15px]", lg: "text-lg" };

export type SentenceResult = { grade: ShadowingGrade; url: string | null };

type Props = {
  lines: TranscriptLine[];
  cues: CueTiming[];
  annotations: LineAnnotation[] | null;
  words: number;
  index: number;
  player: YoutubePlayer;
  scores: Record<number, number>;
  results: Record<number, SentenceResult>;
  estimated: boolean;
  showIpa: boolean;
  onToggleIpa: () => void;
  fontSize: FontSize;
  onFontSize: (size: FontSize) => void;
  /** Sentence selection is locked while recording. */
  locked: boolean;
  recording: boolean;
  canRecord: boolean;
  onSelect: (index: number) => void;
  onReplay: () => void;
  onToggleRecord: () => void;
  onPracticeWeak: () => void;
};

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold transition ${
        on ? "border-navy bg-navy text-white" : "border-line bg-white text-muted hover:text-navy"
      }`}
    >
      {label}
      <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${on ? "bg-emerald-400 text-navy-deep" : "bg-slate-100 text-muted"}`}>{on ? "ON" : "OFF"}</span>
    </button>
  );
}

export function TranscriptPanel(p: Props) {
  const listRef = useRef<HTMLOListElement | null>(null);
  const cardRefs = useRef<(HTMLLIElement | null)[]>([]);
  const practiced = Object.keys(p.scores).length;
  const average = practiced ? Math.round(Object.values(p.scores).reduce((a, b) => a + b, 0) / practiced) : null;
  const weak = Object.values(p.scores).some((s) => s < 60);

  useEffect(() => {
    const list = listRef.current;
    const card = cardRefs.current[p.index];
    if (!list || !card) return;
    list.scrollTo({ top: Math.max(0, card.offsetTop - list.clientHeight / 3), behavior: "smooth" });
  }, [p.index]);

  const navButton =
    "grid size-11 place-items-center rounded-xl border border-line bg-white text-navy transition hover:border-navy/40 disabled:opacity-40";

  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-line bg-white shadow-[0_4px_20px_-4px_rgba(20,40,90,0.05)]">
      <div className="border-b border-line p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <b className="block text-sm tracking-wider text-navy uppercase">Transcript</b>
            <small className="text-xs text-muted">
              {p.lines.length} câu · {p.words} từ
            </small>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {p.annotations && <Toggle label="IPA" on={p.showIpa} onClick={p.onToggleIpa} />}
          <div className="inline-flex items-center rounded-xl border border-line bg-white p-0.5" role="group" aria-label="Cỡ chữ">
            <button
              type="button"
              aria-label="Chữ nhỏ hơn"
              disabled={p.fontSize === "sm"}
              onClick={() => p.onFontSize(FONT_SIZES[FONT_SIZES.indexOf(p.fontSize) - 1])}
              className="grid size-8 place-items-center rounded-lg text-sm font-bold text-navy disabled:opacity-30"
            >
              A-
            </button>
            <span className="px-1.5 text-[11px] font-semibold text-muted">{p.fontSize}</span>
            <button
              type="button"
              aria-label="Chữ lớn hơn"
              disabled={p.fontSize === "lg"}
              onClick={() => p.onFontSize(FONT_SIZES[FONT_SIZES.indexOf(p.fontSize) + 1])}
              className="grid size-8 place-items-center rounded-lg text-sm font-bold text-navy disabled:opacity-30"
            >
              A+
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-muted">
            Đã luyện <b className="text-navy">{practiced}/{p.lines.length}</b>
            {average !== null && (
              <>
                {" "}
                · TB <b className="text-navy">{average}%</b>
              </>
            )}
          </span>
          {weak && (
            <button type="button" onClick={p.onPracticeWeak} disabled={p.locked} className="font-semibold text-teal hover:underline disabled:opacity-40">
              Luyện câu &lt; 60 điểm →
            </button>
          )}
        </div>
        {p.lines.length > 0 && (
          <progress className="mt-2 !h-1.5" value={practiced} max={p.lines.length} aria-label="Tiến độ luyện câu" />
        )}
        {p.estimated && <p className="mt-2 text-[11px] text-amber-700">Thời điểm từng câu được ước lượng theo độ dài, có thể lệch vài giây.</p>}
      </div>

      <ol ref={listRef} className="relative grid max-h-[calc(100vh-320px)] min-h-[240px] content-start gap-2 overflow-y-auto p-3">
        {p.lines.map((line, i) => {
          const active = i === p.index;
          const score = p.scores[i];
          const result = active ? p.results[i] : undefined;
          const ipa = p.showIpa ? p.annotations?.[i]?.ipa : null;
          return (
            <li
              key={i}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
            >
              <div
                role="button"
                tabIndex={0}
                aria-current={active ? "true" : undefined}
                onClick={() => !p.locked && p.onSelect(i)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !p.locked) {
                    e.preventDefault();
                    p.onSelect(i);
                  }
                }}
                className={`flex gap-3 rounded-xl border p-3 transition ${
                  active ? "border-navy/30 bg-navy-soft/60 shadow-sm" : "border-transparent hover:border-line hover:bg-slate-50"
                } ${p.locked && !active ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
              >
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-lg text-[11px] font-bold ${
                    active ? "bg-navy text-white" : "bg-slate-100 text-muted"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className={`min-w-0 flex-1 break-words ${TEXT_CLASS[p.fontSize]}`}>
                  {line.speaker && <b className="mr-1 text-teal">{line.speaker}:</b>}
                  {active && p.cues[i] ? (
                    <KaraokeText cue={p.cues[i]} time={p.player.time} variant="card" onWordClick={p.locked ? undefined : (s) => (p.player.seek(s), p.player.play())} className="inline" />
                  ) : (
                    <span className="text-ink-secondary">{line.text}</span>
                  )}
                  {ipa && <p className="mt-1 font-mono text-xs break-words text-muted">{ipa}</p>}
                  {result && (
                    <div className="mt-2 grid gap-2 rounded-lg border border-line bg-white p-2.5" onClick={(e) => e.stopPropagation()}>
                      <AlignedTranscript words={result.grade.wordResults} compact />
                      {result.url && <audio controls src={result.url} className="h-8 w-full" />}
                    </div>
                  )}
                </div>
                {score !== undefined && (
                  <span className={`h-fit shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${TONE_BADGE[scoreTone(score)]}`}>{score}%</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgba(9,23,52,0.25)] backdrop-blur lg:static lg:rounded-b-2xl lg:bg-white lg:pb-2 lg:shadow-none">
        <div className="mx-auto flex max-w-[640px] items-center justify-between gap-2">
          <button type="button" onClick={p.onReplay} disabled={p.recording} className="btn btn-secondary min-h-11 !px-3 !py-2 text-xs">
            ↻ Nghe lại
          </button>
          <div className="flex items-center gap-2">
            <button type="button" className={navButton} disabled={p.locked || p.index <= 0} onClick={() => p.onSelect(p.index - 1)} aria-label="Câu trước">
              ‹
            </button>
            <button
              type="button"
              disabled={p.recording || !p.player.ready}
              onClick={p.player.toggle}
              aria-label={p.player.playing ? "Tạm dừng" : "Phát"}
              className="grid size-12 place-items-center rounded-full bg-navy text-white shadow-md transition hover:bg-navy-light disabled:opacity-40"
            >
              {p.player.playing ? "❚❚" : "▶"}
            </button>
            <button
              type="button"
              className={navButton}
              disabled={p.locked || p.index >= p.lines.length - 1}
              onClick={() => p.onSelect(p.index + 1)}
              aria-label="Câu sau"
            >
              ›
            </button>
          </div>
          <button
            type="button"
            onClick={p.onToggleRecord}
            disabled={!p.canRecord}
            className={`btn min-h-11 !px-3 !py-2 text-xs ${p.recording ? "!border-rose-700 !bg-rose-600" : "btn-secondary"}`}
          >
            {p.recording ? "■ Dừng" : "🎤 Ghi âm"}
          </button>
        </div>
        <p className="mt-1 hidden text-center text-[11px] text-muted sm:block">
          Câu {p.index + 1} / {p.lines.length} · Space phát/dừng · ←/→ chuyển câu · R nghe lại · M ghi âm
        </p>
      </div>
    </section>
  );
}
