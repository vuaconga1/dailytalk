"use client";

import { useEffect } from "react";
import { api } from "@/client/api";

const INTERVAL_MS = 60_000;

/** Pings the session so a login elsewhere (or an account lock) signs this tab out promptly. */
export function SessionWatch() {
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === "visible") api("/api/auth/session").catch(() => {});
    };
    const timer = window.setInterval(check, INTERVAL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  return null;
}
