import "server-only";

/**
 * Transactional email via Resend (HTTPS). Fits Vercel serverless better than SMTP.
 * Without RESEND_API_KEY every send is a dry run (logged, never delivered).
 */
const env = (name: string) => process.env[name]?.trim() || "";

const RESEND_URL = "https://api.resend.com/emails";

export function emailConfigured(): boolean {
  return Boolean(env("RESEND_API_KEY") && env("EMAIL_FROM"));
}

export function emailFrom(): string {
  return env("EMAIL_FROM") || "WeWIN Daily Speaking <onboarding@resend.dev>";
}

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; dryRun: true; reason: string }
  | { ok: false; dryRun?: false; reason: string };

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Minimal HTML body from plain lines + optional CTA button. */
export function reminderEmailHtml(text: string, ctaUrl?: string): string {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p style="margin:0 0 12px;font-size:16px;line-height:1.5;color:#1a2b4a;">${escapeHtml(l)}</p>`)
    .join("");
  const button = ctaUrl
    ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:12px 20px;background:#0d9488;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">Mở bài hôm nay</a></p>`
    : "";
  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f4f7fb;font-family:system-ui,-apple-system,sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:28px 24px;background:#fff;border-radius:12px;">
<p style="margin:0 0 20px;font-size:13px;font-weight:700;letter-spacing:0.06em;color:#0d9488;">WEWIN DAILY SPEAKING</p>
${lines}${button}
<p style="margin:28px 0 0;font-size:12px;line-height:1.4;color:#64748b;">Email nhắc học tự động · Bạn có thể tắt nhắc trong Cài đặt trên app.</p>
</div></body></html>`;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const key = env("RESEND_API_KEY");
  const from = env("EMAIL_FROM");
  if (!key || !from) {
    const reason = "Email dry-run (thiếu RESEND_API_KEY hoặc EMAIL_FROM)";
    console.info("[email]", reason, { to: input.to, subject: input.subject });
    return { ok: false, dryRun: true, reason };
  }
  if (!input.to || input.to.endsWith("@demo.invalid")) {
    return { ok: false, dryRun: true, reason: "Bỏ qua email demo / thiếu địa chỉ" };
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject.slice(0, 200),
        text: input.text.slice(0, 20_000),
        html: (input.html ?? reminderEmailHtml(input.text)).slice(0, 100_000),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (!res.ok || !data.id) {
      const reason = `Resend ${res.status}: ${data.message ?? data.name ?? "unknown"}`.slice(0, 300);
      return { ok: false, reason };
    }
    return { ok: true, id: data.id };
  } catch (error) {
    return { ok: false, reason: String(error).slice(0, 300) };
  }
}
