import { authedRoute, json, readJson } from "@/server/http/api";
import { AUTO_ACTIVATE_ON_ONBOARD, DEFAULT_PACKAGE_DAYS } from "@/domain/access";
import { classify } from "@/domain/classify";
import { buildPlan } from "@/domain/curriculum";
import { Prisma } from "@/generated/prisma/client";
import { Problem } from "@/lib/errors";
import { prisma } from "@/server/db";
import { isCurrentProfile, readLearnerName, readProfileInput } from "@/domain/profile";
import type { LearnerProfile } from "@/domain/types";

/** Confirmed profile → classification → 30-day reference roadmap from the authored curriculum. */
export const POST = authedRoute(async (req, user) => {
  if (user.plan && isCurrentProfile(user.profile)) {
    throw new Problem("Đã có lộ trình. Lộ trình hiện tại được giữ để bảo toàn tiến độ.", 409);
  }
  const body = await readJson(req);
  const name = readLearnerName(body);
  const input = readProfileInput(body);
  const classification = classify(input);
  const profile: LearnerProfile = { ...input, classification, working_level: classification.level };
  const plan = buildPlan(profile);
  const now = new Date();
  const activation =
    AUTO_ACTIVATE_ON_ONBOARD && user.status === "LEAD" && !user.isDemo
      ? {
          status: "ACTIVE" as const,
          packageName: `Gói ${DEFAULT_PACKAGE_DAYS} ngày`,
          activatedAt: now,
          accessEndsAt: new Date(now.getTime() + DEFAULT_PACKAGE_DAYS * 86_400_000),
          lockAt: null,
        }
      : {};
  const data = { name, profile, plan, planSource: "curriculum", ...activation };
  if (user.plan) {
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
  return json({ ok: true, classification });
});
