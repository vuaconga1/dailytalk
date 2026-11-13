"use client";

import { useEffect, useRef, useState } from "react";
import { frameIndexIn } from "@/domain/frames";
import type { Lesson } from "@/domain/types";
import { KaraokeLine } from "./karaoke-line";
import { SectionHeading } from "@/components/section-heading";
import { useAction } from "./use-action";
import { useKaraoke } from "./use-karaoke";
import type { useMedia } from "./use-media";

type Props = {
  lesson: Lesson;
  serverAudio: boolean;
  lineUrls: (string | null)[];
  media: ReturnType<typeof useMedia>;
  onNext: () => Promise<void>;
  onError: (message: string) => void;
};

const SHADOW_STEPS = [
  ["Nghe", "Nghe cả đoạn một lượt."],
  ["Luyện", "Luyện từng câu, chạm vào từ để nghe từ đó."],
  ["Nói", "Nói liền mạch vai B của bạn."],
] as const;

export function ShadowStep({ lesson, serverAudio, lineUrls, media, onNext, onError }: Props) {
  const { pending, run } = useAction(onError);
  const [rate, setRate] = useState(1);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const recording = media.recording === "shadow";

  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const k = useKaraoke({
    lessonId: lesson.id,
    lines: lesson.dialogue,
    serverAudio,
    lineUrls,
    rate,
    media,
    onError,
  });

  useEffect(() => () => void (recordingUrl && URL.revokeObjectURL(recordingUrl)), [recordingUrl]);

  // Auto-scroll card into view when active line changes
  useEffect(() => {
    if (k.lineIndex >= 0 && k.lineIndex < lesson.dialogue.length) {
      cardRefs.current[k.lineIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [k.lineIndex, lesson.dialogue.length]);

  async function toggleRecord() {
    k.stop();
    await media.toggleRecording("shadow", (blob) => {
      setRecordingUrl(URL.createObjectURL(blob));
      setStatus("Bản ghi ở trên thiết bị. Nghe lại và so sánh với câu mẫu.");
    });
    if (!recording) setStatus("Đang ghi âm · tối đa 45 giây. Chạm Dừng khi nói xong.");
  }

  return (
    <>
      <SectionHeading level={2} title="Nghe. Nói theo. Nghe lại." badge={<span className="badge badge-gold">5 PHÚT</span>} />
      <ol className="mb-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {SHADOW_STEPS.map(([title, text], i) => (
          <li key={title} className="flex h-full min-w-0 items-start gap-3 rounded-xl border-[1.5px] border-black bg-white p-4">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gold text-sm font-bold text-white">{i + 1}</span>
            <div className="min-w-0">
              <b className="block text-navy">{title}</b>
              <p className="mt-0.5 text-sm leading-snug text-ink-secondary">{text}</p>
            </div>
          </li>
        ))}
      </ol>

      <SectionHeading
        index={1}
        title="Đoạn hội thoại"
        badge={
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-ink-secondary">
            <span className="flex items-center gap-1.5">
              <span className="grid size-5 place-items-center rounded-full bg-navy-soft text-[10px] font-bold text-navy">A</span> Người đối thoại
            </span>
            <span className="flex items-center gap-1.5">
              <span className="grid size-5 place-items-center rounded-full bg-gold text-[10px] font-bold text-white">B</span> Vai của bạn
            </span>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border-[1.5px] border-black bg-navy-soft/60 p-2.5 sm:gap-3">
        <button type="button" className="btn grow sm:grow-0" onClick={() => (k.playing ? k.stop() : void k.playAll())}>
          {k.playing ? "■ Dừng nghe" : "▶ Nghe cả đoạn"}
        </button>

        <div className="inline-flex items-center rounded-lg border-[1.5px] border-black bg-white p-0.5">
          <button
            type="button"
            className="min-h-9 rounded-md px-2.5 text-xs font-semibold text-navy hover:bg-navy-soft disabled:opacity-40"
            disabled={k.lineIndex <= 0}
            onClick={k.prev}
            title="Câu trước (phím ←)"
          >
            ◀ Trước
          </button>
          <button
            type="button"
            className="min-h-9 rounded-md px-2.5 text-xs font-semibold text-navy hover:bg-navy-soft"
            onClick={k.replay}
            title="Nghe lại câu hiện tại (phím R)"
          >
            ↺ Lại
          </button>
          <button
            type="button"
            className="min-h-9 rounded-md px-2.5 text-xs font-semibold text-navy hover:bg-navy-soft disabled:opacity-40"
            disabled={k.lineIndex >= lesson.dialogue.length - 1}
            onClick={k.next}
            title="Câu sau (phím →)"
          >
            Sau ▶
          </button>
        </div>

        <label className="flex items-center gap-2 text-xs font-semibold text-navy">
          <span className="sr-only sm:not-sr-only">Tốc độ</span>
          <select
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="min-h-9 rounded-lg border-[1.5px] border-black bg-white px-2 text-sm text-navy"
            aria-label="Tốc độ"
          >
            <option value={0.8}>0.8× chậm</option>
            <option value={1}>1× thường</option>
          </select>
        </label>
      </div>
      <p className="mt-2 hidden text-xs text-muted lg:block">Phím tắt: Space phát/dừng · ← / → chuyển câu · R nghe lại</p>

      <div className="mt-4 mb-10 grid gap-2.5">
        {lesson.dialogue.map((line, i) => {
          const learner = i % 2 === 1;
          const frame = learner ? frameIndexIn(lesson.frames, line) : -1;
          const isActive = i === k.lineIndex;
          return (
            <div
              key={i}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className={`flex items-center gap-2.5 rounded-xl border-[1.5px] p-3 transition-all duration-200 md:gap-3 md:p-4 ${
                isActive
                  ? "border-gold bg-gold-soft/40 shadow-sm ring-2 ring-gold/40"
                  : learner
                    ? "border-black bg-navy-soft/50"
                    : "border-black bg-white"
              }`}
            >
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  learner ? "bg-gold text-white" : "bg-navy-soft text-navy"
                }`}
              >
                {learner ? "B" : "A"}
              </span>
              <div className="min-w-0 flex-1">
                {isActive ? (
                  <KaraokeLine text={line} activeWord={k.wordIndex} onWordClick={(w) => void k.playFromWord(i, w)} />
                ) : (
                  <p className={`text-sm md:text-base ${learner ? "font-semibold text-navy" : "text-ink"}`}>{line}</p>
                )}
                {frame >= 0 && (
                  <span className="mt-1.5 inline-block rounded-md bg-navy px-2 py-0.5 text-[11px] font-semibold text-gold-light">
                    Mẫu câu {frame + 1}
                  </span>
                )}
              </div>
              <button
                type="button"
                className={`grid size-10 shrink-0 place-items-center rounded-full border text-sm transition ${
                  isActive ? "border-navy bg-navy text-white" : "border-black bg-white text-navy hover:bg-gold-soft"
                }`}
                aria-label={`Nghe câu ${i + 1}`}
                onClick={() => (k.playing && isActive ? k.stop() : void k.playLine(i))}
              >
                {k.playing && isActive ? "■" : "▶"}
              </button>
            </div>
          );
        })}
      </div>

      <SectionHeading index={2} title="Nghe lại giọng của mình" />
      <div className="rounded-xl border-[1.5px] border-dashed border-black bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 text-sm text-ink-secondary">Ghi âm giọng của bạn và so sánh với câu mẫu.</p>
          <button type="button" className="btn btn-outline" onClick={() => run(toggleRecord)}>
            {recording ? "■ Dừng ghi âm" : "● Ghi âm thử"}
          </button>
        </div>
        {recordingUrl && <audio controls src={recordingUrl} className="mt-4 h-[38px] max-w-full" />}
        <div role="status" className="legal">
          {status}
        </div>
      </div>

      <div className="mt-10 border-t-2 border-black pt-6">
        <button
          type="button"
          className="btn w-full sm:w-auto"
          disabled={pending}
          onClick={() =>
            run(async () => {
              k.stop();
              await onNext();
            })
          }
        >
          Tôi đã nghe và luyện shadowing →
        </button>
      </div>
    </>
  );
}
