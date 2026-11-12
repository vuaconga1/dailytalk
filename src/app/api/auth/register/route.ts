import { clientIp, json, readJson, route } from "@/server/http/api";
import { createSession, hashPassword } from "@/server/auth";
import { Problem } from "@/lib/errors";
import { prisma } from "@/server/db";
import { throttleAuth } from "@/server/throttle";
import { MIN_PASSWORD } from "@/domain/access";
import { readCredentials } from "../credentials";

export const POST = route(async (req) => {
  throttleAuth(clientIp(req));
  const body = await readJson(req);
  const { email, password } = readCredentials(body, MIN_PASSWORD);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 80) throw new Problem("Vui lòng nhập tên, tối đa 80 ký tự.");
  const passwordHash = await hashPassword(password);
  const user = await prisma.user
    .create({
      data: {
        email,
        name,
        passwordHash,
        status: "ACTIVE",
        activatedAt: new Date(),
        packageName: "Toàn diện",
      },
    })
    .catch((error: unknown) => {
    if ((error as { code?: string }).code === "P2002") {
      throw new Problem("Không thể đăng ký email này. Hãy đăng nhập hoặc dùng email khác.");
    }
    throw error;
  });
  await createSession(user.id);
  return json({ ok: true });
});
