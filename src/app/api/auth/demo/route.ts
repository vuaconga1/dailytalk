import { randomBytes } from "node:crypto";
import { clientIp, json, route } from "@/server/http/api";
import { isDemo } from "@/server/ai/config";
import { createSession, DEMO_SESSION_MAX_AGE_SEC, hashPassword } from "@/server/auth";
import { Problem } from "@/lib/errors";
import { prisma } from "@/server/db";
import { throttleAuth } from "@/server/throttle";

export const POST = route(async (req) => {
  if (!isDemo) throw new Problem("Chức năng demo đã tắt.", 404);
  throttleAuth(clientIp(req));
  const id = randomBytes(12).toString("hex");
  const user = await prisma.user.create({
    data: {
      id,
      email: `${id}@demo.invalid`,
      name: "Học viên Demo",
      isDemo: true,
      passwordHash: await hashPassword(randomBytes(32).toString("base64url")),
    },
  });
  await createSession(user.id, DEMO_SESSION_MAX_AGE_SEC);
  return json({ ok: true });
});
