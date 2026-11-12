"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { api, errorMessage } from "@/client/api";
import { ADMIN_MIN_PASSWORD, DEFAULT_PACKAGE_DAYS, MAX_PACKAGE_DAYS, TERM_PRESETS } from "@/domain/access";
import { vnDate } from "@/lib/time";

type Row = {
  key: number;
  name: string;
  email: string;
  password: string;
  phone: string;
  term: string;
  days: string;
  endDate: string;
  result?: { ok: boolean; text: string };
};

type TextField = "name" | "email" | "password" | "phone";
type BulkResult = { created: number; results: ({ ok: true; id: string } | { ok: false; error: string })[] };

/** Spreadsheet column order, also used when pasting from Excel / Google Sheets. */
const COLUMNS = ["name", "email", "password", "phone", "term", "value"] as const;
type Column = (typeof COLUMNS)[number];

const MAX_ROWS = 200;
const START_ROWS = 5;
const PRESET_DAYS = new Set<number>(TERM_PRESETS.map((p) => p.days));
const PASSWORD_CHARS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

let nextKey = 0;
function blankRow(term = String(DEFAULT_PACKAGE_DAYS)): Row {
  return { key: nextKey++, name: "", email: "", password: "", phone: "", term, days: String(DEFAULT_PACKAGE_DAYS), endDate: "" };
}

function isBlank(row: Row): boolean {
  return !row.name.trim() && !row.email.trim() && !row.password && !row.phone.trim();
}

function randomPassword(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join("");
}

/** "30", "3 tháng", "1 năm", "31/12/2026", "2026-12-31", "không giới hạn" → term fields. */
function parseTerm(raw: string): Pick<Row, "term" | "days" | "endDate"> | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (/không|vô hạn|unlimited|∞/.test(value)) return { term: "unlimited", days: "", endDate: "" };
  const dmy = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) return { term: "date", days: "", endDate: `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}` };
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { term: "date", days: "", endDate: value };
  const amount = value.match(/^(\d+)\s*(ngày|ngay|tháng|thang|năm|nam)?$/);
  if (amount) {
    const n = Number(amount[1]);
    const unit = amount[2] ?? "";
    const days = /^th/.test(unit) ? n * 30 : /^n(ă|a)m$/.test(unit) ? n * 365 : n;
    return PRESET_DAYS.has(days) ? { term: String(days), days: "", endDate: "" } : { term: "custom", days: String(days), endDate: "" };
  }
  return { term: "custom", days: value, endDate: "" };
}

function toCsv(rows: Row[]): string {
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [["Họ tên", "Email", "Mật khẩu", "SĐT"], ...rows.map((r) => [r.name, r.email, r.password, r.phone])];
  return "\uFEFF" + lines.map((l) => l.map(cell).join(",")).join("\r\n");
}

function TermOptions() {
  return (
    <>
      {TERM_PRESETS.map((p) => (
        <option key={p.days} value={p.days}>
          {p.label}
        </option>
      ))}
      <option value="custom">Số ngày…</option>
      <option value="date">Đến ngày…</option>
      <option value="unlimited">Không giới hạn</option>
    </>
  );
}

const CELL = "w-full min-w-0 bg-transparent px-2 py-2 text-sm outline-none focus:bg-teal-soft disabled:text-muted";
const TD = "border border-line p-0";
const TH = "border border-line bg-slate-50 px-2 py-2 text-left text-xs font-bold tracking-wide text-muted uppercase";

/** Excel-like grid for creating many learner accounts at once; rows can be pasted straight from a spreadsheet. */
export function BulkAccounts() {
  const router = useRouter();
  const table = useRef<HTMLTableElement>(null);
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: START_ROWS }, () => blankRow()));
  const [activate, setActivate] = useState(true);
  const [bulkTerm, setBulkTerm] = useState(String(DEFAULT_PACKAGE_DAYS));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const pending = rows.filter((r) => !r.result?.ok && !isBlank(r));
  const created = rows.filter((r) => r.result?.ok);

  function update(key: number, patch: Partial<Row>) {
    setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch, result: r.result?.ok ? r.result : undefined } : r)));
  }

  function addRows(count: number) {
    setRows((all) => [...all, ...Array.from({ length: Math.min(count, MAX_ROWS - all.length) }, () => blankRow(bulkTerm))]);
  }

  function focusCell(row: number, col: number) {
    requestAnimationFrame(() => {
      table.current?.querySelector<HTMLElement>(`[data-cell="${row}-${col}"]`)?.focus();
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>, row: number, col: number) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (row === rows.length - 1) addRows(1);
    focusCell(row + 1, col);
  }

  function onPaste(e: ClipboardEvent<HTMLElement>, startRow: number, startCol: number) {
    const text = e.clipboardData.getData("text/plain");
    if (!/[\t\n]/.test(text.trim())) return;
    e.preventDefault();
    const lines = text.replace(/\r/g, "").replace(/\n+$/, "").split("\n").map((l) => l.split("\t"));
    // Skip a header row copied together with the data.
    if (lines.length > 1 && lines[0].some((c) => /^(e-?mail|họ tên|ho ten|tên|mật khẩu)$/i.test(c.trim()))) lines.shift();
    setRows((all) => {
      const next = [...all];
      lines.forEach((cells, i) => {
        const index = startRow + i;
        if (index >= MAX_ROWS || next[index]?.result?.ok) return;
        const row: Row = { ...(next[index] ?? blankRow(bulkTerm)), result: undefined };
        cells.forEach((value, j) => {
          const column: Column | undefined = COLUMNS[startCol + j];
          if (!column) return;
          if (column === "term" || column === "value") Object.assign(row, parseTerm(value) ?? {});
          else row[column] = value.trim();
        });
        next[index] = row;
      });
      return next;
    });
    setStatus({ ok: true, text: `Đã dán ${lines.length} dòng.` });
  }

  function applyTermToAll() {
    setRows((all) => all.map((r) => (r.result?.ok ? r : { ...r, term: bulkTerm, result: undefined })));
  }

  function fillPasswords() {
    setRows((all) => all.map((r) => (r.result?.ok || r.password || isBlank(r) ? r : { ...r, password: randomPassword() })));
  }

  function downloadCreated() {
    const url = URL.createObjectURL(new Blob([toCsv(created)], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `tai-khoan-${vnDate()}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  async function submit() {
    if (!pending.length) {
      setStatus({ ok: false, text: "Chưa có dòng nào để tạo." });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const payload = pending.map((r) => ({
        name: r.name,
        email: r.email,
        password: r.password,
        phone: r.phone,
        term: r.term,
        days: r.days,
        endDate: r.endDate,
      }));
      const result = await api<BulkResult>("/api/admin/learners", { activate, rows: payload });
      const byKey = new Map(pending.map((r, i) => [r.key, result.results[i]]));
      setRows((all) =>
        all.map((r) => {
          const res = byKey.get(r.key);
          if (!res) return r;
          return { ...r, result: res.ok ? { ok: true, text: "Đã tạo" } : { ok: false, text: res.error } };
        }),
      );
      const failed = pending.length - result.created;
      setStatus({
        ok: failed === 0,
        text: `Đã tạo ${result.created}/${pending.length} tài khoản.${failed ? ` ${failed} dòng lỗi, sửa rồi bấm tạo lại.` : ""}`,
      });
      if (result.created) router.refresh();
    } catch (err) {
      setStatus({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <p className="mb-3 text-xs text-muted">
        Nhập trực tiếp hoặc copy từ Excel / Google Sheets rồi dán vào ô bất kỳ, theo thứ tự cột: Họ tên · Email · Mật khẩu ·
        SĐT · Thời hạn (vd. <i>30</i>, <i>3 tháng</i>, <i>1 năm</i>, <i>31/12/2026</i>, <i>không giới hạn</i>). Enter để xuống
        dòng. Mật khẩu ≥ {ADMIN_MIN_PASSWORD} ký tự.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <label className="mr-2 flex items-center gap-2">
          <input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} />
          Kích hoạt ngay
        </label>
        <select
          value={bulkTerm}
          onChange={(e) => setBulkTerm(e.target.value)}
          className="rounded-lg border border-[#cfdae1] bg-white px-2 py-1.5"
          aria-label="Thời hạn cho tất cả"
        >
          <TermOptions />
        </select>
        <button type="button" className="btn btn-outline !px-3 !py-1.5 text-sm" onClick={applyTermToAll}>
          Áp dụng cho tất cả
        </button>
        <button type="button" className="btn btn-outline !px-3 !py-1.5 text-sm" onClick={fillPasswords}>
          Tạo mật khẩu cho ô trống
        </button>
      </div>

      <div className="overflow-x-auto">
        <table ref={table} className="w-full min-w-[960px] border-collapse">
          <thead>
            <tr>
              <th className={`${TH} w-10 text-center`}>#</th>
              <th className={TH}>Họ tên *</th>
              <th className={TH}>Email *</th>
              <th className={`${TH} w-36`}>Mật khẩu *</th>
              <th className={`${TH} w-36`}>SĐT</th>
              <th className={`${TH} w-44`}>Thời hạn</th>
              <th className={`${TH} w-40`}>Số ngày / đến ngày</th>
              <th className={`${TH} w-48`}>Kết quả</th>
              <th className={`${TH} w-10`} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const locked = r.result?.ok === true;
              const cell = (col: number) => ({
                "data-cell": `${i}-${col}`,
                disabled: locked || busy,
                onKeyDown: (e: KeyboardEvent<HTMLElement>) => onKeyDown(e, i, col),
                onPaste: (e: ClipboardEvent<HTMLElement>) => onPaste(e, i, col),
              });
              const textCell = (field: TextField, col: number, props: Record<string, unknown> = {}) => (
                <td className={TD}>
                  <input
                    className={CELL}
                    value={r[field]}
                    onChange={(e) => update(r.key, { [field]: e.target.value })}
                    {...cell(col)}
                    {...props}
                  />
                </td>
              );
              return (
                <tr key={r.key} className={locked ? "bg-success-soft/60" : r.result ? "bg-red-50" : ""}>
                  <td className={`${TD} text-center text-xs text-muted`}>{i + 1}</td>
                  {textCell("name", 0, { maxLength: 80 })}
                  {textCell("email", 1, { type: "email", maxLength: 200 })}
                  {textCell("password", 2, { autoComplete: "off", maxLength: 128 })}
                  {textCell("phone", 3, { maxLength: 30 })}
                  <td className={TD}>
                    <select
                      className={CELL}
                      value={r.term}
                      onChange={(e) => update(r.key, { term: e.target.value })}
                      {...cell(4)}
                      disabled={locked || busy || !activate}
                    >
                      <TermOptions />
                    </select>
                  </td>
                  <td className={TD}>
                    {r.term === "custom" ? (
                      <input
                        className={CELL}
                        type="number"
                        min={1}
                        max={MAX_PACKAGE_DAYS}
                        value={r.days}
                        onChange={(e) => update(r.key, { days: e.target.value })}
                        {...cell(5)}
                        disabled={locked || busy || !activate}
                      />
                    ) : r.term === "date" ? (
                      <input
                        className={CELL}
                        type="date"
                        min={vnDate()}
                        value={r.endDate}
                        onChange={(e) => update(r.key, { endDate: e.target.value })}
                        {...cell(5)}
                        disabled={locked || busy || !activate}
                      />
                    ) : (
                      <span className="block px-2 py-2 text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className={`${TD} px-2 py-2 text-xs ${r.result?.ok ? "text-success" : "text-danger"}`}>
                    {r.result ? (r.result.ok ? "✓ " : "") + r.result.text : ""}
                  </td>
                  <td className={`${TD} text-center`}>
                    <button
                      type="button"
                      className="px-2 text-muted hover:text-danger disabled:opacity-40"
                      title="Xóa dòng"
                      aria-label={`Xóa dòng ${i + 1}`}
                      disabled={busy}
                      onClick={() => setRows((all) => (all.length > 1 ? all.filter((x) => x.key !== r.key) : [blankRow(bulkTerm)]))}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-outline !px-3 !py-1.5 text-sm" onClick={() => addRows(1)} disabled={rows.length >= MAX_ROWS}>
          + Thêm dòng
        </button>
        <button type="button" className="btn btn-outline !px-3 !py-1.5 text-sm" onClick={() => addRows(10)} disabled={rows.length >= MAX_ROWS}>
          + 10 dòng
        </button>
        {created.length > 0 && (
          <>
            <button type="button" className="btn btn-outline !px-3 !py-1.5 text-sm" onClick={downloadCreated}>
              Tải CSV {created.length} tài khoản đã tạo
            </button>
            <button
              type="button"
              className="btn btn-outline !px-3 !py-1.5 text-sm"
              onClick={() => {
                const rest = rows.filter((r) => !r.result?.ok);
                setRows(rest.length ? rest : [blankRow(bulkTerm)]);
              }}
            >
              Xóa dòng đã tạo
            </button>
          </>
        )}
        <button type="button" className="btn ml-auto" onClick={submit} disabled={busy || !pending.length}>
          {busy ? "Đang tạo…" : `Tạo ${pending.length} tài khoản`}
        </button>
      </div>
      {status && (
        <div className={status.ok ? "mt-3 text-[13px] text-teal" : "form-error"} role="status">
          {status.text}
        </div>
      )}
    </div>
  );
}
