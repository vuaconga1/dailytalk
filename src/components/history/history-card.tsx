"use client";

import { useState } from "react";
import Link from "next/link";
import { formatVnDate } from "@/lib/time";
import type { HistoryItem } from "@/domain/types";

function formatFullVnDate(dateStr: string): string {
  try {
    const d = new Date(Date.parse(dateStr));
    const weekdays = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
    const weekday = weekdays[d.getUTCDay()];
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${weekday}, ${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return formatVnDate(dateStr);
  } catch {
    return formatVnDate(dateStr);
  }
}

export function HistoryCard({ item }: { item: HistoryItem }) {
  const [expanded, setExpanded] = useState(false);
  const { summary } = item;
  const isAchieved = summary?.goal_status === "achieved";
  const hasDetails = Boolean(
    summary &&
      ((summary.errors && summary.errors.length > 0) ||
        (summary.frames_used && summary.frames_used.length > 0) ||
        (summary.review_items && summary.review_items.length > 0) ||
        summary.pronunciation_note)
  );

  return (
    <article className="group relative rounded-2xl border border-[#e2e8f4] bg-white p-5 md:p-6 shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      {/* Top Meta Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Day Badge */}
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1 text-xs font-black tracking-wider text-white shadow-xs">
            BUỔI {String(item.day).padStart(2, "0")}
          </span>

          {/* Status Badge */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold border ${
              item.completed
                ? "bg-emerald-50 text-emerald-800 border-emerald-200/80"
                : "bg-amber-50 text-amber-800 border-amber-200/80"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                item.completed ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            {item.completed ? "ĐÃ HOÀN THÀNH" : "ĐANG HỌC"}
          </span>

          {/* Goal Achieved / Needs Review Badge */}
          {summary && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                isAchieved
                  ? "bg-teal-soft text-teal-800 border border-teal-200/70"
                  : "bg-slate-100 text-slate-700 border border-slate-200"
              }`}
            >
              {isAchieved ? "🎯 Đạt mục tiêu" : "⚠️ Cần ôn tập"}
            </span>
          )}

          {/* Level Badge if available */}
          {item.level && (
            <span className="hidden sm:inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 uppercase">
              {item.level}
            </span>
          )}
        </div>

        {/* Date */}
        <time className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
          <svg className="size-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {formatFullVnDate(item.date)}
        </time>
      </div>

      {/* Main Lesson Titles */}
      <div className="mb-4">
        <h2 className="text-lg md:text-xl font-bold text-navy leading-snug group-hover:text-gold transition-colors">
          {item.title}
        </h2>
        {item.situation && item.situation !== item.title && (
          <p className="mt-1.5 text-sm text-slate-600 leading-relaxed line-clamp-2">
            {item.situation}
          </p>
        )}
      </div>

      {/* AI Coach Summary / Feedback Card */}
      {summary ? (
        <div className="rounded-xl bg-slate-50/80 p-4 md:p-5 border border-slate-200/70 text-sm">
          {/* Overview text */}
          <div className="text-slate-700 leading-relaxed mb-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Nhận xét của AI Coach
            </div>
            <p>{summary.overview}</p>
          </div>

          {/* Actionable Next Step */}
          {summary.next_step && (
            <div className="mb-3 rounded-lg bg-amber-50/70 border border-amber-200/70 p-3 text-slate-800">
              <span className="font-bold text-amber-950 flex items-center gap-1.5 text-xs uppercase tracking-wider mb-0.5">
                <span>💡</span> Điểm cần lưu ý lần tới
              </span>
              <p className="text-xs md:text-sm text-amber-900 leading-relaxed">
                {summary.next_step}
              </p>
            </div>
          )}

          {/* Pronunciation Note if available */}
          {summary.pronunciation_note && (
            <div className="mb-3 rounded-lg bg-blue-soft/50 border border-blue-200/60 p-3 text-slate-800">
              <span className="font-bold text-blue-900 flex items-center gap-1.5 text-xs uppercase tracking-wider mb-0.5">
                <span>🎙</span> Lưu ý phát âm
              </span>
              <p className="text-xs md:text-sm text-slate-700 leading-relaxed">
                {summary.pronunciation_note}
              </p>
            </div>
          )}

          {/* Expanded section: errors & frames */}
          {expanded && hasDetails && (
            <div className="my-3 space-y-3 pt-3 border-t border-slate-200/70 animate-fade-in">
              {summary.errors && summary.errors.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Lỗi cần sửa trong buổi:
                  </h4>
                  <ul className="space-y-1.5 text-xs">
                    {summary.errors.map((err, i) => (
                      <li key={i} className="rounded-md bg-white p-2 border border-slate-200">
                        <span className="font-semibold text-rose-700">{err.issue}</span>
                        <span className="mx-1 text-slate-400">→</span>
                        <span className="font-semibold text-emerald-700">{err.correction}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.frames_used && summary.frames_used.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Mẫu câu bạn đã sử dụng khi nói:
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {summary.frames_used.map((frame, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs text-emerald-800 border border-emerald-200 font-medium"
                      >
                        ✓ {frame}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {summary.review_items && summary.review_items.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Gợi ý ôn tập:
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {summary.review_items.map((item, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-white px-2.5 py-1 text-xs text-slate-700 border border-slate-200"
                      >
                        • {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom Stats & Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/70 text-xs text-slate-500">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1">
                💬 <strong className="text-slate-700">{summary.turn_count}</strong> lượt tương tác
              </span>
              <span className="inline-flex items-center gap-1">
                🎙 <strong className="text-slate-700">{summary.voice_turns}</strong> lượt luyện nói
              </span>
            </div>

            <div className="flex items-center gap-2">
              {hasDetails && (
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  className="font-semibold text-blue-accent hover:underline text-xs"
                >
                  {expanded ? "Thu gọn chi tiết ▲" : "Xem chi tiết lỗi & mẫu câu ▼"}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 text-xs text-slate-500">
          Buổi học đang được thực hiện. Hoàn thành buổi học để nhận đánh giá và tổng kết chi tiết từ AI Coach.
        </div>
      )}

      {/* Card Action Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          Lộ trình 30 ngày WeWIN
        </span>

        <Link
          href={`/lesson?day=${item.day}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-navy hover:text-gold transition-colors"
        >
          {item.completed ? "Xem lại buổi học" : "Tiếp tục học ngay"}
          <span>→</span>
        </Link>
      </div>
    </article>
  );
}

