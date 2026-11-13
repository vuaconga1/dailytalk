import Link from "next/link";
import type { CourseReport } from "@/domain/course-report";
import { levelInfo } from "@/domain/profile-options";
import { formatVnDate } from "@/lib/time";

function duration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} phút`;
  return m ? `${h} giờ ${m} phút` : `${h} giờ`;
}

function percent(part: number, whole: number) {
  return whole ? Math.round((part / whole) * 100) : 0;
}

function Ring({ value }: { value: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid size-36 shrink-0 place-items-center">
      <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--ww-gold)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
        />
      </svg>
      <div className="text-center">
        <div className="text-3xl font-black text-white">{value}%</div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gold-light">Đạt chuẩn</div>
      </div>
    </div>
  );
}

type Tile = { icon: string; label: string; value: string | number; unit?: string; note: string; bar?: number };

export function CourseReportPanel({ report, name }: { report: CourseReport; name: string }) {
  const r = report;
  const sessionMinutes = r.completed ? Math.round(r.studySeconds / 60 / r.completed) : 0;
  const startLevel = levelInfo(r.startLevel).label;
  const endLevel = levelInfo(r.endLevel).label;

  const headline: [string, string, string][] = [
    [r.studySeconds ? duration(r.studySeconds) : "—", "Tổng thời gian học", r.studySeconds ? `${r.studyDays} ngày có học` : "Chưa ghi nhận thời gian"],
    [String(r.words), "Từ vựng đã học", `Qua ${r.situations} tình huống`],
    [String(r.frames), "Mẫu câu đã học", `${r.framesUsed} mẫu đã nói được`],
    [`${r.completed}/${r.totalDays}`, "Buổi hoàn thành", `${percent(r.completed, r.totalDays)}% lộ trình`],
  ];

  const tiles: Tile[] = [
    { icon: "⏱", label: "Trung bình mỗi buổi", value: sessionMinutes || "—", unit: sessionMinutes ? "phút" : "", note: "Mục tiêu 15 phút tập trung" },
    { icon: "📅", label: "Thời gian khóa học", value: r.spanDays, unit: "ngày", note: `Hoàn thành ${r.completed} buổi trong ${r.spanDays} ngày`, bar: percent(r.completed, r.spanDays) },
    { icon: "🔥", label: "Chuỗi dài nhất", value: r.longestStreak, unit: "ngày", note: "Liên tiếp không nghỉ", bar: percent(r.longestStreak, r.totalDays) },
    { icon: "🎯", label: "Buổi đạt chuẩn", value: r.achieved, unit: `/ ${r.completed}`, note: `${r.needsReview} buổi cần ôn lại`, bar: r.achievementRate },
    { icon: "💬", label: "Lượt nói cùng AI", value: r.turns, unit: "lượt", note: `${r.voiceTurns} lượt bằng giọng nói`, bar: percent(r.voiceTurns, r.turns) },
    { icon: "🧩", label: "Mẫu câu vận dụng", value: `${percent(r.framesUsed, r.frames)}%`, note: `${r.framesUsed}/${r.frames} mẫu câu dùng trong hội thoại`, bar: percent(r.framesUsed, r.frames) },
    { icon: "🏢", label: "Tình huống thực chiến", value: r.situations, unit: "tình huống", note: r.reviewDays ? `Cộng ${r.reviewDays} buổi ôn tập tổng hợp` : "Áp dụng ngay vào công việc" },
    { icon: "🚀", label: "Buổi vượt trình độ", value: r.aboveLevel, unit: "buổi", note: "AI đánh giá bạn làm tốt hơn mức bài học", bar: percent(r.aboveLevel, r.completed) },
    { icon: "✍️", label: "Lỗi đã được sửa", value: r.errors, unit: "lỗi", note: "Mỗi lỗi đều kèm câu sửa từ AI Coach" },
    { icon: "📌", label: "Mục cần ôn", value: r.reviewItems, unit: "mục", note: "Từ & mẫu câu AI gợi ý ôn lại" },
    r.shadowing.attempts
      ? { icon: "🎧", label: "Shadowing", value: r.shadowing.avgScore ?? 0, unit: "điểm TB", note: `${r.shadowing.attempts} bài đọc · cao nhất ${r.shadowing.bestScore ?? 0}`, bar: r.shadowing.avgScore ?? 0 }
      : { icon: "🎧", label: "Shadowing", value: "—", note: "Chưa luyện bài shadowing video" },
    { icon: "📈", label: "Trình độ", value: endLevel, note: r.startLevel === r.endLevel ? `Giữ vững mức ${startLevel}` : `Từ ${startLevel} lên ${endLevel}` },
  ];

  const maxWeek = Math.max(...r.weeks.map((w) => w.total), 1);

  return (
    <section className="mb-10 overflow-hidden rounded-2xl border-2 border-black bg-white shadow-(--ww-frame-shadow)">
      <div className="relative overflow-hidden bg-navy p-5 text-white sm:p-9">
        <div className="relative flex flex-col items-center gap-7 text-center md:flex-row md:text-left">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-gold-light">🎓 Tổng kết khóa học</div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-black leading-tight tracking-tight">
              Chúc mừng {name}! Bạn đã hoàn thành {r.totalDays} ngày luyện phản xạ
            </h2>
            {r.firstDate && (
              <p className="mt-2 text-sm text-white/75">
                Từ {formatVnDate(r.firstDate)} đến {formatVnDate(r.lastDate)} · {r.completed} buổi học · {r.achievementRate}% buổi đạt chuẩn
              </p>
            )}
          </div>
          <Ring value={r.achievementRate} />
        </div>

        <div className="relative mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {headline.map(([value, label, note]) => (
            <div key={label} className="min-w-0 rounded-2xl border-[1.5px] border-gold/60 bg-white/[0.06] p-4 text-center">
              <div className="text-2xl font-black text-white sm:text-3xl">{value}</div>
              <div className="mt-1 text-xs font-bold uppercase tracking-wider text-gold-light">{label}</div>
              <div className="mt-0.5 text-[11px] text-white/70">{note}</div>
            </div>
          ))}
        </div>

        <div
          className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full border-[40px] border-white/[0.04]"
          aria-hidden="true"
        />
      </div>

      <div className="p-5 sm:p-8">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="min-w-0 rounded-2xl border-[1.5px] border-black bg-white p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="min-w-0 text-xs font-bold uppercase tracking-wider text-ink-secondary">{t.label}</span>
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-gold-soft text-sm" aria-hidden>
                  {t.icon}
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-1.5">
                <strong className="text-2xl font-black text-navy">{t.value}</strong>
                {t.unit && <span className="text-sm font-semibold text-ink-secondary">{t.unit}</span>}
              </div>
              <p className="mt-1 text-xs text-ink-secondary">{t.note}</p>
              {t.bar !== undefined && (
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-navy-soft">
                  <div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(t.bar, 100)}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <article className="min-w-0 rounded-2xl border-[1.5px] border-black bg-white p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-navy">Kết quả theo tuần</h3>
              <span className="flex items-center gap-3 text-[11px] text-ink-secondary">
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-navy" />Đạt chuẩn</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-gold-light" />Hoàn thành</span>
              </span>
            </div>
            <div className="flex h-36 items-end gap-3">
              {r.weeks.map((w) => (
                <div key={w.week} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="text-[11px] font-bold text-navy">{w.achieved}/{w.total}</span>
                  <div
                    className="relative w-full max-w-12 overflow-hidden rounded-t-lg bg-gold-light"
                    style={{ height: `${(w.done / maxWeek) * 100}%` }}
                  >
                    <div
                      className="absolute inset-x-0 bottom-0 bg-navy"
                      style={{ height: `${percent(w.achieved, w.done)}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-medium text-ink-secondary">Tuần {w.week}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="min-w-0 rounded-2xl border-[1.5px] border-black bg-white p-5">
            <h3 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-navy">Lỗi thường gặp cần lưu ý</h3>
            {r.topErrors.length ? (
              <ul className="space-y-3">
                {r.topErrors.map((e) => (
                  <li key={e.issue} className="flex items-start gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-gold text-xs font-bold text-white">
                      ×{e.count}
                    </span>
                    <div className="min-w-0">
                      <b className="text-sm text-navy">{e.issue}</b>
                      <p className="text-xs font-medium text-ink-secondary">
                        <span className="text-gold">→</span> {e.correction}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-secondary">Không có lỗi lặp lại đáng chú ý trong suốt khóa học. Tuyệt vời!</p>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/history"
                className="inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-navy-light"
              >
                Xem nhật ký chi tiết <span>→</span>
              </Link>
              <Link
                href="/plan"
                className="inline-flex items-center rounded-xl border-[1.5px] border-black bg-white px-5 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-navy-soft/60"
              >
                Xem lại lộ trình
              </Link>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
