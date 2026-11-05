import { clientIp, json, readJson, route } from "@/lib/api";
import { createSession, verifyPassword } from "@/lib/auth";
import { Problem } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { throttleAuth } from "@/lib/throttle";
import { readCredentials } from "../credentials";

export const POST = route(async (req) => {
  throttleAuth(clientIp(req));
  const { email, password } = readCredentials(await readJson(req), 1);
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, passwordHash: true } });
  if (!(await verifyPassword(password, user?.passwordHash ?? null)) || !user) {
    throw new Problem("Email hoặc mật khẩu chưa đúng.", 401);
  }
  await createSession(user.id);
  return json({ ok: true });
});
