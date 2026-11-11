import type { Role } from "@/generated/prisma/client";
import type { SessionUser } from "@/server/auth";

/** Days a not-yet-activated learner may study before a consultant activates them. */
export const TRIAL_DAYS = 1;
export const DEFAULT_PACKAGE_DAYS = 30;
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
  return user.status === "ACTIVE" && (!user.accessEndsAt || user.accessEndsAt > now);
}

/** Whether the learner may open study day `day` (trial covers the first day only). */
export function canStudyDay(user: Learner, day: number): boolean {
  return hasActiveAccess(user) || day <= TRIAL_DAYS;
}
