"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { HistoryCard } from "@/components/history/history-card";
import { HistoryFilters, type SortOrder, type StatusFilter } from "@/components/history/history-filters";
import { HistorySummary } from "@/components/history/history-summary";
import { WeekSummaryCard } from "@/components/history/week-review-card";
import type { HistoryItem, WeekReview } from "@/lib/types";

type Props = {
  history: HistoryItem[];
  weekReviews: WeekReview[];
  streak: number;
  userName?: string;
};

function getWeekNumber(day: number): number {
  return Math.min(Math.ceil(day / 7), 5);
}

function getWeekRange(weekNum: number): { fromDay: number; toDay: number; total: number } {
  const fromDay = (weekNum - 1) * 7 + 1;
  const toDay = Math.min(weekNum * 7, 30);
  return { fromDay, toDay, total: toDay - fromDay + 1 };
}

export function HistoryView({ history, weekReviews, streak }: Props) {
  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWeek, setSelectedWeek] = useState<number | "all">("all");
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  // Extract Month Options dynamically from actual dates
  const monthOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of history) {
      if (!h.date) continue;
      const m = h.date.slice(0, 7); // "YYYY-MM"
      map.set(m, (map.get(m) ?? 0) + 1);
    }
    const months = [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    const options = [{ value: "all", label: "Toàn bộ thời gian", count: history.length }];
    for (const [val, count] of months) {
      const parts = val.split("-");
      if (parts.length === 2) {
        options.push({ value: val, label: `Tháng ${parts[1]}/${parts[0]}`, count });
      }
    }
    return options;
  }, [history]);

  // Is any filter active?
  const isFiltered =
    Boolean(searchQuery.trim()) ||
    selectedWeek !== "all" ||
    selectedStatus !== "all" ||
    selectedMonth !== "all" ||
    sortOrder !== "newest";

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedWeek("all");
    setSelectedStatus("all");
    setSelectedMonth("all");
    setSortOrder("newest");
  };

  // Filter & Sort Logic
  const filteredItems = useMemo(() => {
    let result = [...history];

    // 1. Search Query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (h) =>
          h.title.toLowerCase().includes(query) ||
          (h.situation && h.situation.toLowerCase().includes(query)) ||
          `buổi ${h.day}`.includes(query) ||
          `ngày ${h.day}`.includes(query) ||
          `day ${h.day}`.includes(query) ||
          String(h.day) === query
      );
    }

    // 2. Week Filter
    if (selectedWeek !== "all") {
      result = result.filter((h) => getWeekNumber(h.day) === selectedWeek);
    }

    // 3. Status Filter
    if (selectedStatus === "completed") {
      result = result.filter((h) => h.completed);
    } else if (selectedStatus === "in_progress") {
      result = result.filter((h) => !h.completed);
    } else if (selectedStatus === "achieved") {
      result = result.filter((h) => h.summary?.goal_status === "achieved");
    } else if (selectedStatus === "needs_review") {
      result = result.filter(
        (h) => h.completed && h.summary?.goal_status !== "achieved"
      );
    }

    // 4. Month Filter
    if (selectedMonth !== "all") {
      result = result.filter((h) => h.date.startsWith(selectedMonth));
    }

    // 5. Sorting
    result.sort((a, b) => {
      if (sortOrder === "newest") {
        return b.day - a.day;
      }
      if (sortOrder === "oldest") {
        return a.day - b.day;
      }
      if (sortOrder === "day_asc") {
        return a.day - b.day;
      }
      if (sortOrder === "day_desc") {
        return b.day - a.day;
      }
      return 0;
    });

    return result;
  }, [history, searchQuery, selectedWeek, selectedStatus, selectedMonth, sortOrder]);

  // Group filtered items by week
  const weekGroups = useMemo(() => {
    const map = new Map<number, HistoryItem[]>();
    for (const item of filteredItems) {
      const w = getWeekNumber(item.day);
      if (!map.has(w)) {
        map.set(w, []);
      }
      map.get(w)!.push(item);
    }

    // Sort weeks according to sort order (or newest first)
    const weeks = [...map.keys()].sort((a, b) => {
      if (sortOrder === "oldest" || sortOrder === "day_asc") {
        return a - b;
      }
      return b - a;
    });

    return weeks.map((w) => {
      const itemsInWeek = map.get(w)!;
      const range = getWeekRange(w);
      const foundReview = weekReviews.find((r) => r.week === w);
      const review: WeekReview = foundReview ?? {
        week: w,
        fromDay: range.fromDay,
        toDay: range.toDay,
        total: range.total,
        done: itemsInWeek.filter((i) => i.completed).length,
        achieved: itemsInWeek.filter((i) => i.summary?.goal_status === "achieved").length,
        turns: itemsInWeek.reduce((acc, i) => acc + (i.summary?.turn_count ?? 0), 0),
        voiceTurns: itemsInWeek.reduce((acc, i) => acc + (i.summary?.voice_turns ?? 0), 0),
        days: itemsInWeek.map((i) => ({
          day: i.day,
          title: i.title,
          status: i.completed ? (i.summary?.goal_status ?? "insufficient_evidence") : null,
        })),
        words: [],
        frames: [],
        errors: [],
        review: [],
      };
      return {
        week: w,
        items: itemsInWeek,
        range,
        review,
      };
    });
  }, [filteredItems, sortOrder, weekReviews]);

  return (
    <section className="animate-fade-in pb-16">
      {/* 1. Page Header */}
      <div className="mb-8 border-b border-[#e2e8f4] pb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="eyebrow flex items-center gap-2">
              <span className="size-2 rounded-full bg-gold animate-pulse-glow" />
              NHÌN LẠI ĐỂ TIẾN BỘ
            </div>
            <h1 className="page-title mt-1">Nhật ký học tập.</h1>
            <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-2xl">
              Theo dõi từng buổi học, các lượt phản xạ cùng WeWIN AI Coach và nhận xét chi tiết sau mỗi buổi để thấy sự tiến bộ mỗi ngày.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/today"
              className="inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition-all hover:-translate-y-0.5 hover:bg-navy-light"
            >
              <span>Vào học hôm nay</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </div>

      {history.length > 0 ? (
        <>
          {/* 2. Monthly / Overall Progress Summary Dashboard */}
          <HistorySummary
            history={history}
            weekReviews={weekReviews}
            streak={streak}
            selectedMonth={selectedMonth}
            onSelectMonth={setSelectedMonth}
            monthOptions={monthOptions}
          />

          {/* 3. Search and Filter Bar */}
          <HistoryFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedWeek={selectedWeek}
            onWeekChange={setSelectedWeek}
            selectedStatus={selectedStatus}
            onStatusChange={setSelectedStatus}
            sortOrder={sortOrder}
            onSortChange={setSortOrder}
            totalCount={history.length}
            filteredCount={filteredItems.length}
            onReset={handleResetFilters}
            isFiltered={isFiltered}
          />

          {/* 4. Filtered Content: Grouped by Week */}
          {weekGroups.length > 0 ? (
            <div className="space-y-10">
              {weekGroups.map(({ week, items, range, review }) => {
                const totalInWeek = range.total;
                const completedInWeek = items.filter((h) => h.completed).length;

                return (
                  <div key={week} className="relative">
                    {/* Week Header Bar */}
                    <div className="sticky top-16 z-20 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white/95 px-5 py-3.5 shadow-xs backdrop-blur-md">
                      <div className="flex items-center gap-3">
                        <span className="grid size-8 place-items-center rounded-lg bg-navy text-xs font-black text-amber-300">
                          W{week}
                        </span>
                        <div>
                          <h2 className="text-base sm:text-lg font-black text-navy leading-tight">
                            TUẦN {week} · BUỔI {String(range.fromDay).padStart(2, "0")}–
                            {String(range.toDay).padStart(2, "0")}
                          </h2>
                          <span className="text-xs text-slate-500">
                            Hiển thị {items.length} buổi trong tuần này
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                          <span
                            className={`size-2 rounded-full ${
                              completedInWeek === totalInWeek
                                ? "bg-emerald-500"
                                : completedInWeek > 0
                                  ? "bg-amber-500"
                                  : "bg-slate-300"
                            }`}
                          />
                          {completedInWeek}/{totalInWeek} buổi hoàn thành
                        </span>
                      </div>
                    </div>

                    {/* Weekly Summary Card (shown if week review data exists) */}
                    {review && <WeekSummaryCard review={review} />}

                    {/* List of Sessions in this Week */}
                    <div className="space-y-4">
                      {items.map((item) => (
                        <HistoryCard key={item.day} item={item} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* No Filter Matches State */
            <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-xs">
              <span className="grid mx-auto size-14 place-items-center rounded-2xl bg-slate-100 text-2xl text-slate-500 mb-4">
                🔍
              </span>
              <h3 className="text-lg font-bold text-navy">
                Không tìm thấy buổi học nào phù hợp
              </h3>
              <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
                Không có kết quả nào cho tiêu chí tìm kiếm hoặc bộ lọc hiện tại. Hãy thử chọn tuần khác hoặc xóa bộ lọc.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-navy-light transition-all"
              >
                <span>Xóa toàn bộ bộ lọc</span>
              </button>
            </div>
          )}
        </>
      ) : (
        /* Empty State (User has no history at all yet) */
        <div className="rounded-3xl border border-slate-200 bg-white p-12 md:p-16 text-center shadow-xs">
          <span className="grid mx-auto size-16 place-items-center rounded-2xl bg-amber-50 text-3xl text-gold mb-4 border border-amber-200/60">
            📖
          </span>
          <h2 className="text-xl md:text-2xl font-black text-navy">
            Chưa có lịch sử học tập.
          </h2>
          <p className="mt-2 text-sm md:text-base text-slate-600 max-w-lg mx-auto leading-relaxed">
            Nhật ký học tập sẽ tự động ghi lại quá trình luyện nói 15 phút hàng ngày, phân tích giọng nói và nhận xét chi tiết sau mỗi buổi cùng AI Coach.
          </p>
          <div className="mt-6">
            <Link
              href="/today"
              className="inline-flex items-center gap-2 rounded-xl bg-navy px-6 py-3.5 text-sm font-bold text-white shadow-md hover:bg-navy-light hover:shadow-lg transition-all"
            >
              <span>Bắt đầu buổi học đầu tiên</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

