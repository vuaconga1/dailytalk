"use client";

import { useState } from "react";
import { api, errorMessage } from "@/client/api";

export type ZaloStatus = {
  configured: boolean;
  oaUrl: string | null;
  linked: boolean;
  followed: boolean;
};

export function ZaloLinkCard({ initial }: { initial: ZaloStatus }) {
  const [state, setState] = useState(initial);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function call(method: "POST" | "DELETE") {
    setBusy(true);
    setError("");
    try {
      const next = await api<ZaloStatus & { code?: string }>("/api/zalo/link", undefined, { method });
      setState(next);
      setCode(next.code ?? null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="card mt-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold">Nhắc học qua Zalo</h3>
        <span className={`badge ${state.linked && state.followed ? "" : "badge-gold"}`}>
          {state.linked ? (state.followed ? "Đã liên kết" : "Đã bỏ quan tâm OA") : "Chưa liên kết"}
        </span>
      </div>
      {state.linked ? (
        <>
          <p className="mb-4 text-muted">
            WeWIN sẽ nhắn nhắc học vào giờ học mỗi ngày. Hãy trả lời tin nhắn của OA ít nhất mỗi 2 ngày để Zalo cho phép
            tiếp tục gửi nhắc.
          </p>
          <button type="button" className="btn btn-outline" disabled={busy} onClick={() => call("DELETE")}>
            Hủy liên kết
          </button>
        </>
      ) : (
        <>
          <ol className="mb-4 list-decimal space-y-1 pl-5 text-muted">
            <li>
              Quan tâm Zalo OA WeWIN
              {state.oaUrl && (
                <>
                  {" "}
                  tại{" "}
                  <a href={state.oaUrl} target="_blank" rel="noreferrer" className="font-semibold text-teal underline">
                    đây
                  </a>
                </>
              )}
              .
            </li>
            <li>Tạo mã liên kết bên dưới và gửi mã vào khung chat của OA.</li>
          </ol>
          {code && (
            <p className="mb-4 rounded-[10px] bg-[#e8f2f1] px-4 py-3 text-center text-2xl font-bold tracking-[4px] text-navy">
              {code}
            </p>
          )}
          <button type="button" className="btn" disabled={busy} onClick={() => call("POST")}>
            {code ? "Tạo mã mới" : "Tạo mã liên kết"}
          </button>
          {code && <p className="note mt-3">Mã có hiệu lực 30 phút.</p>}
        </>
      )}
      {!state.configured && <p className="note mt-3">Zalo OA đang được thiết lập, tin nhắc sẽ bắt đầu gửi sau.</p>}
      {error && <div className="form-error">{error}</div>}
    </article>
  );
}
