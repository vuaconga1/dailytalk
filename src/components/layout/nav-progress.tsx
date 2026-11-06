"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const OVERLAY_DELAY_MS = 150;
const MAX_WAIT_MS = 15000;

function isInternalNavigation(e: MouseEvent): boolean {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const a = (e.target as HTMLElement | null)?.closest("a");
  if (!a || !a.href || a.hasAttribute("download") || (a.target && a.target !== "_self")) return false;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return false;
  return url.pathname !== location.pathname || url.search !== location.search;
}

export function NavProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState<number | null>(null);
  const [overlay, setOverlay] = useState(false);
  const timers = useRef<number[]>([]);

  function clearTimers() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!isInternalNavigation(e)) return;
      clearTimers();
      setProgress(8);
      timers.current.push(
        window.setTimeout(() => setOverlay(true), OVERLAY_DELAY_MS),
        window.setTimeout(() => {
          setProgress(null);
          setOverlay(false);
        }, MAX_WAIT_MS),
      );
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (progress === null || progress >= 100) return;
    const t = window.setTimeout(() => setProgress((p) => (p === null || p >= 100 ? p : p + (90 - p) * 0.12)), 200);
    return () => window.clearTimeout(t);
  }, [progress]);

  useEffect(() => {
    clearTimers();
    setOverlay(false);
    setProgress((p) => (p === null ? null : 100));
    const t = window.setTimeout(() => setProgress(null), 350);
    return () => window.clearTimeout(t);
  }, [pathname]);

  if (progress === null) return null;

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-[60] h-[3px]" role="progressbar" aria-label="Đang tải trang">
        <div
          className="h-full bg-gradient-to-r from-gold to-gold-light shadow-[0_0_10px_rgba(245,158,11,0.7)] transition-[width] duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      {overlay && (
        <div className="animate-fade-in fixed inset-0 z-30 grid place-items-center bg-white/60 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-3 text-sm font-medium text-slate-600">
            <span className="size-9 animate-spin rounded-full border-[3px] border-navy/15 border-t-navy" />
            Đang tải...
          </div>
        </div>
      )}
    </>
  );
}
