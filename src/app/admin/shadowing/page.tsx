import Link from "next/link";
import { ApiForm } from "@/components/admin/api-form";
import { transcriptLines } from "@/domain/shadowing/transcript";
import { STATUS_LABELS } from "@/domain/shadowing/types";
import type { ShadowingStatus } from "@/generated/prisma/client";
import { formatVnDate, vnDate } from "@/lib/time";
import { prisma } from "@/server/db";
import { requireStaff } from "@/server/http/page-guards";

const STATUS_BADGE: Record<ShadowingStatus, string> = { DRAFT: "badge-gold", PUBLISHED: "badge-success", ARCHIVED: "" };

function duration(sec: number | null) {
  return sec ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : "–";
}

export default async function ShadowingAdminPage() {
  await requireStaff("manageLessons");
  const rows = await prisma.shadowingExercise.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      level: true,
      status: true,
      order: true,
      youtubeId: true,
      durationSec: true,
      transcript: true,
      captionSource: true,
      updatedAt: true,
      _count: { select: { attempts: true } },
    },
  });

  return (
    <section>
      <div className="eyebrow">HỌC THUẬT</div>
      <h1 className="page-title mb-2">Bài luyện Shadowing.</h1>
      <p className="mb-6 max-w-[900px] text-muted">
        Mỗi bài là một video YouTube được nhúng bằng iframe (không tải video về). Khi thêm bài, hệ thống lấy phụ đề tiếng Anh của video
        để tạo transcript, mốc thời gian từng câu/từ và IPA. Bài ở trạng thái <b>Nháp</b> cho tới khi bạn chuyển sang <b>Đang hiện</b>.
      </p>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <article className="card overflow-x-auto !p-0">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Bài</th>
                <th>Trình độ</th>
                <th>Câu</th>
                <th>Lượt nộp</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="text-muted">{r.order}</td>
                  <td>
                    <Link href={`/admin/shadowing/${r.id}`} className="font-semibold text-navy hover:underline">
                      {r.title}
                    </Link>
                    <small className="block text-muted">
                      {duration(r.durationSec)} · {r.captionSource ?? "chưa có phụ đề"} · sửa {formatVnDate(vnDate(r.updatedAt))}
                    </small>
                  </td>
                  <td>{r.level ?? "–"}</td>
                  <td>{transcriptLines(r.transcript).length}</td>
                  <td>{r._count.attempts}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[r.status]}`}>{STATUS_LABELS[r.status]}</span>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted">
                    Chưa có bài shadowing nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </article>
        <article className="card">
          <h3 className="mb-1 text-lg font-bold">Thêm bài từ YouTube</h3>
          <p className="mb-4 text-xs text-muted">
            Video cần có phụ đề tiếng Anh (phụ đề tự động cũng được). Nếu YouTube chặn máy chủ, dán nội dung file phụ đề .srt/.vtt vào ô cuối.
          </p>
          <ApiForm endpoint="/api/admin/shadowing" extra={{ action: "create" }} submitLabel="Tạo bài" successText="Đã tạo bài.">
            <div className="field">
              <label htmlFor="youtube">Link YouTube</label>
              <input id="youtube" name="youtube" required placeholder="https://www.youtube.com/watch?v=..." />
            </div>
            <div className="field">
              <label htmlFor="title">Tiêu đề (bỏ trống = lấy tên video)</label>
              <input id="title" name="title" maxLength={200} />
            </div>
            <div className="field">
              <label htmlFor="level">Trình độ</label>
              <input id="level" name="level" maxLength={20} placeholder="VD: B1" />
            </div>
            <div className="field">
              <label htmlFor="subtitles">Phụ đề SRT/VTT (không bắt buộc)</label>
              <textarea id="subtitles" name="subtitles" rows={4} placeholder={"1\n00:00:01,000 --> 00:00:03,000\nHello there."} />
            </div>
          </ApiForm>
        </article>
      </div>
    </section>
  );
}
