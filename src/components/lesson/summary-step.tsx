import { WeekReviewCard } from "@/components/week-review";
import type { Summary, WeekReview } from "@/domain/types";
import { SectionHeading } from "@/components/section-heading";

type Props = {
  summary: Summary | null;
  frameCount: number;
  week: WeekReview;
  onBack: () => void;
  onHome: () => void;
};

export function SummaryStep({ summary, frameCount, week, onBack, onHome }: Props) {
  if (!summary) {
    return (
      <div className="px-2 py-10 text-center text-muted sm:p-11">
        <h2 className="mb-2 text-xl font-bold text-navy md:text-2xl">Hoàn thành buổi học để xem tổng kết.</h2>
        <p className="mb-4">Học từ, luyện shadowing rồi bắt đầu hội thoại.</p>
        <button type="button" className="btn" onClick={onBack}>
          Quay lại bài học
        </button>
        {week.done > 0 && (
          <div className="mt-8 text-left">
            <WeekReviewCard review={week} />
          </div>
        )}
      </div>
    );
  }

  const achieved = summary.goal_status === "achieved";
  return (
    <>
      <SectionHeading level={2} title="Mỗi lần thực hành là một bước tiến." badge={<span className="badge badge-gold">✓ ĐÃ LƯU BUỔI HỌC</span>}>
        <span className="text-base leading-relaxed">{summary.overview}</span>
      </SectionHeading>
      <div className="mb-10 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        {[
          [summary.turn_count, "Lượt phản hồi"],
          [summary.voice_turns, "Lượt nói bằng giọng"],
          [summary.frames_used ? `${summary.frames_used.length}/${frameCount}` : "–", "Mẫu câu đã dùng"],
          [achieved ? "Đạt" : "Ôn thêm", summary.goal_status === "insufficient_evidence" ? "Cần thêm lượt nói" : "Mục tiêu tình huống"],
        ].map(([value, label]) => (
          <div key={label} className="min-w-0 rounded-xl border-[1.5px] border-black border-b-4 border-b-gold bg-white px-4 py-3">
            <strong className="block text-2xl font-extrabold text-navy md:text-3xl">{value}</strong>
            <span className="text-xs font-medium text-ink-secondary">{label}</span>
          </div>
        ))}
      </div>

      <SectionHeading title="Nhận xét buổi học" />
      <div className="grid gap-3 md:grid-cols-2 md:gap-4">
        <div className="min-w-0 rounded-xl border-[1.5px] border-black bg-white p-4">
          <h3 className="mb-2 border-b-[1.5px] border-black pb-2 font-bold text-navy">Điều bạn làm được</h3>
          <ul className="grid gap-1.5 text-sm text-ink-secondary">
            {(summary.strengths.length ? summary.strengths : ["Hãy thực hành thêm để nhận nhận xét chi tiết."]).map((t) => (
              <li key={t} className="flex items-start gap-2">
                <span className="mt-0.5 text-gold" aria-hidden>
                  ✓
                </span>
                <span className="min-w-0">{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="min-w-0 rounded-xl border-[1.5px] border-black bg-white p-4">
          <h3 className="mb-2 border-b-[1.5px] border-black pb-2 font-bold text-navy">Điều cần luyện tiếp</h3>
          <ul className="grid gap-1.5 text-sm text-ink-secondary">
            {summary.improvements.map((t) => (
              <li key={t} className="flex items-start gap-2">
                <span className="mt-0.5 text-navy" aria-hidden>
                  →
                </span>
                <span className="min-w-0">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {summary.evidence.length > 0 && (
        <div className="mt-4 grid gap-2">
          {summary.evidence.map((t) => (
            <blockquote key={t} className="rounded-r-lg border-l-[3px] border-gold bg-gold-soft/40 px-4 py-2.5 text-sm text-ink italic">
              “{t}”
            </blockquote>
          ))}
        </div>
      )}
      {!!summary.errors?.length && (
        <div className="mt-10">
          <SectionHeading title="Lỗi cần sửa" badge={<span className="badge badge-gold">{summary.errors.length} LỖI</span>} />
          <div className="grid gap-3 md:grid-cols-2">
            {summary.errors.map((e) => (
              <div key={e.example} className="min-w-0 overflow-hidden rounded-xl border-[1.5px] border-black bg-white text-sm">
                <b className="block border-b-[1.5px] border-black bg-navy-soft/60 px-4 py-2 text-navy">{e.issue}</b>
                <div className="grid gap-1.5 p-4">
                  <p className="text-muted">
                    <span className="mr-1.5 font-bold text-red-600">✗</span>
                    <span className="line-through decoration-red-500">{e.example}</span>
                  </p>
                  <p className="font-semibold text-navy">
                    <span className="mr-1.5 font-bold text-gold">✓</span>
                    {e.correction}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {!!summary.review_items?.length && (
        <div className="mt-10">
          <SectionHeading title="Ôn lại ở buổi sau" />
          <div className="flex flex-wrap gap-2">
            {summary.review_items.map((t) => (
              <span key={t} className="badge badge-gold">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="mt-10 rounded-xl border-l-8 border-gold bg-navy p-5 text-white sm:p-6">
        <span className="text-xs font-bold uppercase tracking-wider text-gold-light">Bước nhỏ tiếp theo</span>
        <p className="mt-2 text-base font-semibold leading-[1.7]">{summary.next_step}</p>
      </div>
      <div className="mt-10">
        <WeekReviewCard review={week} />
      </div>
      <div className="mt-10 border-t-2 border-black pt-6">
        <button type="button" className="btn w-full sm:w-auto" onClick={onHome}>
          Về trang Hôm nay →
        </button>
      </div>
    </>
  );
}
