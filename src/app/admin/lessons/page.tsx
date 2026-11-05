import { ApiForm } from "@/components/admin/api-form";
import { isDemo } from "@/lib/ai";
import { normalizeLesson } from "@/lib/content";
import { lessonAudio } from "@/lib/learning";
import { requireStaff } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";
import { levelInfo, LEVEL_IDS, type LevelId } from "@/lib/profile-options";
import { r2Enabled } from "@/lib/r2";
import { formatVnDate, vnDate } from "@/lib/time";

export default async function LessonsPage() {
  await requireStaff("manageLessons");
  const rows = await prisma.lessonContent.findMany({ orderBy: [{ uses: "desc" }, { lastUsed: "desc" }], take: 200 });
  const lessons = rows.map((r) => ({ row: r, lesson: normalizeLesson(r.lesson) }));
  const keys = lessons.map(({ lesson }) => [lessonAudio(lesson, "all").key, ...lesson.dialogue.map((_, i) => lessonAudio(lesson, i).key)]);
  const stored = await prisma.audioClip.findMany({ where: { key: { in: keys.flat() } }, select: { key: true, r2Key: true } });
  const byKey = new Map(stored.map((c) => [c.key, c]));

  return (
    <section>
      <div className="eyebrow">HỌC THUẬT</div>
      <h1 className="page-title mb-2">Ngân hàng bài dùng chung.</h1>
      <p className="mb-6 max-w-[900px] text-muted">
        Bài học lấy từ giáo trình soạn sẵn của 14 nhóm nghề (<code>src/lib/curriculum</code>), được lưu vào đây khi học viên đầu tiên học
        tới và dùng lại cho học viên có cùng nội dung. Khi bật AI, bài được viết lại cho trình độ khác Sơ cấp và cũng lưu tại đây. Audio
        shadowing lưu ở <b>{r2Enabled() ? "Cloudflare R2" : "database (chưa cấu hình R2)"}</b>.
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
            {lessons.map(({ row, lesson }, i) => {
              const clips = keys[i].map((k) => byKey.get(k));
              const ready = clips.filter(Boolean).length;
              return (
                <tr key={row.key}>
                  <td>
                    <b>{lesson.title}</b>
                    <small className="block text-muted">{lesson.situation}</small>
                    <details className="mt-1 text-xs">
                      <summary className="cursor-pointer text-teal">Xem nội dung</summary>
                      <p className="mt-2">
                        <b>Từ vựng:</b>{" "}
                        {lesson.vocabulary
                          .map((v) => `${v.word}${v.ipa ? ` /${v.ipa}/` : ""}${v.pos ? ` ${v.pos}.` : ""} (${v.meaning})`)
                          .join(", ")}
                      </p>
                      <p>
                        <b>Mẫu câu:</b>{" "}
                        {lesson.frames
                          .map((f, j) => `${f}${lesson.frameNotes?.[j] ? ` (${lesson.frameNotes[j].meaning})` : ""}`)
                          .join(" · ")}
                      </p>
                      <ol className="list-decimal pl-5">
                        {lesson.dialogue.map((d, j) => (
                          <li key={j}>{d}</li>
                        ))}
                      </ol>
                      <p>
                        <b>Role-play:</b> {lesson.roleplay.role} – {lesson.roleplay.goal}
                      </p>
                    </details>
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
                    <span className={`badge ${ready === clips.length ? "" : "badge-gold"}`}>
                      {ready}/{clips.length}
                    </span>
                  </td>
                  <td>
                    {!isDemo && ready < clips.length && (
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
            {!lessons.length && (
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
