import { json, route } from "@/server/http/api";
import { destroySession } from "@/server/auth";

export const POST = route(async () => {
  await destroySession();
  return json({ ok: true });
});
