import "dotenv/config";
import { prisma } from "../src/server/db";

async function main() {
  const exercises = await prisma.shadowingExercise.findMany({
    orderBy: { order: "asc" },
  });
  for (const ex of exercises) {
    console.log(`\n========================================`);
    console.log(`Order: ${ex.order} | Slug: ${ex.slug}`);
    console.log(`Title: ${ex.title}`);
    console.log(`youtubeId: ${ex.youtubeId}`);
    console.log(`captionSource: ${ex.captionSource}`);
    console.log(`cues is null? ${ex.cues === null}`);
    const cues = ex.cues as { version?: unknown; lines?: unknown[] } | null;
    console.log(`cues version: ${cues?.version}, lines: ${cues?.lines?.length}`);
    const annotations = ex.annotations as { lines?: unknown[] } | null;
    console.log(`annotations lines: ${annotations?.lines?.length}`);
  }
}

main().finally(() => prisma.$disconnect());

