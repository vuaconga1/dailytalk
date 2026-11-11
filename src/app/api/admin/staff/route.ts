import type { Role } from "@/generated/prisma/client";
import { ADMIN_MIN_PASSWORD, STAFF_ROLES } from "@/domain/access";
import { json, readJson, staffRoute } from "@/server/http/api";
import { hashPassword } from "@/server/auth";
import { Problem } from "@/lib/errors";
import { prisma } from "@/server/db";
import { readCredentials } from "../../auth/credentials";

/** Creates a staff account, or updates role / password of an existing staff account. */
export const POST = staffRoute("manageStaff", async (req) => {
  const body = await readJson(req);
  const role = body.role as Role;
  if (!STAFF_ROLES.includes(role)) throw new Problem("Vai trò không hợp lệ.");
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 80) throw new Problem("Tên cần từ 1 đến 80 ký tự.");
  const { email, password } = readCredentials(body, ADMIN_MIN_PASSWORD);
  const existing = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  if (existing?.role === "LEARNER") throw new Problem("Email này đang là tài khoản học viên.", 409);
  const passwordHash = await hashPassword(password);
  await prisma.user.upsert({
    where: { email },
    create: { email, name, passwordHash, role, status: "ACTIVE" },
    update: { name, passwordHash, role, status: "ACTIVE" },
  });
  return json({ ok: true });
});
