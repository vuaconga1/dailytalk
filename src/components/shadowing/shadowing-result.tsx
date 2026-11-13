"use client";

import { scoreTone, type WordResult } from "@/domain/shadowing/scoring";
import type { ShadowingAttemptResult } from "@/domain/shadowing/types";
import { formatVnDateTime } from "@/lib/time";

export const TONE_LABEL = { great: "Rất tốt", good: "Khá tốt", low: "Cần luyện thêm" } as const;
export const TONE_BADGE = {
  great: "bg-navy text-white border-navy",
  good: "bg-gold-soft text-navy border-gold",
  low: "bg-rose-50 text-rose-700 border-rose-300",
} as const;

/** Model text word by word, colored by how the recognizer heard each word. */
export function AlignedTranscript({ words, compact = false }: { words: WordResult[]; compact?: boolean }) {
  return (
    <div className="select-none" onCopy={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}>
      <p className={`flex flex-wrap gap-x-1 gap-y-1.5 ${compact ? "text-sm" : "text-[15px]"} leading-snug`}>
        {words.map((w, i) => {
          if (w.status === "correct") {
            return (
              <span key={i} className="rounded bg-navy-soft px-1 py-0.5 font-medium text-navy">
                {w.expected}
              </span>
            );
          }
          if (w.status === "incorrect") {
            return (
              <span key={i} title={`Hệ thống nghe: ${w.actual}`} className="inline-flex flex-col items-center rounded bg-rose-50 px-1 py-0.5 leading-tight">
                <span className="font-semibold text-rose-700">{w.expected}</span>
                <span className="text-[11px] text-rose-400 line-through">
                  {w.actual}
                  {w.nearMiss && <span className="no-underline"> (gần đúng)</span>}
                </span>
              </span>
            );
          }
          if (w.status === "missing") {
            return (
              <span key={i} title="Bỏ sót" className="rounded bg-orange-50 px-1 py-0.5 text-orange-700 underline decoration-dotted underline-offset-4">
                {w.expected}
              </span>
            );
          }
          return (
            <span key={i} title="Đọc thừa" className="px-1 py-0.5 text-slate-400 line-through">
              {w.actual}
            </span>
          );
        })}
      </p>
      {!compact && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t-[1.5px] border-black pt-2 text-[11px] text-ink-secondary">
          <span>
            <i className="mr-1 inline-block size-2.5 rounded-sm bg-navy-soft ring-1 ring-navy/30" />
            Đúng
          </span>
          <span>
            <i className="mr-1 inline-block size-2.5 rounded-sm bg-rose-200" />
            Sai khác
          </span>
          <span>
            <i className="mr-1 inline-block size-2.5 rounded-sm bg-orange-200" />
            Bỏ sót
          </span>
          <span>
            <i className="mr-1 inline-block size-2.5 rounded-sm bg-slate-200" />
            Đọc thừa
          </span>
        </div>
      )}
    </div>
  );
}

const RESULT_TONE = {
  great: { box: "from-navy-soft to-white", score: "text-navy", title: "Xuất sắc! Bạn nói rất khớp với bài mẫu." },
  good: { box: "from-gold-soft to-white", score: "text-gold", title: "Khá tốt! Còn vài chỗ cần luyện thêm." },
  low: { box: "from-rose-50 to-white", score: "text-rose-600", title: "Cần luyện thêm. Nghe lại video và thử từng câu nhé." },
};

type Props = {
  result: ShadowingAttemptResult;
  onPlaySample?: () => void;
  onRetry?: () => void;
};

export function ShadowingResult({ result, onPlaySample, onRetry }: Props) {
  const tone = RESULT_TONE[scoreTone(result.score)];
  const stats = [
    { label: "Từ đúng", value: `${result.correctCount}/${result.totalWords}`, className: "text-navy" },
    { label: "Sai khác", value: result.substitutionCount, className: "text-rose-700" },
    { label: "Bỏ sót", value: result.deletionCount, className: "text-gold" },
    { label: "Đọc thừa", value: result.insertionCount, className: "text-muted" },
  ];

  return (
    <div className="grid gap-5">
      <div className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-black bg-gradient-to-br p-5 ${tone.box}`}>
        <div className="min-w-0">
          <div className="text-xs font-bold tracking-wider text-black uppercase">Kết quả đọc cả bài</div>
          <h3 className="mt-1 text-lg font-bold break-words text-navy">{tone.title}</h3>
          <p className="text-xs text-muted">{formatVnDateTime(new Date(result.createdAt))}</p>
        </div>
        <div className="shrink-0 text-right">
          <span className={`text-5xl font-extrabold tracking-tight ${tone.score}`}>{result.score}</span>
          <span className="text-lg font-semibold text-muted">/100</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0 rounded-xl border-[1.5px] border-black bg-white px-4 py-3">
            <div className="text-xs font-medium text-ink-secondary">{s.label}</div>
            <div className={`text-2xl font-extrabold ${s.className}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <p className="rounded-lg border-l-4 border-gold bg-gold-soft/40 px-3 py-2 text-xs text-ink-secondary">
        Điểm này cho biết phần hệ thống nhận diện được khớp với câu mẫu bao nhiêu, không phải điểm phát âm.
      </p>

      <div>
        <h4 className="mb-2 border-b-2 border-black pb-1.5 text-sm font-extrabold text-navy">Đối chiếu từng từ</h4>
        <div className="max-h-[360px] overflow-y-auto rounded-xl border-[1.5px] border-black bg-white p-4">
          <AlignedTranscript words={result.wordResults} />
        </div>
      </div>

      <div>
        <h4 className="mb-2 border-b-2 border-black pb-1.5 text-sm font-extrabold text-navy">Hệ thống nghe được</h4>
        <p className="rounded-xl border-[1.5px] border-black bg-navy-soft/40 p-4 text-sm break-words text-ink">{result.recognizedText}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0 rounded-xl border-[1.5px] border-black bg-white p-4">
          <div className="mb-2 text-xs font-bold tracking-wider text-black uppercase">Bài mẫu</div>
          {onPlaySample ? (
            <button type="button" className="btn btn-secondary !py-2 text-xs" onClick={onPlaySample}>
              ▶ Phát video mẫu từ đầu
            </button>
          ) : (
            <p className="text-xs text-muted">Xem video ở đầu trang.</p>
          )}
        </div>
        <div className="min-w-0 rounded-xl border-[1.5px] border-black bg-white p-4">
          <div className="mb-2 text-xs font-bold tracking-wider text-black uppercase">Bản ghi của bạn</div>
          {result.recordingUrl ? (
            <>
              <audio controls preload="none" src={result.recordingUrl} className="h-9 w-full" />
              <p className="mt-1 text-[11px] text-muted">
                Bản ghi được lưu đến {formatVnDateTime(new Date(result.recordingExpiresAt!))}.
              </p>
            </>
          ) : (
            <p className="text-xs text-muted">Bản ghi đã hết hạn lưu trữ.</p>
          )}
        </div>
      </div>

      {onRetry && (
        <div>
          <button type="button" className="btn" onClick={onRetry}>
            ↻ Luyện lại bài này
          </button>
        </div>
      )}
    </div>
  );
}
