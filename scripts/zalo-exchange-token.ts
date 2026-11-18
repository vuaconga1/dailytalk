/**
 * Exchange a Zalo OA authorization code for access + refresh tokens.
 *
 * Prerequisites: ZALO_APP_ID and ZALO_APP_SECRET in .env (or the environment).
 * After the OA grants the app, copy the authorization code and run:
 *
 *   npm run zalo:token -- --code <AUTHORIZATION_CODE>
 *
 * Paste the printed refresh_token into ZALO_REFRESH_TOKEN (local + Vercel).
 * The first live send will seed ZaloToken in the DB; Zalo rotates refresh tokens afterward.
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });

const OAUTH_URL = "https://oauth.zaloapp.com/v4/oa/access_token";

function flag(name: string): string | undefined {
  const args = process.argv.slice(2);
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main() {
  const appId = (process.env.ZALO_APP_ID ?? "").trim();
  const secret = (process.env.ZALO_APP_SECRET ?? "").trim();
  const code = (flag("code") ?? "").trim();
  if (!appId || !secret) {
    throw new Error("Cần ZALO_APP_ID và ZALO_APP_SECRET trong .env hoặc môi trường.");
  }
  if (!code) {
    throw new Error("Cần --code <AUTHORIZATION_CODE> từ bước OA cấp quyền cho App.");
  }

  const res = await fetch(OAUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      secret_key: secret,
    },
    body: new URLSearchParams({
      code,
      app_id: appId,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: string | number;
    error?: number;
    error_description?: string;
  };

  if (!res.ok || !data.access_token || !data.refresh_token) {
    throw new Error(
      `Đổi code thất bại: ${data.error ?? res.status} ${data.error_description ?? JSON.stringify(data)}`.trim(),
    );
  }

  console.log("OK — dán refresh_token vào ZALO_REFRESH_TOKEN (local + Vercel):");
  console.log(`ZALO_REFRESH_TOKEN=${data.refresh_token}`);
  console.log(`expires_in=${data.expires_in ?? "?"}s (access_token không cần lưu vào env)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
