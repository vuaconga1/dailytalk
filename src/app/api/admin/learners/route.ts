import { json, readJson, staffRoute } from "@/server/http/api";
import { consultantFrom, createLearner, readTerm, text } from "@/server/accounts";
import { Problem } from "@/lib/errors";
import { appUrl } from "@/server/jobs";
import { notify } from "@/server/notify";
import { prisma } from "@/server/db";
import { vnDate } from "@/lib/time";

export const maxDuration = 60;

const MAX_BULK_ROWS = 200;
const BULK_CONCURRENCY = 5;
const ACTIONS = ["activate", "pause", "resume", "assign"] as const;
type Action = (typeof ACTIONS)[number];

type RowResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Admin creates learner accounts. A body with `rows` creates them in bulk (shared fields such as
 * `activate` apply to every row) and reports each row separately; otherwise the body is one account.
 */
export const POST = staffRoute("createAccounts", async (req, staff) => {
  const body = await readJson(req);
  if (!Array.isArray(body.rows)) return json({ ok: true, id: await createLearner(body, staff) });

  const { rows: rawRows, ...shared } = body;
  const rows = rawRows as unknown[];
  if (!rows.length) throw new Problem("Chưa có dòng nào.");
  if (rows.length > MAX_BULK_ROWS) throw new Problem(`Tối đa ${MAX_BULK_ROWS} tài khoản mỗi lần.`);

  const seen = new Set<string>();
  const results: RowResult[] = new Array(rows.length);
  const run = async (row: unknown, i: number) => {
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      results[i] = { ok: false, error: "Dòng không hợp lệ." };
      return;
    }
    const email = String((row as Record<string, unknown>).email ?? "").trim().toLowerCase();
    if (email && seen.has(email)) {
      results[i] = { ok: false, error: "Email bị trùng trong danh sách." };
      return;
    }
    seen.add(email);
    try {
      results[i] = { ok: true, id: await createLearner({ ...shared, ...row }, staff) };
    } catch (error) {
      if (!(error instanceof Problem)) console.error("bulk create learner", error);
      results[i] = { ok: false, error: error instanceof Problem ? error.message : "Lỗi máy chủ." };
    }
  };
  for (let i = 0; i < rows.length; i += BULK_CONCURRENCY) {
    await Promise.all(rows.slice(i, i + BULK_CONCURRENCY).map((row, j) => run(row, i + j)));
  }
  return json({ ok: true, created: results.filter((r) => r.ok).length, results });
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

  const consultantId = await consultantFrom(body);

  let note: string;
  const now = new Date();
  if (action === "activate") {
    // Extending an active package adds days after its current end.
    const from = learner.accessEndsAt && learner.accessEndsAt > now ? learner.accessEndsAt : now;
    const term = readTerm(body, from);
    const packageName = text(body.packageName, 80) ?? term.packageName;
    await prisma.user.update({
      where: { id: learner.id },
      data: {
        status: "ACTIVE",
        packageName,
        activatedAt: learner.activatedAt ?? now,
        accessEndsAt: term.accessEndsAt,
        lockAt: null,
        phone: text(body.phone, 30) ?? undefined,
        consultantId: consultantId ?? learner.consultantId ?? (staff.role === "CONSULTANT" ? staff.id : null),
      },
    });
    note = `Kích hoạt ${packageName} (${term.summary}).`;
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
    if (learner.accessEndsAt && learner.accessEndsAt <= now) throw new Problem("Gói đã hết hạn, hãy kích hoạt/gia hạn.");
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
