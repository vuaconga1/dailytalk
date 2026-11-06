"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, errorMessage } from "@/client/api";

export function AuthForm({ demoEnabled, notice = "" }: { demoEnabled: boolean; notice?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const register = mode === "register";

  async function run(task: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await task();
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    void run(() => api(`/api/auth/${mode}`, data));
  }

  return (
    <section className="m-auto w-full max-w-[480px] px-6 py-7 md:p-10">
      <span className="badge">WEWIN DAILY SPEAKING</span>
      <h2 className="mt-5 text-[30px] font-bold tracking-[-0.5px]">
        {register ? "Bắt đầu hành trình của bạn" : "Chào mừng bạn trở lại"}
      </h2>
      <p className="mb-6 text-muted">
        {register
          ? "Tạo tài khoản, chọn mục tiêu và thiết kế nhịp học của riêng bạn."
          : "Đăng nhập để tiếp tục buổi học."}
      </p>
      {notice && (
        <p className="note mb-5" role="alert">
          {notice}
        </p>
      )}
      {demoEnabled && (
        <>
          <button type="button" className="btn btn-gold w-full" disabled={busy} onClick={() => run(() => api("/api/auth/demo", {}))}>
            Trải nghiệm demo không cần đăng ký →
          </button>
          <div className="my-5 flex items-center gap-3 text-xs text-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
            hoặc
          </div>
        </>
      )}
      <form onSubmit={onSubmit} key={mode}>
        {register && (
          <div className="field">
            <label htmlFor="name">Tên học viên</label>
            <input id="name" name="name" autoComplete="name" required maxLength={80} placeholder="Bạn muốn được gọi là gì?" />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" name="email" autoComplete="email" required maxLength={200} placeholder="you@example.com" />
        </div>
        <div className="field">
          <label htmlFor="password">Mật khẩu</label>
          <input
            id="password"
            type="password"
            name="password"
            autoComplete={register ? "new-password" : "current-password"}
            required
            minLength={register ? 8 : undefined}
            maxLength={128}
            placeholder={register ? "Ít nhất 8 ký tự" : "Mật khẩu của bạn"}
          />
        </div>
        <button type="submit" className="btn w-full" disabled={busy}>
          {register ? "Tạo tài khoản" : "Đăng nhập"} →
        </button>
        <div className="form-error" role="alert">
          {error}
        </div>
      </form>
      <div className="mt-6 text-center text-[13px]">
        {register ? "Đã có tài khoản?" : "Bạn chưa có tài khoản?"}{" "}
        <button
          type="button"
          className="text-teal underline"
          onClick={() => {
            setMode(register ? "login" : "register");
            setError("");
          }}
        >
          {register ? "Đăng nhập" : "Đăng ký"}
        </button>
      </div>
      <p className="legal mt-5">
        Bằng việc tiếp tục, bạn đồng ý với Điều khoản sử dụng và Chính sách bảo mật của WeWIN Education.
      </p>
    </section>
  );
}
