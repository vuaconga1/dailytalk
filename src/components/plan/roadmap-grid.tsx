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
 * 30-day reference roadmap – clean, spacious, professional card layout.
 * Displays complete content without truncation.
 */
export function RoadmapGrid({ days, completed = new Set(), current, actual = new Map(), openAll = false }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-4.5">
      {days.map((d, index) => {
        const done = completed.has(d.day);
        const isCurrent = d.day === current;
        const studied = actual.get(d.day);
        const canLink = openAll || isCurrent;
        const cardClass = `group relative flex min-w-0 flex-col overflow-hidden rounded-2xl transition-all duration-200 hover:-translate-y-1 animate-slide-up ${
          isCurrent
            ? "border-2 border-black bg-white shadow-md ring-4 ring-gold/50 hover:shadow-lg"
            : done
              ? "border-[1.5px] border-black bg-navy-soft/40 hover:shadow-md"
              : "border-[1.5px] border-black bg-white hover:shadow-md"
        }`;

        const cardBody = (
          <>
            <div
              className={`flex items-center justify-between gap-2 border-b-[1.5px] border-black px-4 py-2.5 ${
                isCurrent ? "bg-navy text-white" : done ? "bg-navy-soft" : "bg-white"
              }`}
            >
              <span className={`text-xs font-extrabold uppercase tracking-wider ${isCurrent ? "text-gold-light" : "text-navy"}`}>
                Ngày {String(d.day).padStart(2, "0")}
              </span>

              {done ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-0.5 text-[11px] font-bold text-white">
                  <svg className="size-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Đã học
                </span>
              ) : isCurrent ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gold px-2.5 py-0.5 text-[11px] font-bold text-white">
                  <span className="size-1.5 animate-pulse rounded-full bg-white" />
                  Hôm nay
                </span>
              ) : (
                <span className="text-[11px] font-medium text-muted">Buổi {d.day}</span>
              )}
            </div>

            <div className="flex-1 px-4 pt-3 pb-4">
              <h3 className="mb-1.5 text-base font-extrabold leading-snug text-navy">{studied ?? d.title}</h3>
              {studied && studied !== d.title && <div className="mb-1.5 text-xs text-muted line-through">Kế hoạch gốc: {d.title}</div>}
              <p className="text-[13px] leading-relaxed text-ink-secondary">{d.situation}</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t-[1.5px] border-black px-4 py-2.5">
              <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md bg-gold-soft px-2 py-1 text-xs font-semibold text-navy">
                <span className="size-1.5 shrink-0 rounded-full bg-gold" />
                <span className="min-w-0 leading-snug">{SKILL_LABELS[d.skill]}</span>
              </span>
              {isCurrent ? (
                <span className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-navy px-3 text-xs font-bold text-white transition group-hover:bg-navy-light">
                  Vào học ngay <span className="text-gold-light transition-transform group-hover:translate-x-0.5">→</span>
                </span>
              ) : openAll ? (
                <span className="inline-flex items-center text-xs font-bold text-navy">
                  {done ? "Học lại" : "Vào học"}
                  <span className="ml-1 text-gold transition-transform group-hover:translate-x-0.5">→</span>
                </span>
              ) : null}
            </div>
          </>
        );

        return canLink ? (
          <Link
            key={d.day}
            href={`/lesson?day=${d.day}`}
            style={{ animationDelay: `${Math.min(index * 25, 300)}ms` }}
            className={cardClass}
          >
            {cardBody}
          </Link>
        ) : (
          <article
            key={d.day}
            style={{ animationDelay: `${Math.min(index * 25, 300)}ms` }}
            className={cardClass}
          >
            {cardBody}
          </article>
        );
      })}
    </div>
  );
}
