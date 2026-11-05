import { authedRoute, json, readJson } from "@/lib/api";
import { classify } from "@/lib/classify";
import { buildPlan } from "@/lib/curriculum";
import { Prisma } from "@/generated/prisma/client";
import { Problem } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { isCurrentProfile, readProfileInput } from "@/lib/profile";
import type { LearnerProfile } from "@/lib/types";

/** Confirmed profile → classification → 30-day reference roadmap from the authored curriculum. */
export const POST = authedRoute(async (req, user) => {
  if (user.plan && isCurrentProfile(user.profile)) {
    throw new Problem("Đã có lộ trình. Lộ trình hiện tại được giữ để bảo toàn tiến độ.", 409);
  }
  const input = readProfileInput(await readJson(req));
  const classification = classify(input);
  const profile: LearnerProfile = { ...input, classification, working_level: classification.level };
  const plan = buildPlan(profile);
  const data = { profile, plan, planSource: "curriculum" };
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
