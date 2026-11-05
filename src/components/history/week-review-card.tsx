"use client";

import { useState } from "react";
import type { WeekReview } from "@/lib/types";

export function WeekSummaryCard({ review }: { review: WeekReview }) {
  const [open, setOpen] = useState(false);
  const finished = review.done === review.total;
  const usedFrames = review.frames.filter((f) => f.used).length;
  const missedFrames = review.frames.filter((f) => !f.used);
  const achievementRate = review.done > 0 ? Math.round((review.achieved / review.done) * 100) : 0;

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-[#f8fafc] to-[#edf3fd]/50 p-5 md:p-6 shadow-xs transition-all duration-200 mb-6">
      {/* Top Banner Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-navy text-amber-400 font-extrabold text-sm shadow-xs">
            W{review.week}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="eyebrow !mb-0 text-[11px]">TỔNG KẾT TUẦN {review.week}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  finished
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {finished ? "Đã hoàn thành tuần" : "Đang học trong tuần"}
              </span>
            </div>
            <h3 className="text-base md:text-lg font-bold text-navy mt-0.5">
              {finished
                ? `Xuất sắc! Bạn đã hoàn thành trọn vẹn tuần ${review.week}.`
                : `Tiến độ học tập tuần ${review.week} (Buổi ${review.fromDay}–${review.toDay})`}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-navy border border-slate-200 shadow-2xs">
            <span className="size-2 rounded-full bg-emerald-500" />
            {review.done}/{review.total} BUỔI ĐÃ HỌC
          </span>
        </div>
      </div>

      {/* Mini KPI stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 md:gap-3.5 my-4">
        <div className="rounded-xl border border-white/80 bg-white/90 p-3 shadow-2xs">
          <span className="block text-[11px] font-semibold text-slate-500">Hoàn thành</span>
          <strong className="text-lg md:text-xl font-black text-navy">
            {review.done}/{review.total}
          </strong>
          <span className="block text-[10px] text-slate-400">buổi trong tuần</span>
        </div>

        <div className="rounded-xl border border-white/80 bg-white/90 p-3 shadow-2xs">
          <span className="block text-[11px] font-semibold text-slate-500">Đạt mục tiêu</span>
          <strong className="text-lg md:text-xl font-black text-emerald-600">
            {review.achieved}/{review.done || 1}
          </strong>
          <span className="block text-[10px] text-slate-400">({achievementRate}% buổi học)</span>
        </div>

        <div className="rounded-xl border border-white/80 bg-white/90 p-3 shadow-2xs">
          <span className="block text-[11px] font-semibold text-slate-500">Luyện nói AI</span>
          <strong className="text-lg md:text-xl font-black text-blue-accent">
            {review.voiceTurns}
          </strong>
          <span className="block text-[10px] text-slate-400">lượt phản xạ giọng</span>
        </div>

        <div className="rounded-xl border border-white/80 bg-white/90 p-3 shadow-2xs">
          <span className="block text-[11px] font-semibold text-slate-500">Vốn từ mới</span>
          <strong className="text-lg md:text-xl font-black text-gold">
            {review.words.length}
          </strong>
          <span className="block text-[10px] text-slate-400">từ vựng cốt lõi</span>
        </div>
      </div>

      {/* Expandable toggle button */}
      <div className="pt-1 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-navy hover:text-gold transition-colors"
        >
          <span>{open ? "Thu gọn báo cáo tuần" : "Xem chi tiết từ vựng, mẫu câu & lưu ý tuần này"}</span>
          <svg
            className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {review.done > 0 && (
          <span className="text-xs text-slate-500 hidden sm:inline-block">
            Mẫu câu áp dụng: <b>{usedFrames}/{review.frames.length}</b>
          </span>
        )}
      </div>

      {/* Expanded Weekly Details */}
      {open && (
        <div className="mt-4 pt-4 border-t border-slate-200 space-y-4 animate-fade-in text-sm">
          {/* 1. Vocabulary of the week */}
          {review.words.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center gap-1.5">
                <span>📚</span> Từ vựng cốt lõi của tuần ({review.words.length} từ)
              </h4>
              <div className="flex flex-wrap gap-2">
                {review.words.map((w) => (
                  <span
                    key={w.word}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 text-xs shadow-2xs"
                  >
                    <b className="text-navy">{w.word}</b>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600">{w.meaning}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 2. Frames of the week */}
          {review.frames.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center gap-1.5">
                <span>💬</span> Mẫu câu phản xạ ({usedFrames}/{review.frames.length} đã áp dụng khi nói)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                {review.frames.map((f, i) => (
                  <div
                    key={`${f.day}-${f.frame}-${i}`}
                    className={`flex items-start gap-2 rounded-lg p-2.5 border ${
                      f.used
                        ? "bg-emerald-50/60 border-emerald-200 text-emerald-900"
                        : "bg-white border-slate-200 text-slate-600"
                    }`}
                  >
                    <span className={`font-bold ${f.used ? "text-emerald-600" : "text-slate-400"}`}>
                      {f.used ? "✓" : "○"}
                    </span>
                    <span className="flex-1 font-medium">{f.frame}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">B.{f.day}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Recurring errors */}
          {review.errors.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                <span>⚠️</span> Lỗi hay gặp trong tuần & cách khắc phục
              </h4>
              <div className="space-y-2">
                {review.errors.map((e) => (
                  <div
                    key={e.issue}
                    className="rounded-lg bg-amber-50/70 border border-amber-200/80 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between font-semibold text-amber-950">
                      <span>{e.issue}</span>
                      {e.count > 1 && (
                        <span className="rounded bg-amber-200/80 px-1.5 py-0.5 text-[10px] text-amber-900">
                          {e.count} buổi lặp lại
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-emerald-800 font-medium">
                      → Sửa chuẩn: {e.correction}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Weekend AI Coach Advice */}
          {review.done > 0 && (
            <div className="rounded-xl bg-blue-soft/70 border border-blue-200/80 p-4 text-xs md:text-sm text-slate-800">
              <span className="font-bold text-navy uppercase tracking-wider text-xs flex items-center gap-1.5 mb-2">
                <span>🎯</span> Gợi ý ôn tập cuối tuần từ WeWIN Coach
              </span>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-700 leading-relaxed">
                {missedFrames.length > 0 && (
                  <li>
                    Thử nói lại {missedFrames.length} mẫu câu chưa kịp áp dụng trong tuần:{" "}
                    <b>“{missedFrames[0].frame}”</b>
                  </li>
                )}
                {review.review.length > 0 && (
                  <li>
                    Chủ đề cần ôn: <span className="font-semibold">{review.review.join(" · ")}</span>
                  </li>
                )}
                <li>
                  Luyện nói to {review.words.length} từ mới của tuần để ghi nhớ ngữ điệu tự nhiên.
                </li>
                {finished && review.toDay < 30 && (
                  <li className="text-blue-900 font-semibold">
                    Chuẩn bị sẵn sàng cho Tuần {review.week + 1} với các tình huống giao tiếp nâng cao!
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

