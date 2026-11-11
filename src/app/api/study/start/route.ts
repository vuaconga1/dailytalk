import { authedRoute, json, readJson } from "@/server/http/api";
import { ownedAttempt } from "@/server/learning/practice";
import { startStudy } from "@/server/learning/study-time";

export const POST = authedRoute(async (req, user) => {
  const attempt = await ownedAttempt(user, (await readJson(req)).attempt_id);
  await startStudy(attempt.id);
  return json({ ok: true });
});
