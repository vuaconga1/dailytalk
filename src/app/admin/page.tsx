import Link from "next/link";
import { ApiForm } from "@/components/admin/api-form";
import { can } from "@/lib/access";
import { dashboardCounts } from "@/lib/admin";
import { lastWeekStart, type WeeklyHighlights } from "@/lib/jobs";
import { requireStaff } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";
import { formatVnDate, shiftDays } from "@/lib/time";

export default async function AdminHome() {
  const user = await requireStaff();
  const weekStart = lastWeekStart();
  const [counts, reports] = await Promise.all([
    dashboardCounts(),
    prisma.weeklyReport.findMany({
      where: { weekStart },
      include: { user: { select: { id: true, name: true } } },
      orderBy: [{ needsSupport: "desc" }, { sessionsDone: "asc" }],
      take: 50,
    }),
  ]);

  return (
    <section>
      <div className="eyebrow">CHUYÊN VIÊN · HỌC THUẬT · ADMIN</div>
      <h1 className="page-title mb-6">Tổng quan học viên.</h1>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          [counts.leads, "Chờ kích hoạt", "/admin/learners?filter=lead"],
          [counts.active, "Đang học", "/admin/learners?filter=active"],
          [counts.support.length, "Cần hỗ trợ", "/admin/learners?filter=support"],
          [counts.paused, "Tạm dừng / hết hạn", "/admin/learners?filter=inactive"],
        ].map(([value, label, href]) => (
          <Link key={label} href={String(href)} className="stat no-underline">
            <strong className="block text-[25px] text-navy">{value}</strong>
            <span className="text-xs text-muted">{label}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="card">
          <h3 className="mb-3 text-lg font-bold">Học viên cần hỗ trợ ngay</h3>
          {counts.support.length ? (
            <table className="data-table">
              <tbody>
                {counts.support.slice(0, 15).map((l) => (
                  <tr key={l.id}>
                    <td>
                      <Link href={`/admin/learners/${l.id}`} className="font-semibold text-teal">
                        {l.name}
                      </Link>
                      <small className="block text-muted">{l.consultant?.name ?? "Chưa có chuyên viên"}</small>
                    </td>
                    <td className="text-muted">{l.supportReasons.join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-muted">Không có học viên nào cần hỗ trợ.</p>
          )}
        </article>

        <article className="card">
          <h3 className="mb-1 text-lg font-bold">Tổng kết tuần</h3>
          <p className="mb-3 text-xs text-muted">
            {formatVnDate(weekStart)} – {formatVnDate(shiftDays(weekStart, 6))}
          </p>
          {reports.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Học viên</th>
                  <th>Buổi</th>
                  <th>Đạt</th>
                  <th>Ghi nhận</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => {
                  const h = r.highlights as unknown as WeeklyHighlights;
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/admin/learners/${r.user.id}`} className="font-semibold text-teal">
                          {r.user.name}
                        </Link>
                      </td>
                      <td>{r.sessionsDone}/7</td>
                      <td>{r.achieved}</td>
                      <td className="text-muted">
                        {r.needsSupport && <span className="badge badge-gold mb-1">{r.supportNote}</span>}
                        {h.errors.length > 0 && <div>Lỗi: {h.errors.map(([e, n]) => `${e} (${n})`).join(", ")}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-muted">Chưa có báo cáo tuần trước. Báo cáo được tạo tự động bởi cron mỗi thứ Hai.</p>
          )}
        </article>
      </div>

      {can(user.role, "runJobs") && (
        <article className="card mt-6">
          <h3 className="mb-1 text-lg font-bold">Chạy tác vụ tự động</h3>
          <p className="mb-4 text-sm text-muted">
            Chuẩn bị bài trước giờ học, gửi nhắc Zalo và tạo tổng kết tuần. Bình thường cron gọi tự động mỗi 5–10 phút.
          </p>
          <ApiForm endpoint="/api/admin/jobs" submitLabel="Chạy ngay" successText="json" buttonClassName="btn btn-outline" />
        </article>
      )}
    </section>
  );
}
