import Link from "next/link";
import { ApiForm } from "@/components/admin/api-form";
import { ADMIN_MIN_PASSWORD, can, DEFAULT_PACKAGE_DAYS } from "@/domain/access";
import { isLearnerFilter, LEARNER_FILTERS, listLearners } from "@/server/admin";
import { isCurrentProfile, profileLabels } from "@/domain/profile";
import { levelInfo } from "@/domain/profile-options";
import { requireStaff } from "@/server/http/page-guards";
import { formatVnDate, vnDate } from "@/lib/time";

const STATUS_LABELS = { LEAD: "Chờ kích hoạt", ACTIVE: "Đang học", PAUSED: "Tạm dừng", EXPIRED: "Hết hạn" } as const;

type Props = { searchParams: Promise<{ filter?: string; q?: string }> };

export default async function LearnersPage({ searchParams }: Props) {
  const staff = await requireStaff();
  const params = await searchParams;
  const filter = isLearnerFilter(params.filter) ? params.filter : "all";
  const q = params.q ?? "";
  const learners = await listLearners(filter, q);

  return (
    <section>
      <div className="eyebrow">HỌC VIÊN</div>
      <h1 className="page-title mb-6">Danh sách học viên.</h1>

      {can(staff.role, "createAccounts") && (
        <details className="card mb-6">
          <summary className="cursor-pointer text-lg font-bold">+ Tạo tài khoản học viên</summary>
          <ApiForm
            endpoint="/api/admin/learners"
            submitLabel="Tạo tài khoản"
            successText="Đã tạo tài khoản."
            resetOnSuccess
            className="mt-4 grid gap-x-4 sm:grid-cols-2"
          >
            <div className="field">
              <label htmlFor="new-name">Họ tên</label>
              <input id="new-name" name="name" required maxLength={80} />
            </div>
            <div className="field">
              <label htmlFor="new-email">Email</label>
              <input id="new-email" name="email" type="email" required />
            </div>
            <div className="field">
              <label htmlFor="new-password">Mật khẩu (≥ {ADMIN_MIN_PASSWORD} ký tự)</label>
              <input id="new-password" name="password" type="text" required minLength={ADMIN_MIN_PASSWORD} autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor="new-phone">Số điện thoại (không bắt buộc)</label>
              <input id="new-phone" name="phone" maxLength={30} />
            </div>
            <div className="field">
              <label htmlFor="new-days">Số ngày gói</label>
              <input id="new-days" name="days" type="number" min={1} max={366} defaultValue={DEFAULT_PACKAGE_DAYS} required />
            </div>
            <label className="mb-4 flex items-center gap-2 self-end text-sm">
              <input type="checkbox" name="activate" defaultChecked />
              Kích hoạt gói ngay
            </label>
          </ApiForm>
        </details>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {Object.entries(LEARNER_FILTERS).map(([key, label]) => (
          <Link
            key={key}
            href={`/admin/learners?filter=${key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`badge ${filter === key ? "!bg-teal !text-white" : ""}`}
          >
            {label}
          </Link>
        ))}
        <form className="ml-auto flex gap-2" action="/admin/learners">
          <input type="hidden" name="filter" value={filter} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Tên, email, SĐT"
            className="rounded-lg border border-[#cfdae1] bg-white px-3 py-2 text-sm outline-none focus:border-teal"
          />
          <button className="btn btn-secondary !py-2">Tìm</button>
        </form>
      </div>

      <article className="card overflow-x-auto !p-0">
        <table className="data-table">
          <thead>
            <tr>
              <th>Học viên</th>
              <th>Trạng thái</th>
              <th>Vị trí / trình độ</th>
              <th>Tiến độ</th>
              <th>Chuyên viên</th>
              <th>Lưu ý</th>
            </tr>
          </thead>
          <tbody>
            {learners.map((l) => (
              <tr key={l.id}>
                <td>
                  <Link href={`/admin/learners/${l.id}`} className="font-semibold text-teal">
                    {l.name}
                  </Link>
                  <small className="block text-muted">{l.email}</small>
                  {l.phone && <small className="block text-muted">{l.phone}</small>}
                </td>
                <td>
                  <span className={`badge ${l.status === "ACTIVE" ? "" : "badge-gold"}`}>{STATUS_LABELS[l.status]}</span>
                  {l.accessEndsAt && <small className="mt-1 block text-muted">đến {formatVnDate(vnDate(l.accessEndsAt))}</small>}
                </td>
                <td className="text-muted">
                  {isCurrentProfile(l.profile) ? (
                    <>
                      {profileLabels(l.profile).position}
                      <small className="block">
                        {profileLabels(l.profile).industry} · {levelInfo(l.profile.working_level).label}
                      </small>
                    </>
                  ) : (
                    "Chưa thiết lập hồ sơ"
                  )}
                </td>
                <td>
                  {l.sessionsDone}/30
                  {l.lastStudied && <small className="block text-muted">gần nhất {formatVnDate(l.lastStudied)}</small>}
                </td>
                <td className="text-muted">{l.consultant?.name ?? "—"}</td>
                <td className="text-muted">
                  {[...l.supportReasons, ...(l.zaloWarning ? [l.zaloWarning] : [])].join(" · ") || "—"}
                </td>
              </tr>
            ))}
            {!learners.length && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted">
                  Không có học viên phù hợp.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </article>
    </section>
  );
}
