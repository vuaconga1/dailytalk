import type { WeekReview } from "@/domain/types";

const DOT: Record<string, string> = {
  achieved: "bg-navy text-gold-light",
  needs_review: "bg-gold text-white",
  insufficient_evidence: "bg-slate-300 text-slate-700",
};

export function WeekReviewCard({ review }: { review: WeekReview }) {
  const finished = review.done === review.total;
  const usedFrames = review.frames.filter((f) => f.used).length;
  const missed = review.frames.filter((f) => !f.used);
  const days = Array.from({ length: review.total }, (_, i) => review.fromDay + i);

  return (
    <section className="rounded-2xl border-2 border-black bg-white p-4 sm:p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-black pb-3">
        <div className="min-w-0">
          <span className="text-xs font-bold uppercase tracking-wider text-gold">Tổng kết tuần {review.week}</span>
          <h3 className="mt-1 text-lg font-bold text-navy md:text-xl">
            {finished ? `Bạn đã hoàn thành tuần ${review.week}!` : `Tuần ${review.week} đang diễn ra`}
          </h3>
          <p className="text-sm text-muted">
            Buổi {review.fromDay}–{review.toDay}
          </p>
        </div>
        <span className={`badge ${finished ? "" : "badge-gold"}`}>
          {review.done}/{review.total} BUỔI
        </span>
      </div>

      <div className="mb-5 flex flex-wrap gap-2" aria-label="Các buổi trong tuần">
        {days.map((d) => {
          const day = review.days.find((x) => x.day === d);
          const cls = day?.status
            ? DOT[day.status]
            : day
              ? "border-2 border-navy text-navy"
              : "border-[1.5px] border-dashed border-black/60 text-muted";
          return (
            <span
              key={d}
              title={day?.title ?? "Chưa học"}
              className={`grid size-9 place-items-center rounded-full text-xs font-bold ${cls}`}
            >
              {d}
            </span>
          );
        })}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        {[
          [`${review.done}/${review.total}`, "Buổi hoàn thành"],
          [review.achieved, "Buổi đạt mục tiêu"],
          [review.words.length, "Từ mới đã học"],
          [`${usedFrames}/${review.frames.length}`, "Mẫu câu đã dùng khi nói"],
        ].map(([value, label]) => (
          <div key={label} className="min-w-0 rounded-xl border-[1.5px] border-black bg-navy-soft/60 px-3.5 py-3">
            <strong className="block text-xl font-extrabold text-navy">{value}</strong>
            <span className="text-[11px] text-muted">{label}</span>
          </div>
        ))}
      </div>

      {review.words.length > 0 && (
        <div className="mb-5">
          <h4 className="mb-2 font-bold text-navy">Từ vựng của tuần</h4>
          <div className="flex flex-wrap gap-2">
            {review.words.map((w) => (
              <span key={w.word} className="min-w-0 rounded-lg border-[1.5px] border-black bg-white px-2.5 py-1 text-sm" title={w.meaning}>
                <b className="text-navy">{w.word}</b> <span className="text-muted">· {w.meaning}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {review.frames.length > 0 && (
        <div className="mb-5">
          <h4 className="mb-2 font-bold text-navy">Mẫu câu của tuần</h4>
          <ul className="grid gap-1.5 text-sm md:grid-cols-2">
            {review.frames.map((f) => (
              <li key={`${f.day}-${f.frame}`} className={`flex items-start gap-2 ${f.used ? "font-semibold text-navy" : "text-muted"}`}>
                <span className={f.used ? "text-gold" : ""} aria-hidden>
                  {f.used ? "✓" : "○"}
                </span>
                <span className="min-w-0">
                  {f.frame} <span className="text-xs font-normal text-muted">(buổi {f.day})</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {review.errors.length > 0 && (
        <div className="mb-5">
          <h4 className="mb-2 font-bold text-navy">Lỗi lặp lại trong tuần</h4>
          {review.errors.map((e) => (
            <p key={e.issue} className="mb-1.5 text-sm">
              <b className="text-navy">{e.issue}</b>
              {e.count > 1 && <span className="text-muted"> · {e.count} buổi</span>}
              <span className="font-semibold text-navy">
                {" "}
                <span className="text-gold">→</span> {e.correction}
              </span>
            </p>
          ))}
        </div>
      )}

      {review.done > 0 && (
        <div className="rounded-xl border-l-4 border-gold bg-gold-soft/40 p-4 sm:p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-navy">Ôn tập cuối tuần</span>
          <ul className="mt-2 list-disc pl-5 text-sm leading-[1.7] text-ink-secondary marker:text-gold">
            {missed.length > 0 && (
              <li>
                Nói lại {missed.length} mẫu câu chưa dùng khi hội thoại, mỗi mẫu một câu về công việc của bạn: “{missed[0].frame}”
                {missed.length > 1 ? "…" : ""}
              </li>
            )}
            {review.review.length > 0 && <li>Ôn lại: {review.review.join(" · ")}</li>}
            <li>Đọc to {review.words.length} từ mới của tuần, mỗi từ đặt một câu ngắn.</li>
            {finished && review.toDay < 30 && <li>Sẵn sàng cho tuần {review.week + 1} với các tình huống mới.</li>}
          </ul>
        </div>
      )}
    </section>
  );
}
