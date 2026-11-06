"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/client/api";

export function LogoutButton({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 ${
        variant === "dark"
          ? "border-white/20 text-slate-200 hover:border-red-300/60 hover:bg-red-400/10 hover:text-white"
          : "border-slate-300 text-slate-600 hover:border-slate-500 hover:bg-slate-100 hover:text-slate-800"
      }`}
      disabled={busy}
      title="Đăng xuất khỏi tài khoản"
      onClick={async () => {
        setBusy(true);
        await api("/api/auth/logout", {}).catch(() => undefined);
        router.replace("/login");
        router.refresh();
      }}
    >
      <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
      <span>Đăng xuất</span>
    </button>
  );
}
