import { ADMIN_MIN_PASSWORD, DEFAULT_PACKAGE_DAYS } from "@/domain/access";
import { json, readJson, staffRoute } from "@/server/http/api";
import { hashPassword } from "@/server/auth";
import { Problem } from "@/lib/errors";
import { appUrl } from "@/server/jobs";
import { notify } from "@/server/notify";
import { prisma } from "@/server/db";
import { vnDate } from "@/lib/time";
import { readCredentials } from "../../auth/credentials";

const DAY_MS = 86_400_000;
const ACTIONS = ["activate", "pause", "resume", "assign"] as const;
type Action = (typeof ACTIONS)[number];

function text(value: unknown, max: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > max) throw new Problem("Dữ liệu không hợp lệ.");
  return value.trim();
}

function packageDays(value: unknown): number {
  const days = Number(value ?? DEFAULT_PACKAGE_DAYS);
  if (!Number.isInteger(days) || days < 1 || days > 366) throw new Problem("Số ngày phải từ 1 đến 366.");
  return days;
}

/** Admin creates a learner account, optionally activating a package right away. */
export const POST = staffRoute("createAccounts", async (req, staff) => {
  const body = await readJson(req);
  const name = text(body.name, 80);
  if (!name) throw new Problem("Tên cần từ 1 đến 80 ký tự.");
  const { email, password } = readCredentials(body, ADMIN_MIN_PASSWORD);
  const phone = text(body.phone, 30);
  const activate = body.activate === true || body.activate === "on";
  const now = new Date();
  const days = activate ? packageDays(body.days) : 0;
  const packageName = activate ? (text(body.packageName, 80) ?? `Gói ${days} ngày`) : null;

  const passwordHash = await hashPassword(password);
  const learner = await prisma.user
    .create({
      data: {
        email,
        name,
        passwordHash,
        phone,
        ...(activate && {
          status: "ACTIVE" as const,
          packageName,
          activatedAt: now,
          accessEndsAt: new Date(now.getTime() + days * DAY_MS),
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
      body: activate ? `Admin tạo tài khoản và kích hoạt ${packageName} (+${days} ngày).` : "Admin tạo tài khoản.",
    },
  });
  return json({ ok: true, id: learner.id });
});

/**
 * Consultant actions on a learner: activate (or extend) a package after payment,
 * pause / resume access, assign the responsible consultant.
 */
export const PATCH = staffRoute("manageLearners", async (req, staff) => {
  const body = await readJson(req);
  const action = body.action as Action;
  if (!ACTIONS.includes(action)) throw new Problem("Thao tác không hợp lệ.");
  const learner = await prisma.user.findFirst({
    where: { id: String(body.id ?? ""), role: "LEARNER", isDemo: false },
    select: { id: true, name: true, status: true, accessEndsAt: true, lockAt: true, activatedAt: true, consultantId: true },
  });
  if (!learner) throw new Problem("Không tìm thấy học viên.", 404);

  const consultantId = text(body.consultantId, 40);
  if (consultantId) {
    const ok = await prisma.user.count({ where: { id: consultantId, role: { in: ["CONSULTANT", "ADMIN"] } } });
    if (!ok) throw new Problem("Chuyên viên không hợp lệ.");
  }

  let note: string;
  const now = new Date();
  if (action === "activate") {
    const days = packageDays(body.days);
    const packageName = text(body.packageName, 80) ?? `Gói ${days} ngày`;
    // Extending an active package adds days after its current end.
    const from = learner.accessEndsAt && learner.accessEndsAt > now ? learner.accessEndsAt : now;
    const accessEndsAt = new Date(from.getTime() + days * DAY_MS);
    await prisma.user.update({
      where: { id: learner.id },
      data: {
        status: "ACTIVE",
        packageName,
        activatedAt: learner.activatedAt ?? now,
        accessEndsAt,
        lockAt: null,
        phone: text(body.phone, 30) ?? undefined,
        consultantId: consultantId ?? learner.consultantId ?? (staff.role === "CONSULTANT" ? staff.id : null),
      },
    });
    note = `Kích hoạt ${packageName} (+${days} ngày, đến ${vnDate(accessEndsAt).split("-").reverse().join("/")}).`;
    await notify(
      learner.id,
      "activated",
      vnDate(),
      `Chúc mừng ${learner.name}! Lộ trình WeWIN Daily Speaking của bạn đã được kích hoạt. Mỗi ngày 15 phút, bắt đầu tại: ${appUrl()}/today`,
    );
  } else if (action === "pause") {
    await prisma.user.update({ where: { id: learner.id }, data: { status: "PAUSED" } });
    note = "Tạm dừng tài khoản.";
  } else if (action === "resume") {
    if (!learner.accessEndsAt || learner.accessEndsAt <= now) throw new Problem("Gói đã hết hạn, hãy kích hoạt/gia hạn.");
    if (learner.lockAt && learner.lockAt <= now) throw new Problem("Học viên đã hoàn thành lộ trình và bị khóa, hãy kích hoạt lại.");
    await prisma.user.update({ where: { id: learner.id }, data: { status: "ACTIVE" } });
    note = "Mở lại tài khoản.";
  } else {
    await prisma.user.update({ where: { id: learner.id }, data: { consultantId } });
    note = consultantId ? "Đổi chuyên viên phụ trách." : "Bỏ chuyên viên phụ trách.";
  }
  const reason = text(body.note, 1000);
  await prisma.staffNote.create({
    data: { learnerId: learner.id, authorId: staff.id, body: reason ? `${note} ${reason}` : note },
  });
  return json({ ok: true });
});
