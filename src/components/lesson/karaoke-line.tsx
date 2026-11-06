"use client";

import { useMemo } from "react";
import { tokenize } from "@/domain/karaoke";

type Props = {
  text: string;
  activeWord: number;
  onWordClick?: (wordIndex: number) => void;
  className?: string;
};

export function KaraokeLine({ text, activeWord, onWordClick, className = "" }: Props) {
  const tokens = useMemo(() => tokenize(text), [text]);

  return (
    <p className={`text-sm md:text-base leading-relaxed ${className}`}>
      {tokens.map((token, i) => {
        let stateClass = "text-slate-400";
        if (i === activeWord) {
          stateClass = "bg-navy text-white font-bold ring-2 ring-navy/20 scale-[1.04]";
        } else if (i < activeWord) {
          stateClass = "text-navy font-semibold";
        }

        const clickable = Boolean(onWordClick);

        return (
          <span key={i}>
            <span
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={() => onWordClick?.(i)}
              onKeyDown={(e) => {
                if (clickable && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onWordClick?.(i);
                }
              }}
              className={`inline-block rounded px-1.5 py-0.5 -mx-0.5 transition-transform duration-100 ${stateClass} ${
                clickable ? "cursor-pointer" : ""
              }`}
            >
              {token.text}
            </span>
            {i < tokens.length - 1 ? " " : ""}
          </span>
        );
      })}
    </p>
  );
}

