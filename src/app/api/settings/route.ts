import { authedRoute, json, readJson } from "@/server/http/api";
import { Problem } from "@/lib/errors";
import { prisma } from "@/server/db";
import { isStudyTime } from "@/lib/time";
import { enqueueStudyReminder } from "@/server/jobs";

export const POST = authedRoute(async (req, user) => {
  if (!user.profile) throw new Problem("Chưa có hồ sơ.");
  const body = await readJson(req);
  if (!isStudyTime(body.study_time)) throw new Problem("Giờ học dùng HH:MM.");
  const reminders = body.reminders === true;
  await prisma.user.update({
    where: { id: user.id },
    data: { profile: { ...user.profile, study_time: body.study_time, reminders } },
  });
  if (reminders) {
    await enqueueStudyReminder(user.id).catch((error: unknown) => console.error("schedule reminder", error));
  }
  return json({ ok: true });
});
