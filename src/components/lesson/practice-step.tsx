"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { api, ApiError, errorMessage } from "@/client/api";
import { framesUsed } from "@/domain/frames";
import { AI_UNAVAILABLE } from "@/lib/errors";
import type { Lesson, PracticeView, Turn } from "@/domain/types";
import type { TurnResult } from "./lesson-player";
import { SectionHeading } from "@/components/section-heading";
import { useAction } from "./use-action";
import { speechRecognition, type useMedia } from "./use-media";

type Props = {
  lesson: Lesson;
  practice: PracticeView | null;
  expired: boolean;
  remaining: () => number;
  demo: boolean;
  media: ReturnType<typeof useMedia>;
  onAiFail: () => void;
  onLost: () => void;
  onStart: () => Promise<void>;
  onSend: (text: string) => Promise<void>;
  onVoiceTurn: (r: TurnResult) => void;
  onFinish: () => Promise<void>;
  onError: (message: string) => void;
};

export function PracticeStep({ lesson, practice, expired, remaining, demo, media, onAiFail, onLost, onStart, onSend, onVoiceTurn, onFinish, onError }: Props) {
  const { pending, run } = useAction(onError);
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [canVoice, setCanVoice] = useState(!demo);
  const holdingRef = useRef(false);
  const recognizingRef = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const recording = media.recording === "voice";
  const turns = practice?.turns ?? [];
  const said = turns.filter((t) => t.role === "user");
  const shown = turns.slice(1);
  const opening = turns.find((t) => t.role === "assistant")?.text ?? lesson.roleplay.opening;
  const used = framesUsed(
    lesson.frames,
    said.map((t) => t.text),
  );
  const ended = Boolean(practice && (practice.ended || expired));

  useEffect(() => setCanVoice(!demo || Boolean(speechRecognition())), [demo]);
  useEffect(() => {
    if (!ended) return;
    holdingRef.current = false;
    recognizingRef.current = false;
  }, [ended]);
  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [turns.length, draft]);

  async function save(text: string) {
    const value = text.trim();
    if (!value) {
      setStatus("Chưa nghe rõ. Giữ nút và nói lại nhé.");
      return;
    }
    setBusy(true);
    try {
      await onSend(value);
      setStatus("");
    } catch (e) {
      setStatus(errorMessage(e));
    } finally {
      setDraft("");
      setBusy(false);
    }
  }

  async function transcribe(blob: Blob) {
    if (!practice) return;
    setBusy(true);
    setStatus("Đang xử lý…");
    try {
      const r = await api<Omit<TurnResult, "turns"> & { turns: Turn[] | null }>("/api/transcribe", blob, {
        headers: { "Content-Type": blob.type.split(";")[0], "X-Practice-Id": practice.id },
      });
      setBusy(false);
      if (!r.turns) {
        setStatus("Chưa nghe rõ. Giữ nút và nói lại nhé.");
        return;
      }
      setStatus("");
      onVoiceTurn({ ...r, turns: r.turns });
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiError && e.status === 404) {
        setStatus("");
        onLost();
      } else if (e instanceof ApiError && e.status < 500) {
        setStatus(e.message);
      } else {
        onAiFail();
        setStatus(`${AI_UNAVAILABLE} Giữ nút và nói lại để chuyển sang chế độ trò chuyện cơ bản.`);
      }
    }
  }

  async function press() {
    if (holdingRef.current || ended || busy || remaining() <= 0) return;
    holdingRef.current = true;
    setStatus("Đang ghi âm… thả nút khi nói xong.");
    try {
      if (demo) {
        recognizingRef.current = true;
        media.toggleRecognition(setDraft, setStatus, (text, failed) => {
          recognizingRef.current = false;
          holdingRef.current = false;
          if (failed) setDraft("");
          else void save(text);
        });
      } else {
        await media.startRecording("voice", (blob) => void transcribe(blob), remaining() * 1000);
      }
    } catch (e) {
      holdingRef.current = false;
      recognizingRef.current = false;
      setStatus(errorMessage(e));
    }
  }

  function release() {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    if (demo) {
      if (recognizingRef.current) media.toggleRecognition(setDraft, setStatus);
    } else {
      media.stopRecording();
    }
  }

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    void press();
  }

  function onKey(e: KeyboardEvent<HTMLButtonElement>, down: boolean) {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    if (down && !e.repeat) void press();
    if (!down) release();
  }

  return (
    <>
      <SectionHeading level={2} title="Đến lượt bạn nói." badge={<span className="badge badge-gold">3 PHÚT</span>} />

      <div className="mb-10 grid gap-3 md:grid-cols-2">
        <div className="min-w-0 rounded-xl border-[1.5px] border-black bg-navy-soft/60 p-4 text-sm leading-relaxed">
          <p className="mb-2 border-b-[1.5px] border-black pb-2 text-[11px] font-bold uppercase tracking-wider text-black">Tình huống</p>
          <p className="text-ink">
            Bạn nói chuyện với <b className="text-navy">{lesson.roleplay.role}</b>.
          </p>
          <p className="mt-2 rounded-lg bg-white px-3 py-2 font-semibold text-navy">
            <span className="mr-1 text-gold">★</span>Nhiệm vụ: {lesson.roleplay.goal}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border-[1.5px] border-black bg-white p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b-[1.5px] border-black pb-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-black">Mẫu câu cần dùng</p>
            <span className="badge badge-gold">
              {used.filter(Boolean).length}/{lesson.frames.length}
            </span>
          </div>
          <ul className="grid gap-1.5 text-sm">
            {lesson.frames.map((f, i) => (
              <li key={f} className={`flex items-start gap-2 ${used[i] ? "font-semibold text-navy" : "text-muted"}`}>
                <span
                  className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full text-[10px] ${
                    used[i] ? "bg-gold text-white" : "border-[1.5px] border-black"
                  }`}
                  aria-hidden
                >
                  {used[i] ? "✓" : ""}
                </span>
                <span className="min-w-0">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <SectionHeading index={1} title="Hội thoại với AI">
        Giữ nút micro và nói bằng tiếng Anh, thả ra khi nói xong. Lời bạn nói sẽ hiện thành chữ bên dưới.
      </SectionHeading>

      {!practice ? (
        <div className="rounded-xl bg-navy px-5 py-10 text-center text-white sm:py-12">
          <h3 className="mb-2 text-lg font-bold">Sẵn sàng cho tình huống hôm nay?</h3>
          <p className="mb-5 text-sm text-white/70">Chuẩn bị micro trước khi bắt đầu.</p>
          <button type="button" className="btn btn-gold" disabled={pending} onClick={() => run(onStart)}>
            Bắt đầu phiên 3 phút →
          </button>
        </div>
      ) : (
        <>
          <p className="rounded-lg border-l-4 border-gold bg-gold-soft/50 px-3 py-2 text-sm text-ink-secondary">
            <b className="text-navy">Gợi ý mở đầu:</b> <i className="font-medium text-ink">“{opening}”</i>
          </p>
          <div
            ref={boxRef}
            className="my-4 flex min-h-[160px] max-h-[390px] flex-col gap-3 overflow-auto rounded-xl border-[1.5px] border-black bg-navy-soft/40 p-3 sm:p-4"
            aria-live="polite"
          >
            {shown.length === 0 && !draft && <p className="m-auto text-sm text-muted">Nội dung bạn nói sẽ hiện ở đây.</p>}
            {shown.map((t, i) =>
              t.role === "user" ? (
                <p key={i} className="min-w-0 max-w-[85%] self-end rounded-[14px_14px_3px_14px] bg-navy px-4 py-2.5 leading-[1.55] text-white">
                  {t.text}
                </p>
              ) : (
                <p
                  key={i}
                  className="min-w-0 max-w-[85%] self-start rounded-[14px_14px_14px_3px] border-[1.5px] border-black bg-white px-4 py-2.5 leading-[1.55] text-ink"
                >
                  {t.text}
                </p>
              ),
            )}
            {draft && (
              <p className="min-w-0 max-w-[85%] self-end rounded-[14px_14px_3px_14px] bg-navy/60 px-4 py-2.5 italic text-white">{draft}</p>
            )}
          </div>

          {!ended && canVoice && (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                className={`grid size-24 touch-none select-none place-items-center rounded-full text-3xl text-white shadow-md transition ${
                  recording ? "scale-110 bg-red-500 ring-8 ring-red-500/20" : "bg-navy ring-4 ring-gold/60 hover:bg-navy-light"
                } disabled:opacity-50`}
                aria-label="Giữ để nói"
                disabled={busy}
                onPointerDown={onPointerDown}
                onPointerUp={release}
                onPointerCancel={release}
                onContextMenu={(e) => e.preventDefault()}
                onKeyDown={(e) => onKey(e, true)}
                onKeyUp={(e) => onKey(e, false)}
                onBlur={release}
              >
                {recording ? "■" : "🎙"}
              </button>
              <b className="text-sm text-navy">{recording ? "Đang ghi âm… thả để dừng" : busy ? "Đang xử lý…" : "Giữ để nói"}</b>
            </div>
          )}
          {!canVoice && <div className="note">Trình duyệt chưa hỗ trợ ghi âm. Hãy dùng Chrome hoặc Edge.</div>}
          <div className="legal text-center" role="status">
            {status}
          </div>

          {ended && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border-[1.5px] border-black bg-gold-soft/50 px-4 py-3 text-sm">
              <b className="text-navy">Phiên nói 3 phút đã kết thúc.</b>
              <button type="button" className="btn btn-outline" disabled={pending} onClick={() => run(onStart)}>
                ↺ Làm lại phiên 3 phút
              </button>
            </div>
          )}
          <div className="mt-10 border-t-2 border-black pt-6">
            <button type="button" className="btn w-full sm:w-auto" disabled={pending || busy || recording} onClick={() => run(onFinish)}>
              {pending ? "Đang tổng kết…" : "Kết thúc & xem tổng kết →"}
            </button>
            <p className="legal mt-5">Hoàn thành phần từ vựng và shadowing trước khi xem tổng kết.</p>
          </div>
        </>
      )}
    </>
  );
}
