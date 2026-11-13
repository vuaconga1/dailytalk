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

const LABEL = "text-[11px] font-bold uppercase tracking-wider text-black";

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
    <article className="group relative overflow-hidden rounded-2xl border-2 border-black bg-white shadow-(--ww-frame-shadow)">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black bg-navy-soft/50 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-lg bg-navy px-3 py-1 text-xs font-black tracking-wider text-gold-light">
            BUỔI {String(item.day).padStart(2, "0")}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-black px-2.5 py-0.5 text-xs font-bold ${
              item.completed ? "bg-white text-navy" : "bg-gold-soft text-navy"
            }`}
          >
            <span className={`size-1.5 rounded-full ${item.completed ? "bg-navy" : "bg-gold"}`} />
            {item.completed ? "ĐÃ HOÀN THÀNH" : "ĐANG HỌC"}
          </span>
          {summary && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                isAchieved ? "bg-gold text-white" : "border-[1.5px] border-black bg-white text-navy"
              }`}
            >
              {isAchieved ? "🎯 Đạt mục tiêu" : "⚠️ Cần ôn tập"}
            </span>
          )}
          {item.level && (
            <span className="hidden rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold uppercase text-navy sm:inline-flex">
              {item.level}
            </span>
          )}
        </div>
        <time className="flex items-center gap-1.5 text-xs font-semibold text-ink-secondary">
          <svg className="size-3.5 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {formatFullVnDate(item.date)}
        </time>
      </div>

      <div className="p-4 sm:p-5">
        <h2 className="mb-4 text-lg font-extrabold leading-snug text-navy md:text-xl">{item.title}</h2>

        {summary ? (
          <div className="grid gap-3 text-sm">
            <div>
              <div className={`mb-1 ${LABEL}`}>Nhận xét của AI Coach</div>
              <p className="leading-relaxed text-ink">{summary.overview}</p>
            </div>

            {summary.next_step && (
              <div className="rounded-lg border-l-4 border-gold bg-gold-soft/50 px-3 py-2.5">
                <div className={`mb-0.5 flex items-center gap-1.5 ${LABEL}`}>
                  <span aria-hidden>💡</span> Điểm cần lưu ý lần tới
                </div>
                <p className="font-semibold leading-relaxed text-navy">{summary.next_step}</p>
              </div>
            )}

            {summary.pronunciation_note && (
              <div className="rounded-lg border-l-4 border-navy bg-navy-soft/50 px-3 py-2.5">
                <div className={`mb-0.5 flex items-center gap-1.5 ${LABEL}`}>
                  <span aria-hidden>🎙</span> Lưu ý phát âm
                </div>
                <p className="leading-relaxed text-ink">{summary.pronunciation_note}</p>
              </div>
            )}

            {expanded && hasDetails && (
              <div className="animate-fade-in grid gap-4 border-t-[1.5px] border-black pt-3">
                {summary.errors && summary.errors.length > 0 && (
                  <div>
                    <h4 className={`mb-2 ${LABEL}`}>Lỗi cần sửa trong buổi</h4>
                    <ul className="grid gap-1.5">
                      {summary.errors.map((err, i) => (
                        <li key={i} className="rounded-md border-[1.5px] border-black bg-white px-3 py-2">
                          <span className="font-semibold text-rose-700">{err.issue}</span>
                          <span className="mx-1.5 font-bold text-gold">→</span>
                          <span className="font-semibold text-navy">{err.correction}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {summary.frames_used && summary.frames_used.length > 0 && (
                  <div>
                    <h4 className={`mb-2 ${LABEL}`}>Mẫu câu bạn đã sử dụng khi nói</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {summary.frames_used.map((frame, i) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded-md bg-navy px-2.5 py-1 text-xs font-medium text-white">
                          <span className="text-gold-light">✓</span> {frame}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {summary.review_items && summary.review_items.length > 0 && (
                  <div>
                    <h4 className={`mb-2 ${LABEL}`}>Gợi ý ôn tập</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {summary.review_items.map((item, i) => (
                        <span key={i} className="badge badge-gold">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t-[1.5px] border-black pt-3 text-xs text-ink-secondary">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  💬 <strong className="text-navy">{summary.turn_count}</strong> lượt tương tác
                </span>
                <span className="inline-flex items-center gap-1">
                  🎙 <strong className="text-navy">{summary.voice_turns}</strong> lượt luyện nói
                </span>
              </div>
              {hasDetails && (
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  aria-expanded={expanded}
                  className="min-h-9 text-xs font-bold text-navy underline-offset-4 hover:underline"
                >
                  {expanded ? "Thu gọn chi tiết ▲" : "Xem chi tiết lỗi & mẫu câu ▼"}
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="rounded-lg border-[1.5px] border-dashed border-black bg-navy-soft/40 px-3 py-2.5 text-xs text-ink-secondary">
            Buổi học đang được thực hiện. Hoàn thành buổi học để nhận đánh giá và tổng kết chi tiết từ AI Coach.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-black px-4 py-3 sm:px-5">
        <span className="text-xs text-ink-secondary">Lộ trình 30 ngày WeWIN</span>
        <Link
          href={`/lesson?day=${item.day}`}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-navy px-3 text-xs font-bold text-white transition-colors hover:bg-navy-light"
        >
          {item.completed ? "Xem lại buổi học" : "Tiếp tục học ngay"}
          <span className="text-gold-light">→</span>
        </Link>
      </div>
    </article>
  );
}
