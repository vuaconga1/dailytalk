import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { json, route } from "@/server/http/api";
import { Problem } from "@/lib/errors";
import {
  buildWeeklyReports,
  ensureStudySchedules,
  expireAccounts,
  lastWeekStart,
  runStudyJobs,
} from "@/server/jobs";
import { weekStartOf } from "@/lib/time";
import { purgeExpiredRecordings } from "@/server/shadowing/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Default daily jobs — study reminders are per-learner via QStash, not a tight poll. */
const JOBS = ["expire", "weekly", "recordings", "ensure"] as const;
type Job = (typeof JOBS)[number] | "study";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

/** Accepts `Authorization: Bearer <CRON_SECRET>` (cron-job.org, QStash) or `x-cron-secret`. */
function authorize(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 16) throw new Problem("CRON_SECRET chưa được cấu hình.", 503);
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? req.headers.get("x-cron-secret") ?? "";
  if (!timingSafeEqual(digest(given), digest(secret))) throw new Problem("Unauthorized", 401);
}

/**
 * Call once daily from an external scheduler (or Vercel Cron).
 * `ensure` re-queues QStash reminders for eligible learners (deduped).
 * `?jobs=study` remains available as a manual fallback sweep.
 */
async function handler(req: NextRequest) {
  authorize(req);
  const params = req.nextUrl.searchParams;
  const requested = params.get("jobs")?.split(",").map((j) => j.trim()) ?? [...JOBS];
  const jobs = requested.filter((j): j is Job => j === "study" || (JOBS as readonly string[]).includes(j));
  const week = params.get("week");
  if (week && !/^\d{4}-\d{2}-\d{2}$/.test(week)) throw new Problem("week phải có dạng YYYY-MM-DD.");

  const started = Date.now();
  const out: Record<string, unknown> = {};
  if (jobs.includes("expire")) out.expired = await expireAccounts();
  if (jobs.includes("ensure")) out.ensure = await ensureStudySchedules();
  if (jobs.includes("study")) out.study = await runStudyJobs();
  if (jobs.includes("weekly")) {
    const weekStart = week ? weekStartOf(week) : lastWeekStart();
    out.weekly = { weekStart, created: await buildWeeklyReports(weekStart) };
  }
  if (jobs.includes("recordings")) out.recordingsPurged = await purgeExpiredRecordings(true);
  return json({ ok: true, ms: Date.now() - started, ...out });
}

export const GET = route(handler);
export const POST = route(handler);
