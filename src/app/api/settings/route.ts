import { authedRoute, json, readJson } from "@/server/http/api";
import { readReminderEmail, readRequiredPhone } from "@/domain/contact";
import { Problem } from "@/lib/errors";
import { prisma } from "@/server/db";
import { isStudyTime } from "@/lib/time";
import { withLearnerProfile } from "@/server/auth";
import { enqueueStudyReminder } from "@/server/jobs";

export const POST = authedRoute(async (req, user) => {
  const learner = await withLearnerProfile(user);
  const body = await readJson(req);
  if (!isStudyTime(body.study_time)) throw new Problem("Giờ học dùng HH:MM.");
  const reminders = body.reminders === true;
  const phone = readRequiredPhone(body);
  const touchedReminderEmail = "reminder_email" in body || "reminderEmail" in body;
  const reminderEmail = learner.isDemo
    ? null
    : touchedReminderEmail
      ? readReminderEmail(body, learner.email)
      : undefined;
  await prisma.user.update({
    where: { id: learner.id },
    data: {
      phone,
      ...(reminderEmail !== undefined ? { reminderEmail } : {}),
      profile: { ...learner.profile, study_time: body.study_time, reminders },
    },
  });
  if (reminders) {
    await enqueueStudyReminder(learner.id).catch((error: unknown) => console.error("schedule reminder", error));
  }
  return json({ ok: true });
});
