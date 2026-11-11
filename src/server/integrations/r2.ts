import "server-only";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const env = (name: string) => process.env[name]?.trim() || "";

function config() {
  const accountId = env("R2_ACCOUNT_ID");
  const accessKeyId = env("R2_ACCESS_KEY_ID");
  const secretAccessKey = env("R2_SECRET_ACCESS_KEY");
  const bucket = env("R2_BUCKET");
  const publicBase = env("R2_PUBLIC_BASE_URL").replace(/\/+$/, "");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBase) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket, publicBase, privateBucket: env("R2_PRIVATE_BUCKET") || bucket };
}

export function r2Enabled(): boolean {
  return config() !== null;
}

let client: S3Client | null = null;

function s3(c: NonNullable<ReturnType<typeof config>>): S3Client {
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${c.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
  });
  return client;
}

/** Uploads an immutable object; returns false when R2 is not configured. */
export async function putObject(key: string, body: Buffer, contentType: string): Promise<boolean> {
  const c = config();
  if (!c) return false;
  await s3(c).send(
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

/**
 * Personal data (voice recordings): stored in R2_PRIVATE_BUCKET, or under an unguessable key of the
 * main bucket, and only ever streamed through an access-checked API — never linked publicly.
 */
export async function putPrivateObject(key: string, body: Buffer, contentType: string): Promise<boolean> {
  const c = config();
  if (!c) return false;
  await s3(c).send(
    new PutObjectCommand({
      Bucket: c.privateBucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: body.length,
      CacheControl: "private, no-store",
    }),
  );
  return true;
}

export async function getPrivateObject(key: string): Promise<Uint8Array | null> {
  const c = config();
  if (!c) return null;
  try {
    const res = await s3(c).send(new GetObjectCommand({ Bucket: c.privateBucket, Key: key }));
    return res.Body ? await res.Body.transformToByteArray() : null;
  } catch (error) {
    if ((error as { name?: string }).name === "NoSuchKey") return null;
    throw error;
  }
}

export async function deletePrivateObject(key: string): Promise<void> {
  const c = config();
  if (!c) return;
  await s3(c).send(new DeleteObjectCommand({ Bucket: c.privateBucket, Key: key }));
}
