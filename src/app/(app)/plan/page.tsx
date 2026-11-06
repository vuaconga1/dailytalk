import { RoadmapGrid } from "@/components/plan/roadmap-grid";
import { getHistory } from "@/server/learning/history";
import { getTodayAttempt } from "@/server/learning/lessons";
import { OPEN_ALL_DAYS } from "@/server/learning/practice";
import { requirePlan } from "@/server/http/page-guards";
import { levelInfo } from "@/domain/profile-options";

export default async function PlanPage() {
  const user = await requirePlan();
  const [attempt, history] = await Promise.all([getTodayAttempt(user), getHistory(user.id)]);
  const completed = new Set(history.filter((h) => h.completed).map((h) => h.day));
  const actual = new Map(history.map((h) => [h.day, h.title]));
  const { classification } = user.profile;
  const level = levelInfo(user.profile.working_level);

  return (
    <section className="animate-fade-in pb-12">
      {/* Page Header */}
      <div className="mb-8 gap-6 md:flex md:items-end md:justify-between border-b border-[#e2e8f4] pb-6">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <span className="size-2 rounded-full bg-gold" />
            THEO MỤC TIÊU CỦA BẠN
          </div>
          <h1 className="page-title mt-1">Lộ trình 30 ngày.</h1>
          <p className="mt-3 max-w-[860px] text-base md:text-lg text-slate-600 leading-relaxed">
            {user.plan.goal}
          </p>
        </div>

        <div className="mt-4 shrink-0 md:mt-0">
          <span className="inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-xs font-bold tracking-wider text-white shadow-sm">
            <span className="size-2 rounded-full bg-amber-400" />
            TRÌNH ĐỘ HIỆN TẠI: {level.label.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Adaptive Notice Banner - Website Style */}
      <div className="mb-6 flex items-start gap-3.5 rounded-2xl border border-[#e2e8f4] bg-white p-4.5 shadow-xs text-sm text-slate-600 leading-relaxed">
        <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-blue-soft text-blue-accent text-base">
          ℹ
        </div>
        <div className="flex-1">
          <b className="text-navy font-semibold">Lộ trình thích ứng:</b> Đây là khung kế hoạch tham khảo. Sau mỗi buổi học, hệ thống xem xét kết quả thực tế để cá nhân hóa tình huống và mức độ thử thách cho các buổi kế tiếp.
        </div>
      </div>

      {/* Priorities Pills */}
      <div className="mb-7 flex flex-wrap items-center gap-2.5">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-1">
          Trọng tâm của bạn:
        </span>
        {classification.priorities.map((p) => (
          <span
            key={p.skill}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-amber-900 border border-amber-200/80 shadow-xs transition-transform hover:scale-105"
          >
            <span className="size-1.5 rounded-full bg-gold" />
            {p.label}
          </span>
        ))}
      </div>

      {/* 30-Day Grid with Large Typography */}
      <RoadmapGrid days={user.plan.days} completed={completed} current={attempt.day} actual={actual} openAll={OPEN_ALL_DAYS} />
    </section>
  );
}
