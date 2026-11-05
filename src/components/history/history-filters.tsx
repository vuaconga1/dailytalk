"use client";

export type StatusFilter = "all" | "completed" | "in_progress" | "achieved" | "needs_review";
export type SortOrder = "newest" | "oldest" | "day_asc" | "day_desc";

type Props = {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedWeek: number | "all";
  onWeekChange: (week: number | "all") => void;
  selectedStatus: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  sortOrder: SortOrder;
  onSortChange: (sort: SortOrder) => void;
  totalCount: number;
  filteredCount: number;
  onReset: () => void;
  isFiltered: boolean;
};

const WEEKS = [
  { value: "all" as const, label: "Tất cả các tuần" },
  { value: 1, label: "Tuần 1 (01–07)" },
  { value: 2, label: "Tuần 2 (08–14)" },
  { value: 3, label: "Tuần 3 (15–21)" },
  { value: 4, label: "Tuần 4 (22–28)" },
  { value: 5, label: "Tuần 5 (29–30)" },
];

const STATUSES: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Tất cả trạng thái" },
  { value: "completed", label: "Đã hoàn thành" },
  { value: "in_progress", label: "Đang học" },
  { value: "achieved", label: "Đạt mục tiêu buổi" },
  { value: "needs_review", label: "Cần ôn tập thêm" },
];

export function HistoryFilters({
  searchQuery,
  onSearchChange,
  selectedWeek,
  onWeekChange,
  selectedStatus,
  onStatusChange,
  sortOrder,
  onSortChange,
  totalCount,
  filteredCount,
  onReset,
  isFiltered,
}: Props) {
  return (
    <div className="mb-8 rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs">
      {/* Row 1: Search & Dropdown Selectors */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search input with icon */}
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm kiếm theo chủ đề, tình huống, bài học..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-9 text-xs sm:text-sm text-slate-800 placeholder-slate-400 transition-all focus:border-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy/10"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
              title="Xóa tìm kiếm"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Status Filter Dropdown */}
        <div className="relative shrink-0">
          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
            className="w-full md:w-auto appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3.5 pr-8 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs focus:border-navy focus:outline-none cursor-pointer hover:border-slate-300"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
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

        {/* Sort Dropdown */}
        <div className="relative shrink-0">
          <select
            value={sortOrder}
            onChange={(e) => onSortChange(e.target.value as SortOrder)}
            className="w-full md:w-auto appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3.5 pr-8 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs focus:border-navy focus:outline-none cursor-pointer hover:border-slate-300"
          >
            <option value="newest">Mới nhất trước</option>
            <option value="oldest">Cũ nhất trước</option>
            <option value="day_asc">Thứ tự Buổi (01 → 30)</option>
            <option value="day_desc">Thứ tự Buổi (30 → 01)</option>
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

      {/* Row 2: Week Filter Pills & Counter */}
      <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
        {/* Week Selector Pills */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">
            Tuần:
          </span>
          {WEEKS.map((w) => {
            const active = selectedWeek === w.value;
            return (
              <button
                key={String(w.value)}
                type="button"
                onClick={() => onWeekChange(w.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-200 ${
                  active
                    ? "bg-navy text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                }`}
              >
                {w.label}
              </button>
            );
          })}
        </div>

        {/* Counter & Reset Filter */}
        <div className="flex items-center gap-3 text-xs text-slate-500 ml-auto">
          <span>
            Hiển thị <strong className="text-navy font-bold">{filteredCount}</strong>/{totalCount} buổi
          </span>

          {isFiltered && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 font-bold text-amber-800 hover:bg-amber-100 border border-amber-200/80 transition-colors"
            >
              <span>✕</span>
              <span>Xóa bộ lọc</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

