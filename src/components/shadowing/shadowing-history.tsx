"use client";

import { useEffect, useState } from "react";
import { api, errorMessage } from "@/client/api";
import { scoreTone } from "@/domain/shadowing/scoring";
import type { ShadowingAttemptResult, ShadowingHistoryItem } from "@/domain/shadowing/types";
import { formatVnDateTime } from "@/lib/time";
import { ShadowingResult, TONE_BADGE } from "./shadowing-result";

type Props = { slug: string; refreshKey: number; onPlaySample: () => void };

/** "Đọc cả bài" attempts of this exercise; collapsed by default. */
export function ShadowingHistory({ slug, refreshKey, onPlaySample }: Props) {
  const [items, setItems] = useState<ShadowingHistoryItem[] | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ id: string; result: ShadowingAttemptResult | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ items: ShadowingHistoryItem[] }>(`/api/shadowing/history?slug=${encodeURIComponent(slug)}`)
      .then((r) => !cancelled && setItems(r.items))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [slug, refreshKey]);

  async function view(id: string) {
    if (viewing?.id === id) return setViewing(null);
    setViewing({ id, result: null });
    try {
      const result = await api<ShadowingAttemptResult>(`/api/shadowing/attempt?id=${encodeURIComponent(id)}`);
      setViewing((v) => (v?.id === id ? { id, result } : v));
    } catch (e) {
      setViewing(null);
      setError(errorMessage(e));
    }
  }

  const best = items?.length ? Math.max(...items.map((i) => i.score)) : null;

  return (
    <section className="rounded-2xl border border-line bg-white shadow-[0_4px_20px_-4px_rgba(20,40,90,0.05)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-[56px] w-full items-center justify-between gap-3 px-5 py-3 text-left"
      >
        <span className="flex flex-wrap items-center gap-2">
          <b className="text-sm tracking-wider text-navy uppercase">Lịch sử làm bài</b>
          {items && <span className="badge !py-0.5">{items.length} lần</span>}
          {best !== null && <span className="badge badge-gold !py-0.5">🏆 {best}/100</span>}
        </span>
        <span className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="border-t border-line px-5 py-4">
          {error && <p className="form-error !mt-0 mb-3">{error}</p>}
          {!items && !error && <p className="text-sm text-muted">Đang tải…</p>}
          {items && !items.length && (
            <p className="py-4 text-center text-sm text-muted">Bạn chưa nộp lần nào. Chọn “Đọc cả bài” để ghi âm và nộp bài.</p>
          )}
          <ul className="grid gap-2">
            {items?.map((item, i) => (
              <li key={item.attemptId} className="rounded-xl border border-line">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <b className="text-sm text-navy">Lần {items.length - i}</b>
                    <span className="ml-2 text-xs text-muted">{formatVnDateTime(new Date(item.createdAt))}</span>
                    {item.hasRecording && <span className="badge ml-2 !px-2 !py-0 text-[10px]">Audio</span>}
                  </div>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${TONE_BADGE[scoreTone(item.score)]}`}>{item.score}/100</span>
                  <span className="text-xs text-muted">
                    {item.correctCount}/{item.totalWords} từ
                  </span>
                  <button type="button" className="btn btn-outline !px-3 !py-1.5 text-xs" onClick={() => void view(item.attemptId)}>
                    {viewing?.id === item.attemptId ? "Thu gọn" : "Xem lại"}
                  </button>
                </div>
                {viewing?.id === item.attemptId && (
                  <div className="border-t border-line p-4">
                    {viewing.result ? <ShadowingResult result={viewing.result} onPlaySample={onPlaySample} /> : <p className="text-sm text-muted">Đang tải…</p>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
