import type { WeekReview } from "@/domain/types";

const DOT: Record<string, string> = {
  achieved: "bg-emerald-500 text-white",
  needs_review: "bg-amber-400 text-white",
  insufficient_evidence: "bg-slate-300 text-slate-700",
};

export function WeekReviewCard({ review }: { review: WeekReview }) {
  const finished = review.done === review.total;
  const usedFrames = review.frames.filter((f) => f.used).length;
  const missed = review.frames.filter((f) => !f.used);
  const days = Array.from({ length: review.total }, (_, i) => review.fromDay + i);

  return (
    <section className="rounded-2xl border border-line bg-[#fbfdfd] p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="eyebrow">TỔNG KẾT TUẦN {review.week}</span>
          <h3 className="mt-1 text-xl font-bold">
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
              ? "border-2 border-teal text-teal"
              : "border border-dashed border-line text-muted";
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
          <div key={label} className="stat">
            <strong className="block text-[22px] text-navy">{value}</strong>
            <span className="text-[11px] text-muted">{label}</span>
          </div>
        ))}
      </div>

      {review.words.length > 0 && (
        <div className="mb-5">
          <h4 className="mb-2 font-bold">Từ vựng của tuần</h4>
          <div className="flex flex-wrap gap-2">
            {review.words.map((w) => (
              <span key={w.word} className="rounded-lg border border-line bg-white px-2.5 py-1 text-sm" title={w.meaning}>
                <b>{w.word}</b> <span className="text-muted">· {w.meaning}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {review.frames.length > 0 && (
        <div className="mb-5">
          <h4 className="mb-2 font-bold">Mẫu câu của tuần</h4>
          <ul className="grid gap-1.5 text-sm md:grid-cols-2">
            {review.frames.map((f) => (
              <li key={`${f.day}-${f.frame}`} className={f.used ? "text-teal" : "text-muted"}>
                {f.used ? "✓" : "○"} {f.frame} <span className="text-xs text-muted">(buổi {f.day})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {review.errors.length > 0 && (
        <div className="mb-5">
          <h4 className="mb-2 font-bold">Lỗi lặp lại trong tuần</h4>
          {review.errors.map((e) => (
            <p key={e.issue} className="mb-1.5 text-sm">
              <b>{e.issue}</b>
              {e.count > 1 && <span className="text-muted"> · {e.count} buổi</span>}
              <span className="text-teal"> → {e.correction}</span>
            </p>
          ))}
        </div>
      )}

      {review.done > 0 && (
        <div className="rounded-xl bg-[#eaf4f2] p-5">
          <span className="eyebrow">ÔN TẬP CUỐI TUẦN</span>
          <ul className="mt-2 list-disc pl-5 text-sm leading-[1.7]">
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
