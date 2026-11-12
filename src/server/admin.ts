import "server-only";
import { EXPIRING_SOON_DAYS, hasActiveAccess } from "@/domain/access";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import { shiftDays, vnDate } from "@/lib/time";
import { normalizeLesson } from "@/domain/content";
import type { LearnerProfile, Summary } from "@/domain/types";

/** An active learner with no session for this many days needs a consultant's call. */
export const INACTIVE_DAYS = 3;

export const LEARNER_FILTERS = {
  all: "Tất cả",
  lead: "Chờ kích hoạt",
  active: "Đang học",
  support: "Cần hỗ trợ",
  expiring: `Sắp hết hạn (≤ ${EXPIRING_SOON_DAYS} ngày)`,
  expired: "Hết hạn",
  unlimited: "Không thời hạn",
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

export const LEARNER_SORTS = {
  newest: "Mới tạo",
  ending: "Hết hạn sớm nhất",
  name: "Tên A–Z",
} as const;

export type LearnerSort = keyof typeof LEARNER_SORTS;

export function isLearnerSort(value: unknown): value is LearnerSort {
  return typeof value === "string" && value in LEARNER_SORTS;
}

const LEARNER_ORDER: Record<LearnerSort, Prisma.UserOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }],
  ending: [{ accessEndsAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
  name: [{ name: "asc" }],
};

/** `consultantId`: a staff id, "none" for unassigned learners, or empty for everyone. */
export async function listLearners(
  filter: LearnerFilter = "all",
  q = "",
  consultantId = "",
  sort: LearnerSort = "newest",
): Promise<LearnerRow[]> {
  const now = new Date();
  const and: Prisma.UserWhereInput[] = [{ role: "LEARNER", isDemo: false }];
  if (filter === "lead") and.push({ status: "LEAD" });
  if (filter === "active" || filter === "support") and.push({ status: "ACTIVE" });
  if (filter === "inactive") and.push({ status: { in: ["PAUSED", "EXPIRED"] } });
  if (filter === "expiring") {
    const soon = new Date(now.getTime() + EXPIRING_SOON_DAYS * 86_400_000);
    and.push({ status: "ACTIVE", accessEndsAt: { gt: now, lte: soon } });
  }
  if (filter === "expired") {
    and.push({ OR: [{ status: "EXPIRED" }, { status: { not: "LEAD" }, accessEndsAt: { lte: now } }] });
  }
  if (filter === "unlimited") and.push({ status: { in: ["ACTIVE", "PAUSED"] }, accessEndsAt: null });
  if (consultantId === "none") and.push({ consultantId: null });
  else if (consultantId) and.push({ consultantId });
  const term = q.trim();
  if (term) {
    and.push({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { phone: { contains: term } },
      ],
    });
  }
  const where: Prisma.UserWhereInput = { AND: and };
  const rows = (await prisma.user.findMany({ where, select: LIST_SELECT, orderBy: LEARNER_ORDER[sort], take: 300 })).map(toRow);
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
