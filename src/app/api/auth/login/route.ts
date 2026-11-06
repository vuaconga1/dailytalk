import { clientIp, json, readJson, route } from "@/server/http/api";
import { createSession, SESSION_END_MESSAGES, verifyPassword } from "@/server/auth";
import { isLocked } from "@/domain/access";
import { Problem } from "@/lib/errors";
import { prisma } from "@/server/db";
import { throttleAuth } from "@/server/throttle";
import { readCredentials } from "../credentials";

export const POST = route(async (req) => {
  throttleAuth(clientIp(req));
  const { email, password } = readCredentials(await readJson(req), 1);
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, role: true, isDemo: true, lockAt: true },
  });
  if (!(await verifyPassword(password, user?.passwordHash ?? null)) || !user) {
    throw new Problem("Email hoặc mật khẩu chưa đúng.", 401);
  }
  if (isLocked(user)) throw new Problem(SESSION_END_MESSAGES.locked, 403);
  await createSession(user.id);
  return json({ ok: true });
});
