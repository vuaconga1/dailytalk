"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type CueWord,
  estimateSentenceSeconds,
  estimateWordTimings,
  tokenize,
  tokenIndexAtChar,
  wordIndexAt,
} from "@/domain/karaoke";
import type { useMedia } from "./use-media";

export interface UseKaraokeProps {
  lessonId: string;
  lines: string[];
  /** Every line has a cached MP3 clip; otherwise the browser voice reads it. */
  serverAudio: boolean;
  rate: number;
  media: ReturnType<typeof useMedia>;
  onError?: (message: string) => void;
}

export function useKaraoke({ lessonId, lines, serverAudio, rate, media, onError }: UseKaraokeProps) {
  const [lineIndex, setLineIndex] = useState(-1);
  const [wordIndex, setWordIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);

  const runIdRef = useRef(0);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentTimingsRef = useRef<CueWord[]>([]);
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const lineIndexRef = useRef(lineIndex);
  lineIndexRef.current = lineIndex;
  const rateRef = useRef(rate);
  rateRef.current = rate;

  // Sync playback rate with currently active HTML audio element if rate changes
  useEffect(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.playbackRate = rate;
      currentAudioRef.current.defaultPlaybackRate = rate;
    }
  }, [rate]);

  const stop = useCallback(() => {
    runIdRef.current++;
    media.stopSound();
    currentAudioRef.current = null;
    currentTimingsRef.current = [];
    setPlaying(false);
  }, [media]);

  /**
   * Internal runner for a single line.
   * Returns true if line finished naturally, or false if cancelled or stopped externally.
   */
  const playLineInternal = useCallback(
    async (targetLine: number, fromWordIdx: number, runId: number): Promise<boolean> => {
      if (targetLine < 0 || targetLine >= lines.length) return false;
      const text = lines[targetLine];
      const tokens = tokenize(text);
      if (tokens.length === 0) return true;

      if (!serverAudio) {
        // SpeechSynthesis path (no cached clips)
        const charOffset = fromWordIdx > 0 && fromWordIdx < tokens.length ? tokens[fromWordIdx].start : 0;
        const spokenText = text.slice(charOffset);
        const estimatedSec = estimateSentenceSeconds(spokenText, 150) / Math.max(0.1, rateRef.current);
        const fallbackTimings = estimateWordTimings(spokenText, 0, estimatedSec);

        let boundaryFired = false;
        let startTime = 0;
        let rafId: number | null = null;

        try {
          await media.speakTracked(spokenText, rateRef.current, {
            onStart: () => {
              startTime = performance.now();
              const loop = () => {
                if (runIdRef.current !== runId) return;
                if (!boundaryFired && fallbackTimings.length > 0) {
                  const elapsed = (performance.now() - startTime) / 1000;
                  const relIdx = wordIndexAt(fallbackTimings, elapsed);
                  const activeIdx = Math.min(tokens.length - 1, fromWordIdx + relIdx);
                  setWordIndex(activeIdx);
                }
                rafId = requestAnimationFrame(loop);
              };
              rafId = requestAnimationFrame(loop);
            },
            onBoundary: (charIndex) => {
              boundaryFired = true;
              const absChar = charIndex + charOffset;
              const wIdx = tokenIndexAtChar(tokens, absChar);
              if (wIdx >= 0 && wIdx < tokens.length && runIdRef.current === runId) {
                setWordIndex(wIdx);
              }
            },
          });
        } finally {
          if (rafId !== null) cancelAnimationFrame(rafId);
        }

        if (runIdRef.current !== runId) return false;
        if (media.recording) return false;
        return true;
      }

      // MP3 audio path
      currentTimingsRef.current = [];
      currentAudioRef.current = null;
      onError?.("Đang chuẩn bị audio…");
      const url = `/api/audio?lesson=${encodeURIComponent(lessonId)}&line=${targetLine}`;
      let seeked = false;
      let completedNaturally = false;

      try {
        await media.playTracked(url, rateRef.current, (currentTime, duration) => {
          if (runIdRef.current !== runId) return;

          if (media.audioRef.current) {
            currentAudioRef.current = media.audioRef.current;
          }

          if (duration > 0 && currentTimingsRef.current.length === 0) {
            onError?.("");
            currentTimingsRef.current = estimateWordTimings(text, 0, duration);
          }

          if (!seeked && fromWordIdx > 0 && currentTimingsRef.current.length > 0 && media.audioRef.current) {
            seeked = true;
            const targetWord = currentTimingsRef.current[fromWordIdx];
            if (targetWord) {
              media.audioRef.current.currentTime = targetWord.s;
              setWordIndex(fromWordIdx);
              return;
            }
          }

          if (currentTimingsRef.current.length > 0) {
            const wIdx = wordIndexAt(currentTimingsRef.current, currentTime);
            setWordIndex(wIdx);
          }
        });

        const activeAudio = media.audioRef.current ?? (currentAudioRef.current as HTMLAudioElement | null);
        if (activeAudio?.ended) {
          completedNaturally = true;
        }
      } catch {
        onError?.("Chưa phát được audio. Vui lòng thử lại.");
        return false;
      }

      if (runIdRef.current !== runId) return false;
      const activeAudio = media.audioRef.current ?? (currentAudioRef.current as HTMLAudioElement | null);
      if (!completedNaturally && (media.recording || !activeAudio || activeAudio.paused)) {
        return false;
      }

      return true;
    },
    [serverAudio, lessonId, lines, media, onError],
  );

  const playLine = useCallback(
    async (index: number, fromWordIdx = 0) => {
      if (index < 0 || index >= lines.length) return;
      const currentRunId = ++runIdRef.current;
      setLineIndex(index);
      setWordIndex(fromWordIdx);
      setPlaying(true);

      const completed = await playLineInternal(index, fromWordIdx, currentRunId);
      if (runIdRef.current !== currentRunId) return;

      if (completed) {
        const tokens = tokenize(lines[index]);
        setWordIndex(tokens.length); // whole line read
      }
      setPlaying(false);
    },
    [lines, playLineInternal],
  );

  const playAll = useCallback(async () => {
    const currentRunId = ++runIdRef.current;
    setPlaying(true);

    for (let i = 0; i < lines.length; i++) {
      if (runIdRef.current !== currentRunId) break;
      setLineIndex(i);
      setWordIndex(0);

      const completed = await playLineInternal(i, 0, currentRunId);
      if (runIdRef.current !== currentRunId) break;

      if (!completed) {
        setPlaying(false);
        return;
      }

      const tokens = tokenize(lines[i]);
      setWordIndex(tokens.length); // whole line read

      // Short natural pause between speakers
      if (i < lines.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        if (runIdRef.current !== currentRunId) break;
      }
    }

    if (runIdRef.current === currentRunId) {
      setPlaying(false);
    }
  }, [lines, playLineInternal]);

  const playFromWord = useCallback(
    async (targetLine: number, targetWord: number) => {
      if (targetLine < 0 || targetLine >= lines.length) return;
      const tokens = tokenize(lines[targetLine]);
      if (targetWord < 0 || targetWord >= tokens.length) return;

      // In MP3 mode, if this line is already playing, seek directly in audio element
      if (
        serverAudio &&
        playing &&
        lineIndex === targetLine &&
        media.audioRef.current &&
        currentTimingsRef.current.length > 0
      ) {
        const wordCue = currentTimingsRef.current[targetWord];
        if (wordCue) {
          media.audioRef.current.currentTime = wordCue.s;
          setWordIndex(targetWord);
          return;
        }
      }

      // Otherwise launch playLine starting from targetWord
      await playLine(targetLine, targetWord);
    },
    [serverAudio, lines, lineIndex, playing, media, playLine],
  );

  const prev = useCallback(() => {
    const target = lineIndexRef.current > 0 ? lineIndexRef.current - 1 : 0;
    void playLine(target);
  }, [playLine]);

  const next = useCallback(() => {
    const cur = lineIndexRef.current;
    const target = cur >= 0 && cur < lines.length - 1 ? cur + 1 : cur < 0 ? 0 : cur;
    void playLine(target);
  }, [lines.length, playLine]);

  const replay = useCallback(() => {
    const target = lineIndexRef.current >= 0 ? lineIndexRef.current : 0;
    void playLine(target);
  }, [playLine]);

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          tag === "BUTTON" ||
          target.isContentEditable
        ) {
          return;
        }
      }

      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        if (playingRef.current) {
          stop();
        } else if (lineIndexRef.current >= 0) {
          void playLine(lineIndexRef.current);
        } else {
          void playAll();
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        replay();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [stop, playLine, playAll, prev, next, replay]);

  const stopRef = useRef(stop);
  stopRef.current = stop;
  useEffect(() => () => stopRef.current(), []);

  return {
    lineIndex,
    wordIndex,
    playing,
    playAll,
    playLine,
    playFromWord,
    next,
    prev,
    replay,
    stop,
  };
}
