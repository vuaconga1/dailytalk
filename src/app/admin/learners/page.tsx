import Link from "next/link";
import { BulkAccounts } from "@/components/admin/bulk-accounts";
import { can, daysLeft, EXPIRING_SOON_DAYS, PAYMENT_ENABLED } from "@/domain/access";
import {
  isLearnerFilter,
  isLearnerSort,
  LEARNER_FILTERS,
  LEARNER_SORTS,
  listLearners,
  staffList,
  type LearnerRow,
} from "@/server/admin";
import { isCurrentProfile, profileLabels } from "@/domain/profile";
import { levelInfo } from "@/domain/profile-options";
import { requireStaff } from "@/server/http/page-guards";
import { formatVnDate, vnDate } from "@/lib/time";

const STATUS_LABELS = { LEAD: PAYMENT_ENABLED ? "Học thử / chờ thanh toán" : "Chờ kích hoạt", ACTIVE: "Đang học", PAUSED: "Tạm dừng", EXPIRED: "Hết hạn" } as const;

const INPUT = "rounded-lg border border-[#cfdae1] bg-white px-3 py-2 text-sm outline-none focus:border-teal";

type Props = { searchParams: Promise<{ filter?: string; q?: string; c?: string; sort?: string }> };

function TermCell({ learner }: { learner: LearnerRow }) {
  if (learner.status === "LEAD") return <span className="text-muted">Chưa kích hoạt</span>;
  const left = daysLeft(learner.accessEndsAt);
  return (
    <>
      {learner.packageName && <span className="block">{learner.packageName}</span>}
      {learner.accessEndsAt ? (
        <small className="block text-muted">
          đến {formatVnDate(vnDate(learner.accessEndsAt))} ·{" "}
          {left ? (
            <b className={left <= EXPIRING_SOON_DAYS ? "text-gold" : ""}>còn {left} ngày</b>
          ) : (
            <b className="text-danger">đã hết hạn</b>
          )}
        </small>
      ) : (
        <small className="block text-muted">Không thời hạn</small>
      )}
    </>
  );
}

export default async function LearnersPage({ searchParams }: Props) {
  const staff = await requireStaff();
  const params = await searchParams;
  const filter = isLearnerFilter(params.filter) ? params.filter : "all";
  const sort = isLearnerSort(params.sort) ? params.sort : "newest";
  const q = params.q ?? "";
  const consultantId = params.c ?? "";
  const [learners, staffMembers] = await Promise.all([listLearners(filter, q, consultantId, sort), staffList()]);
  const consultants = staffMembers.filter((s) => s.role === "CONSULTANT" || s.role === "ADMIN");

  const hrefFor = (key: string) => {
    const query = new URLSearchParams({ filter: key });
    if (q) query.set("q", q);
    if (consultantId) query.set("c", consultantId);
    if (sort !== "newest") query.set("sort", sort);
    return `/admin/learners?${query}`;
  };

  return (
    <section>
      <div className="eyebrow">HỌC VIÊN</div>
      <h1 className="page-title mb-6">Danh sách học viên.</h1>

      {can(staff.role, "createAccounts") && (
        <details className="card mb-6">
          <summary className="cursor-pointer text-lg font-bold">+ Tạo tài khoản học viên</summary>
          <BulkAccounts />
        </details>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {Object.entries(LEARNER_FILTERS).map(([key, label]) => (
          <Link key={key} href={hrefFor(key)} className={`badge ${filter === key ? "!bg-teal !text-white" : ""}`}>
            {label}
          </Link>
        ))}
      </div>
      <form className="mb-4 flex flex-wrap items-center gap-2" action="/admin/learners">
        <input type="hidden" name="filter" value={filter} />
        <input name="q" defaultValue={q} placeholder="Tên, email, SĐT" className={INPUT} />
        <select name="c" defaultValue={consultantId} className={INPUT} aria-label="Chuyên viên">
          <option value="">Mọi chuyên viên</option>
          <option value="none">Chưa giao chuyên viên</option>
          {consultants.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="sort" defaultValue={sort} className={INPUT} aria-label="Sắp xếp">
          {Object.entries(LEARNER_SORTS).map(([key, label]) => (
            <option key={key} value={key}>
              Sắp xếp: {label}
            </option>
          ))}
        </select>
        <button className="btn btn-secondary !py-2">Lọc</button>
        {(q || consultantId || sort !== "newest") && (
          <Link href={`/admin/learners?filter=${filter}`} className="text-sm text-teal">
            Xóa bộ lọc
          </Link>
        )}
        <span className="ml-auto text-sm text-muted">
          {learners.length >= 300 ? "300+ tài khoản (hiển thị 300 đầu)" : `${learners.length} tài khoản`}
        </span>
      </form>

      <article className="card overflow-x-auto !p-0">
        <table className="data-table">
          <thead>
            <tr>
              <th>Học viên</th>
              <th>Trạng thái</th>
              <th>Thời hạn</th>
              <th>Vị trí / trình độ</th>
              <th>Tiến độ</th>
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
                  <small className="block text-muted">tạo {formatVnDate(vnDate(l.createdAt))}</small>
                </td>
                <td>
                  <span className={`badge ${l.status === "ACTIVE" ? "" : "badge-gold"}`}>{STATUS_LABELS[l.status]}</span>
                </td>
                <td>
                  <TermCell learner={l} />
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
