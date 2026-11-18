import { json, staffRoute } from "@/server/http/api";
import { buildWeeklyReports, ensureStudySchedules, expireAccounts, lastWeekStart, runStudyJobs } from "@/server/jobs";

export const maxDuration = 60;

/** Runs maintenance jobs on demand from the admin dashboard. */
export const POST = staffRoute("runJobs", async () => {
  const expired = await expireAccounts();
  const ensure = await ensureStudySchedules();
  const study = await runStudyJobs();
  const weekStart = lastWeekStart();
  return json({
    ok: true,
    expired,
    ensure,
    study,
    weekly: { weekStart, created: await buildWeeklyReports(weekStart) },
  });
});
