"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { api, errorMessage } from "@/lib/client-api";

type Props = {
  endpoint: string;
  method?: "POST" | "PATCH";
  /** Merged into the form fields (e.g. ids, action names). */
  extra?: Record<string, unknown>;
  submitLabel: string;
  confirm?: string;
  successText?: string;
  className?: string;
  buttonClassName?: string;
  resetOnSuccess?: boolean;
  children?: ReactNode;
};

/** Small staff form: fields → JSON body, shows the server's error or result, refreshes the page. */
export function ApiForm({
  endpoint,
  method = "POST",
  extra,
  submitLabel,
  confirm,
  successText = "Đã lưu.",
  className = "",
  buttonClassName = "btn",
  resetOnSuccess = false,
  children,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (confirm && !window.confirm(confirm)) return;
    const form = e.currentTarget;
    const fields = Object.fromEntries(new FormData(form).entries());
    setBusy(true);
    setStatus(null);
    try {
      const body = JSON.stringify({ ...fields, ...extra });
      const result = await api<Record<string, unknown>>(endpoint, undefined, {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      });
      setStatus({ ok: true, text: successText === "json" ? JSON.stringify(result, null, 2) : successText });
      if (resetOnSuccess) form.reset();
      router.refresh();
    } catch (err) {
      setStatus({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={className} onSubmit={onSubmit}>
      {children}
      <button type="submit" className={buttonClassName} disabled={busy}>
        {busy ? "Đang xử lý…" : submitLabel}
      </button>
      {status &&
        (status.ok && successText === "json" ? (
          <pre className="note mt-3 overflow-auto whitespace-pre-wrap">{status.text}</pre>
        ) : (
          <div className={status.ok ? "mt-3 text-[13px] text-teal" : "form-error"} role="status">
            {status.text}
          </div>
        ))}
    </form>
  );
}
