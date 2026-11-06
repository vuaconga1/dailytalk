/** Session auth via signed httpOnly cookie + bcrypt passwords. */
import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { isLocked } from "@/domain/access";
import { Problem } from "@/lib/errors";
import type { AccountStatus, Role } from "@/generated/prisma/client";
import type { LearnerProfile, StudyPlan } from "@/domain/types";

const COOKIE_NAME = "ww_session";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;
export const DEMO_SESSION_MAX_AGE_SEC = 60 * 60 * 24;
/** A session seen within this window counts as "đang đăng nhập" when another IP logs in. */
const SESSION_ACTIVE_WINDOW_MS = 15 * 60_000;
const SEEN_REFRESH_MS = 60_000;
const SESSION_CONFLICT_MESSAGE =
  "Tài khoản đang được đăng nhập ở một nơi khác. Để bảo mật, WeWIN đã đăng xuất tài khoản trên tất cả thiết bị. Vui lòng đăng nhập lại.";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: AccountStatus;
  accessEndsAt: Date | null;
  lockAt: Date | null;
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

type SessionToken = { uid: string; sid: string };

function encodeSession(token: SessionToken, maxAgeSec: number): string {
  const body = Buffer.from(JSON.stringify({ ...token, exp: Date.now() + maxAgeSec * 1000 })).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeSession(token: string): SessionToken | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { uid?: string; sid?: string; exp?: number };
    if (!data.uid || !data.sid || !data.exp || Date.now() > data.exp) return null;
    return { uid: data.uid, sid: data.sid };
  } catch {
    return null;
  }
}

async function requestIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
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

/**
 * One live session per account. Logging in while another IP was active recently ends every
 * session of the account (both devices) and asks to log in again; the same IP just takes over.
 */
export async function createSession(userId: string, maxAgeSec = SESSION_MAX_AGE_SEC): Promise<void> {
  const ip = await requestIp();
  const now = new Date();
  const current = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { sessionId: true, sessionIp: true, sessionSeenAt: true },
  });
  const activeElsewhere =
    current.sessionId &&
    current.sessionIp !== ip &&
    current.sessionSeenAt &&
    now.getTime() - current.sessionSeenAt.getTime() < SESSION_ACTIVE_WINDOW_MS;
  if (activeElsewhere) {
    await prisma.user.update({ where: { id: userId }, data: { sessionId: null, sessionIp: null, sessionSeenAt: null } });
    throw new Problem(SESSION_CONFLICT_MESSAGE, 409);
  }
  const sid = randomBytes(16).toString("base64url");
  await prisma.user.update({ where: { id: userId }, data: { sessionId: sid, sessionIp: ip, sessionSeenAt: now } });
  const jar = await cookies();
  jar.set(COOKIE_NAME, encodeSession({ uid: userId, sid }, maxAgeSec), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSec,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  const session = token ? decodeSession(token) : null;
  if (session) {
    await prisma.user.updateMany({
      where: { id: session.uid, sessionId: session.sid },
      data: { sessionId: null, sessionIp: null, sessionSeenAt: null },
    });
  }
  jar.delete(COOKIE_NAME);
}

/** Why a signed-in cookie no longer gives access: replaced by another login, or the account is locked. */
export type SessionEnd = "conflict" | "locked";

export const SESSION_END_MESSAGES: Record<SessionEnd, string> = {
  conflict: "Tài khoản của bạn vừa được đăng nhập ở nơi khác nên phiên này đã bị đăng xuất. Mỗi tài khoản chỉ dùng trên một thiết bị.",
  locked: "Tài khoản đã hết thời gian sử dụng sau khi hoàn thành lộ trình 30 ngày. Vui lòng liên hệ WeWIN để được kích hoạt lại.",
};

type SessionState = { user: SessionUser | null; ended: SessionEnd | null };

/** Deduped within a single request (layout + page both call this). */
export const getSessionState = cache(async (): Promise<SessionState> => {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  const session = token ? decodeSession(token) : null;
  if (!session) return { user: null, ended: null };
  const row = await prisma.user.findUnique({
    where: { id: session.uid },
    select: { ...SESSION_USER_SELECT, sessionId: true, sessionIp: true, sessionSeenAt: true },
  });
  if (!row) return { user: null, ended: null };
  const { sessionId, sessionIp, sessionSeenAt, ...rest } = row;
  if (sessionId !== session.sid) return { user: null, ended: "conflict" };
  const user = toSessionUser(rest);
  if (isLocked(user)) return { user: null, ended: "locked" };

  const ip = await requestIp();
  const now = new Date();
  if (ip !== sessionIp || !sessionSeenAt || now.getTime() - sessionSeenAt.getTime() > SEEN_REFRESH_MS) {
    await prisma.user.updateMany({ where: { id: user.id, sessionId }, data: { sessionIp: ip, sessionSeenAt: now } });
  }
  return { user, ended: null };
});

export async function getSessionUser(): Promise<SessionUser | null> {
  return (await getSessionState()).user;
}

export const SESSION_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  accessEndsAt: true,
  lockAt: true,
  isDemo: true,
  profile: true,
  plan: true,
  planSource: true,
} as const;

type SessionUserRow = Omit<SessionUser, "profile" | "plan"> & { profile: unknown; plan: unknown };

export function toSessionUser(row: SessionUserRow): SessionUser {
  return { ...row, profile: row.profile as LearnerProfile | null, plan: row.plan as StudyPlan | null };
}
