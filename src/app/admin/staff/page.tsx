import { ApiForm } from "@/components/admin/api-form";
import { ROLE_LABELS, STAFF_ROLES } from "@/lib/access";
import { staffList } from "@/lib/admin";
import { requireStaff } from "@/lib/page-guards";

export default async function StaffPage() {
  await requireStaff("manageStaff");
  const staff = await staffList();

  return (
    <section>
      <div className="eyebrow">ADMIN</div>
      <h1 className="page-title mb-6">Nhân sự & phân quyền.</h1>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
        <article className="card overflow-x-auto !p-0">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Email</th>
                <th>Vai trò</th>
                <th>Học viên phụ trách</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td className="font-semibold">{s.name}</td>
                  <td className="text-muted">{s.email}</td>
                  <td>
                    <span className="badge">{ROLE_LABELS[s.role]}</span>
                  </td>
                  <td>{s._count.learners}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
        <article className="card">
          <h3 className="mb-1 text-lg font-bold">Thêm / cập nhật nhân sự</h3>
          <p className="mb-4 text-xs text-muted">
            Chuyên viên: kích hoạt & chăm sóc học viên. Học thuật: ngân hàng bài, audio. Admin: toàn quyền.
          </p>
          <ApiForm endpoint="/api/admin/staff" submitLabel="Lưu tài khoản" resetOnSuccess>
            <div className="field">
              <label htmlFor="name">Họ tên</label>
              <input id="name" name="name" required maxLength={80} />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required />
            </div>
            <div className="field">
              <label htmlFor="password">Mật khẩu (≥ 8 ký tự)</label>
              <input id="password" name="password" type="password" required minLength={8} />
            </div>
            <div className="field">
              <label htmlFor="role">Vai trò</label>
              <select id="role" name="role" defaultValue="CONSULTANT">
                {STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
          </ApiForm>
        </article>
      </div>
    </section>
  );
}
