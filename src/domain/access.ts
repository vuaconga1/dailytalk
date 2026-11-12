import type { Role } from "@/generated/prisma/client";
import type { SessionUser } from "@/server/auth";

/** Days a learner may study; every active learner now has access to all days. */
export const TRIAL_DAYS = 30;
export const DEFAULT_PACKAGE_DAYS = 30;
export const MAX_PACKAGE_DAYS = 3650;
/** Quick choices for an account's term; `custom`, `date` and `unlimited` are handled by the admin API. */
export const TERM_PRESETS = [
  { days: 7, label: "7 ngày" },
  { days: 30, label: "1 tháng (30 ngày)" },
  { days: 90, label: "3 tháng (90 ngày)" },
  { days: 180, label: "6 tháng (180 ngày)" },
  { days: 365, label: "1 năm (365 ngày)" },
] as const;
/** Active accounts ending within this many days show up under "Sắp hết hạn". */
export const EXPIRING_SOON_DAYS = 7;
/** Self-registration requires 8+ characters; an admin creating an account may set a shorter one. */
export const MIN_PASSWORD = 8;
export const ADMIN_MIN_PASSWORD = 3;
/** Temporary: activate a LEAD learner as soon as onboarding builds their plan. Set false to require staff activation again. */
export const AUTO_ACTIVATE_ON_ONBOARD = true;

export const ROLE_LABELS: Record<Role, string> = {
  LEARNER: "Học viên",
  CONSULTANT: "Chuyên viên",
  ACADEMIC: "Học thuật",
  ADMIN: "Admin",
};

export const STAFF_ROLES: Role[] = ["CONSULTANT", "ACADEMIC", "ADMIN"];

export function isStaff(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

/** What each staff area allows. ADMIN can do everything. */
export const PERMISSIONS = {
  viewLearners: ["CONSULTANT", "ACADEMIC", "ADMIN"],
  manageLearners: ["CONSULTANT", "ADMIN"],
  manageLessons: ["ACADEMIC", "ADMIN"],
  viewNotifications: ["CONSULTANT", "ADMIN"],
  manageStaff: ["ADMIN"],
  createAccounts: ["ADMIN"],
  manageSettings: ["ADMIN"],
  runJobs: ["ADMIN"],
} satisfies Record<string, Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as Role[]).includes(role);
}

/** After the last study day the learner keeps access this long (to review), then the account locks. */
export const FINISH_GRACE_MS = 24 * 60 * 60 * 1000;
export const LAST_STUDY_DAY = 30;

/** Locked until staff activates the account again (activation clears `lockAt`). */
export function isLocked(user: Pick<SessionUser, "role" | "isDemo" | "lockAt">, now = new Date()): boolean {
  return user.role === "LEARNER" && !user.isDemo && user.lockAt !== null && user.lockAt <= now;
}

type Learner = Pick<SessionUser, "isDemo" | "status" | "accessEndsAt">;

export function hasActiveAccess(user: Learner, now = new Date()): boolean {
  if (user.isDemo) return true;
  if (user.status === "PAUSED") return false;
  if (user.status === "EXPIRED" && user.accessEndsAt && user.accessEndsAt <= now) return false;
  return !user.accessEndsAt || user.accessEndsAt > now;
}

/** Whole days of access left (0 once ended), or null for an account without an end date. */
export function daysLeft(accessEndsAt: Date | null, now = new Date()): number | null {
  if (!accessEndsAt) return null;
  return Math.max(0, Math.ceil((accessEndsAt.getTime() - now.getTime()) / 86_400_000));
}

/** Whether the learner may open study day `day` (all active learners can study all days). */
export function canStudyDay(user: Learner, day?: number): boolean {
  void day;
  return hasActiveAccess(user);
}
