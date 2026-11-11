import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiForm } from "@/components/admin/api-form";
import { transcriptLines } from "@/domain/shadowing/transcript";
import { STATUS_LABELS } from "@/domain/shadowing/types";
import { formatVnDateTime } from "@/lib/time";
import { prisma } from "@/server/db";
import { requireStaff } from "@/server/http/page-guards";
import { toPublicExercise } from "@/server/shadowing/store";

function clock(sec: number) {
  return `${Math.floor(sec / 60)}:${(sec % 60).toFixed(1).padStart(4, "0")}`;
}

export default async function ShadowingEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("manageLessons");
  const { id } = await params;
  const row = await prisma.shadowingExercise.findUnique({ where: { id } });
  if (!row) notFound();
  const exercise = toPublicExercise(row);
  const lines = transcriptLines(row.transcript);
  const attempts = await prisma.shadowingAttempt.findMany({
    where: { exerciseId: row.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      score: true,
      correctCount: true,
      totalWords: true,
      recognizedText: true,
      recordingKey: true,
      recordingExpiresAt: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });
  const now = new Date();

  return (
    <section>
      <Link href="/admin/shadowing" className="text-sm text-teal hover:underline">
        ← Danh sách bài shadowing
      </Link>
      <h1 className="page-title mt-2 mb-1">{row.title}</h1>
      <p className="mb-6 text-sm text-muted">
        <a href={`https://www.youtube.com/watch?v=${row.youtubeId}`} target="_blank" rel="noreferrer" className="text-teal hover:underline">
          youtube.com/watch?v={row.youtubeId}
        </a>{" "}
        · {STATUS_LABELS[row.status]} · trang học viên: <code>/shadowing/{row.slug}</code> · phụ đề: {row.captionSource ?? "chưa có"}
      </p>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,1fr)]">
        <article className="card">
          <h3 className="mb-4 text-lg font-bold">Nội dung bài</h3>
          <ApiForm endpoint="/api/admin/shadowing" extra={{ action: "update", id: row.id }} submitLabel="Lưu thay đổi">
            <div className="grid gap-x-4 sm:grid-cols-2">
              <div className="field">
                <label htmlFor="title">Tiêu đề</label>
                <input id="title" name="title" required maxLength={200} defaultValue={row.title} />
              </div>
              <div className="field">
                <label htmlFor="slug">Đường dẫn (slug)</label>
                <input id="slug" name="slug" maxLength={64} defaultValue={row.slug} />
              </div>
              <div className="field">
                <label htmlFor="level">Trình độ</label>
                <input id="level" name="level" maxLength={20} defaultValue={row.level ?? ""} placeholder="VD: B1" />
              </div>
              <div className="field">
                <label htmlFor="status">Trạng thái</label>
                <select id="status" name="status" defaultValue={row.status}>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="order">Thứ tự trong danh sách</label>
                <input id="order" name="order" type="number" defaultValue={row.order} />
              </div>
              <div className="field">
                <label htmlFor="maxRecordSeconds">Giới hạn ghi âm “Đọc cả bài” (giây, 5–300)</label>
                <input id="maxRecordSeconds" name="maxRecordSeconds" type="number" min={5} max={300} defaultValue={row.maxRecordSeconds} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="instructions">Hướng dẫn cho học viên (không bắt buộc)</label>
              <textarea id="instructions" name="instructions" maxLength={2000} defaultValue={row.instructions ?? ""} />
            </div>
            <div className="field">
              <label htmlFor="transcript">Transcript — mỗi câu một dòng ({lines.length} câu)</label>
              <textarea id="transcript" name="transcript" rows={18} required defaultValue={row.transcript} className="font-mono !text-[13px]" />
              <small className="text-muted">
                Sửa chính tả, dấu câu hoặc gộp/tách câu thoải mái: mốc thời gian được căn lại theo phụ đề YouTube và IPA được tạo lại khi lưu.
                Có thể thêm nhãn người nói ở đầu dòng, VD <code>Joey: ...</code>.
              </small>
            </div>
          </ApiForm>
        </article>

        <div className="grid content-start gap-6">
          <article className="card !p-0 overflow-hidden">
            <div className="aspect-video w-full bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${row.youtubeId}?rel=0`}
                title={row.title}
                className="size-full"
                allow="encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          </article>
          <article className="card">
            <h3 className="mb-1 text-lg font-bold">Lấy lại phụ đề</h3>
            <p className="mb-4 text-xs text-muted">Dùng khi video vừa có phụ đề tốt hơn, hoặc dán file .srt/.vtt bạn tự chuẩn bị.</p>
            <ApiForm endpoint="/api/admin/shadowing" extra={{ action: "refetch", id: row.id }} submitLabel="Lấy lại phụ đề" successText="Đã cập nhật phụ đề.">
              <div className="field">
                <label htmlFor="subtitles">Phụ đề SRT/VTT (bỏ trống = lấy từ YouTube)</label>
                <textarea id="subtitles" name="subtitles" rows={3} />
              </div>
              <label className="check mb-4">
                <input type="checkbox" name="overwrite" />
                Ghi đè transcript hiện tại bằng phụ đề mới
              </label>
            </ApiForm>
          </article>
          <article className="card">
            <h3 className="mb-1 text-lg font-bold">Xóa bài</h3>
            <p className="mb-4 text-xs text-muted">Xóa luôn lịch sử làm bài và bản ghi âm của học viên cho bài này.</p>
            <ApiForm
              endpoint="/api/admin/shadowing"
              extra={{ action: "delete", id: row.id }}
              submitLabel="Xóa bài"
              confirm={`Xóa bài "${row.title}" và toàn bộ lượt làm bài?`}
              buttonClassName="btn btn-outline !border-danger/50 !text-danger"
            />
          </article>
        </div>
      </div>

      <article className="card mt-6 overflow-x-auto !p-0">
        <div className="px-6 pt-5 pb-3">
          <h3 className="text-lg font-bold">Mốc thời gian & IPA</h3>
          <p className="text-xs text-muted">
            {exercise.cues
              ? "Căn theo phụ đề YouTube."
              : "Chưa căn được theo phụ đề — trang học viên sẽ ước lượng theo độ dài câu (có thể lệch vài giây)."}
          </p>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Thời gian</th>
              <th>Câu / IPA</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i}>
                <td className="text-muted">{i + 1}</td>
                <td className="whitespace-nowrap font-mono text-xs">
                  {exercise.cues ? `${clock(exercise.cues[i].start)} – ${clock(exercise.cues[i].end)}` : "–"}
                </td>
                <td>
                  {line.speaker && <b>{line.speaker}: </b>}
                  {line.text}
                  {exercise.annotations?.[i]?.ipa && <small className="block font-mono text-muted">{exercise.annotations[i].ipa}</small>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <article className="card mt-6 overflow-x-auto !p-0">
        <div className="px-6 pt-5 pb-3">
          <h3 className="text-lg font-bold">100 lượt nộp gần nhất</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Học viên</th>
              <th>Thời điểm</th>
              <th>Điểm</th>
              <th>Hệ thống nghe được</th>
              <th>Bản ghi</th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((a) => {
              const live = a.recordingKey && a.recordingExpiresAt && a.recordingExpiresAt > now;
              return (
                <tr key={a.id}>
                  <td>
                    <b>{a.user.name}</b>
                    <small className="block text-muted">{a.user.email}</small>
                  </td>
                  <td className="whitespace-nowrap text-muted">{formatVnDateTime(a.createdAt)}</td>
                  <td className="whitespace-nowrap">
                    <b>{a.score}</b>/100
                    <small className="block text-muted">
                      {a.correctCount}/{a.totalWords} từ
                    </small>
                  </td>
                  <td className="max-w-[420px] text-xs">{a.recognizedText}</td>
                  <td>
                    {live ? (
                      <audio controls preload="none" src={`/api/shadowing/recording?id=${a.id}`} className="h-9 w-[220px]" />
                    ) : (
                      <span className="text-xs text-muted">Đã hết hạn</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!attempts.length && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted">
                  Chưa có học viên nộp bài này.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </article>
    </section>
  );
}
