import { RoadmapGrid } from "@/components/plan/roadmap-grid";
import { SectionHeading } from "@/components/section-heading";
import { getHistory } from "@/server/learning/history";
import { getTodayAttempt } from "@/server/learning/lessons";
import { openAllDaysFor } from "@/server/learning/practice";
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
      <header className="mb-6 rounded-2xl border-2 border-black bg-gray-100 p-5 text-navy shadow-(--ww-frame-shadow) md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600">
            <span className="size-2 rounded-full bg-gold" />
            Theo mục tiêu của bạn
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/50 bg-gold-soft px-3.5 py-1.5 text-xs font-bold tracking-wider text-amber-800">
            Trình độ hiện tại: {level.label.toUpperCase()}
          </span>
        </div>
        <h1 className="mt-3 text-[clamp(26px,3.4vw,38px)] font-extrabold leading-tight tracking-tight">Lộ trình 30 ngày.</h1>
        <p className="mt-2 max-w-[860px] text-base leading-relaxed text-ink-secondary md:text-lg">{user.plan.goal}</p>
      </header>

      <div className="mb-8 grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 items-start gap-3 rounded-xl border-[1.5px] border-black border-l-8 border-l-gold bg-white p-4 text-sm leading-relaxed text-ink-secondary">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-gray-200 text-sm font-bold text-navy" aria-hidden>
            i
          </span>
          <p className="min-w-0">
            <b className="text-navy">Lộ trình thích ứng:</b> Đây là khung kế hoạch tham khảo. Sau mỗi buổi học, hệ thống xem xét kết quả thực tế để cá nhân hóa tình huống và mức độ thử thách cho các buổi kế tiếp.
          </p>
        </div>
        <div className="min-w-0 rounded-xl border-[1.5px] border-black bg-white p-4">
          <p className="mb-2 border-b-[1.5px] border-black pb-1.5 text-[11px] font-bold uppercase tracking-wider text-black">Trọng tâm của bạn</p>
          <div className="flex flex-wrap gap-2">
            {classification.priorities.map((p) => (
              <span key={p.skill} className="inline-flex items-center gap-1.5 rounded-full bg-gold-soft px-3 py-1 text-xs font-bold text-navy">
                <span className="size-1.5 rounded-full bg-gold" />
                {p.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <SectionHeading
        level={2}
        title="30 buổi học"
        badge={
          <span className="badge badge-gold">
            {completed.size}/{user.plan.days.length} ĐÃ HỌC
          </span>
        }
      >
        Mỗi thẻ là một buổi: chủ đề, tình huống và kỹ năng trọng tâm.
      </SectionHeading>
      <RoadmapGrid days={user.plan.days} completed={completed} current={attempt.day} actual={actual} openAll={openAllDaysFor(user)} />
    </section>
  );
}
