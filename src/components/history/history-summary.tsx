"use client";

import type { HistoryItem, WeekReview } from "@/domain/types";

type MonthOption = {
  value: string;
  label: string;
  count: number;
};

type Props = {
  history: HistoryItem[];
  weekReviews: WeekReview[];
  streak: number;
  /** Study seconds per month ("YYYY-MM"). */
  studySeconds: Record<string, number>;
  currentMonth: string;
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  monthOptions: MonthOption[];
};

export function HistorySummary({
  history,
  weekReviews,
  streak,
  studySeconds,
  currentMonth,
  selectedMonth,
  onSelectMonth,
  monthOptions,
}: Props) {
  // Study minutes: the selected month, or the current month when viewing everything
  const minutesMonth = selectedMonth === "all" ? currentMonth : selectedMonth;
  const [minutesYear, minutesMonthNum] = minutesMonth.split("-");
  const monthMinutes = Math.floor((studySeconds[minutesMonth] ?? 0) / 60);
  const totalMinutes = Math.floor(Object.values(studySeconds).reduce((a, s) => a + s, 0) / 60);
  const daysInMonth = new Date(Date.UTC(Number(minutesYear), Number(minutesMonthNum), 0)).getUTCDate();
  const monthTargetMinutes = daysInMonth * 15;
  const minutesProgress = Math.min(Math.round((monthMinutes / monthTargetMinutes) * 100), 100);
  const formatHours = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} giờ ${m % 60} phút` : `${m} phút`);

  // Filter history based on selected month if not "all"
  const currentItems =
    selectedMonth === "all"
      ? history
      : history.filter((h) => h.date.startsWith(selectedMonth));

  const totalSessions = currentItems.length;
  const completedSessions = currentItems.filter((h) => h.completed).length;
  const inProgressSessions = totalSessions - completedSessions;

  // Percentage of 30-day program completed
  const programProgress = Math.min(Math.round((completedSessions / 30) * 100), 100);

  // Turns and speaking stats
  const totalTurns = currentItems.reduce((acc, h) => acc + (h.summary?.turn_count ?? 0), 0);
  const totalVoiceTurns = currentItems.reduce((acc, h) => acc + (h.summary?.voice_turns ?? 0), 0);

  // Goal achievement stats
  const achievedSessions = currentItems.filter(
    (h) => h.summary?.goal_status === "achieved"
  ).length;
  const achievementRate =
    completedSessions > 0 ? Math.round((achievedSessions / completedSessions) * 100) : 0;

  // Words and frames accumulated from week reviews
  const totalWords = weekReviews.reduce((acc, w) => acc + w.words.length, 0);
  const totalFrames = weekReviews.reduce(
    (acc, w) => acc + w.frames.filter((f) => f.used).length,
    0
  );

  // Monthly insight tone
  const insightMessage =
    completedSessions === 0
      ? "Hãy bắt đầu buổi học đầu tiên để WeWIN AI Coach theo dõi sự tiến bộ và phân tích giọng nói của bạn."
      : achievementRate >= 80
        ? `Rất xuất sắc! Tỷ lệ đạt chuẩn mục tiêu đàm thoại đạt ${achievementRate}%. Bạn đang duy trì phong độ giao tiếp phản xạ rất ổn định.`
        : achievementRate >= 50
          ? `Bạn đang tiến bộ vững vàng với ${completedSessions} buổi học. Hãy chú ý các điểm lưu ý phát âm để tăng tốc phản xạ tự nhiên hơn.`
          : `Khởi đầu kiên trì! Mỗi buổi phản xạ 15 phút là một bước đệm quan trọng để tạo phản xạ không cần dịch trong đầu.`;

  const selectedMonthLabel =
    monthOptions.find((m) => m.value === selectedMonth)?.label ?? "Toàn bộ lộ trình";

  const metrics: { label: string; icon: string; value: string | number; unit: string; note: string; progress: number; gold?: boolean }[] = [
    {
      label: `Thời gian học T${minutesMonthNum}/${minutesYear}`,
      icon: "⏱",
      value: monthMinutes,
      unit: "phút",
      note:
        selectedMonth === "all"
          ? `Tổng toàn khóa: ${formatHours(totalMinutes)}`
          : monthMinutes >= 60
            ? `≈ ${formatHours(monthMinutes)}`
            : `Mục tiêu ${monthTargetMinutes} phút/tháng`,
      progress: minutesProgress,
    },
    {
      label: "Tiến độ khóa",
      icon: "🏁",
      value: completedSessions,
      unit: "/ 30 buổi",
      note: `${programProgress}% lộ trình${inProgressSessions > 0 ? ` · ${inProgressSessions} đang học` : ""}`,
      progress: programProgress,
    },
    {
      label: "Chuỗi kiên trì",
      icon: "🔥",
      value: streak,
      unit: "ngày liên tiếp",
      note: streak > 0 ? "Duy trì thói quen 15p mỗi ngày" : "Học ngay hôm nay để bắt đầu chuỗi",
      progress: Math.round((Math.min(streak, 7) / 7) * 100),
      gold: true,
    },
    {
      label: "Luyện nói AI",
      icon: "🎙",
      value: totalVoiceTurns,
      unit: "lượt nói",
      note: totalTurns > 0 ? `Trên tổng số ${totalTurns} lượt phản xạ` : "Tương tác giọng với AI Coach",
      progress: totalTurns > 0 ? Math.round((totalVoiceTurns / totalTurns) * 100) : 0,
    },
    {
      label: "Tỷ lệ đạt chuẩn",
      icon: "🎯",
      value: `${achievementRate}%`,
      unit: "mục tiêu",
      note: `${achievedSessions}/${completedSessions || 1} buổi đạt chuẩn đàm thoại`,
      progress: achievementRate,
      gold: true,
    },
  ];

  return (
    <section className="mb-8 rounded-2xl border-2 border-black bg-white p-4 shadow-(--ww-frame-shadow) sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold">
            <span className="size-2 rounded-full bg-gold" />
            Báo cáo tiến độ & phản xạ
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-navy sm:text-2xl">
            Tổng kết tháng: {selectedMonthLabel}
          </h2>
          <p className="mt-0.5 text-xs text-ink-secondary sm:text-sm">
            Đánh giá tổng quát hiệu suất luyện phản xạ và tích lũy kỹ năng giao tiếp.
          </p>
        </div>

        {monthOptions.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor="month-select" className="hidden text-xs font-bold uppercase tracking-wider text-black sm:inline">
              Xem theo kỳ:
            </label>
            <div className="relative">
              <select
                id="month-select"
                value={selectedMonth}
                onChange={(e) => onSelectMonth(e.target.value)}
                className="min-h-10 cursor-pointer appearance-none rounded-xl border-[1.5px] border-black bg-white px-3.5 py-2 pr-9 text-xs font-bold text-navy focus:outline-none focus:ring-2 focus:ring-gold/50"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} ({opt.count} buổi)
                  </option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-navy"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        )}
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {metrics.map((m) => (
          <div key={m.label} className="flex min-w-0 flex-col rounded-xl border-[1.5px] border-black bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-2 border-b-[1.5px] border-black pb-2">
              <span className="min-w-0 text-[11px] font-bold uppercase tracking-wider text-black">{m.label}</span>
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-gray-100 text-sm" aria-hidden>
                {m.icon}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <strong className={`text-3xl font-black ${m.gold ? "text-gold" : "text-navy"}`}>{m.value}</strong>
              <span className="text-sm font-semibold text-ink-secondary">{m.unit}</span>
            </div>
            <p className="mt-1 flex-1 text-xs text-ink-secondary">{m.note}</p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${m.gold ? "bg-gold" : "bg-gray-500"}`}
                style={{ width: `${m.progress}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col justify-between gap-4 rounded-xl border-l-8 border-gold bg-gray-100 p-4 text-navy sm:p-5 md:flex-row md:items-center">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-gray-200 bg-white text-lg" aria-hidden>
            💡
          </span>
          <div className="min-w-0">
            <div className="text-xs font-extrabold uppercase tracking-wider text-amber-600">
              Nhận định tiến bộ từ WeWIN AI Coach
            </div>
            <p className="mt-1 max-w-2xl text-sm font-medium leading-relaxed text-navy">
              {insightMessage}
            </p>
          </div>
        </div>

        {(totalWords > 0 || totalFrames > 0) && (
          <div className="flex shrink-0 items-center gap-3 border-t border-gray-300 pt-3 md:border-t-0 md:pt-0">
            <div className="md:text-right">
              <span className="block text-[11px] text-muted">Tích lũy toàn khóa</span>
              <div className="text-sm font-bold text-amber-600">
                {totalWords} từ vựng · {totalFrames} mẫu câu
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
