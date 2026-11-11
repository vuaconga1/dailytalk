import type { ShadowingStatus } from "@/generated/prisma/client";
import { transcriptLines } from "@/domain/shadowing/transcript";
import { RECORD_SECONDS } from "@/domain/shadowing/types";
import { Problem } from "@/lib/errors";
import { prisma } from "@/server/db";
import { json, readJson, staffRoute } from "@/server/http/api";
import { captionWordsOf, deleteExercise, deriveContent, slugify, uniqueSlug } from "@/server/shadowing/store";
import { captionTranscript, fetchYoutubeVideo, parseYoutubeId, subtitleWords, type YoutubeVideo } from "@/server/shadowing/youtube";

export const maxDuration = 60;

const STATUSES: ShadowingStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];
const MAX_TRANSCRIPT = 100_000;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function clampSeconds(value: number): number {
  return Math.min(RECORD_SECONDS.max, Math.max(RECORD_SECONDS.min, Math.round(value)));
}

/** Pasted SRT/VTT wins; otherwise the caption track is fetched from YouTube. */
async function loadCaptions(youtubeId: string, subtitles: string): Promise<YoutubeVideo | (Omit<YoutubeVideo, "title"> & { title: null })> {
  if (!subtitles) return fetchYoutubeVideo(youtubeId);
  const words = subtitleWords(subtitles);
  if (!words.length) throw new Problem("Không đọc được phụ đề. Hãy dán nội dung file .srt hoặc .vtt.");
  return { title: null, durationSec: Math.ceil(words[words.length - 1].e), words, source: "file" };
}

async function findExercise(id: unknown) {
  const row = await prisma.shadowingExercise.findUnique({ where: { id: str(id) } });
  if (!row) throw new Problem("Không tìm thấy bài.", 404);
  return row;
}

/** Shadowing bank: create from a YouTube link, edit, re-fetch captions, delete. */
export const POST = staffRoute("manageLessons", async (req) => {
  const body = await readJson(req);
  const action = str(body.action);

  if (action === "create") {
    const youtubeId = parseYoutubeId(str(body.youtube));
    if (!youtubeId) throw new Problem("Link YouTube không hợp lệ.");
    const video = await loadCaptions(youtubeId, str(body.subtitles));
    const title = (str(body.title) || video.title || youtubeId).slice(0, 200);
    const transcript = captionTranscript(video.words);
    const last = await prisma.shadowingExercise.aggregate({ _max: { order: true } });
    const row = await prisma.shadowingExercise.create({
      data: {
        slug: await uniqueSlug(title),
        title,
        level: str(body.level).slice(0, 20) || null,
        youtubeId,
        durationSec: video.durationSec,
        transcript,
        captionWords: video.words,
        captionSource: video.source,
        maxRecordSeconds: clampSeconds(video.durationSec ? video.durationSec * 1.3 + 10 : RECORD_SECONDS.default),
        order: (last._max.order ?? 0) + 1,
        ...deriveContent(transcript, video.words, youtubeId),
      },
    });
    return json({ ok: true, id: row.id, redirect: `/admin/shadowing/${row.id}` });
  }

  if (action === "update") {
    const row = await findExercise(body.id);
    const title = str(body.title).slice(0, 200);
    if (!title) throw new Problem("Cần nhập tiêu đề.");
    const transcript = str(body.transcript).replace(/\r\n/g, "\n");
    if (!transcriptLines(transcript).length) throw new Problem("Transcript đang trống.");
    if (transcript.length > MAX_TRANSCRIPT) throw new Problem("Transcript quá dài.");
    const status = str(body.status) as ShadowingStatus;
    if (!STATUSES.includes(status)) throw new Problem("Trạng thái không hợp lệ.");
    const slugInput = str(body.slug);
    const slug = slugInput && slugInput !== row.slug ? await uniqueSlug(slugify(slugInput), row.id) : row.slug;
    const order = Number(body.order);
    const seconds = Number(body.maxRecordSeconds);
    await prisma.shadowingExercise.update({
      where: { id: row.id },
      data: {
        title,
        slug,
        level: str(body.level).slice(0, 20) || null,
        instructions: str(body.instructions).slice(0, 2000) || null,
        status,
        order: Number.isFinite(order) ? Math.round(order) : row.order,
        maxRecordSeconds: Number.isFinite(seconds) ? clampSeconds(seconds) : row.maxRecordSeconds,
        transcript,
        ...deriveContent(transcript, captionWordsOf(row.captionWords), row.youtubeId),
      },
    });
    return json({ ok: true });
  }

  if (action === "refetch") {
    const row = await findExercise(body.id);
    const video = await loadCaptions(row.youtubeId, str(body.subtitles));
    const transcript = body.overwrite === "on" ? captionTranscript(video.words) : row.transcript;
    await prisma.shadowingExercise.update({
      where: { id: row.id },
      data: {
        captionWords: video.words,
        captionSource: video.source,
        durationSec: video.durationSec ?? row.durationSec,
        transcript,
        ...deriveContent(transcript, video.words, row.youtubeId),
      },
    });
    return json({ ok: true });
  }

  if (action === "delete") {
    const row = await findExercise(body.id);
    await deleteExercise(row.id);
    return json({ ok: true, redirect: "/admin/shadowing" });
  }

  throw new Problem("Thao tác không hợp lệ.");
});
