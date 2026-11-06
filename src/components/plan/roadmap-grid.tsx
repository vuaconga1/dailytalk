import Link from "next/link";
import { SKILL_LABELS } from "@/domain/classify";
import type { PlanDay } from "@/domain/types";

type Props = {
  days: PlanDay[];
  completed?: Set<number>;
  current?: number;
  actual?: Map<number, string>;
  /** Every day links to its lesson (testing mode). */
  openAll?: boolean;
};

/**
 * 30-day reference roadmap designed to match WeWIN's brand color scheme.
 * Features Midnight Navy, Warm Gold, Soft Periwinkle Blue tags, and crisp white surfaces.
 */
export function RoadmapGrid({ days, completed = new Set(), current, actual = new Map(), openAll = false }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-5">
      {days.map((d, index) => {
        const done = completed.has(d.day);
        const isCurrent = d.day === current;
        const studied = actual.get(d.day);

        return (
          <article
            key={d.day}
            style={{ animationDelay: `${Math.min(index * 25, 300)}ms` }}
            className={`group relative flex flex-col justify-between rounded-2xl border p-5 md:p-6 transition-all duration-300 hover:-translate-y-1 animate-slide-up ${
              done
                ? "border-emerald-200/90 bg-emerald-50/25 shadow-xs hover:border-emerald-300 hover:shadow-md"
                : isCurrent
                  ? "border-2 border-navy bg-white shadow-md ring-4 ring-navy/10 hover:shadow-lg"
                  : "border-[#e2e8f4] bg-white shadow-xs hover:border-slate-300 hover:shadow-md"
            }`}
          >
            <div>
              {/* Day Badge & Status */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs md:text-sm font-extrabold uppercase tracking-wider text-navy">
                  NGÀY {String(d.day).padStart(2, "0")}
                </span>

                {done ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/90 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                    <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Đã học
                  </span>
                ) : isCurrent ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-navy px-2.5 py-0.5 text-xs font-bold text-white shadow-xs animate-pulse-glow">
                    <span className="size-2 rounded-full bg-amber-400 animate-ping" />
                    Hôm nay
                  </span>
                ) : (
                  <span className="text-xs font-medium text-slate-400">Buổi {d.day}</span>
                )}
              </div>

              {/* Main English Situation Title */}
              <h3 className="text-base md:text-lg lg:text-[18px] font-bold text-navy leading-snug my-2 group-hover:text-gold transition-colors">
                {studied ?? d.title}
              </h3>

              {studied && studied !== d.title && (
                <div className="mb-2 text-xs text-slate-400 line-through">
                  Kế hoạch gốc: {d.title}
                </div>
              )}

              {/* Vietnamese Situation Context */}
              <p className="text-sm md:text-[14px] text-slate-600 leading-relaxed line-clamp-3 mb-4">
                {d.situation}
              </p>
            </div>

            {/* Bottom Meta & Skill Priority */}
            <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-soft px-2.5 py-1 text-xs font-semibold text-blue-accent border border-blue-200/50">
                <span className="size-1.5 rounded-full bg-blue-accent" />
                {SKILL_LABELS[d.skill]}
              </span>

              {openAll ? (
                <Link href={`/lesson?day=${d.day}`} className="text-xs font-bold text-navy flex items-center gap-0.5 hover:text-gold">
                  {done ? "Học lại" : "Vào học"} <span>→</span>
                </Link>
              ) : (
                isCurrent && (
                  <span className="text-xs font-bold text-navy flex items-center gap-0.5">
                    Vào học <span>→</span>
                  </span>
                )
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
