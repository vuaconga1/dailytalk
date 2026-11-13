"use client";

import { useState } from "react";
import type { WeekReview } from "@/domain/types";

const LABEL = "mb-2 flex items-center gap-1.5 border-b-[1.5px] border-black pb-1.5 text-xs font-bold uppercase tracking-wider text-black";

export function WeekSummaryCard({ review }: { review: WeekReview }) {
  const [open, setOpen] = useState(false);
  const finished = review.done === review.total;
  const usedFrames = review.frames.filter((f) => f.used).length;
  const missedFrames = review.frames.filter((f) => !f.used);
  const achievementRate = review.done > 0 ? Math.round((review.achieved / review.done) * 100) : 0;

  const stats: { label: string; value: string | number; note: string; gold?: boolean }[] = [
    { label: "Hoàn thành", value: `${review.done}/${review.total}`, note: "buổi trong tuần" },
    { label: "Đạt mục tiêu", value: `${review.achieved}/${review.done || 1}`, note: `(${achievementRate}% buổi học)`, gold: true },
    { label: "Luyện nói AI", value: review.voiceTurns, note: "lượt phản xạ giọng" },
    { label: "Vốn từ mới", value: review.words.length, note: "từ vựng cốt lõi", gold: true },
  ];

  return (
    <div className="mb-6 rounded-2xl border-2 border-black bg-white p-4 shadow-(--ww-frame-shadow) sm:p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-navy text-sm font-extrabold text-gold-light">W{review.week}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gold">Tổng kết tuần {review.week}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  finished ? "bg-navy text-white" : "border-[1.5px] border-black bg-gold-soft text-navy"
                }`}
              >
                {finished ? "Đã hoàn thành tuần" : "Đang học trong tuần"}
              </span>
            </div>
            <h3 className="mt-0.5 text-base font-extrabold text-navy md:text-lg">
              {finished
                ? `Xuất sắc! Bạn đã hoàn thành trọn vẹn tuần ${review.week}.`
                : `Tiến độ học tập tuần ${review.week} (Buổi ${review.fromDay}–${review.toDay})`}
            </h3>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-black bg-white px-3 py-1 text-xs font-bold text-navy">
          <span className="size-2 rounded-full bg-gold" />
          {review.done}/{review.total} BUỔI ĐÃ HỌC
        </span>
      </div>

      <div className="my-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 md:gap-3">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0 rounded-xl border-[1.5px] border-black bg-white p-3">
            <span className="block text-[11px] font-semibold text-ink-secondary">{s.label}</span>
            <strong className={`text-xl font-black md:text-2xl ${s.gold ? "text-gold" : "text-navy"}`}>{s.value}</strong>
            <span className="block text-[10px] text-muted">{s.note}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="inline-flex min-h-9 items-center gap-1.5 text-xs font-bold text-navy underline-offset-4 hover:underline"
        >
          <span>{open ? "Thu gọn báo cáo tuần" : "Xem chi tiết từ vựng, mẫu câu & lưu ý tuần này"}</span>
          <svg className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {review.done > 0 && (
          <span className="hidden text-xs text-ink-secondary sm:inline-block">
            Mẫu câu áp dụng: <b className="text-navy">{usedFrames}/{review.frames.length}</b>
          </span>
        )}
      </div>

      {open && (
        <div className="animate-fade-in mt-4 grid gap-5 border-t-2 border-black pt-4 text-sm">
          {review.words.length > 0 && (
            <div>
              <h4 className={LABEL}>
                <span aria-hidden>📚</span> Từ vựng cốt lõi của tuần ({review.words.length} từ)
              </h4>
              <div className="flex flex-wrap gap-2">
                {review.words.map((w) => (
                  <span key={w.word} className="inline-flex min-w-0 items-center gap-1.5 rounded-lg border-[1.5px] border-black bg-white px-3 py-1.5 text-xs">
                    <b className="text-navy">{w.word}</b>
                    <span className="text-muted">·</span>
                    <span className="text-ink-secondary">{w.meaning}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {review.frames.length > 0 && (
            <div>
              <h4 className={LABEL}>
                <span aria-hidden>💬</span> Mẫu câu phản xạ ({usedFrames}/{review.frames.length} đã áp dụng khi nói)
              </h4>
              <div className="grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
                {review.frames.map((f, i) => (
                  <div
                    key={`${f.day}-${f.frame}-${i}`}
                    className={`flex min-w-0 items-start gap-2 rounded-lg border-[1.5px] border-black p-2.5 ${
                      f.used ? "bg-navy-soft/60 text-navy" : "bg-white text-ink-secondary"
                    }`}
                  >
                    <span className={`font-bold ${f.used ? "text-gold" : "text-muted"}`}>{f.used ? "✓" : "○"}</span>
                    <span className={`min-w-0 flex-1 ${f.used ? "font-semibold" : "font-medium"}`}>{f.frame}</span>
                    <span className="shrink-0 text-[10px] text-muted">B.{f.day}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {review.errors.length > 0 && (
            <div>
              <h4 className={LABEL}>
                <span aria-hidden>⚠️</span> Lỗi hay gặp trong tuần & cách khắc phục
              </h4>
              <div className="grid gap-2">
                {review.errors.map((e) => (
                  <div key={e.issue} className="rounded-lg border-[1.5px] border-black bg-white p-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 font-semibold text-rose-700">
                      <span className="min-w-0">{e.issue}</span>
                      {e.count > 1 && (
                        <span className="rounded bg-gold-soft px-1.5 py-0.5 text-[10px] text-navy">{e.count} buổi lặp lại</span>
                      )}
                    </div>
                    <div className="mt-1 font-semibold text-navy">
                      <span className="text-gold">→</span> Sửa chuẩn: {e.correction}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {review.done > 0 && (
            <div className="rounded-xl border-l-8 border-gold bg-navy p-4 text-white">
              <span className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gold-light">
                <span aria-hidden>🎯</span> Gợi ý ôn tập cuối tuần từ WeWIN Coach
              </span>
              <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-white/90 marker:text-gold md:text-sm">
                {missedFrames.length > 0 && (
                  <li>
                    Thử nói lại {missedFrames.length} mẫu câu chưa kịp áp dụng trong tuần:{" "}
                    <b className="text-gold-light">“{missedFrames[0].frame}”</b>
                  </li>
                )}
                {review.review.length > 0 && (
                  <li>
                    Chủ đề cần ôn: <span className="font-semibold">{review.review.join(" · ")}</span>
                  </li>
                )}
                <li>Luyện nói to {review.words.length} từ mới của tuần để ghi nhớ ngữ điệu tự nhiên.</li>
                {finished && review.toDay < 30 && (
                  <li className="font-semibold text-gold-light">
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
