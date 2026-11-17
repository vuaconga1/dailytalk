import { normalizeLesson } from "@/domain/content";
import { Problem } from "@/lib/errors";
import { prisma } from "@/server/db";
import { json, staffRoute } from "@/server/http/api";

/** Lean lesson-bank detail for admin expand (list page does not hydrate full JSON into RSC). */
export const GET = staffRoute("manageLessons", async (req) => {
  const key = req.nextUrl.searchParams.get("key")?.trim() ?? "";
  if (!key || key.length > 200) throw new Problem("Thiếu key bài học.");
  const row = await prisma.lessonContent.findUnique({
    where: { key },
    select: { key: true, lesson: true },
  });
  if (!row) throw new Problem("Không tìm thấy bài.", 404);
  return json({ key: row.key, lesson: normalizeLesson(row.lesson) });
});
