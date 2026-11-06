/**
 * Moves audio clips stored in the database to Cloudflare R2 (frees Neon storage).
 *
 *   npm run audio:to-r2
 */
import "dotenv/config";
import { prisma } from "../src/server/db";
import { putObject, r2Enabled } from "../src/server/integrations/r2";

async function main() {
  if (!r2Enabled()) throw new Error("Cần đủ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL.");
  const rows = await prisma.audioClip.findMany({ where: { data: { not: null } }, select: { key: true } });
  console.log(`${rows.length} clip trong database cần chuyển sang R2.`);
  let moved = 0;
  for (const { key } of rows) {
    const clip = await prisma.audioClip.findUnique({ where: { key }, select: { data: true } });
    if (!clip?.data) continue;
    const r2Key = `daily-speaking/audio/${key}.mp3`;
    await putObject(r2Key, Buffer.from(clip.data), "audio/mpeg");
    await prisma.audioClip.update({ where: { key }, data: { r2Key, data: null } });
    if (++moved % 50 === 0) console.log(`${moved}/${rows.length}`);
  }
  console.log(`Xong: đã chuyển ${moved} clip.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
