import { json, staffRoute } from "@/lib/api";
import { buildWeeklyReports, expireAccounts, lastWeekStart, runStudyJobs } from "@/lib/jobs";

export const maxDuration = 60;

/** Runs the cron jobs on demand from the admin dashboard (same work as /api/cron/tick). */
export const POST = staffRoute("runJobs", async () => {
  const expired = await expireAccounts();
  const study = await runStudyJobs();
  const weekStart = lastWeekStart();
  return json({ ok: true, expired, study, weekly: { weekStart, created: await buildWeeklyReports(weekStart) } });
});
