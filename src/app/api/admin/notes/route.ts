import { json, readJson, staffRoute } from "@/server/http/api";
import { Problem } from "@/lib/errors";
import { prisma } from "@/server/db";

export const POST = staffRoute("viewLearners", async (req, staff) => {
  const body = await readJson(req);
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text || text.length > 2000) throw new Problem("Ghi chú cần từ 1 đến 2000 ký tự.");
  const learner = await prisma.user.findFirst({ where: { id: String(body.learnerId ?? ""), role: "LEARNER" }, select: { id: true } });
  if (!learner) throw new Problem("Không tìm thấy học viên.", 404);
  await prisma.staffNote.create({ data: { learnerId: learner.id, authorId: staff.id, body: text } });
  return json({ ok: true });
});
