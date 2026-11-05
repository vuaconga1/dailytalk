"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, errorMessage } from "@/lib/client-api";
import { framesUsed } from "@/lib/frames";
import type { Lesson, PracticeView } from "@/lib/types";
import { useAction } from "./use-action";
import { speechRecognition, type useMedia } from "./use-media";

type Props = {
  lesson: Lesson;
  practice: PracticeView | null;
  expired: boolean;
  remaining: () => number;
  demo: boolean;
  media: ReturnType<typeof useMedia>;
  onStart: () => Promise<void>;
  onSend: (text: string, inputMode: "voice" | "text") => Promise<void>;
  onFinish: () => Promise<void>;
  onError: (message: string) => void;
};

export function PracticeStep({ lesson, practice, expired, remaining, demo, media, onStart, onSend, onFinish, onError }: Props) {
  const { pending, run } = useAction(onError);
  const [text, setText] = useState("");
  const [voiceDraft, setVoiceDraft] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [chatError, setChatError] = useState("");
  const [sending, setSending] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [canVoice, setCanVoice] = useState(!demo);
  const chatRef = useRef<HTMLDivElement>(null);
  const recording = media.recording === "voice";
  const turns = practice?.turns ?? [];
  const used = framesUsed(
    lesson.frames,
    turns.filter((t) => t.role === "user").map((t) => t.text),
  );

  useEffect(() => setCanVoice(!demo || Boolean(speechRecognition())), [demo]);
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
  }, [turns.length]);

  function fillFromVoice(value: string) {
    setText(value);
    setVoiceDraft(true);
  }

  async function toggleVoice() {
    if (remaining() <= 0) return;
    if (demo) {
      media.toggleRecognition(fillFromVoice, setVoiceStatus);
      return;
    }
    if (!recording) setVoiceStatus("Đang ghi âm · tối đa 45 giây. Chạm Dừng khi nói xong.");
    await media.toggleRecording("voice", async (blob) => {
      if (remaining() <= 0 || !practice) {
        setVoiceStatus("Phiên đã hết giờ; bản ghi chưa được gửi.");
        return;
      }
      setTranscribing(true);
      setVoiceStatus("Đang nhận dạng. Kiểm tra câu trước khi gửi cho AI.");
      try {
        const r = await api<{ text: string }>("/api/transcribe", blob, {
          headers: {
            "Content-Type": blob.type.split(";")[0],
            "X-Practice-Id": practice.id,
          },
        });
        fillFromVoice(r.text);
        setVoiceStatus("Đã nhận dạng. Kiểm tra hoặc sửa, rồi bấm Gửi câu trả lời.");
      } catch (e) {
        setVoiceStatus(errorMessage(e));
      } finally {
        setTranscribing(false);
      }
    });
  }

  async function listen() {
    if (!practice || remaining() <= 0) return;
    if (demo) {
      const last = turns.filter((t) => t.role === "assistant").at(-1);
      if (last) media.speak(last.text, 1);
      return;
    }
    const blob = await api<Blob>("/api/reply-audio", {
      session_id: practice.id,
    });
    if (remaining() > 0) await media.playBlob(blob, 1);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setChatError("");
    const value = text.trim();
    if (!value) return setChatError("Hãy nhập hoặc ghi âm một câu.");
    if (expired) return setChatError("Phiên đã kết thúc. Hãy xem tổng kết.");
    setSending(true);
    try {
      await onSend(value, voiceDraft ? "voice" : "text");
      setText("");
      setVoiceDraft(false);
    } catch (err) {
      setChatError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[25px] font-bold tracking-[-0.5px]">Đến lượt bạn mở lời.</h2>
        <span className="badge badge-gold">TỐI ĐA 5 PHÚT</span>
      </div>
      <p className="mb-4 text-muted">
        AI đóng vai <b className="text-ink">{lesson.roleplay.role}</b>. Nhiệm vụ của bạn: {lesson.roleplay.goal}
      </p>
      <div className="note">
        Trả lời bằng tiếng Anh: bấm Ghi âm để nói hoặc nhập câu trả lời. AI Coach sẽ phản hồi và gợi ý ngay trong hội thoại.
      </div>
      <div className="mt-4 rounded-xl border border-line p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <b className="text-sm">Mẫu câu cần dùng trong hội thoại</b>
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
          <p className="mb-4">Chuẩn bị micro hoặc bàn phím trước khi bắt đầu.</p>
          <button type="button" className="btn" disabled={pending} onClick={() => run(onStart)}>
            Bắt đầu phiên 3 phút →
          </button>
        </div>
      ) : (
        <>
          <div ref={chatRef} className="my-4 flex max-h-[390px] flex-col gap-4 overflow-auto py-4" aria-live="polite">
            {turns.map((t, i) => (
              <div
                key={i}
                className={`max-w-[88%] px-[18px] py-[15px] leading-[1.55] ${
                  t.role === "user"
                    ? "self-end rounded-[14px_14px_3px_14px] bg-[#dff1eb]"
                    : "self-start rounded-[14px_14px_14px_3px] bg-[#f0f4f7]"
                }`}
              >
                <small className="mb-1 block text-[10px] text-muted">
                  {t.role === "user" ? `BẠN${t.input_mode === "voice" ? " · GIỌNG NÓI" : ""}` : "AI COACH"}
                </small>
                {t.text}
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-secondary" disabled={expired} onClick={() => run(listen)}>
            ▶ Nghe câu AI
          </button>
          <form onSubmit={onSubmit} className="mt-5">
            <div className="flex flex-wrap gap-2.5 md:flex-nowrap">
              <input
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setVoiceDraft(false);
                }}
                aria-label="Câu trả lời của bạn"
                placeholder="Nói hoặc nhập câu trả lời bằng tiếng Anh…"
                maxLength={1000}
                required
                disabled={expired}
                className="min-w-0 basis-full rounded-[9px] border border-line p-[13px] md:flex-1 md:basis-auto"
              />
              {canVoice && (
                <button
                  type="button"
                  className="btn btn-outline flex-1 md:flex-none"
                  disabled={expired || transcribing}
                  onClick={() => run(toggleVoice)}
                >
                  {recording ? "■ Dừng ghi âm" : "● Ghi âm"}
                </button>
              )}
              <button type="submit" className="btn flex-1 md:flex-none" disabled={expired || sending}>
                Gửi câu trả lời
              </button>
            </div>
            <div className="legal" role="status">
              {voiceStatus}
            </div>
            <div className="form-error" role="alert">
              {chatError}
            </div>
          </form>
          {expired && <div className="note mt-5">Phiên hội thoại đã kết thúc. Bấm “Kết thúc & xem tổng kết” để nhận phản hồi.</div>}
          <div className="mt-6 border-t border-line pt-5">
            <button type="button" className="btn" disabled={pending} onClick={() => run(onFinish)}>
              {pending ? "Đang tổng kết…" : "Kết thúc & xem tổng kết →"}
            </button>
            <p className="legal mt-5">Hoàn thành phần từ vựng và shadowing trước khi xem tổng kết.</p>
          </div>
        </>
      )}
    </>
  );
}
