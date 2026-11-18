import type { NextRequest } from "next/server";
import { json } from "@/server/http/api";
import { Problem } from "@/lib/errors";
import { runStudyReminderForUser } from "@/server/jobs";
import { qstashConfigured, qstashReceiver } from "@/server/integrations/qstash";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * QStash callback: one learner, one reminder attempt, then enqueue the next slot.
 * Auth is the QStash signature (not CRON_SECRET / session).
 */
export async function POST(req: NextRequest) {
  try {
    if (!qstashConfigured()) return json({ error: "QStash chưa được cấu hình." }, 503);

    const receiver = qstashReceiver();
    if (!receiver) return json({ error: "QStash chưa được cấu hình." }, 503);

    const signature = req.headers.get("upstash-signature") ?? "";
    const raw = await req.text();
    try {
      await receiver.verify({ signature, body: raw });
    } catch {
      return json({ error: "Unauthorized" }, 401);
    }

    let body: { userId?: unknown; localDate?: unknown; studyTime?: unknown };
    try {
      body = raw ? (JSON.parse(raw) as { userId?: unknown; localDate?: unknown; studyTime?: unknown }) : {};
    } catch {
      return json({ error: "JSON không hợp lệ." }, 400);
    }

    const userId = typeof body.userId === "string" ? body.userId : "";
    if (!userId || userId.length > 64) return json({ error: "Thiếu userId." }, 400);
    const studyTime = typeof body.studyTime === "string" ? body.studyTime : undefined;

    const result = await runStudyReminderForUser(userId, new Date(), studyTime);
    return json({ ok: true, userId, localDate: body.localDate ?? null, ...result });
  } catch (error) {
    if (error instanceof Problem) return json({ error: error.message }, error.status);
    console.error("qstash study-reminder", error);
    return json({ error: "Có lỗi máy chủ." }, 500);
  }
}
