import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { can, type Permission } from "@/lib/access";
import { getSessionUser, type SessionUser } from "@/lib/auth";
import { AIError, Problem } from "@/lib/errors";

export const MAX_BODY_BYTES = 4_000_000;

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** Cross-site POSTs are rejected; the session cookie is SameSite=Lax as a second layer. */
function assertSameOrigin(req: NextRequest) {
  if (req.method === "GET") return;
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new Problem("Origin không hợp lệ.", 403);
  }
  if (originHost !== host) throw new Problem("Origin không hợp lệ.", 403);
}

export async function readJson(req: NextRequest): Promise<Record<string, unknown>> {
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) throw new Problem("Nội dung quá lớn.", 413);
  let body: unknown;
  try {
    const raw = await req.text();
    body = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Problem("JSON không hợp lệ.");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new Problem("JSON phải là object.");
  return body as Record<string, unknown>;
}

type Handler = (req: NextRequest) => Promise<Response>;
type AuthedHandler = (req: NextRequest, user: SessionUser) => Promise<Response>;

/** Maps Problem / AIError to JSON errors and hides unexpected failures. */
export function route(handler: Handler): Handler {
  return async (req) => {
    try {
      assertSameOrigin(req);
      return await handler(req);
    } catch (error) {
      if (error instanceof Problem) return json({ error: error.message }, error.status);
      if (error instanceof AIError || error instanceof RangeError) return json({ error: error.message }, 422);
      console.error(req.method, req.nextUrl.pathname, error);
      return json({ error: "Có lỗi máy chủ. Dữ liệu đã lưu vẫn được giữ." }, 500);
    }
  };
}

export function authedRoute(handler: AuthedHandler): Handler {
  return route(async (req) => {
    const user = await getSessionUser();
    if (!user) throw new Problem("Vui lòng đăng nhập.", 401);
    return handler(req, user);
  });
}

export function staffRoute(permission: Permission, handler: AuthedHandler): Handler {
  return authedRoute(async (req, user) => {
    if (!can(user.role, permission)) throw new Problem("Không có quyền thực hiện thao tác này.", 403);
    return handler(req, user);
  });
}

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
