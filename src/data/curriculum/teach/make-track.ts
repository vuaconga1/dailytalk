import type { CurriculumDay, GradeTrack } from "@/domain/curriculum/types";
import { day } from "./lesson";
import { PACKS } from "./packs";
import { SHARED_DAYS } from "./shared-days";
import type { SubjectSpec } from "./subjects";
import { threadDays } from "./thread-days";

function ideaDay(spec: SubjectSpec): CurriculumDay {
  const [a, b, c, d] = spec.slots;
  return day({
    title: spec.ideaTitle,
    situation: spec.ideaSituation,
    skill: "structure",
    focus: spec.ideaFocus,
    goal: spec.ideaGoal,
    words: spec.words,
    frames: [
      { en: "Today the new idea is …", vi: "Ý mới hôm nay là …", structure: "Today the new idea is + cụm danh từ", usage: "Nêu đúng một ý mới trước khi giải thích. Is đi với danh từ." },
      { en: "Let me show you …", vi: "Để tôi chỉ bạn …", structure: "Let me show you + cụm danh từ", usage: "Sau let me dùng động từ nguyên mẫu. Show you đi với vật được chỉ." },
      { en: "A simple example is …", vi: "Một ví dụ đơn giản là …", structure: "A simple example is + cụm danh từ", usage: "Đưa một ví dụ ngay sau ý mới. Example là số ít nên dùng is." },
      { en: "Can you say …?", vi: "Bạn nói … được không?", structure: "Can you say + cụm danh từ?", usage: "Mời học sinh nhắc lại từ vừa học. Say không thêm to." },
    ],
    lines: [
      "What is new today?",
      `Today the new idea is ${a}.`,
      "Can you show us?",
      `Let me show you ${b}.`,
      "Can you give an example?",
      `A simple example is ${c}.`,
      "How do I say it?",
      `Can you say ${d}?`,
    ],
  });
}

export function makeTrack(spec: SubjectSpec): GradeTrack {
  const thread = threadDays(spec.aboutEn, spec.aboutVi, spec.checkExtra);
  const days = Array.from({ length: 30 }, (_, index) => {
    const n = index + 1;
    if (n === 5) return ideaDay(spec);
    return thread[n] ?? SHARED_DAYS[n];
  });
  if (days.some((item) => !item)) throw new Error(`Missing day in ${spec.className}`);
  return {
    grade: spec.grade,
    className: spec.className,
    gradeLabel: spec.gradeLabel,
    people: spec.grade === "preschool" ? { customers: ["child", "bé"] } : undefined,
    days,
    packs: PACKS,
  };
}
