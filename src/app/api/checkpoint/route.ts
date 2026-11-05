import { authedRoute, json, readJson } from "@/lib/api";
import { Problem } from "@/lib/errors";
import { ownedAttempt } from "@/lib/learning";
import { prisma } from "@/lib/prisma";

export const POST = authedRoute(async (req, user) => {
  const body = await readJson(req);
  const attempt = await ownedAttempt(user, body.attempt_id);
  if (body.stage !== "words" && body.stage !== "shadow") throw new Problem("Bước học không hợp lệ.");
  await prisma.attempt.update({
    where: { id: attempt.id },
    data: body.stage === "words" ? { wordsDone: true } : { shadowDone: true },
  });
  return json({ ok: true });
});
