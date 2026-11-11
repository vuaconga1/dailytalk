"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { api } from "@/client/api";

type Props = { attemptId: string; track: boolean; className: string; children: ReactNode };

/** Opens the lesson; `track` starts the study-time clock first. */
export function StartLessonButton({ attemptId, track, className, children }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    if (track) await api("/api/study/start", { attempt_id: attemptId }).catch(() => {});
    router.push("/lesson");
  }

  return (
    <button type="button" onClick={open} disabled={busy} className={className}>
      {children}
    </button>
  );
}
