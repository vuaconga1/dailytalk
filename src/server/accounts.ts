import "server-only";
import { ADMIN_MIN_PASSWORD, DEFAULT_PACKAGE_DAYS, MAX_PACKAGE_DAYS } from "@/domain/access";
import { hashPassword, type SessionUser } from "@/server/auth";
import { Problem } from "@/lib/errors";
import { prisma } from "@/server/db";
import { formatVnDate, shiftDays, vnDate, vnNextMidnight } from "@/lib/time";
import { readCredentials } from "@/app/api/auth/credentials";

const DAY_MS = 86_400_000;

export function text(value: unknown, max: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > max) throw new Problem("Dữ liệu không hợp lệ.");
  return value.trim() || null;
}

function packageDays(value: unknown): number {
  const days = Number(value ?? DEFAULT_PACKAGE_DAYS);
  if (!Number.isInteger(days) || days < 1 || days > MAX_PACKAGE_DAYS) {
    throw new Problem(`Số ngày phải từ 1 đến ${MAX_PACKAGE_DAYS}.`);
  }
  return days;
}

export type Term = { accessEndsAt: Date | null; packageName: string; summary: string };

/**
 * Reads the chosen term: preset / `custom` days are added to `extendFrom`,
 * `date` ends at the close of that Vietnam day, `unlimited` has no end date.
 */
export function readTerm(body: Record<string, unknown>, extendFrom: Date): Term {
  const term = typeof body.term === "string" && body.term ? body.term : "custom";
  if (term === "unlimited") return { accessEndsAt: null, packageName: "Gói không thời hạn", summary: "không thời hạn" };
  if (term === "date") {
    const date = typeof body.endDate === "string" ? body.endDate : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw new Problem("Ngày hết hạn không hợp lệ.");
    const today = vnDate();
    if (date < today) throw new Problem("Ngày hết hạn phải từ hôm nay trở đi.");
    if (date > shiftDays(today, MAX_PACKAGE_DAYS)) throw new Problem(`Thời hạn tối đa ${MAX_PACKAGE_DAYS} ngày.`);
    const accessEndsAt = new Date(vnNextMidnight(Date.parse(date)).getTime() - 1000);
    return { accessEndsAt, packageName: `Gói đến ${formatVnDate(date)}`, summary: `đến ${formatVnDate(date)}` };
  }
  const days = packageDays(term === "custom" ? body.days : term);
  const accessEndsAt = new Date(extendFrom.getTime() + days * DAY_MS);
  return { accessEndsAt, packageName: `Gói ${days} ngày`, summary: `+${days} ngày, đến ${formatVnDate(vnDate(accessEndsAt))}` };
}

export async function consultantFrom(body: Record<string, unknown>): Promise<string | null> {
  const consultantId = text(body.consultantId, 40);
  if (!consultantId) return null;
  const ok = await prisma.user.count({ where: { id: consultantId, role: { in: ["CONSULTANT", "ADMIN"] } } });
  if (!ok) throw new Problem("Chuyên viên không hợp lệ.");
  return consultantId;
}

/** Creates one learner account, activated for the chosen term when `activate` is set. */
export async function createLearner(body: Record<string, unknown>, staff: SessionUser): Promise<string> {
  const name = text(body.name, 80);
  if (!name) throw new Problem("Tên cần từ 1 đến 80 ký tự.");
  const { email, password } = readCredentials(body, ADMIN_MIN_PASSWORD);
  const phone = text(body.phone, 30);
  const consultantId = await consultantFrom(body);
  const activate = body.activate === true || body.activate === "on";
  const now = new Date();
  const term = activate ? readTerm(body, now) : null;
  const packageName = term ? (text(body.packageName, 80) ?? term.packageName) : null;

  const passwordHash = await hashPassword(password);
  const learner = await prisma.user
    .create({
      data: {
        email,
        name,
        passwordHash,
        phone,
        consultantId,
        ...(term && {
          status: "ACTIVE" as const,
          packageName,
          activatedAt: now,
          accessEndsAt: term.accessEndsAt,
        }),
      },
    })
    .catch((error: unknown) => {
      if ((error as { code?: string }).code === "P2002") throw new Problem("Email này đã có tài khoản.", 409);
      throw error;
    });
  await prisma.staffNote.create({
    data: {
      learnerId: learner.id,
      authorId: staff.id,
      body: term ? `Admin tạo tài khoản và kích hoạt ${packageName} (${term.summary}).` : "Admin tạo tài khoản.",
    },
  });
  return learner.id;
}
