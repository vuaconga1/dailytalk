"use client";

import { useEffect, useState } from "react";
import { api, errorMessage } from "@/client/api";
import type { Lesson } from "@/domain/types";

type LessonDetail = { key: string; lesson: Lesson };

/** Lazy-loads full lesson JSON when staff expands “Xem nội dung”. */
export function LessonBankDetails({ lessonKey }: { lessonKey: string }) {
  const [open, setOpen] = useState(false);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || lesson) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    api<LessonDetail>(`/api/admin/lessons?key=${encodeURIComponent(lessonKey)}`)
      .then((data) => {
        if (!cancelled) setLesson(data.lesson);
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, lesson, lessonKey]);

  return (
    <details
      className="mt-1 text-xs"
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer text-teal">Xem nội dung</summary>
      {loading && <p className="mt-2 text-muted">Đang tải…</p>}
      {error && <p className="mt-2 text-red-600">{error}</p>}
      {lesson && (
        <>
          {lesson.situation && <p className="mt-2 text-muted">{lesson.situation}</p>}
          <p className="mt-2">
            <b>Từ vựng:</b>{" "}
            {lesson.vocabulary
              .map((v) => `${v.word}${v.ipa ? ` /${v.ipa}/` : ""}${v.pos ? ` ${v.pos}.` : ""} (${v.meaning})`)
              .join(", ")}
          </p>
          <p>
            <b>Mẫu câu:</b>{" "}
            {lesson.frames
              .map((f, j) => `${f}${lesson.frameNotes?.[j] ? ` (${lesson.frameNotes[j].meaning})` : ""}`)
              .join(" · ")}
          </p>
          <ol className="list-decimal pl-5">
            {lesson.dialogue.map((d, j) => (
              <li key={j}>{d}</li>
            ))}
          </ol>
          <p>
            <b>Role-play:</b> {lesson.roleplay.role} – {lesson.roleplay.goal}
          </p>
        </>
      )}
    </details>
  );
}
