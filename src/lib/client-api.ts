/** Browser-side fetch helper: JSON in, JSON or Blob out, server error message thrown. */
export async function api<T = unknown>(path: string, body?: unknown, init: RequestInit = {}): Promise<T> {
  const options: RequestInit = { credentials: "same-origin", ...init };
  if (body !== undefined) {
    options.method = "POST";
    if (body instanceof Blob) {
      options.body = body;
    } else {
      options.headers = { "Content-Type": "application/json", ...init.headers };
      options.body = JSON.stringify(body);
    }
  }
  const res = await fetch(path, options);
  if (!res.ok) {
    let message = "Yêu cầu thất bại.";
    try {
      message = ((await res.json()) as { error?: string }).error ?? message;
    } catch {
      message = "Không kết nối được máy chủ.";
    }
    if (res.status === 401) window.location.assign("/login");
    throw new Error(message);
  }
  const type = res.headers.get("content-type") ?? "";
  return (type.includes("application/json") ? res.json() : res.blob()) as Promise<T>;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Yêu cầu thất bại.";
}
