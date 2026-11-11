"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { api, errorMessage } from "@/client/api";
import { framesUsed } from "@/domain/frames";
import { AI_UNAVAILABLE } from "@/lib/errors";
import type { Lesson, PracticeView } from "@/domain/types";
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
  onStart: () => Promise<void>;
  onSend: (text: string) => Promise<void>;
  onFinish: () => Promise<void>;
  onError: (message: string) => void;
};

export function PracticeStep({ lesson, practice, expired, remaining, demo, media, onAiFail, onStart, onSend, onFinish, onError }: Props) {
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
    setStatus("Đang nhận dạng giọng nói…");
    try {
      const r = await api<{ text: string }>("/api/transcribe", blob, {
        headers: { "Content-Type": blob.type.split(";")[0], "X-Practice-Id": practice.id },
      });
      await save(r.text);
    } catch {
      onAiFail();
      setStatus(`${AI_UNAVAILABLE} Giữ nút và nói lại để chuyển sang chế độ trò chuyện cơ bản.`);
      setBusy(false);
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
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[25px] font-bold tracking-[-0.5px]">Đến lượt bạn nói.</h2>
        <span className="badge badge-gold">3 PHÚT</span>
      </div>
      <p className="mb-4 text-muted">
        Tình huống: bạn nói chuyện với <b className="text-ink">{lesson.roleplay.role}</b>. Nhiệm vụ của bạn: {lesson.roleplay.goal}
      </p>
      <div className="note">Giữ nút ghi âm và nói bằng tiếng Anh, thả ra khi nói xong. Lời bạn nói sẽ được chuyển thành chữ bên dưới.</div>
      <div className="mt-4 rounded-xl border border-line p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <b className="text-sm">Mẫu câu cần dùng</b>
          <span className="badge">
            {used.filter(Boolean).length}/{lesson.frames.length}
          </span>
        </div>
        <ul className="grid gap-1.5 text-sm md:grid-cols-2">
          {lesson.frames.map((f, i) => (
            <li key={f} className={used[i] ? "font-semibold text-teal" : "text-muted"}>
              {used[i] ? "✓" : "○"} {f}
            </li>
          ))}
        </ul>
      </div>

      {!practice ? (
        <div className="p-11 text-center text-muted">
          <h3 className="mb-2 text-lg font-bold text-ink">Sẵn sàng cho tình huống hôm nay?</h3>
          <p className="mb-4">Chuẩn bị micro trước khi bắt đầu.</p>
          <button type="button" className="btn" disabled={pending} onClick={() => run(onStart)}>
            Bắt đầu phiên 3 phút →
          </button>
        </div>
      ) : (
        <>
          <p className="mt-5 text-sm text-muted">
            Gợi ý mở đầu: <i className="text-ink">“{opening}”</i>
          </p>
          <div
            ref={boxRef}
            className="my-4 flex min-h-[160px] max-h-[390px] flex-col gap-3 overflow-auto rounded-xl bg-surface p-4"
            aria-live="polite"
          >
            {shown.length === 0 && !draft && <p className="m-auto text-sm text-muted">Nội dung bạn nói sẽ hiện ở đây.</p>}
            {shown.map((t, i) =>
              t.role === "user" ? (
                <p key={i} className="min-w-0 self-end rounded-[14px_14px_3px_14px] bg-[#dff1eb] px-[18px] py-3 leading-[1.55]">
                  {t.text}
                </p>
              ) : (
                <p key={i} className="min-w-0 self-start rounded-[14px_14px_14px_3px] border border-line bg-white px-[18px] py-3 leading-[1.55]">
                  {t.text}
                </p>
              ),
            )}
            {draft && <p className="min-w-0 self-end rounded-[14px_14px_3px_14px] bg-[#dff1eb]/60 px-[18px] py-3 italic">{draft}</p>}
          </div>

          {!ended && canVoice && (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                className={`grid size-24 touch-none select-none place-items-center rounded-full text-3xl text-white shadow-md transition ${
                  recording ? "scale-110 bg-red-500 ring-8 ring-red-500/20" : "bg-navy hover:bg-navy/90"
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
              <b className="text-sm">{recording ? "Đang ghi âm… thả để dừng" : busy ? "Đang xử lý…" : "Giữ để nói"}</b>
            </div>
          )}
          {!canVoice && <div className="note">Trình duyệt chưa hỗ trợ ghi âm. Hãy dùng Chrome hoặc Edge.</div>}
          <div className="legal text-center" role="status">
            {status}
          </div>

          {ended && (
            <div className="note mt-5 flex flex-wrap items-center justify-between gap-3">
              <span>Phiên nói 3 phút đã kết thúc.</span>
              <button type="button" className="btn btn-outline" disabled={pending} onClick={() => run(onStart)}>
                ↺ Làm lại phiên 3 phút
              </button>
            </div>
          )}
          <div className="mt-6 border-t border-line pt-5">
            <button type="button" className="btn" disabled={pending || busy || recording} onClick={() => run(onFinish)}>
              {pending ? "Đang tổng kết…" : "Kết thúc & xem tổng kết →"}
            </button>
            <p className="legal mt-5">Hoàn thành phần từ vựng và shadowing trước khi xem tổng kết.</p>
          </div>
        </>
      )}
    </>
  );
}
