import { ApiForm } from "@/components/admin/api-form";
import { LessonBankDetails } from "@/components/admin/lesson-bank-details";
import { canGenerateSpeech } from "@/server/ai/config";
import { normalizeLesson } from "@/domain/content";
import { lessonClips } from "@/server/learning/audio";
import { requireStaff } from "@/server/http/page-guards";
import { prisma } from "@/server/db";
import { levelInfo, LEVEL_IDS, type LevelId } from "@/domain/profile-options";
import { r2Enabled } from "@/server/integrations/r2";
import { formatVnDate, vnDate } from "@/lib/time";

export default async function LessonsPage() {
  await requireStaff("manageLessons");
  // Metadata columns for the table + lesson only to compute audio keys (lesson is not passed into RSC props).
  const rows = await prisma.lessonContent.findMany({
    orderBy: [{ uses: "desc" }, { lastUsed: "desc" }],
    take: 200,
    select: {
      key: true,
      title: true,
      industry: true,
      position: true,
      level: true,
      uses: true,
      lastUsed: true,
      lesson: true,
    },
  });

  const audio = rows.map((row) => {
    const clips = lessonClips(normalizeLesson(row.lesson));
    return { key: row.key, total: clips.length, clipKeys: clips.map((c) => c.key) };
  });
  const stored = await prisma.audioClip.findMany({
    where: { key: { in: audio.flatMap((a) => a.clipKeys) } },
    select: { key: true },
  });
  const have = new Set(stored.map((c) => c.key));
  const readyByKey = new Map(audio.map((a) => [a.key, a.clipKeys.filter((k) => have.has(k)).length] as const));
  const totalByKey = new Map(audio.map((a) => [a.key, a.total] as const));

  return (
    <section>
      <div className="eyebrow">HỌC THUẬT</div>
      <h1 className="page-title mb-2">Ngân hàng bài dùng chung.</h1>
      <p className="mb-6 max-w-[900px] text-muted">
        Bài học lấy từ giáo trình soạn sẵn của 14 nhóm nghề (<code>src/data/curriculum</code>), được lưu vào đây khi học viên đầu tiên học
        tới và dùng lại cho học viên có cùng nội dung. Khi bật AI, bài được viết lại cho trình độ khác Sơ cấp và cũng lưu tại đây. Audio
        shadowing và từ vựng (tạo bằng <code>npm run audio:gen</code> hoặc nút bên dưới) lưu ở <b>{r2Enabled() ? "Cloudflare R2" : "database (chưa cấu hình R2)"}</b>.
      </p>
      <article className="card overflow-x-auto !p-0">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tình huống</th>
              <th>Nhóm nghề / vị trí</th>
              <th>Trình độ</th>
              <th>Lượt dùng</th>
              <th>Audio</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const ready = readyByKey.get(row.key) ?? 0;
              const total = totalByKey.get(row.key) ?? 0;
              return (
                <tr key={row.key}>
                  <td>
                    <b>{row.title}</b>
                    <LessonBankDetails lessonKey={row.key} />
                  </td>
                  <td className="text-muted">
                    {row.industry}
                    <small className="block">{row.position}</small>
                  </td>
                  <td>{LEVEL_IDS.includes(row.level as LevelId) ? levelInfo(row.level as LevelId).label : row.level}</td>
                  <td>
                    {row.uses}
                    <small className="block text-muted">{formatVnDate(vnDate(row.lastUsed))}</small>
                  </td>
                  <td>
                    <span className={`badge ${ready === total ? "" : "badge-gold"}`}>
                      {ready}/{total}
                    </span>
                  </td>
                  <td>
                    {canGenerateSpeech && ready < total && (
                      <ApiForm
                        endpoint="/api/admin/audio"
                        extra={{ key: row.key }}
                        submitLabel="Tạo audio"
                        successText="Đã tạo."
                        buttonClassName="btn btn-outline !px-3 !py-2 text-xs"
                      />
                    )}
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted">
                  Ngân hàng chưa có bài nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </article>
    </section>
  );
}
