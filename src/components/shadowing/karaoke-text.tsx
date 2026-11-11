"use client";

import { wordIndexAt, type CueTiming } from "@/domain/shadowing/cues";
import { useTimeSelector, type TimeStore } from "./use-youtube-player";

export type KaraokeVariant = "hero" | "card" | "video";

const STYLES: Record<KaraokeVariant, { idle: string; upcoming: string; past: string; current: string }> = {
  hero: { idle: "text-navy", upcoming: "text-slate-400", past: "text-navy", current: "bg-navy text-white scale-[1.04]" },
  card: { idle: "", upcoming: "text-slate-400", past: "text-navy font-medium", current: "bg-navy text-white scale-[1.04]" },
  video: { idle: "text-white", upcoming: "text-white/60", past: "text-white", current: "bg-amber-400 text-navy-deep scale-[1.04]" },
};

const LEAD = 0.25;
const TRAIL = 0.35;

type Props = {
  cue: CueTiming;
  time: TimeStore;
  variant: KaraokeVariant;
  /** Karaoke only runs on the active sentence; other sentences render as plain text. */
  active?: boolean;
  onWordClick?: (seconds: number) => void;
  className?: string;
};

/** Word-by-word highlight of the sentence currently playing; click a word to play from it. */
export function KaraokeText({ cue, time, variant, active = true, onWordClick, className = "" }: Props) {
  const current = useTimeSelector(time, (t) =>
    active && t >= cue.start - LEAD && t <= cue.end + TRAIL ? wordIndexAt(cue.words, t) : null,
  );
  const style = STYLES[variant];

  return (
    <p className={`leading-relaxed ${className}`}>
      {cue.words.map((word, i) => {
        const state = current === null ? style.idle : i === current ? style.current : i < current ? style.past : style.upcoming;
        return (
          <span key={i}>
            <span
              role={onWordClick ? "button" : undefined}
              tabIndex={onWordClick ? -1 : undefined}
              onClick={
                onWordClick
                  ? (e) => {
                      e.stopPropagation();
                      onWordClick(word.s);
                    }
                  : undefined
              }
              className={`-mx-0.5 inline-block rounded px-0.5 transition-[color,background-color,transform] duration-100 ${state} ${
                onWordClick ? "cursor-pointer hover:underline hover:decoration-dotted" : ""
              }`}
            >
              {word.w}
            </span>
            {i < cue.words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </p>
  );
}
