import "server-only";
import { notFound, redirect } from "next/navigation";
import { can, isStaff, type Permission } from "@/domain/access";
import { getSessionUser, type SessionUser } from "@/server/auth";
import { isCurrentProfile } from "@/domain/profile";
import type { LearnerProfile, StudyPlan } from "@/domain/types";

/** Staff-only pages; learners and missing permissions get a 404 rather than a hint. */
export async function requireStaff(permission: Permission = "viewLearners"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isStaff(user.role) || !can(user.role, permission)) notFound();
  return user;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export type PlannedUser = SessionUser & { profile: LearnerProfile; plan: StudyPlan };

/** Learners without a (current-format) profile and plan are sent to onboarding first. */
export async function requirePlan(): Promise<PlannedUser> {
  const user = await requireUser();
  if (!user.plan || !isCurrentProfile(user.profile)) redirect("/onboarding");
  return user as PlannedUser;
}
