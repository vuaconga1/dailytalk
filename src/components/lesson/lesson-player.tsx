"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/client/api";
import type { AttemptView, PracticeView, Summary, Turn, WeekReview } from "@/domain/types";
import { PracticeStep } from "./practice-step";
import { ShadowStep } from "./shadow-step";
import { SummaryStep } from "./summary-step";
import { useMedia } from "./use-media";
import { WordsStep } from "./words-step";

const DAILY_SECONDS = 180;
const STEPS = ["01. Từ & mẫu câu", "02. Shadowing", "03. Hội thoại AI", "04. Tổng kết"];

type Props = { initial: AttemptView; week: WeekReview; serverTime: number; demo: boolean; contextLabel: string };

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function LessonPlayer({ initial, week, serverTime, demo, contextLabel }: Props) {
  const router = useRouter();
  const media = useMedia();
  const [attempt, setAttempt] = useState(initial);
  const [practice, setPractice] = useState<PracticeView | null>(initial.practice);
  const [step, setStep] = useState(initial.completed ? 3 : 0);
  const [mounted, setMounted] = useState(false);
  const [, setTick] = useState(0);
  const [toast, setToast] = useState("");
  const offsetRef = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    offsetRef.current = serverTime - Date.now();
    setMounted(true);
  }, [serverTime]);

  const remaining = useCallback(() => {
    if (!practice) return DAILY_SECONDS;
    if (practice.ended) return 0;
    return Math.max(0, Math.ceil((practice.deadline - (Date.now() + offsetRef.current)) / 1000));
  }, [practice]);

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

  async function startPractice() {
    const r = await api<{ practice: PracticeView; serverTime: number }>("/api/practice/start", { attempt_id: attempt.id });
    offsetRef.current = r.serverTime - Date.now();
    setPractice(r.practice);
    setAttempt((a) => (a.completed ? { ...a, completed: false, summary: null } : a));
  }

  async function sendTurn(text: string) {
    if (!practice) return;
    const r = await api<{ turns: Turn[]; serverTime: number }>("/api/practice/turn", {
      session_id: practice.id,
      text,
      input_mode: "voice",
      record_only: true,
    });
    offsetRef.current = r.serverTime - Date.now();
    setPractice((p) => (p ? { ...p, turns: r.turns } : p));
  }

  async function finish() {
    media.stopAll();
    const summary = await api<Summary>("/api/complete", { attempt_id: attempt.id });
    setAttempt((a) => ({ ...a, completed: true, summary }));
    setPractice((p) => (p ? { ...p, ended: true } : p));
    goTo(3);
    router.refresh();
  }

  const left = remaining();
  const { lesson } = attempt;
  const stepDone = [attempt.wordsDone, attempt.shadowDone, false, attempt.completed];

  return (
    <section className="animate-fade-in mx-auto w-full max-w-[1000px] pb-12">
      {/* Top Header Row with Timer */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-[#e2e8f4] pb-5 md:items-center">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <span className="size-2 rounded-full bg-gold" />
            BUỔI {attempt.day} · {contextLabel}
          </div>
          <h1 className="my-1.5 text-2xl md:text-3xl font-extrabold text-navy tracking-tight">
            {lesson.title}
          </h1>
          <p className="text-sm md:text-base text-slate-600">{lesson.goal}</p>
          {attempt.focus && (
            <div className="mt-2 inline-flex items-center gap-1.5 text-xs md:text-sm font-semibold text-amber-900 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200/70">
              <span>✦</span> Trọng tâm buổi học: {attempt.focus}
            </div>
          )}
        </div>

        {/* 5-Minute Practice Clock */}
        <div className="flex items-center gap-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/80 px-4 py-3 text-amber-900 shadow-xs">
          <div className="text-2xl font-black tabular-nums md:text-3xl">
            {practice?.ended ? "Đã xong" : mounted ? clock(left) : clock(DAILY_SECONDS)}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 leading-tight">
            Phiên nói
            <br />
            3 phút
          </div>
        </div>
      </div>

      {/* Modern Stepper Navigation */}
      <nav className="my-6 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3" aria-label="Các phần bài học">
        {STEPS.map((title, i) => (
          <button
            key={title}
            type="button"
            onClick={() => goTo(i)}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs md:text-sm font-semibold transition-all duration-200 ${
              step === i
                ? "bg-navy text-white shadow-sm ring-2 ring-navy/10 scale-[1.02]"
                : "bg-white border border-[#e2e8f4] text-slate-600 hover:bg-slate-50 hover:text-navy"
            } ${stepDone[i] ? "border-b-4 border-b-emerald-500" : ""}`}
          >
            {stepDone[i] && (
              <span className="text-emerald-500 font-bold">✓</span>
            )}
            <span>{title}</span>
          </button>
        ))}
      </nav>

      {/* Step Workspace Card */}
      <div className="rounded-2xl border border-[#e2e8f4] bg-white p-6 md:p-8 shadow-xs">
        {step === 0 && <WordsStep lesson={lesson} media={media} onNext={() => checkpoint("words")} onError={notify} />}
        {step === 1 && (
          <ShadowStep lesson={lesson} demo={demo} media={media} onNext={() => checkpoint("shadow")} onError={notify} />
        )}
        {step === 2 && (
          <PracticeStep
            lesson={lesson}
            practice={practice}
            expired={Boolean(practice && left <= 0)}
            remaining={remaining}
            demo={demo}
            media={media}
            onStart={startPractice}
            onSend={sendTurn}
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
