"use client";

import type { HistoryItem, WeekReview } from "@/lib/types";

type MonthOption = {
  value: string;
  label: string;
  count: number;
};

type Props = {
  history: HistoryItem[];
  weekReviews: WeekReview[];
  streak: number;
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  monthOptions: MonthOption[];
};

export function HistorySummary({
  history,
  weekReviews,
  streak,
  selectedMonth,
  onSelectMonth,
  monthOptions,
}: Props) {
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

  return (
    <section className="mb-8 rounded-3xl border border-[#cbd5e1]/70 bg-gradient-to-b from-white to-[#f8faff] p-5 sm:p-7 shadow-[0_4px_24px_-4px_rgba(9,23,52,0.06)]">
      {/* Top Header & Month Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
        <div>
          <div className="eyebrow !mb-1 flex items-center gap-2">
            <span className="size-2 rounded-full bg-gold animate-pulse-glow" />
            BÁO CÁO TIẾN ĐỘ & PHẢN XẠ
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-navy tracking-tight">
            Tổng kết tháng: {selectedMonthLabel}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Đánh giá tổng quát hiệu suất luyện phản xạ và tích lũy kỹ năng giao tiếp.
          </p>
        </div>

        {/* Month Dropdown / Filter */}
        {monthOptions.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor="month-select" className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">
              Xem theo kỳ:
            </label>
            <div className="relative">
              <select
                id="month-select"
                value={selectedMonth}
                onChange={(e) => onSelectMonth(e.target.value)}
                className="appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2 pr-9 text-xs font-bold text-navy shadow-xs focus:border-navy focus:outline-none transition-all cursor-pointer hover:border-slate-300"
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} ({opt.count} buổi)
                  </option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
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

      {/* 4 Main Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 mb-6">
        {/* Metric 1: Hoàn thành lộ trình */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-4.5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Tiến độ khóa</span>
            <span className="grid size-7 place-items-center rounded-lg bg-blue-soft text-blue-accent text-sm">
              🏁
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <strong className="text-2xl sm:text-3xl font-black text-navy">
              {completedSessions}
            </strong>
            <span className="text-sm font-semibold text-slate-400">/ 30 buổi</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {programProgress}% lộ trình{inProgressSessions > 0 ? ` · ${inProgressSessions} đang học` : ""}
          </p>
          {/* Progress Bar */}
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-navy transition-all duration-500"
              style={{ width: `${programProgress}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Chuỗi ngày liên tiếp */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-4.5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Chuỗi kiên trì</span>
            <span className="grid size-7 place-items-center rounded-lg bg-amber-50 text-gold text-sm">
              🔥
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <strong className="text-2xl sm:text-3xl font-black text-gold">
              {streak}
            </strong>
            <span className="text-sm font-semibold text-slate-400">ngày liên tiếp</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {streak > 0 ? "Duy trì thói quen 15p mỗi ngày" : "Học ngay hôm nay để bắt đầu chuỗi"}
          </p>
          <div className="mt-3 flex items-center gap-1">
            {Array.from({ length: 7 }, (_, i) => (
              <span
                key={i}
                className={`h-2 flex-1 rounded-full ${
                  i < Math.min(streak, 7) ? "bg-gold" : "bg-slate-100"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Metric 3: Luyện nói bằng giọng */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-4.5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Luyện nói AI</span>
            <span className="grid size-7 place-items-center rounded-lg bg-teal-soft text-teal text-sm">
              🎙
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <strong className="text-2xl sm:text-3xl font-black text-blue-accent">
              {totalVoiceTurns}
            </strong>
            <span className="text-sm font-semibold text-slate-400">lượt nói</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {totalTurns > 0 ? `Trên tổng số ${totalTurns} lượt phản xạ` : "Tương tác giọng với AI Coach"}
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-accent transition-all duration-500"
              style={{
                width: totalTurns > 0 ? `${Math.round((totalVoiceTurns / totalTurns) * 100)}%` : "0%",
              }}
            />
          </div>
        </div>

        {/* Metric 4: Tỷ lệ đạt mục tiêu */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-4.5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Tỷ lệ đạt chuẩn</span>
            <span className="grid size-7 place-items-center rounded-lg bg-emerald-50 text-emerald-600 text-sm">
              🎯
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <strong className="text-2xl sm:text-3xl font-black text-emerald-600">
              {achievementRate}%
            </strong>
            <span className="text-sm font-semibold text-slate-400">mục tiêu</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {achievedSessions}/{completedSessions || 1} buổi đạt chuẩn đàm thoại
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${achievementRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* AI Coach Monthly Highlight Box */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-navy to-[#132752] p-4.5 sm:p-5 text-white shadow-md">
        <div className="flex items-start gap-3.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-amber-300 text-lg border border-white/15">
            💡
          </span>
          <div>
            <div className="text-xs font-extrabold tracking-wider text-amber-300 uppercase">
              Nhận định tiến bộ từ WeWIN AI Coach
            </div>
            <p className="mt-1 text-xs sm:text-sm text-slate-200 leading-relaxed max-w-2xl">
              {insightMessage}
            </p>
          </div>
        </div>

        {/* Accumulated Skills Badge */}
        {(totalWords > 0 || totalFrames > 0) && (
          <div className="flex items-center gap-3 shrink-0 pt-2 md:pt-0 border-t border-white/10 md:border-t-0">
            <div className="text-right">
              <span className="block text-[11px] text-slate-300">Tích lũy toàn khóa</span>
              <div className="text-xs font-bold text-amber-300">
                {totalWords} từ vựng · {totalFrames} mẫu câu
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
