import { authedRoute, json } from "@/server/http/api";
import { attemptResult } from "@/server/shadowing/store";

export const GET = authedRoute(async (req, user) => json(await attemptResult(req.nextUrl.searchParams.get("id") ?? "", user)));
