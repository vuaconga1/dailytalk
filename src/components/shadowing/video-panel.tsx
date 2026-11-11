"use client";

import { useState } from "react";
import type { CueTiming } from "@/domain/shadowing/cues";
import { KaraokeText } from "./karaoke-text";
import { useTimeSelector, type YoutubePlayer } from "./use-youtube-player";

const RATES = [0.5, 0.75, 1, 1.25];

export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function SeekBar({ player, duration }: { player: YoutubePlayer; duration: number }) {
  const tenth = useTimeSelector(player.time, (t) => Math.floor(t * 10));
  const t = Math.min(tenth / 10, duration || 0);
  const pct = duration ? (t / duration) * 100 : 0;
  return (
    <div>
      <input
        type="range"
        aria-label="Tua video"
        min={0}
        max={duration || 1}
        step={0.1}
        value={t}
        disabled={!duration}
        onChange={(e) => player.seek(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-navy"
        style={{ background: `linear-gradient(to right, var(--ww-navy) ${pct}%, #e2e8f4 ${pct}%)` }}
      />
      <div className="mt-1 flex justify-between font-mono text-xs font-semibold text-muted">
        <span>{clock(t)}</span>
        <span>{clock(duration)}</span>
      </div>
    </div>
  );
}

type Props = {
  player: YoutubePlayer;
  title: string;
  level: string | null;
  duration: number;
  cue: CueTiming | null;
  /** Locks the player while the microphone is recording. */
  locked: boolean;
};

export function VideoPanel({ player, title, level, duration, cue, locked }: Props) {
  const [captions, setCaptions] = useState(true);
  const iconButton =
    "grid size-11 place-items-center rounded-xl border border-line bg-white text-navy transition hover:border-navy/40 hover:bg-navy-soft/60 disabled:opacity-40";

  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-line bg-white p-4 shadow-[0_4px_20px_-4px_rgba(20,40,90,0.05)] sm:p-5">
      <div className="mb-3 flex min-w-0 items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-navy-soft text-navy">
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0013.5 5.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold tracking-[1.5px] text-muted uppercase">Video mẫu</div>
          <h1 className="line-clamp-2 text-base font-bold text-navy" title={title}>
            {title}
          </h1>
        </div>
        {level && <span className="badge shrink-0 !py-1 text-[11px]">Trình độ {level}</span>}
      </div>

      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        <div ref={player.containerRef} className="absolute inset-0 [&_iframe]:size-full" />
        <button
          type="button"
          aria-label={player.playing ? "Tạm dừng" : "Phát"}
          disabled={locked || !player.ready}
          onClick={player.toggle}
          className="absolute inset-0 z-10 cursor-pointer bg-transparent disabled:cursor-default"
        />
        {!player.ready && !player.error && (
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center text-sm text-white/70">Đang tải video…</div>
        )}
        {player.error && <div className="absolute inset-0 z-20 grid place-items-center bg-black/80 p-6 text-center text-sm text-white">{player.error}</div>}
        {captions && cue && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-3 sm:bottom-5">
            <div className="max-w-[92%] rounded-lg bg-black/75 px-3 py-1.5 text-center text-sm font-medium sm:text-base">
              <KaraokeText cue={cue} time={player.time} variant="video" />
            </div>
          </div>
        )}
      </div>

      <div className="mt-4">
        <SeekBar player={player} duration={duration} />
      </div>

      <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" className={iconButton} disabled={locked} onClick={() => player.seek(player.time.get() - 5)} aria-label="Lùi 5 giây">
            <span className="text-xs font-bold">↺5s</span>
          </button>
          <button
            type="button"
            disabled={locked || !player.ready}
            onClick={player.toggle}
            aria-label={player.playing ? "Tạm dừng" : "Phát"}
            className="grid size-12 place-items-center rounded-xl bg-navy text-white shadow-md transition hover:bg-navy-light disabled:opacity-40"
          >
            {player.playing ? (
              <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
              </svg>
            ) : (
              <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <button type="button" className={iconButton} disabled={locked} onClick={() => player.seek(player.time.get() + 5)} aria-label="Tới 5 giây">
            <span className="text-xs font-bold">5s↻</span>
          </button>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-line bg-slate-50 p-1" role="group" aria-label="Tốc độ phát">
            {RATES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => player.setRate(r)}
                aria-pressed={player.rate === r}
                className={`min-h-9 rounded-lg px-2.5 text-xs font-semibold transition ${
                  player.rate === r ? "bg-white text-navy shadow-sm ring-1 ring-line" : "text-muted hover:text-navy"
                }`}
              >
                {r}x
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`${iconButton} ${captions ? "!border-navy/40 !bg-navy-soft" : ""}`}
            onClick={() => setCaptions((c) => !c)}
            aria-pressed={captions}
            aria-label="Bật/tắt phụ đề"
            title="Phụ đề"
          >
            <span className="text-[11px] font-extrabold">CC</span>
          </button>
          <div className="group relative">
            <button type="button" className={iconButton} onClick={player.toggleMute} aria-label={player.muted ? "Bật tiếng" : "Tắt tiếng"}>
              {player.muted || player.volume === 0 ? "🔇" : "🔊"}
            </button>
            <div className="absolute right-0 bottom-full z-30 hidden pb-2 group-focus-within:block group-hover:block">
              <div className="rounded-xl border border-line bg-white px-3 py-2 shadow-lg">
                <input
                  type="range"
                  aria-label="Âm lượng"
                  min={0}
                  max={100}
                  value={player.muted ? 0 : player.volume}
                  onChange={(e) => player.setVolume(Number(e.target.value))}
                  className="w-28 accent-navy"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
