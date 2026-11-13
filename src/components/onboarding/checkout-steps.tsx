"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const STEPS = [
  { title: "1. Hồ sơ học tập", href: "/onboarding" },
  { title: "2. Thanh toán", href: "/payment" },
];
const LOCKED_MESSAGE = "Vui lòng điền đầy đủ thông tin trước khi thanh toán";

/** Profile form ↔ payment, switched like the lesson parts; payment stays greyed out until the profile is saved. */
export function CheckoutSteps({ current, formDone }: { current: 0 | 1; formDone: boolean }) {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function goTo(i: number) {
    if (i === current) return;
    if (i === 1 && !formDone) {
      setToast(LOCKED_MESSAGE);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setToast(""), 4000);
      return;
    }
    router.push(STEPS[i].href);
  }

  return (
    <>
      <nav className="mb-6 grid grid-cols-2 gap-2 sm:gap-3" aria-label="Các bước đăng ký">
        {STEPS.map((s, i) => {
          const locked = i === 1 && !formDone;
          const done = i === 0 && formDone;
          return (
            <button
              key={s.href}
              type="button"
              onClick={() => goTo(i)}
              aria-current={current === i ? "step" : undefined}
              aria-disabled={locked || undefined}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-semibold transition-all duration-200 md:text-sm ${
                current === i
                  ? "scale-[1.02] bg-navy text-white shadow-sm ring-2 ring-navy/10"
                  : locked
                    ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                    : "border border-[#e2e8f4] bg-white text-slate-600 hover:bg-slate-50 hover:text-navy"
              } ${done ? "border-b-4 border-b-emerald-500" : ""}`}
            >
              {done && <span className="font-bold text-emerald-500">✓</span>}
              {locked && <span aria-hidden="true">🔒</span>}
              <span>{s.title}</span>
            </button>
          );
        })}
      </nav>
      <div
        role="status"
        aria-live="polite"
        className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-navy px-6 py-3.5 text-sm font-medium text-white shadow-xl transition-all duration-300 ${
          toast ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
        }`}
      >
        {toast}
      </div>
    </>
  );
}
