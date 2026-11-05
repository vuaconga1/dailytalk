/** Session auth via signed httpOnly cookie + bcrypt passwords. */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { AccountStatus, Role } from "@/generated/prisma/client";
import type { LearnerProfile, StudyPlan } from "@/lib/types";

const COOKIE_NAME = "ww_session";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;
export const DEMO_SESSION_MAX_AGE_SEC = 60 * 60 * 24;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: AccountStatus;
  accessEndsAt: Date | null;
  isDemo: boolean;
  profile: LearnerProfile | null;
  plan: StudyPlan | null;
  planSource: string | null;
};

function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set to a string of at least 16 characters in production");
  }
  // Dev fallback only — never used when NODE_ENV=production
  return "wewin-dailytalk-dev-secret-change-me";
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function encodeSession(userId: string, maxAgeSec: number): string {
  const body = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + maxAgeSec * 1000 })).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeSession(token: string): string | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { uid?: string; exp?: number };
    if (!data.uid || !data.exp || Date.now() > data.exp) return null;
    return data.uid;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Compared against when the email is unknown, so both paths cost one bcrypt check.
let dummyHash: Promise<string> | null = null;

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  dummyHash ??= bcrypt.hash("unknown-account", 10);
  const ok = await bcrypt.compare(password, hash ?? (await dummyHash));
  return ok && hash !== null;
}

export async function createSession(userId: string, maxAgeSec = SESSION_MAX_AGE_SEC): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, encodeSession(userId, maxAgeSec), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSec,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

/** Deduped within a single request (layout + page both call this). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  const userId = token ? decodeSession(token) : null;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: SESSION_USER_SELECT });
  return user ? toSessionUser(user) : null;
});

export const SESSION_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  accessEndsAt: true,
  isDemo: true,
  profile: true,
  plan: true,
  planSource: true,
} as const;

type SessionUserRow = Omit<SessionUser, "profile" | "plan"> & { profile: unknown; plan: unknown };

export function toSessionUser(row: SessionUserRow): SessionUser {
  return { ...row, profile: row.profile as LearnerProfile | null, plan: row.plan as StudyPlan | null };
}
