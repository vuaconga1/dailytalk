"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/client/api";
import { AI_UNAVAILABLE } from "@/lib/errors";
import type { AttemptView, PracticeView, Summary, Turn, WeekReview } from "@/domain/types";
import { PracticeStep } from "./practice-step";
import { ShadowStep } from "./shadow-step";
import { SummaryStep } from "./summary-step";
import { useMedia } from "./use-media";
import { WordsStep } from "./words-step";

const DAILY_SECONDS = 180;
const STEPS = ["01. Từ & mẫu câu", "02. Shadowing", "03. Hội thoại AI", "04. Tổng kết"];

export type TurnResult = { turns: Turn[]; ai_off: boolean; serverTime: number };

/** Which parts of the lesson have cached MP3 clips; the rest use the browser voice. */
export type LessonAudio = { lines: boolean; words: boolean; lineUrls: (string | null)[]; wordUrls: (string | null)[] };

type Props = { initial: AttemptView; week: WeekReview; serverTime: number; demo: boolean; audio: LessonAudio; contextLabel: string };

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function LessonPlayer({ initial, week, serverTime, demo, audio, contextLabel }: Props) {
  const router = useRouter();
  const media = useMedia();
  const [attempt, setAttempt] = useState(initial);
  const [practice, setPractice] = useState<PracticeView | null>(initial.practice);
  const [step, setStep] = useState(initial.completed ? 3 : 0);
  const [mounted, setMounted] = useState(false);
  const [, setTick] = useState(0);
  const [toast, setToast] = useState("");
  /** The AI failed in this session; scripted replies and browser speech recognition until a new session starts. */
  const [aiOff, setAiOff] = useState(false);
  const offsetRef = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  /** Id of the speaking session still running, abandoned if the learner leaves the page. */
  const liveIdRef = useRef<string | null>(null);
  const attachedRef = useRef(false);

  useEffect(() => {
    offsetRef.current = serverTime - Date.now();
    setMounted(true);
  }, [serverTime]);

  const remaining = useCallback(() => {
    if (!practice) return DAILY_SECONDS;
    if (practice.ended) return 0;
    return Math.max(0, Math.ceil((practice.deadline - (Date.now() + offsetRef.current)) / 1000));
  }, [practice]);

  useEffect(() => {
    liveIdRef.current = practice && !practice.ended && !attempt.completed && remaining() > 0 ? practice.id : null;
  });

  useEffect(() => {
    const abandon = () => {
      const id = liveIdRef.current;
      if (!id) return;
      liveIdRef.current = null;
      void fetch("/api/practice/abandon", {
        method: "POST",
        keepalive: true,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: id }),
      }).catch(() => {});
    };
    attachedRef.current = true;
    window.addEventListener("pagehide", abandon);
    return () => {
      attachedRef.current = false;
      window.removeEventListener("pagehide", abandon);
      // Strict Mode remounts immediately; only a real unmount (leaving the page) abandons.
      setTimeout(() => {
        if (!attachedRef.current) abandon();
      }, 0);
    };
  }, []);

  const live = Boolean(practice && !practice.ended);
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      setTick((t) => t + 1);
      if (remaining() === 0) {
        clearInterval(id);
        media.stopAll();
      }
    }, 500);
    return () => clearInterval(id);
  }, [live, remaining, media]);

  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 5000);
  }, []);

  function goTo(i: number) {
    media.stopAll();
    setStep(i);
    window.scrollTo(0, 0);
  }

  async function checkpoint(stage: "words" | "shadow") {
    await api("/api/checkpoint", { attempt_id: attempt.id, stage });
    setAttempt((a) => ({ ...a, [stage === "words" ? "wordsDone" : "shadowDone"]: true }));
    goTo(stage === "words" ? 1 : 2);
  }

  const disableAi = useCallback(() => {
    setAiOff(true);
    notify(AI_UNAVAILABLE);
  }, [notify]);

  async function startPractice() {
    await media.requestMicrophone();
    const r = await api<{ practice: PracticeView; serverTime: number }>("/api/practice/start", { attempt_id: attempt.id });
    offsetRef.current = r.serverTime - Date.now();
    setPractice(r.practice);
    setAiOff(false);
    setAttempt((a) => (a.completed ? { ...a, completed: false, summary: null } : a));
  }

  /** The session row is gone (e.g. abandoned by a reload racing the new page); offer a fresh start. */
  const losePractice = useCallback(() => {
    liveIdRef.current = null;
    media.stopAll();
    setPractice(null);
    notify("Phiên luyện tập đã kết thúc. Hãy bắt đầu phiên mới.");
  }, [media, notify]);

  function applyTurn(r: TurnResult) {
    offsetRef.current = r.serverTime - Date.now();
    setPractice((p) => (p ? { ...p, turns: r.turns } : p));
    if (r.ai_off && !demo && !aiOff) disableAi();
  }

  async function sendTurn(text: string) {
    if (!practice) return;
    let r: TurnResult;
    try {
      r = await api("/api/practice/turn", {
        session_id: practice.id,
        text,
        input_mode: "voice",
        ai_off: aiOff,
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) losePractice();
      throw e;
    }
    applyTurn(r);
  }

  async function finish() {
    media.stopAll();
    const summary = await api<Summary>("/api/complete", { attempt_id: attempt.id, ai_off: aiOff });
    setAttempt((a) => ({ ...a, completed: true, summary }));
    setPractice((p) => (p ? { ...p, ended: true } : p));
    goTo(3);
    // A bare refresh lets /lesson open the next day (new key, remount at step 1); pin this day instead.
    router.replace(`/lesson?day=${attempt.day}`);
  }

  const left = remaining();
  const { lesson } = attempt;
  const stepDone = [attempt.wordsDone, attempt.shadowDone, false, attempt.completed];

  return (
    <section className="animate-fade-in mx-auto w-full max-w-[1000px] pb-12">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border-2 border-black bg-gray-100 p-5 text-navy shadow-(--ww-frame-shadow) md:items-center md:p-7">
        <div className="min-w-0 flex-1 basis-64">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600">
            <span className="size-2 rounded-full bg-gold" />
            Buổi {attempt.day} · {contextLabel}
          </div>
          <h1 className="mt-2 mb-1.5 text-2xl font-extrabold tracking-tight md:text-3xl">{lesson.title}</h1>
          <p className="text-sm text-ink-secondary md:text-base">{lesson.goal}</p>
          {attempt.focus && (
            <div className="mt-3 inline-flex items-start gap-1.5 rounded-lg border border-gold/50 bg-gold-soft px-3 py-1.5 text-xs font-semibold text-amber-800 md:text-sm">
              <span aria-hidden>✦</span>
              <span className="min-w-0">Trọng tâm: {attempt.focus}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-gold/50 bg-white px-4 py-3">
          <div className="text-2xl font-black tabular-nums text-amber-600 md:text-3xl">
            {practice?.ended ? "Đã xong" : mounted ? clock(left) : clock(DAILY_SECONDS)}
          </div>
          <div className="text-[10px] font-bold uppercase leading-tight tracking-wider text-muted">
            Phiên nói
            <br />3 phút
          </div>
        </div>
      </header>

      <nav className="my-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3" aria-label="Các phần bài học">
        {STEPS.map((title, i) => {
          const [num, label] = title.split(". ");
          const active = step === i;
          return (
            <button
              key={title}
              type="button"
              onClick={() => goTo(i)}
              aria-current={active ? "step" : undefined}
              className={`flex min-h-12 items-center gap-2.5 rounded-xl border-[1.5px] px-3 py-2.5 text-left text-xs font-semibold transition-all duration-200 md:text-sm ${
                active ? "border-black bg-navy text-white shadow-sm" : "border-black bg-white text-navy hover:bg-navy-soft/50"
              }`}
            >
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  stepDone[i] ? "bg-gold text-white" : active ? "bg-white/15 text-gold-light" : "bg-navy-soft text-navy"
                }`}
              >
                {stepDone[i] ? "✓" : num}
              </span>
              <span className="min-w-0">{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="rounded-2xl border-2 border-black bg-white p-4 shadow-(--ww-frame-shadow) sm:p-6 md:p-8">
        {step === 0 && <WordsStep lesson={lesson} audio={audio} media={media} onNext={() => checkpoint("words")} onError={notify} />}
        {step === 1 && (
          <ShadowStep lesson={lesson} serverAudio={audio.lines} lineUrls={audio.lineUrls} media={media} onNext={() => checkpoint("shadow")} onError={notify} />
        )}
        {step === 2 && (
          <PracticeStep
            lesson={lesson}
            practice={practice}
            expired={Boolean(practice && left <= 0)}
            remaining={remaining}
            demo={demo || aiOff}
            media={media}
            onAiFail={disableAi}
            onLost={losePractice}
            onStart={startPractice}
            onSend={sendTurn}
            onVoiceTurn={applyTurn}
            onFinish={finish}
            onError={notify}
          />
        )}
        {step === 3 && (
          <SummaryStep
            summary={attempt.summary}
            frameCount={lesson.frames.length}
            week={week}
            onBack={() => goTo(0)}
            onHome={() => {
              media.stopAll();
              router.push("/today");
            }}
          />
        )}
      </div>

      {/* Floating Notification Toast */}
      <div
        role="status"
        aria-live="polite"
        className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-navy px-6 py-3.5 text-sm font-medium text-white shadow-xl transition-all duration-300 ${
          toast ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        {toast}
      </div>
    </section>
  );
}
