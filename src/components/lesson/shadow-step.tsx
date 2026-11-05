"use client";

import { useEffect, useState } from "react";
import { frameIndexIn } from "@/lib/frames";
import type { Lesson } from "@/lib/types";
import { useAction } from "./use-action";
import type { useMedia } from "./use-media";

type Props = {
  lesson: Lesson;
  demo: boolean;
  media: ReturnType<typeof useMedia>;
  onNext: () => Promise<void>;
  onError: (message: string) => void;
};

export function ShadowStep({ lesson, demo, media, onNext, onError }: Props) {
  const { pending, run } = useAction(onError);
  const [rate, setRate] = useState(1);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const recording = media.recording === "shadow";

  useEffect(() => () => void (recordingUrl && URL.revokeObjectURL(recordingUrl)), [recordingUrl]);

  async function play(line: "all" | number) {
    const text = line === "all" ? lesson.dialogue.join(" ") : lesson.dialogue[line];
    if (demo) return media.speak(text, rate);
    onError("Đang chuẩn bị audio…");
    try {
      await media.playUrl(`/api/audio?lesson=${encodeURIComponent(lesson.id)}&line=${line}`, rate);
      onError("");
    } catch {
      throw new Error("Chưa phát được audio. Vui lòng thử lại.");
    }
  }

  async function toggleRecord() {
    await media.toggleRecording("shadow", (blob) => {
      setRecordingUrl(URL.createObjectURL(blob));
      setStatus("Bản ghi ở trên thiết bị. Nghe lại và so sánh với câu mẫu.");
    });
    if (!recording) setStatus("Đang ghi âm · tối đa 45 giây. Chạm Dừng khi nói xong.");
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[25px] font-bold tracking-[-0.5px]">Nghe. Nói theo. Nghe lại.</h2>
        <span className="badge">5 PHÚT</span>
      </div>
      <p className="mb-4 text-muted">
        Nghe một lượt, luyện từng câu, rồi thử nói liền mạch. A là người đối thoại, B là vai của bạn; câu có nhãn “Mẫu câu” là chỗ bạn luyện
        các mẫu câu vừa học.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn" onClick={() => run(() => play("all"))}>
          ▶ Nghe cả đoạn
        </button>
        <label htmlFor="speed" className="text-[13px] font-semibold">
          Tốc độ
        </label>
        <select id="speed" value={rate} onChange={(e) => setRate(Number(e.target.value))} className="rounded-lg border border-line p-2.5">
          <option value={0.8}>Chậm · 0.8×</option>
          <option value={1}>Bình thường · 1×</option>
        </select>
        <small className="text-muted">Giọng đọc tiếng Anh chuẩn</small>
      </div>
      <div className="my-[22px] grid gap-[13px]">
        {lesson.dialogue.map((line, i) => {
          const frame = i % 2 ? frameIndexIn(lesson.frames, line) : -1;
          return (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-xl p-3 md:gap-3 md:p-[17px] ${i % 2 ? "bg-[#edf5f0]" : "bg-[#f2f6f8]"}`}
            >
              <span className="grid size-[30px] shrink-0 place-items-center rounded-full bg-white text-xs">{i % 2 ? "B" : "A"}</span>
              <div>
                <p className="text-sm md:text-base">{line}</p>
                {frame >= 0 && (
                  <span className="mt-1 inline-block rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-teal">
                    Mẫu câu {frame + 1}: {lesson.frames[frame]}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="btn btn-secondary ml-auto shrink-0 !p-2 md:!px-5 md:!py-3"
                aria-label={`Nghe câu ${i + 1}`}
                onClick={() => run(() => play(i))}
              >
                ▶
              </button>
            </div>
          );
        })}
      </div>
      <div className="mb-5 rounded-xl border border-dashed border-[#bbced4] bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <b>Nghe lại giọng của mình</b>
            <p className="legal">Ghi âm giọng của bạn và so sánh với câu mẫu.</p>
          </div>
          <button type="button" className="btn btn-outline" onClick={() => run(toggleRecord)}>
            {recording ? "■ Dừng ghi âm" : "● Ghi âm thử"}
          </button>
        </div>
        {recordingUrl && <audio controls src={recordingUrl} className="mt-4 h-[38px] max-w-full" />}
        <div role="status" className="legal">
          {status}
        </div>
      </div>
      <button type="button" className="btn" disabled={pending} onClick={() => run(onNext)}>
        Tôi đã nghe và luyện shadowing →
      </button>
    </>
  );
}
