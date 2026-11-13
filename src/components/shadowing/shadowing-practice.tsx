"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { errorMessage } from "@/client/api";
import { estimateCues, lineIndexAt } from "@/domain/shadowing/cues";
import { gradeText, pickClosestAlternatives } from "@/domain/shadowing/scoring";
import { spokenText, transcriptLines, wordCount } from "@/domain/shadowing/transcript";
import {
  MAX_ALTERNATIVES_CHARS,
  MAX_RECOGNIZED_CHARS,
  MAX_RECORDING_BYTES,
  type PublicShadowingExercise,
  type ShadowingAttemptResult,
  type ShadowingCatalogItem,
} from "@/domain/shadowing/types";
import { CAPTURE_MESSAGES, CaptureError, captureSupported, speechProvider, startCapture, type Capture, type SpeechErrorCode } from "./capture";
import { ShadowingCatalog } from "./shadowing-catalog";
import { ShadowingHistory } from "./shadowing-history";
import { ShadowingResult } from "./shadowing-result";
import { MicButton, RecordingMeter, SentenceCard, SentenceGrade } from "./studio";
import { TranscriptPanel, type FontSize, type SentenceResult } from "./transcript-panel";
import { useTimeSelector, useYoutubePlayer } from "./use-youtube-player";
import { clock, VideoPanel } from "./video-panel";

type Mode = "sentence" | "full";
type Phase = "idle" | "starting" | "recording" | "processing" | "recorded" | "submitting";
type Take = { blob: Blob | null; url: string | null; text: string; segments: string[][]; durationMs: number };

const IPA_KEY = "wewin_shadowing_show_ipa";
const progressKey = (slug: string) => `wewin_shadowing_progress_${slug}`;
const AUTO_RECORD_DELAY_MS = 250;
const AUTO_NEXT_DELAY_MS = 1200;

function readScores(slug: string): Record<number, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(progressKey(slug)) ?? "{}") as Record<string, unknown>;
    return Object.fromEntries(Object.entries(raw).filter(([k, v]) => /^\d+$/.test(k) && typeof v === "number")) as Record<number, number>;
  } catch {
    return {};
  }
}

function extension(mime: string): string {
  return mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
}

export function ShadowingPractice({ exercise, catalog }: { exercise: PublicShadowingExercise; catalog: ShadowingCatalogItem[] }) {
  const lines = useMemo(() => transcriptLines(exercise.transcript), [exercise.transcript]);
  const totalWords = useMemo(() => wordCount(spokenText(exercise.transcript)), [exercise.transcript]);
  const player = useYoutubePlayer(exercise.youtubeId);
  const duration = player.duration || exercise.durationSec || 0;
  const cues = useMemo(() => exercise.cues ?? estimateCues(exercise.transcript, duration), [exercise.cues, exercise.transcript, duration]);

  const [mode, setMode] = useState<Mode>("sentence");
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [liveText, setLiveText] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [limitSec, setLimitSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const [results, setResults] = useState<Record<number, SentenceResult>>({});
  const [scores, setScores] = useState<Record<number, number> | null>(null);
  const [showIpa, setShowIpa] = useState(true);
  const [fontSize, setFontSize] = useState<FontSize>("base");
  const [supported, setSupported] = useState<boolean | null>(null);
  const [take, setTake] = useState<Take | null>(null);
  const [fullResult, setFullResult] = useState<ShadowingAttemptResult | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  const phaseRef = useRef<Phase>("idle");
  const indexRef = useRef(0);
  const sentenceRef = useRef(0);
  const captureRef = useRef<Capture | null>(null);
  const tokenRef = useRef(0);
  const autoRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const urlsRef = useRef(new Set<string>());

  useEffect(() => {
    setSupported(captureSupported());
    setScores(readScores(exercise.slug));
    const ipa = localStorage.getItem(IPA_KEY);
    if (ipa !== null) setShowIpa(ipa === "1");
  }, [exercise.slug]);

  useEffect(() => {
    if (scores) localStorage.setItem(progressKey(exercise.slug), JSON.stringify(scores));
  }, [scores, exercise.slug]);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    const urls = urlsRef.current;
    const token = tokenRef;
    const capture = captureRef;
    const timers = timersRef;
    return () => {
      token.current++;
      capture.current?.abort();
      timers.current.forEach((t) => clearTimeout(t));
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const go = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };
  const trackUrl = (blob: Blob | null) => {
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    urlsRef.current.add(url);
    return url;
  };
  const revokeUrl = (url: string | null | undefined) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    urlsRef.current.delete(url);
  };
  const schedule = (ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((t) => t !== id);
      fn();
    }, ms);
    timersRef.current.push(id);
  };

  const recordingNow = phase === "starting" || phase === "recording" || phase === "processing";
  const busy = recordingNow || phase === "submitting";

  // While the video plays freely, the active sentence follows playback.
  const timeLine = useTimeSelector(player.time, (t) => lineIndexAt(cues, t + 0.05));
  useEffect(() => {
    if (player.playing && !player.ranging && !busy) setIndex(timeLine);
  }, [timeLine, player.playing, player.ranging, busy]);

  function stopAuto() {
    autoRef.current = false;
    setAuto(false);
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }

  function abortCapture() {
    tokenRef.current++;
    captureRef.current?.abort();
    captureRef.current = null;
  }

  function failCapture(code: SpeechErrorCode) {
    abortCapture();
    stopAuto();
    go("idle");
    setError(CAPTURE_MESSAGES[code]);
  }

  function playSentence(i: number, handlers?: { onDone?: () => void; onCancel?: () => void }) {
    const cue = cues[i];
    if (!cue) return;
    setIndex(i);
    indexRef.current = i;
    player.playRange(cue.start, cue.end, handlers);
  }

  function select(i: number) {
    if (i < 0 || i >= lines.length || busy) return;
    stopAuto();
    setNotice(null);
    setIndex(i);
    indexRef.current = i;
    player.clearRange();
    if (cues[i]) player.seek(cues[i].start);
  }

  function replay() {
    if (busy) return;
    stopAuto();
    playSentence(indexRef.current);
  }

  async function beginCapture(maxSec: number, onLimit: () => void): Promise<void> {
    player.pause();
    setError(null);
    setNotice(null);
    setLiveText("");
    setElapsedMs(0);
    setLimitSec(maxSec);
    go("starting");
    const token = ++tokenRef.current;
    try {
      const capture = await startCapture({
        maxSec,
        onText: setLiveText,
        onTick: setElapsedMs,
        onLimit,
        onError: (code) => token === tokenRef.current && actions.current.failCapture(code),
      });
      if (token !== tokenRef.current) return capture.abort();
      captureRef.current = capture;
      go("recording");
    } catch (e) {
      if (token !== tokenRef.current) return;
      stopAuto();
      go("idle");
      setError(CAPTURE_MESSAGES[e instanceof CaptureError ? e.code : "other"]);
    }
  }

  async function startSentence(i: number) {
    if (phaseRef.current !== "idle" || !supported) return;
    const cue = cues[i];
    sentenceRef.current = i;
    const maxSec = Math.max(4, Math.round((cue ? cue.end - cue.start : 3) * 2 + 2));
    await beginCapture(maxSec, () => void actions.current.finishSentence());
  }

  async function finishSentence() {
    const capture = captureRef.current;
    if (!capture) return;
    captureRef.current = null;
    const i = sentenceRef.current;
    const token = tokenRef.current;
    go("processing");
    const heard = await capture.stop();
    if (token !== tokenRef.current) return;
    const sentence = lines[i]?.text ?? "";
    const text = (pickClosestAlternatives(sentence, heard.segments) ?? heard.text).trim();
    if (!text) {
      go("idle");
      stopAuto();
      setNotice("Chưa phát hiện giọng nói rõ ràng. Hãy nói to, rõ hơn rồi thử lại.");
      return;
    }
    const grade = gradeText(sentence, text);
    const url = trackUrl(heard.blob);
    revokeUrl(results[i]?.url);
    setResults((r) => ({ ...r, [i]: { grade, url } }));
    setScores((s) => ({ ...s, [i]: grade.score }));
    go("idle");
    if (autoRef.current) schedule(AUTO_NEXT_DELAY_MS, () => actions.current.autoNext(i));
  }

  function autoPlay(i: number) {
    playSentence(i, {
      onDone: () => schedule(AUTO_RECORD_DELAY_MS, () => autoRef.current && void actions.current.startSentence(i)),
      onCancel: () => actions.current.stopAuto(),
    });
  }

  function autoNext(i: number) {
    if (!autoRef.current) return;
    if (i >= lines.length - 1) return stopAuto();
    autoPlay(i + 1);
  }

  function toggleAuto() {
    if (autoRef.current) {
      stopAuto();
      player.pause();
      if (phaseRef.current === "starting" || phaseRef.current === "recording") {
        abortCapture();
        go("idle");
      }
      return;
    }
    if (phaseRef.current !== "idle" || !supported) return;
    autoRef.current = true;
    setAuto(true);
    setError(null);
    setNotice(null);
    autoPlay(indexRef.current);
  }

  async function startFull() {
    if ((phaseRef.current !== "idle" && phaseRef.current !== "recorded") || !supported) return;
    revokeUrl(take?.url);
    setTake(null);
    setFullResult(null);
    await beginCapture(exercise.maxRecordSeconds, () => void actions.current.finishFull());
  }

  async function finishFull() {
    const capture = captureRef.current;
    if (!capture) return;
    captureRef.current = null;
    const token = tokenRef.current;
    go("processing");
    const heard = await capture.stop();
    if (token !== tokenRef.current) return;
    setTake({ blob: heard.blob, url: trackUrl(heard.blob), text: heard.text, segments: heard.segments, durationMs: heard.durationMs });
    go("recorded");
  }

  function retryFull() {
    revokeUrl(take?.url);
    setTake(null);
    setFullResult(null);
    setError(null);
    go("idle");
  }

  async function submitFull() {
    if (!take?.text.trim() || phaseRef.current !== "recorded") return;
    go("submitting");
    setError(null);
    const form = new FormData();
    form.set("slug", exercise.slug);
    form.set("recognizedText", take.text.slice(0, MAX_RECOGNIZED_CHARS));
    form.set("sttProvider", speechProvider.id);
    const alternatives = JSON.stringify(take.segments);
    if (alternatives.length <= MAX_ALTERNATIVES_CHARS) form.set("alternatives", alternatives);
    if (take.blob && take.blob.size <= MAX_RECORDING_BYTES) form.set("recording", take.blob, `recording.${extension(take.blob.type)}`);
    form.set("durationMs", String(take.durationMs));
    try {
      const res = await fetch("/api/shadowing/submit", { method: "POST", body: form, credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as ShadowingAttemptResult & { error?: string };
      if (res.status === 401) window.location.assign("/login");
      if (!res.ok) throw new Error(data.error ?? "Nộp bài thất bại.");
      revokeUrl(take.url);
      setTake(null);
      setFullResult(data);
      setHistoryKey((k) => k + 1);
      go("idle");
    } catch (e) {
      setError(errorMessage(e));
      go("recorded");
    }
  }

  function toggleRecord() {
    if (mode === "sentence") {
      if (phaseRef.current === "recording") void finishSentence();
      else if (phaseRef.current === "idle") void startSentence(indexRef.current);
    } else if (phaseRef.current === "recording") void finishFull();
    else void startFull();
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    abortCapture();
    stopAuto();
    player.pause();
    setError(null);
    setNotice(null);
    setMode(next);
    go(next === "full" && take ? "recorded" : "idle");
  }

  function practiceWeak() {
    if (!scores) return;
    const order = [...lines.keys()].map((k) => (index + 1 + k) % lines.length);
    const target = order.find((i) => scores[i] !== undefined && scores[i] < 60);
    if (target !== undefined) select(target);
  }

  function playSample() {
    stopAuto();
    player.seek(0);
    player.play();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const actions = useRef({ failCapture, finishSentence, finishFull, startSentence, autoNext, stopAuto, toggleRecord, select, replay });
  useEffect(() => {
    actions.current = { failCapture, finishSentence, finishFull, startSentence, autoNext, stopAuto, toggleRecord, select, replay };
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button, a, [role=button], [contenteditable=true]")) return;
      const key = e.key.toLowerCase();
      if (key === "m") {
        e.preventDefault();
        actions.current.toggleRecord();
        return;
      }
      if (phaseRef.current !== "idle" && phaseRef.current !== "recorded") return;
      if (key === " ") {
        e.preventDefault();
        player.toggle();
      } else if (key === "arrowleft" || key === "arrowright") {
        e.preventDefault();
        actions.current.select(indexRef.current + (key === "arrowleft" ? -1 : 1));
      } else if (key === "r") {
        e.preventDefault();
        actions.current.replay();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player]);

  const line = lines[index];
  const cue = cues[index];
  const ipa = showIpa ? (exercise.annotations?.[index]?.ipa ?? null) : null;
  const sentenceResult = results[index];
  const meterPhase = recordingNow ? (phase as "starting" | "recording" | "processing") : null;
  const seekWord = busy ? undefined : (s: number) => (player.seek(s), player.play());

  return (
    <div className="grid gap-5 pb-32 xl:grid-cols-[230px_minmax(0,1fr)] lg:pb-0">
      <ShadowingCatalog items={catalog} current={exercise.slug} />

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)] xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <VideoPanel player={player} title={exercise.title} level={exercise.level} duration={duration} cue={cue ?? null} locked={recordingNow} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl border-[1.5px] border-black bg-white p-1" role="tablist" aria-label="Chế độ luyện">
              {(
                [
                  ["sentence", "Luyện từng câu"],
                  ["full", "Đọc cả bài"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={mode === value}
                  onClick={() => switchMode(value)}
                  className={`min-h-10 rounded-lg px-4 text-sm font-semibold transition ${
                    mode === value ? "bg-navy text-white shadow-sm" : "text-navy hover:bg-navy-soft/60"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {mode === "sentence" && (
              <button
                type="button"
                onClick={toggleAuto}
                disabled={!supported || (!auto && phase !== "idle")}
                aria-pressed={auto}
                className={`btn min-h-11 !py-2 text-sm ${auto ? "btn-gold" : "btn-secondary"}`}
              >
                {auto ? "■ Dừng shadow tự động" : "✨ Shadow tự động"}
              </button>
            )}
          </div>

          <section className="min-w-0 rounded-2xl border-2 border-black bg-white p-4 shadow-(--ww-frame-shadow) sm:p-5">
            <div className="mb-4 flex flex-wrap items-center gap-3 border-b-2 border-black pb-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-navy text-gold-light">
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
              </span>
              <b className="min-w-0 flex-1 text-base font-extrabold tracking-wide text-navy uppercase">{mode === "sentence" ? "Ghi âm câu này" : "Đọc cả bài"}</b>
              <span className="badge badge-gold">
                {mode === "sentence" ? `Câu ${index + 1} / ${lines.length}` : `Tối đa ${clock(exercise.maxRecordSeconds)}`}
              </span>
            </div>

            {exercise.instructions && (
              <p className="mb-4 rounded-lg border-l-4 border-gold bg-navy-soft/50 px-3 py-2 text-xs leading-relaxed text-ink">{exercise.instructions}</p>
            )}
            {supported === false && (
              <p className="mb-4 rounded-lg border-[1.5px] border-black bg-gold-soft/60 px-3 py-2 text-xs text-ink">{CAPTURE_MESSAGES.unsupported}</p>
            )}

            {mode === "sentence" && line && (
              <div className="grid gap-4">
                <SentenceCard index={index} line={line} cue={cue} ipa={ipa} time={player.time} onWordClick={seekWord} />
                {meterPhase ? (
                  <RecordingMeter phase={meterPhase} elapsedMs={elapsedMs} limitSec={limitSec} liveText={liveText} onStop={() => void finishSentence()} />
                ) : sentenceResult ? (
                  <SentenceGrade
                    grade={sentenceResult.grade}
                    url={sentenceResult.url}
                    isLast={index >= lines.length - 1}
                    onRetry={() => void startSentence(index)}
                    onReplay={replay}
                    onNext={() => select(index + 1)}
                  />
                ) : (
                  <>
                    <MicButton onClick={() => void startSentence(index)} disabled={!supported || auto} label="Bấm micro để bắt đầu nói" />
                    <div className="text-center">
                      <button type="button" className="btn-text font-semibold" onClick={replay}>
                        ▶ Nghe câu mẫu (R)
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {mode === "full" && (
              <div className="grid gap-4">
                {fullResult ? (
                  <ShadowingResult result={fullResult} onPlaySample={playSample} onRetry={retryFull} />
                ) : meterPhase ? (
                  <RecordingMeter
                    phase={meterPhase}
                    elapsedMs={elapsedMs}
                    limitSec={limitSec}
                    liveText={liveText}
                    onStop={() => void finishFull()}
                    badge="Đang thu…"
                  />
                ) : take ? (
                  <div className="grid gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge badge-navy">✓ Đã ghi âm xong</span>
                      <span className="text-xs text-muted">{clock(take.durationMs / 1000)}</span>
                    </div>
                    {take.url && <audio controls src={take.url} className="h-9 w-full" />}
                    <div>
                      <div className="mb-1.5 text-[11px] font-bold tracking-wider text-black uppercase">
                        Văn bản hệ thống nghe được · {wordCount(take.text)} từ
                      </div>
                      <p className="max-h-[220px] overflow-y-auto rounded-xl border-[1.5px] border-black bg-navy-soft/40 p-3 text-sm break-words text-ink">
                        {take.text || "—"}
                      </p>
                    </div>
                    {!take.text.trim() && (
                      <p className="rounded-lg border-[1.5px] border-black bg-gold-soft/60 px-3 py-2 text-xs text-ink">
                        Chưa phát hiện giọng nói rõ ràng. Hãy ghi âm lại, nói to và rõ hơn.
                      </p>
                    )}
                    {take.blob && take.blob.size > MAX_RECORDING_BYTES && (
                      <p className="text-xs text-muted">Bản ghi dài hơn 4 MB nên sẽ chỉ được chấm điểm, không lưu lại.</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn btn-outline" onClick={retryFull} disabled={phase === "submitting"}>
                        🎤 Ghi âm lại
                      </button>
                      <button type="button" className="btn btn-gold" onClick={() => void submitFull()} disabled={!take.text.trim() || phase === "submitting"}>
                        {phase === "submitting" ? "Đang chấm…" : "Nộp bài & xem điểm"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-ink-secondary">
                      Xem video vài lần, rồi bấm micro và đọc liền mạch toàn bộ transcript ({lines.length} câu, {totalWords} từ). Hệ thống so khớp từng từ
                      và lưu kết quả vào lịch sử.
                    </p>
                    <MicButton onClick={() => void startFull()} disabled={!supported} label="Bấm micro để đọc cả bài" />
                  </>
                )}
              </div>
            )}

            {notice && <p className="mt-4 rounded-lg border-[1.5px] border-black bg-gold-soft/60 px-3 py-2 text-xs text-ink">{notice}</p>}
            {error && (
              <p className="mt-4 rounded-xl border-[1.5px] border-rose-600 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
                {error}
              </p>
            )}
          </section>
        </div>

        <div className="min-w-0">
          <div className="lg:sticky lg:top-20">
            <TranscriptPanel
              lines={lines}
              cues={cues}
              annotations={exercise.annotations}
              words={totalWords}
              index={index}
              player={player}
              scores={scores ?? {}}
              results={results}
              estimated={!exercise.cues}
              showIpa={showIpa}
              onToggleIpa={() => {
                localStorage.setItem(IPA_KEY, showIpa ? "0" : "1");
                setShowIpa(!showIpa);
              }}
              fontSize={fontSize}
              onFontSize={setFontSize}
              locked={busy}
              recording={phase === "recording"}
              canRecord={Boolean(supported) && (phase === "idle" || phase === "recording" || (mode === "full" && phase === "recorded"))}
              onSelect={select}
              onReplay={replay}
              onToggleRecord={toggleRecord}
              onPracticeWeak={practiceWeak}
            />
          </div>
        </div>

        <div className="min-w-0 lg:col-span-2 [grid-column:1/-1]">
          <ShadowingHistory slug={exercise.slug} refreshKey={historyKey} onPlaySample={playSample} />
        </div>
      </div>
    </div>
  );
}
