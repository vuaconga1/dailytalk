import { authedRoute, json } from "@/server/http/api";
import { historyFor } from "@/server/shadowing/store";

/** The learner's 30 latest "Đọc cả bài" attempts on one exercise, newest first. */
export const GET = authedRoute(async (req, user) => {
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  return json({ signedIn: true, items: slug ? await historyFor(user.id, slug) : [] });
});
