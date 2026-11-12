import { authedRoute, json, readJson } from "@/server/http/api";
import { Problem } from "@/lib/errors";
import { OPEN_ALL_DAYS } from "@/server/learning/practice";
import { prisma } from "@/server/db";

/** The learner left the lesson mid-session: end it and drop everything said in it. */
export const POST = authedRoute(async (req, user) => {
  const id = (await readJson(req)).session_id;
  if (typeof id !== "string" || !id) throw new Problem("Không tìm thấy phiên luyện tập.", 404);
  const where = { id, userId: user.id, ended: false, deadline: { gt: new Date() }, attempt: { completed: false } };
  // With daily limits the row must stay, or deleting it would hand out a fresh 3 minutes today.
  if (OPEN_ALL_DAYS) await prisma.practice.deleteMany({ where });
  else await prisma.practice.updateMany({ where, data: { ended: true, turns: [], busySince: null } });
  return json({ ok: true });
});
