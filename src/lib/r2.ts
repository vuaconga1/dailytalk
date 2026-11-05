import "server-only";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const env = (name: string) => process.env[name]?.trim() || "";

function config() {
  const accountId = env("R2_ACCOUNT_ID");
  const accessKeyId = env("R2_ACCESS_KEY_ID");
  const secretAccessKey = env("R2_SECRET_ACCESS_KEY");
  const bucket = env("R2_BUCKET");
  const publicBase = env("R2_PUBLIC_BASE_URL").replace(/\/+$/, "");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBase) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket, publicBase };
}

export function r2Enabled(): boolean {
  return config() !== null;
}

let client: S3Client | null = null;

/** Uploads an immutable object; returns false when R2 is not configured. */
export async function putObject(key: string, body: Buffer, contentType: string): Promise<boolean> {
  const c = config();
  if (!c) return false;
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${c.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
  });
  await client.send(
    new PutObjectCommand({
      Bucket: c.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: body.length,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return true;
}

export function publicUrl(key: string): string | null {
  const c = config();
  return c ? `${c.publicBase}/${key}` : null;
}
