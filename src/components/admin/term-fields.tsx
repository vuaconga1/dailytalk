"use client";

import { useId, useState } from "react";
import { DEFAULT_PACKAGE_DAYS, MAX_PACKAGE_DAYS, TERM_PRESETS } from "@/domain/access";
import { vnDate } from "@/lib/time";

/** Account term picker: a preset, a custom number of days, an exact end date, or no end date. */
export function TermFields({ extending = false }: { extending?: boolean }) {
  const id = useId();
  const [term, setTerm] = useState(String(DEFAULT_PACKAGE_DAYS));

  return (
    <>
      <div className="field">
        <label htmlFor={`${id}-term`}>{extending ? "Thời hạn (cộng thêm)" : "Thời hạn tài khoản"}</label>
        <select id={`${id}-term`} name="term" value={term} onChange={(e) => setTerm(e.target.value)}>
          {TERM_PRESETS.map((p) => (
            <option key={p.days} value={p.days}>
              {p.label}
            </option>
          ))}
          <option value="custom">Tùy chọn số ngày…</option>
          <option value="date">Đến ngày cụ thể…</option>
          <option value="unlimited">Không giới hạn</option>
        </select>
      </div>
      {term === "custom" && (
        <div className="field">
          <label htmlFor={`${id}-days`}>Số ngày (1–{MAX_PACKAGE_DAYS})</label>
          <input id={`${id}-days`} name="days" type="number" min={1} max={MAX_PACKAGE_DAYS} defaultValue={DEFAULT_PACKAGE_DAYS} required />
        </div>
      )}
      {term === "date" && (
        <div className="field">
          <label htmlFor={`${id}-end`}>Hết hạn sau ngày</label>
          <input id={`${id}-end`} name="endDate" type="date" min={vnDate()} required />
        </div>
      )}
    </>
  );
}
