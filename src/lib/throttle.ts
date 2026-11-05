import "server-only";
import { Problem } from "@/lib/errors";

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 15;
const hits = new Map<string, number[]>();

/** Best-effort per-instance limit on login/register attempts. */
export function throttleAuth(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS) throw new Problem("Thử lại sau một phút.", 429);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 10_000) hits.clear();
}
