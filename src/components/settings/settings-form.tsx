"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, errorMessage } from "@/client/api";
import { EMAIL_MAX, PHONE_MAX } from "@/domain/contact";

type Props = {
  name: string;
  email: string;
  phone: string;
  reminderEmail: string;
  studyTime: string;
  reminders: boolean;
};

export function SettingsForm({ name, email, phone, reminderEmail, studyTime, reminders }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [wantReminders, setWantReminders] = useState(reminders);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setStatus(null);
    try {
      await api("/api/settings", {
        phone: fd.get("phone"),
        reminder_email: fd.get("reminder_email"),
        study_time: fd.get("study_time"),
        reminders: fd.get("reminders") === "on",
      });
      setStatus({ ok: true, text: "Đã lưu thay đổi." });
      router.refresh();
    } catch (err) {
      setStatus({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={onSubmit} noValidate>
      <h3 className="text-lg font-bold">{name}</h3>
      <p className="mb-5 text-muted">{email}</p>
      <div className="field">
        <label htmlFor="phone">Số điện thoại</label>
        <input
          type="tel"
          id="phone"
          name="phone"
          required
          maxLength={PHONE_MAX}
          autoComplete="tel"
          inputMode="tel"
          defaultValue={phone}
          placeholder="Ví dụ: 0901234567"
        />
      </div>
      <div className="field">
        <label htmlFor="study_time">Giờ học mỗi ngày</label>
        <input type="time" id="study_time" name="study_time" required defaultValue={studyTime} />
      </div>
      <label className="check">
        <input
          type="checkbox"
          name="reminders"
          defaultChecked={reminders}
          onChange={(e) => setWantReminders(e.target.checked)}
        />
        Nhắc tôi trước giờ học mỗi ngày.
      </label>
      {wantReminders && (
        <div className="field mt-3">
          <label htmlFor="reminder_email">Email nhận nhắc học</label>
          <input
            type="email"
            id="reminder_email"
            name="reminder_email"
            maxLength={EMAIL_MAX}
            autoComplete="email"
            defaultValue={reminderEmail || email}
            placeholder={typeof email === "string" && email.includes("@") ? email : "you@example.com"}
          />
          <p className="note mt-2">Mặc định là email đăng nhập. Chỉ đổi nếu bạn muốn nhận nhắc ở địa chỉ khác.</p>
        </div>
      )}
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
