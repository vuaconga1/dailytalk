import type { Role } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth";

/** Days a not-yet-activated learner may study before a consultant activates them. */
export const TRIAL_DAYS = 1;
export const DEFAULT_PACKAGE_DAYS = 30;

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
  runJobs: ["ADMIN"],
} satisfies Record<string, Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as Role[]).includes(role);
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
