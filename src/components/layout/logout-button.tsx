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
      className={`inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 ${
        variant === "dark"
          ? "border-white/20 text-white hover:border-amber-400/60 hover:bg-amber-400/10 [&>svg]:text-amber-400"
          : "border-slate-300 text-slate-600 hover:border-slate-500 hover:bg-slate-100 hover:text-slate-800"
      }`}
      disabled={busy}
      title="Đăng xuất khỏi tài khoản"
      aria-label="Đăng xuất"
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
      <span className="hidden sm:inline">Đăng xuất</span>
    </button>
  );
}
