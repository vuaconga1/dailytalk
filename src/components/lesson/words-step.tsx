"use client";

import { PARTS_OF_SPEECH, usesFrame } from "@/domain/frames";
import type { Lesson } from "@/domain/types";
import type { LessonAudio } from "./lesson-player";
import { SectionHeading } from "@/components/section-heading";
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
    const url = audio.wordUrls[i] ?? clip(`word=${i}`);
    return audio.words && i >= 0 ? run(() => media.playUrl(url, 0.9)) : say(v.word);
  };
  const sayFrame = (frame: string, example: string | undefined) => {
    const line = example ? lesson.dialogue.indexOf(example) : -1;
    const url = audio.lineUrls[line] ?? clip(`line=${line}`);
    return audio.lines && line >= 0 ? run(() => media.playUrl(url, 0.9)) : say(example ?? frame.replaceAll("…", ""));
  };
  const recap = lesson.recap;
  const range = recap?.days.length ? `ngày ${recap.days[0].day}–${recap.days[recap.days.length - 1].day}` : "";
  const otherFrames = recap?.frames.filter((f) => !lesson.frames.includes(f.frame)) ?? [];

  const playButton = (label: string, onClick: () => void) => (
    <button
      type="button"
      className="grid size-9 shrink-0 place-items-center rounded-full border-[1.5px] border-black bg-white text-xs text-navy transition hover:bg-gold-soft"
      aria-label={label}
      onClick={onClick}
    >
      ▶
    </button>
  );

  const wordCard = (v: Word, compact = false) => (
    <article
      key={`${v.day ?? ""}-${v.word}`}
      className={`flex min-w-0 flex-col rounded-xl border-[1.5px] border-black border-t-4 border-t-gold bg-white ${compact ? "p-4" : "p-5"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className={`${compact ? "text-lg" : "text-xl"} font-extrabold leading-tight text-navy`}>{v.word}</h3>
          {(v.ipa || v.pos) && (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              {v.ipa && <span className="font-mono">/{v.ipa}/</span>}
              {v.pos && (
                <span className="rounded bg-navy-soft px-1.5 py-0.5 font-semibold text-navy" title={PARTS_OF_SPEECH[v.pos]}>
                  {v.pos === "phrv" ? "phr. v" : v.pos}.
                </span>
              )}
            </p>
          )}
        </div>
        {playButton(`Nghe phát âm ${v.word}`, () => sayWord(v))}
      </div>
      <p className="mt-3 text-base font-semibold text-ink">{v.meaning}</p>
      {!compact && v.example && (
        <p className="mt-3 border-t-[1.5px] border-black pt-3 text-[13px] leading-relaxed text-muted italic">“{v.example}”</p>
      )}
    </article>
  );

  return (
    <>
      <div className="mb-8 rounded-xl border-[1.5px] border-black bg-navy-soft/60 px-4 py-3 text-sm leading-relaxed text-ink">
        <span className="mr-1.5 inline-block rounded bg-gold px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">Tình huống</span>
        <span className="font-medium">{lesson.situation}</span>
      </div>

      <SectionHeading
        level={2}
        index={1}
        title={recap ? `Ôn tập ${range}` : "Từ vựng hôm nay"}
        badge={
          <span className="badge badge-gold">
            {recap ? "KHÔNG CÓ TỪ MỚI" : `${lesson.vocabulary.length} TỪ`}
          </span>
        }
      >
        Nghe và đọc to từng từ. Nghĩa tiếng Việt in đậm, câu ví dụ ở dưới.
      </SectionHeading>

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
                  <h3 className="mb-2.5 flex flex-wrap items-center gap-2 text-sm font-bold text-navy">
                    <span className="rounded-md bg-navy px-2 py-0.5 text-[11px] tracking-wider text-gold-light">NGÀY {d.day}</span>
                    <span className="min-w-0">{d.title}</span>
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

      <SectionHeading
        className="mt-12"
        index={2}
        title={`Mẫu câu ${recap ? "ôn tập" : "trọng tâm"}`}
        badge={<span className="badge badge-gold">{lesson.frames.length} MẪU CÂU</span>}
      >
        Thay phần <b className="text-navy">“…”</b> bằng thông tin công việc của bạn. Bạn sẽ dùng lại các mẫu câu này khi shadowing và hội thoại với AI.
      </SectionHeading>
      <div className="grid gap-4 md:grid-cols-2">
        {lesson.frames.map((f, i) => {
          const note = lesson.frameNotes?.[i];
          const example = learnerLines.find((l) => usesFrame(f, l));
          const day = recap?.frameDays[i];
          return (
            <article key={f} className="flex min-w-0 flex-col overflow-hidden rounded-xl border-[1.5px] border-black bg-white">
              <div className="flex items-start gap-3 border-b-[1.5px] border-black bg-navy-soft/60 p-4">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy text-sm font-bold text-gold-light">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <b className="block text-lg font-extrabold leading-snug text-navy md:text-xl">{f}</b>
                  {note && <p className="mt-1 text-sm font-medium text-ink-secondary">{note.meaning}</p>}
                  {day && <p className="mt-1 text-xs font-semibold text-gold">Đã học ngày {day}</p>}
                </div>
                {playButton(`Nghe mẫu câu ${i + 1}`, () => sayFrame(f, example))}
              </div>
              {(note || example) && (
                <dl className="grid flex-1 gap-4 p-4 text-sm">
                  {note && (
                    <>
                      <div>
                        <dt className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-black">Cấu trúc</dt>
                        <dd>
                          <code className="block rounded-md bg-navy px-3 py-2 text-[13px] font-semibold leading-relaxed text-white">{note.structure}</code>
                        </dd>
                      </div>
                      <div>
                        <dt className="mb-1 text-[11px] font-bold uppercase tracking-wider text-black">Cách dùng</dt>
                        <dd className="leading-relaxed text-ink-secondary">{note.usage}</dd>
                      </div>
                    </>
                  )}
                  {example && (
                    <div className="border-t-[1.5px] border-black pt-3">
                      <dt className="mb-1 text-[11px] font-bold uppercase tracking-wider text-black">Ví dụ trong bài</dt>
                      <dd className="rounded-lg border-l-4 border-gold bg-gold-soft/50 px-3 py-2 font-medium italic text-ink">“{example}”</dd>
                    </div>
                  )}
                </dl>
              )}
            </article>
          );
        })}
      </div>

      {otherFrames.length > 0 && (
        <>
          <SectionHeading className="mt-12" index={3} title="Các mẫu câu khác đã học">
            Dùng thêm khi hội thoại nếu phù hợp.
          </SectionHeading>
          <ul className="grid gap-2 md:grid-cols-2">
            {otherFrames.map((f) => (
              <li key={`${f.day}-${f.frame}`} className="flex min-w-0 items-start gap-2.5 rounded-lg border-[1.5px] border-black bg-white px-3.5 py-2.5 text-sm">
                <span className="shrink-0 rounded bg-navy-soft px-1.5 py-0.5 text-[11px] font-bold text-navy">Ngày {f.day}</span>
                <span className="min-w-0">
                  <b className="text-navy">{f.frame}</b>
                  {f.note && <span className="block text-muted">{f.note.meaning}</span>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-10 border-t-2 border-black pt-6">
        <button type="button" className="btn w-full sm:w-auto" disabled={pending} onClick={() => run(onNext)}>
          {recap ? "Tôi đã ôn lại từ và mẫu câu →" : "Tôi đã luyện từ và mẫu câu →"}
        </button>
      </div>
    </>
  );
}
