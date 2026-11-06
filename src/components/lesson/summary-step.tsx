import { WeekReviewCard } from "@/components/week-review";
import type { Summary, WeekReview } from "@/domain/types";

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
      <div className="p-11 text-center text-muted">
        <h2 className="mb-2 text-[25px] font-bold text-ink">Hoàn thành buổi học để xem tổng kết.</h2>
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
      <span className="badge">BUỔI HỌC ĐÃ ĐƯỢC LƯU</span>
      <h2 className="mt-5 mb-3 text-[25px] font-bold tracking-[-0.5px]">Mỗi lần thực hành là một bước tiến.</h2>
      <p className="text-muted">{summary.overview}</p>
      <div className="my-5 grid grid-cols-2 gap-2 md:mb-6 md:grid-cols-4 md:gap-3.5">
        {[
          [summary.turn_count, "Lượt phản hồi"],
          [summary.voice_turns, "Lượt nói bằng giọng"],
          [summary.frames_used ? `${summary.frames_used.length}/${frameCount}` : "–", "Mẫu câu đã dùng"],
          [achieved ? "Đạt" : "Ôn thêm", summary.goal_status === "insufficient_evidence" ? "Cần thêm lượt nói" : "Mục tiêu tình huống"],
        ].map(([value, label]) => (
          <div key={label} className="stat">
            <strong className="block text-[22px] text-navy md:text-[25px]">{value}</strong>
            <span className="text-[10px] text-muted md:text-xs">{label}</span>
          </div>
        ))}
      </div>
      <div className="grid md:grid-cols-2 md:gap-[18px]">
        <div>
          <h3 className="text-lg font-bold">Điều bạn làm được</h3>
          <ul className="my-3 list-disc pl-5 text-sm text-muted">
            {summary.strengths.length ? (
              summary.strengths.map((t) => <li key={t}>{t}</li>)
            ) : (
              <li>Hãy thực hành thêm để nhận nhận xét chi tiết.</li>
            )}
          </ul>
        </div>
        <div>
          <h3 className="text-lg font-bold">Điều cần luyện tiếp</h3>
          <ul className="my-3 list-disc pl-5 text-sm text-muted">
            {summary.improvements.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </div>
      {summary.evidence.map((t) => (
        <blockquote key={t} className="my-3 border-l-[3px] border-teal px-4 py-2.5 text-muted italic">
          “{t}”
        </blockquote>
      ))}
      {!!summary.errors?.length && (
        <div className="mt-5">
          <h3 className="text-lg font-bold">Lỗi cần sửa</h3>
          {summary.errors.map((e) => (
            <div key={e.example} className="my-3 rounded-xl border border-line p-4 text-sm">
              <b>{e.issue}</b>
              <p className="mt-1 text-muted line-through">{e.example}</p>
              <p className="text-teal">→ {e.correction}</p>
            </div>
          ))}
        </div>
      )}
      {!!summary.review_items?.length && (
        <div className="mt-5">
          <h3 className="text-lg font-bold">Ôn lại ở buổi sau</h3>
          <div className="my-3 flex flex-wrap gap-2">
            {summary.review_items.map((t) => (
              <span key={t} className="badge badge-gold">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="my-[22px] rounded-xl bg-[#eaf4f2] p-6">
        <span className="eyebrow">BƯỚC NHỎ TIẾP THEO</span>
        <p className="mt-2 text-[15px] leading-[1.7]">{summary.next_step}</p>
      </div>
      <div className="my-[22px]">
        <WeekReviewCard review={week} />
      </div>
      <button type="button" className="btn" onClick={onHome}>
        Về trang Hôm nay →
      </button>
    </>
  );
}
