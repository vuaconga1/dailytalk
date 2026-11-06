"use client";

import { PARTS_OF_SPEECH, usesFrame } from "@/domain/frames";
import type { Lesson } from "@/domain/types";
import type { LessonAudio } from "./lesson-player";
import { useAction } from "./use-action";
import type { useMedia } from "./use-media";

type Props = {
  lesson: Lesson;
  audio: LessonAudio;
  media: ReturnType<typeof useMedia>;
  onNext: () => Promise<void>;
  onError: (message: string) => void;
};

type Word = Lesson["vocabulary"][number];

export function WordsStep({ lesson, audio, media, onNext, onError }: Props) {
  const { pending, run } = useAction(onError);
  const learnerLines = lesson.dialogue.filter((_, i) => i % 2 === 1);
  const say = (text: string) => run(async () => media.speak(text, 0.9));
  const clip = (query: string) => `/api/audio?lesson=${encodeURIComponent(lesson.id)}&${query}`;
  const sayWord = (v: Word) => {
    const i = lesson.vocabulary.indexOf(v);
    return audio.words && i >= 0 ? run(() => media.playUrl(clip(`word=${i}`), 0.9)) : say(v.word);
  };
  const sayFrame = (frame: string, example: string | undefined) => {
    const line = example ? lesson.dialogue.indexOf(example) : -1;
    return audio.lines && line >= 0 ? run(() => media.playUrl(clip(`line=${line}`), 0.9)) : say(example ?? frame.replaceAll("…", ""));
  };
  const recap = lesson.recap;
  const range = recap?.days.length ? `ngày ${recap.days[0].day}–${recap.days[recap.days.length - 1].day}` : "";
  const otherFrames = recap?.frames.filter((f) => !lesson.frames.includes(f.frame)) ?? [];

  const wordCard = (v: Word, compact = false) => (
    <article key={`${v.day ?? ""}-${v.word}`} className={`rounded-xl border border-line bg-[#fbfdfd] ${compact ? "p-4" : "p-[22px]"}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className={`${compact ? "text-lg" : "text-[22px]"} font-bold`}>{v.word}</h3>
        <button
          type="button"
          className="btn btn-secondary shrink-0 !px-3 !py-1.5 text-xs"
          aria-label={`Nghe phát âm ${v.word}`}
          onClick={() => sayWord(v)}
        >
          ▶
        </button>
      </div>
      {(v.ipa || v.pos) && (
        <p className="mb-2 flex flex-wrap items-center gap-2 text-sm">
          {v.ipa && <span className="font-mono text-teal">/{v.ipa}/</span>}
          {v.pos && (
            <span className="rounded-md bg-[#eef3f6] px-2 py-0.5 text-[11px] font-semibold text-muted">
              {v.pos === "phrv" ? "phr. v" : v.pos}. · {PARTS_OF_SPEECH[v.pos]}
            </span>
          )}
        </p>
      )}
      <p className="text-sm text-ink">{v.meaning}</p>
      {!compact && v.example && <p className="mt-2 text-[13px] text-muted italic">“{v.example}”</p>}
    </article>
  );

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[25px] font-bold tracking-[-0.5px]">{recap ? `Ôn tập ${range}` : "Những từ bạn sẽ dùng hôm nay"}</h2>
        <span className="badge">
          {recap ? "KHÔNG CÓ TỪ MỚI" : `${lesson.vocabulary.length} TỪ · ${lesson.frames.length} MẪU CÂU`}
        </span>
      </div>
      <p className="note mb-4">Tình huống: {lesson.situation}</p>

      {recap ? (
        <>
          <p className="mb-4 text-sm text-muted">
            Hôm nay không học từ mới. Đọc lại và nghe lại {lesson.vocabulary.length} từ của {recap.days.length} buổi trước, rồi dùng chúng trong
            phần shadowing và hội thoại với AI.
          </p>
          <div className="grid gap-6">
            {recap.days.map((d) => {
              const words = lesson.vocabulary.filter((v) => v.day === d.day);
              if (!words.length) return null;
              return (
                <section key={d.day}>
                  <h3 className="mb-2.5 text-sm font-bold text-ink">
                    <span className="eyebrow mr-2">NGÀY {d.day}</span>
                    {d.title}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{words.map((v) => wordCard(v, true))}</div>
                </section>
              );
            })}
          </div>
        </>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">{lesson.vocabulary.map((v) => wordCard(v))}</div>
      )}

      <h3 className="mt-8 mb-1 text-xl font-bold">
        {lesson.frames.length} mẫu câu {recap ? "ôn tập hôm nay" : "trọng tâm"}
      </h3>
      <p className="mb-4 text-sm text-muted">
        Thay phần “…” bằng thông tin công việc của bạn. Bạn sẽ gặp lại các mẫu câu này trong phần shadowing và dùng chúng khi hội thoại với
        AI.
      </p>
      <div className="grid gap-3.5 md:grid-cols-2">
        {lesson.frames.map((f, i) => {
          const note = lesson.frameNotes?.[i];
          const example = learnerLines.find((l) => usesFrame(f, l));
          const day = recap?.frameDays[i];
          return (
            <article key={f} className="rounded-xl bg-[#eaf4f2] p-5">
              <span className="eyebrow">
                MẪU CÂU {i + 1}
                {day ? ` · ĐÃ HỌC NGÀY ${day}` : ""}
              </span>
              <div className="mt-1.5 flex items-start justify-between gap-2">
                <b className="block text-lg md:text-xl">{f}</b>
                <button
                  type="button"
                  className="btn btn-secondary shrink-0 !px-3 !py-1.5 text-xs"
                  aria-label={`Nghe mẫu câu ${i + 1}`}
                  onClick={() => sayFrame(f, example)}
                >
                  ▶
                </button>
              </div>
              {note && (
                <dl className="mt-3 grid gap-2 text-sm">
                  <div>
                    <dt className="font-semibold text-ink">Nghĩa</dt>
                    <dd className="text-muted">{note.meaning}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-ink">Cấu trúc</dt>
                    <dd>
                      <code className="rounded-md bg-white px-2 py-1 text-[13px] text-navy">{note.structure}</code>
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-ink">Cách dùng</dt>
                    <dd className="text-muted">{note.usage}</dd>
                  </div>
                </dl>
              )}
              {example && <p className="mt-3 border-t border-[#cfe5df] pt-2.5 text-[13px] italic">Ví dụ trong bài: “{example}”</p>}
            </article>
          );
        })}
      </div>

      {otherFrames.length > 0 && (
        <>
          <h3 className="mt-8 mb-1 text-lg font-bold">Các mẫu câu khác đã học</h3>
          <p className="mb-3 text-sm text-muted">Dùng thêm khi hội thoại nếu phù hợp.</p>
          <ul className="grid gap-2 md:grid-cols-2">
            {otherFrames.map((f) => (
              <li key={`${f.day}-${f.frame}`} className="rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm">
                <span className="eyebrow mr-2">NGÀY {f.day}</span>
                <b>{f.frame}</b>
                {f.note && <span className="block text-muted">{f.note.meaning}</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      <button type="button" className="btn mt-6" disabled={pending} onClick={() => run(onNext)}>
        {recap ? "Tôi đã ôn lại từ và mẫu câu →" : "Tôi đã luyện từ và mẫu câu →"}
      </button>
    </>
  );
}
