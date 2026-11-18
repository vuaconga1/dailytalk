import { authedRoute, json, readJson } from "@/server/http/api";
import { DEFAULT_PACKAGE_DAYS, isTrial, PAYMENT_ENABLED } from "@/domain/access";
import { classify } from "@/domain/classify";
import { buildPlan } from "@/domain/curriculum";
import { Prisma } from "@/generated/prisma/client";
import { Problem } from "@/lib/errors";
import { prisma } from "@/server/db";
import { readReminderEmail, readRequiredPhone } from "@/domain/contact";
import { isCurrentProfile, readLearnerName, readProfileInput } from "@/domain/profile";
import type { LearnerProfile } from "@/domain/types";
import { loadSessionPlan } from "@/server/auth";
import { enqueueStudyReminder } from "@/server/jobs";

/** Confirmed profile → classification → 30-day reference roadmap from the authored curriculum. */
export const POST = authedRoute(async (req, user) => {
  const existing = await loadSessionPlan(user.id);
  // Before paying, a trial learner may revise the profile; afterwards the roadmap is kept to preserve progress.
  const editing = Boolean(existing.plan && isCurrentProfile(existing.profile));
  if (editing && !isTrial(user)) {
    throw new Problem("Đã có lộ trình. Lộ trình hiện tại được giữ để bảo toàn tiến độ.", 409);
  }
  const body = await readJson(req);
  const name = readLearnerName(body);
  const phone = readRequiredPhone(body);
  const reminderEmail = user.isDemo ? null : readReminderEmail(body, user.email);
  const input = readProfileInput(body);
  const classification = classify(input);
  const profile: LearnerProfile = { ...input, classification, working_level: classification.level };
  const plan = await buildPlan(profile);
  const now = new Date();
  // Auto-activate when QR payment is off: open email reminders (not legacy Zalo-only []).
  const activation =
    !PAYMENT_ENABLED && user.status === "LEAD" && !user.isDemo
      ? {
          status: "ACTIVE" as const,
          packageName: `Gói email ${DEFAULT_PACKAGE_DAYS} ngày`,
          reminderChannels: ["email"] as string[],
          activatedAt: now,
          accessEndsAt: new Date(now.getTime() + DEFAULT_PACKAGE_DAYS * 86_400_000),
          lockAt: null,
        }
      : {};
  const data = { name, phone, reminderEmail, profile, plan, planSource: "curriculum", ...activation };
  if (editing) {
    await prisma.user.update({ where: { id: user.id }, data });
  } else if (existing.plan) {
    // Old-survey learner: their sessions used the retired lesson format, so the journey restarts.
    await prisma.$transaction([
      prisma.attempt.deleteMany({ where: { userId: user.id } }),
      prisma.user.update({ where: { id: user.id }, data }),
    ]);
  } else {
    const { count } = await prisma.user.updateMany({
      where: { id: user.id, plan: { equals: Prisma.DbNull } },
      data,
    });
    if (!count) throw new Problem("Lộ trình đã được tạo.", 409);
  }
  if (profile.reminders) await enqueueStudyReminder(user.id);
  return json({ ok: true });
});
