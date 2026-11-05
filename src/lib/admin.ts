import "server-only";
import { hasActiveAccess } from "@/lib/access";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { shiftDays, vnDate } from "@/lib/time";
import { normalizeLesson } from "@/lib/content";
import type { LearnerProfile, Summary } from "@/lib/types";

/** An active learner with no session for this many days needs a consultant's call. */
export const INACTIVE_DAYS = 3;

export const LEARNER_FILTERS = {
  all: "Tất cả",
  lead: "Chờ kích hoạt",
  active: "Đang học",
  support: "Cần hỗ trợ",
  inactive: "Tạm dừng / hết hạn",
} as const;

export type LearnerFilter = keyof typeof LEARNER_FILTERS;

export function isLearnerFilter(value: unknown): value is LearnerFilter {
  return typeof value === "string" && value in LEARNER_FILTERS;
}

const LIST_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  status: true,
  isDemo: true,
  profile: true,
  packageName: true,
  activatedAt: true,
  accessEndsAt: true,
  createdAt: true,
  consultant: { select: { id: true, name: true } },
  zaloLink: { select: { followed: true, lastInteractionAt: true } },
  attempts: {
    where: { completed: true },
    orderBy: { day: "desc" },
    take: 3,
    select: { day: true, localDate: true, summary: true, lesson: true },
  },
  _count: { select: { attempts: { where: { completed: true } } } },
} satisfies Prisma.UserSelect;

type ListRow = Prisma.UserGetPayload<{ select: typeof LIST_SELECT }>;

export type LearnerRow = Omit<ListRow, "profile" | "attempts"> & {
  profile: LearnerProfile | null;
  lastStudied: string | null;
  sessionsDone: number;
  supportReasons: string[];
  zaloWarning: string | null;
};

/** Live signals (the weekly report adds a slower, aggregated view). */
export function supportReasons(row: ListRow, today = vnDate()): string[] {
  if (row.status !== "ACTIVE" || !hasActiveAccess({ ...row, isDemo: false })) return [];
  const reasons: string[] = [];
  const last = row.attempts[0]?.localDate ?? null;
  const since = last ?? (row.activatedAt ? vnDate(row.activatedAt) : null);
  if (since && since <= shiftDays(today, -INACTIVE_DAYS)) {
    reasons.push(last ? `Không học từ ${last.split("-").reverse().join("/")}` : `Chưa học buổi nào sau ${INACTIVE_DAYS} ngày kích hoạt`);
  }
  const recent = row.attempts.slice(0, 2).map((a) => (a.summary as Summary | null)?.goal_status);
  if (recent.length === 2 && recent.every((s) => s !== "achieved")) reasons.push("2 buổi gần nhất chưa đạt mục tiêu");
  return reasons;
}

export function zaloWarning(link: ListRow["zaloLink"]): string | null {
  if (!link) return "Chưa liên kết Zalo";
  return link.followed ? null : "Đã bỏ quan tâm OA";
}

function toRow(row: ListRow): LearnerRow {
  const { attempts, _count, ...rest } = row;
  return {
    ...rest,
    _count,
    profile: row.profile as LearnerProfile | null,
    lastStudied: attempts[0]?.localDate ?? null,
    sessionsDone: _count.attempts,
    supportReasons: supportReasons(row),
    zaloWarning: zaloWarning(row.zaloLink),
  };
}

export async function listLearners(filter: LearnerFilter = "all", q = ""): Promise<LearnerRow[]> {
  const where: Prisma.UserWhereInput = { role: "LEARNER", isDemo: false };
  if (filter === "lead") where.status = "LEAD";
  if (filter === "active" || filter === "support") where.status = "ACTIVE";
  if (filter === "inactive") where.status = { in: ["PAUSED", "EXPIRED"] };
  const term = q.trim();
  if (term) {
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { phone: { contains: term } },
    ];
  }
  const rows = (await prisma.user.findMany({ where, select: LIST_SELECT, orderBy: { createdAt: "desc" }, take: 300 })).map(toRow);
  return filter === "support" ? rows.filter((r) => r.supportReasons.length) : rows;
}

export async function dashboardCounts() {
  const [leads, active, paused, learners] = await Promise.all([
    prisma.user.count({ where: { role: "LEARNER", isDemo: false, status: "LEAD" } }),
    prisma.user.count({ where: { role: "LEARNER", isDemo: false, status: "ACTIVE" } }),
    prisma.user.count({ where: { role: "LEARNER", isDemo: false, status: { in: ["PAUSED", "EXPIRED"] } } }),
    listLearners("support"),
  ]);
  return { leads, active, paused, support: learners };
}

export async function learnerDetail(id: string) {
  const user = await prisma.user.findFirst({
    where: { id, role: "LEARNER" },
    include: {
      consultant: { select: { id: true, name: true } },
      zaloLink: true,
      attempts: { orderBy: { day: "desc" }, include: { practice: { select: { turns: true, startedAt: true } } } },
      notifications: { orderBy: { createdAt: "desc" }, take: 20 },
      weeklyReports: { orderBy: { weekStart: "desc" }, take: 8 },
      notesAbout: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
    },
  });
  if (!user) return null;
  return {
    ...user,
    profile: user.profile as LearnerProfile | null,
    attempts: user.attempts.map((a) => ({ ...a, lesson: normalizeLesson(a.lesson), summary: a.summary as Summary | null })),
  };
}

export async function staffList() {
  return prisma.user.findMany({
    where: { role: { not: "LEARNER" } },
    select: { id: true, name: true, email: true, role: true, createdAt: true, _count: { select: { learners: true } } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
}
