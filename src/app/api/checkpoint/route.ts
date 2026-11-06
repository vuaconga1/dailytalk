import { authedRoute, json, readJson } from "@/server/http/api";
import { Problem } from "@/lib/errors";
import { ownedAttempt } from "@/server/learning/practice";
import { prisma } from "@/server/db";

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
