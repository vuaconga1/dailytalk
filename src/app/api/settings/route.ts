import { authedRoute, json, readJson } from "@/server/http/api";
import { Problem } from "@/lib/errors";
import { prisma } from "@/server/db";
import { isStudyTime } from "@/lib/time";

export const POST = authedRoute(async (req, user) => {
  if (!user.profile) throw new Problem("Chưa có hồ sơ.");
  const body = await readJson(req);
  if (!isStudyTime(body.study_time)) throw new Problem("Giờ học dùng HH:MM.");
  await prisma.user.update({
    where: { id: user.id },
    data: { profile: { ...user.profile, study_time: body.study_time, reminders: body.reminders === true } },
  });
  return json({ ok: true });
});
