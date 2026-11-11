"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  setPlaybackRate(rate: number): void;
  setVolume(volume: number): void;
  mute(): void;
  unMute(): void;
  destroy(): void;
};
type YTNamespace = { Player: new (el: HTMLElement, options: unknown) => YTPlayer };
type YTWindow = Window & { YT?: Partial<YTNamespace>; onYouTubeIframeAPIReady?: () => void };

const PLAYING = 1;
const ENDED = 0;
const PAUSED = 2;
const BUFFERING = 3;
/** pauseVideo() reaches the iframe via postMessage, so a range stop is issued this many seconds early. */
const PAUSE_LATENCY = 0.06;

let apiPromise: Promise<YTNamespace> | null = null;

function loadYoutubeApi(): Promise<YTNamespace> {
  const w = window as YTWindow;
  if (w.YT?.Player) return Promise.resolve(w.YT as YTNamespace);
  apiPromise ??= new Promise<YTNamespace>((resolve, reject) => {
    const previous = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(w.YT as YTNamespace);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error("Không tải được trình phát YouTube. Kiểm tra kết nối mạng."));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

/** Playback time readable from any component; selectors re-render only when their result changes. */
export type TimeStore = { get(): number; subscribe(listener: () => void): () => void };

export function useTimeSelector<T>(store: TimeStore, select: (t: number) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.get()),
    () => select(0),
  );
}

type Range = { end: number; onDone?: () => void; onCancel?: () => void; startedAt: number };

const PLAYER_ERRORS: Record<number, string> = {
  2: "Mã video YouTube không hợp lệ.",
  5: "Trình duyệt không phát được video này.",
  100: "Video đã bị gỡ hoặc để riêng tư.",
  101: "Chủ video không cho phép nhúng video này.",
  150: "Chủ video không cho phép nhúng video này.",
};

/**
 * Embedded YouTube player (IFrame API). The API reports currentTime only a few times per second,
 * so time is interpolated while playing to keep karaoke and sentence stops precise.
 */
export function useYoutubePlayer(videoId: string) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const stateRef = useRef(-1);
  const rateRef = useRef(1);
  const clockRef = useRef({ raw: 0, at: 0, time: 0, seek: null as { t: number; at: number } | null });
  const rangeRef = useRef<Range | null>(null);
  const listenersRef = useRef(new Set<() => void>());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [rate, setRateState] = useState(1);
  const [volume, setVolumeState] = useState(100);
  const [muted, setMuted] = useState(false);
  const [ranging, setRanging] = useState(false);

  const readTime = useCallback(() => {
    const player = playerRef.current;
    const clock = clockRef.current;
    if (!player) return clock.time;
    const raw = player.getCurrentTime() || 0;
    const now = performance.now();
    if (clock.seek) {
      if (Math.abs(raw - clock.seek.t) < 1 || now - clock.seek.at > 1500) clock.seek = null;
      else return clock.seek.t;
    }
    if (raw !== clock.raw) {
      clock.raw = raw;
      clock.at = now;
    }
    if (stateRef.current !== PLAYING) return raw;
    return raw + Math.min(0.4, ((now - clock.at) / 1000) * rateRef.current);
  }, []);

  const time = useMemo<TimeStore>(
    () => ({
      get: () => clockRef.current.time,
      subscribe: (listener) => {
        listenersRef.current.add(listener);
        return () => listenersRef.current.delete(listener);
      },
    }),
    [],
  );

  const finishRange = useCallback((completed: boolean) => {
    const range = rangeRef.current;
    rangeRef.current = null;
    if (!range) return;
    setRanging(false);
    if (completed) range.onDone?.();
    else range.onCancel?.();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    const host = containerRef.current;
    if (!host) return;
    const target = document.createElement("div");
    target.className = "size-full";
    host.appendChild(target);

    const tick = () => {
      const clock = clockRef.current;
      const t = readTime();
      const range = rangeRef.current;
      if (range && t >= range.end - PAUSE_LATENCY * rateRef.current) {
        clock.time = range.end;
        playerRef.current?.pauseVideo();
        setPlaying(false);
        finishRange(true);
      } else if (Math.abs(t - clock.time) > 0.005) {
        clock.time = t;
      } else {
        frame = requestAnimationFrame(tick);
        return;
      }
      listenersRef.current.forEach((l) => l());
      frame = requestAnimationFrame(tick);
    };

    loadYoutubeApi()
      .then((YT) => {
        if (cancelled) return;
        playerRef.current = new YT.Player(target, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            iv_load_policy: 3,
            cc_load_policy: 0,
            fs: 0,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (cancelled) return;
              setReady(true);
              setDuration(playerRef.current?.getDuration() || 0);
              frame = requestAnimationFrame(tick);
            },
            onStateChange: (e: { data: number }) => {
              stateRef.current = e.data;
              clockRef.current.at = performance.now();
              setPlaying(e.data === PLAYING || e.data === BUFFERING);
              const d = playerRef.current?.getDuration();
              if (d) setDuration(d);
              if (e.data === ENDED) finishRange(true);
              else if (e.data === PAUSED && rangeRef.current && performance.now() - rangeRef.current.startedAt > 600) finishRange(false);
            },
            onPlaybackRateChange: (e: { data: number }) => {
              rateRef.current = e.data;
              setRateState(e.data);
            },
            onError: (e: { data: number }) => setError(PLAYER_ERRORS[e.data] ?? "Không phát được video."),
          },
        });
      })
      .catch((e: Error) => !cancelled && setError(e.message));

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      rangeRef.current = null;
      setRanging(false);
      playerRef.current?.destroy();
      playerRef.current = null;
      host.replaceChildren();
      setReady(false);
    };
  }, [videoId, readTime, finishRange]);

  const seek = useCallback((t: number) => {
    const target = Math.max(0, t);
    clockRef.current.seek = { t: target, at: performance.now() };
    clockRef.current.time = target;
    playerRef.current?.seekTo(target, true);
    listenersRef.current.forEach((l) => l());
  }, []);

  const clearRange = useCallback(() => finishRange(false), [finishRange]);

  const play = useCallback(() => playerRef.current?.playVideo(), []);
  const pause = useCallback(() => {
    clearRange();
    playerRef.current?.pauseVideo();
  }, [clearRange]);
  const toggle = useCallback(() => {
    if (stateRef.current === PLAYING || stateRef.current === BUFFERING) pause();
    else {
      clearRange();
      play();
    }
  }, [pause, play, clearRange]);

  /** Plays [start, end] and pauses at `end`; `onDone` runs when it got there, `onCancel` if interrupted. */
  const playRange = useCallback(
    (start: number, end: number, handlers: { onDone?: () => void; onCancel?: () => void } = {}) => {
      clearRange();
      seek(start);
      rangeRef.current = { end, ...handlers, startedAt: performance.now() };
      setRanging(true);
      playerRef.current?.playVideo();
    },
    [clearRange, seek],
  );

  const setRate = useCallback((r: number) => {
    rateRef.current = r;
    setRateState(r);
    playerRef.current?.setPlaybackRate(r);
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    playerRef.current?.setVolume(v);
    if (v > 0) {
      playerRef.current?.unMute();
      setMuted(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (muted) playerRef.current?.unMute();
    else playerRef.current?.mute();
    setMuted(!muted);
  }, [muted]);

  return useMemo(
    () => ({ containerRef, ready, error, playing, ranging, duration, rate, volume, muted, time, play, pause, toggle, seek, playRange, clearRange, setRate, setVolume, toggleMute }),
    [ready, error, playing, ranging, duration, rate, volume, muted, time, play, pause, toggle, seek, playRange, clearRange, setRate, setVolume, toggleMute],
  );
}

export type YoutubePlayer = ReturnType<typeof useYoutubePlayer>;
