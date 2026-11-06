import { authedRoute, json } from "@/server/http/api";

/** Heartbeat: keeps the session marked active and tells a replaced/locked session to sign out. */
export const GET = authedRoute(async () => json({ ok: true }));
