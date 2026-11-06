"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, errorMessage } from "@/client/api";

type Props = { name: string; email: string; studyTime: string; reminders: boolean };

export function SettingsForm({ name, email, studyTime, reminders }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setStatus(null);
    try {
      await api("/api/settings", { study_time: fd.get("study_time"), reminders: fd.get("reminders") === "on" });
      setStatus({ ok: true, text: "Đã lưu giờ học." });
      router.refresh();
    } catch (err) {
      setStatus({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <h3 className="text-lg font-bold">{name}</h3>
      <p className="mb-5 text-muted">{email}</p>
      <div className="field">
        <label htmlFor="study_time">Giờ học mỗi ngày</label>
        <input type="time" id="study_time" name="study_time" required defaultValue={studyTime} />
      </div>
      <label className="check">
        <input type="checkbox" name="reminders" defaultChecked={reminders} />
        Nhắc tôi trước giờ học mỗi ngày.
      </label>
      <p className="note mt-5 mb-5">Múi giờ: Giờ Việt Nam (GMT+7).</p>
      <button type="submit" className="btn" disabled={busy}>
        Lưu thay đổi
      </button>
      {status && (
        <div className={status.ok ? "mt-4 text-[13px] text-teal" : "form-error"} role="status">
          {status.text}
        </div>
      )}
    </form>
  );
}
