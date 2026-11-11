import { authedRoute } from "@/server/http/api";
import { attemptRecording } from "@/server/shadowing/store";

/** Streams a private recording to its owner or to staff; the storage URL is never exposed. */
export const GET = authedRoute(async (req, user) => {
  const { data, mime } = await attemptRecording(req.nextUrl.searchParams.get("id") ?? "", user);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(data.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
