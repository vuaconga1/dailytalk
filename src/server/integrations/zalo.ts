import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/server/db";

/**
 * Zalo Official Account (API v3) – consultation ("tư vấn") messages.
 * They are free but Zalo only accepts them within a window after the follower's
 * last interaction, so reminders ask learners to reply to keep the window open.
 * Without credentials every send is a dry run (logged, never delivered).
 */
const env = (name: string) => process.env[name]?.trim() || "";

const OAUTH_URL = "https://oauth.zaloapp.com/v4/oa/access_token";
const CS_MESSAGE_URL = "https://openapi.zalo.me/v3.0/oa/message/cs";
/** Refresh slightly before expiry so a request never carries a dying token. */
const EXPIRY_MARGIN_MS = 5 * 60_000;

export function zaloConfigured(): boolean {
  return Boolean(env("ZALO_APP_ID") && env("ZALO_APP_SECRET") && env("ZALO_REFRESH_TOKEN"));
}

/** Hours after the follower's last interaction during which consultation messages are allowed. */
export function messagingWindowHours(): number {
  const hours = Number(env("ZALO_CS_WINDOW_HOURS") || 48);
  return Number.isFinite(hours) && hours > 0 ? hours : 48;
}

export function oaFollowUrl(): string | null {
  return env("ZALO_OA_URL") || null;
}

type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: string | number; error?: number; error_description?: string };

async function refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
  const res = await fetch(OAUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", secret_key: env("ZALO_APP_SECRET") },
    body: new URLSearchParams({ refresh_token: refreshToken, app_id: env("ZALO_APP_ID"), grant_type: "refresh_token" }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !data.access_token || !data.refresh_token) {
    throw new Error(`Zalo token refresh failed: ${data.error ?? res.status} ${data.error_description ?? ""}`.trim());
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + Number(data.expires_in ?? 3600) * 1000),
  };
}

/**
 * Zalo rotates the refresh token on every refresh and invalidates the old one,
 * so the newest pair lives in the DB; ZALO_REFRESH_TOKEN only seeds the first refresh.
 */
async function accessToken(force = false): Promise<string> {
  const row = await prisma.zaloToken.findUnique({ where: { id: "oa" } });
  if (row && !force && row.expiresAt.getTime() - EXPIRY_MARGIN_MS > Date.now()) return row.accessToken;
  const current = row?.refreshToken ?? env("ZALO_REFRESH_TOKEN");
  if (!current) throw new Error("Thiếu ZALO_REFRESH_TOKEN.");
  let next;
  try {
    next = await refresh(current);
  } catch (error) {
    // A concurrent request may have rotated the token first; use its result.
    const latest = await prisma.zaloToken.findUnique({ where: { id: "oa" } });
    if (latest && latest.refreshToken !== current && latest.expiresAt.getTime() > Date.now()) return latest.accessToken;
    throw error;
  }
  if (row) {
    await prisma.zaloToken.updateMany({ where: { id: "oa", refreshToken: current }, data: next });
  } else {
    await prisma.zaloToken.createMany({ data: [{ id: "oa", ...next }], skipDuplicates: true });
  }
  return next.accessToken;
}

export type SendResult = { ok: true; messageId?: string } | { ok: false; reason: string; dryRun?: boolean };

/** Error codes meaning the access token is invalid / expired. */
const TOKEN_ERRORS = new Set([-216, -124]);

export async function sendText(zaloUserId: string, text: string): Promise<SendResult> {
  if (!zaloConfigured()) {
    console.info(`[zalo dry-run] → ${zaloUserId}: ${text}`);
    return { ok: false, reason: "dry_run: chưa cấu hình Zalo OA", dryRun: true };
  }
  for (const force of [false, true]) {
    const res = await fetch(CS_MESSAGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: await accessToken(force) },
      body: JSON.stringify({ recipient: { user_id: zaloUserId }, message: { text } }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: number; message?: string; data?: { message_id?: string } };
    if (data.error === 0) return { ok: true, messageId: data.data?.message_id };
    if (!force && data.error !== undefined && TOKEN_ERRORS.has(data.error)) continue;
    return { ok: false, reason: `zalo ${data.error ?? res.status}: ${data.message ?? "unknown"}`.slice(0, 300) };
  }
  return { ok: false, reason: "zalo: access token bị từ chối" };
}

/**
 * Webhook signature: X-ZEvent-Signature = "mac=" + sha256(appId + rawBody + timestamp + OA secret key).
 * Requests are rejected while ZALO_OA_SECRET_KEY is unset.
 */
export function verifyWebhook(rawBody: string, timestamp: string, signature: string | null): boolean {
  const appId = env("ZALO_APP_ID");
  const secret = env("ZALO_OA_SECRET_KEY");
  if (!appId || !secret || !signature) return false;
  const expected = Buffer.from(`mac=${createHash("sha256").update(appId + rawBody + timestamp + secret).digest("hex")}`);
  const given = Buffer.from(signature.trim());
  return expected.length === given.length && timingSafeEqual(expected, given);
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const LINK_CODE_TTL_MS = 30 * 60_000;
export const LINK_CODE_PATTERN = /\bWW[A-HJ-NP-Z2-9]{6}\b/i;

export function newLinkCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `WW${Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("")}`;
}
