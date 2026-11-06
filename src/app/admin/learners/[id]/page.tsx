import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiForm } from "@/components/admin/api-form";
import { can, DEFAULT_PACKAGE_DAYS } from "@/domain/access";
import { learnerDetail, staffList } from "@/server/admin";
import type { WeeklyHighlights } from "@/server/jobs";
import { requireStaff } from "@/server/http/page-guards";
import { isCurrentProfile, profileLabels } from "@/domain/profile";
import { FREQUENCIES, labelOf, levelInfo } from "@/domain/profile-options";
import { formatVnDate, vnDate } from "@/lib/time";
import type { StudyPlan, Turn } from "@/domain/types";

const STATUS_LABELS = { LEAD: "Chờ kích hoạt", ACTIVE: "Đang học", PAUSED: "Tạm dừng", EXPIRED: "Hết hạn" } as const;
const GOAL_LABELS = { achieved: "Đạt", needs_review: "Cần ôn", insufficient_evidence: "Chưa đủ dữ liệu" } as const;
const SELECTED_BY = { plan: "Theo lộ trình", rule: "Quy tắc ôn tập", openai: "AI điều chỉnh" } as Record<string, string>;
const NOTIFY_LABELS = { PENDING: "Đang chờ", SENT: "Đã gửi", SKIPPED: "Bỏ qua", FAILED: "Lỗi" } as const;

function dateTime(d: Date) {
  return d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });
}

export default async function LearnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  const [learner, staffMembers] = await Promise.all([learnerDetail(id), staffList()]);
  if (!learner) notFound();
  const manage = can(staff.role, "manageLearners");
  const consultants = staffMembers.filter((s) => s.role === "CONSULTANT" || s.role === "ADMIN");
  const plan = learner.plan as StudyPlan | null;
  const profile = isCurrentProfile(learner.profile) ? learner.profile : null;
  const labels = profile ? profileLabels(profile) : null;

  return (
    <section>
      <Link href="/admin/learners" className="text-sm text-teal">
        ← Danh sách học viên
      </Link>
      <div className="mt-3 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">{learner.name}</h1>
          <p className="text-muted">
            {learner.email}
            {learner.phone ? ` · ${learner.phone}` : ""} · đăng ký {formatVnDate(vnDate(learner.createdAt))}
          </p>
        </div>
        <span className={`badge ${learner.status === "ACTIVE" ? "" : "badge-gold"}`}>
          {STATUS_LABELS[learner.status]}
          {learner.accessEndsAt ? ` · đến ${formatVnDate(vnDate(learner.accessEndsAt))}` : ""}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
        <div className="grid content-start gap-6">
          <article className="card">
            <h3 className="mb-3 text-lg font-bold">Hồ sơ học tập & phân loại</h3>
            {labels && profile ? (
              <dl className="grid gap-2 text-sm sm:grid-cols-[170px_1fr]">
                <dt className="text-muted">Ngành nghề</dt>
                <dd>{labels.industry}</dd>
                <dt className="text-muted">Vị trí</dt>
                <dd>{labels.position}</dd>
                <dt className="text-muted">Đối tượng giao tiếp</dt>
                <dd>{labels.audiences.join(", ")}</dd>
                <dt className="text-muted">Mục tiêu</dt>
                <dd>{labels.goals.join(", ")}</dd>
                <dt className="text-muted">Tự đánh giá</dt>
                <dd>
                  {levelInfo(profile.self_level).label} · dùng tiếng Anh {labelOf(FREQUENCIES, profile.frequency)?.toLowerCase()}
                </dd>
                <dt className="text-muted">Muốn học trong</dt>
                <dd>{profile.duration_months ? `${profile.duration_months} tháng` : "—"}</dd>
                <dt className="text-muted">Phân loại</dt>
                <dd>
                  <b>{profile.classification.level_label}</b> — hiện học ở mức <b>{levelInfo(profile.working_level).label}</b>
                  <small className="block text-muted">{profile.classification.summary_vi}</small>
                </dd>
                <dt className="text-muted">Kỹ năng ưu tiên</dt>
                <dd>{profile.classification.priorities.map((p) => p.label).join(", ")}</dd>
                <dt className="text-muted">Giờ học</dt>
                <dd>
                  {profile.study_time} · nhắc học {profile.reminders ? "bật" : "tắt"}
                </dd>
              </dl>
            ) : (
              <p className="text-muted">Học viên chưa thiết lập hồ sơ học tập (hoặc dùng hồ sơ cũ, sẽ được yêu cầu điền lại).</p>
            )}
          </article>

          <article className="card overflow-x-auto">
            <h3 className="mb-1 text-lg font-bold">Lộ trình thực tế</h3>
            <p className="mb-3 text-xs text-muted">
              Lộ trình 30 ngày chỉ là tham khảo; bài mỗi ngày được chọn lại theo kết quả buổi trước.
            </p>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Buổi</th>
                  <th>Bài đã học</th>
                  <th>Kết quả</th>
                  <th>Lỗi / cần ôn</th>
                </tr>
              </thead>
              <tbody>
                {learner.attempts.map((a) => {
                  const planned = a.plannedTitle && a.plannedTitle !== a.lesson.title ? a.plannedTitle : null;
                  const turns = (a.practice?.turns as Turn[] | undefined)?.filter((t) => t.role === "user").length ?? 0;
                  return (
                    <tr key={a.id}>
                      <td>
                        {a.day}
                        <small className="block text-muted">{formatVnDate(a.localDate)}</small>
                      </td>
                      <td>
                        <b>{a.lesson.title}</b>
                        <small className="block text-muted">
                          {SELECTED_BY[a.selectedBy ?? "plan"] ?? a.selectedBy}
                          {planned ? ` · thay cho “${planned}”` : ""} · {levelInfo(a.lesson.level).label}
                        </small>
                        {a.focus && <small className="block text-muted">{a.focus}</small>}
                      </td>
                      <td>
                        {a.summary ? (
                          <span className={`badge ${a.summary.goal_status === "achieved" ? "" : "badge-gold"}`}>
                            {GOAL_LABELS[a.summary.goal_status]}
                          </span>
                        ) : (
                          <span className="text-muted">{a.completed ? "—" : "Đang học"}</span>
                        )}
                        <small className="mt-1 block text-muted">{turns} lượt nói</small>
                      </td>
                      <td className="text-muted">
                        {a.summary?.errors?.map((e) => (
                          <div key={e.example}>
                            {e.issue}: <i>{e.correction}</i>
                          </div>
                        ))}
                        {!!a.summary?.review_items?.length && <div>Ôn: {a.summary.review_items.join(", ")}</div>}
                      </td>
                    </tr>
                  );
                })}
                {!learner.attempts.length && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted">
                      Chưa có buổi học nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {plan && (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-teal">Lộ trình tham khảo ban đầu</summary>
                <p className="my-2 text-muted">{plan.goal}</p>
                <ol className="list-decimal pl-5 text-muted">
                  {plan.days.map((d) => (
                    <li key={d.day}>
                      {d.title} — {d.focus}
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </article>

          <article className="card overflow-x-auto">
            <h3 className="mb-3 text-lg font-bold">Tổng kết tuần</h3>
            {learner.weeklyReports.length ? (
              <table className="data-table">
                <tbody>
                  {learner.weeklyReports.map((r) => {
                    const h = r.highlights as unknown as WeeklyHighlights;
                    return (
                      <tr key={r.id}>
                        <td>Tuần {formatVnDate(r.weekStart)}</td>
                        <td>
                          {r.sessionsDone}/7 buổi · {r.achieved} đạt · {r.voiceTurns} lượt nói
                        </td>
                        <td className="text-muted">
                          {r.needsSupport && <span className="badge badge-gold">{r.supportNote}</span>}
                          {h.reviewItems.length > 0 && <div>Ôn: {h.reviewItems.map(([t]) => t).join(", ")}</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="text-muted">Chưa có báo cáo tuần.</p>
            )}
          </article>
        </div>

        <aside className="grid content-start gap-6">
          {manage && (
            <article className="card">
              <h3 className="mb-3 text-lg font-bold">{learner.status === "ACTIVE" ? "Gia hạn gói" : "Kích hoạt lộ trình"}</h3>
              <p className="mb-4 text-xs text-muted">Xác nhận sau khi học viên đã được tư vấn và thanh toán.</p>
              <ApiForm
                endpoint="/api/admin/learners"
                method="PATCH"
                extra={{ id: learner.id, action: "activate" }}
                submitLabel={learner.status === "ACTIVE" ? "Gia hạn" : "Kích hoạt"}
                successText="Đã cập nhật."
              >
                <div className="field">
                  <label htmlFor="packageName">Tên gói</label>
                  <input id="packageName" name="packageName" defaultValue={learner.packageName ?? "Gói 30 ngày"} maxLength={80} />
                </div>
                <div className="field">
                  <label htmlFor="days">Số ngày</label>
                  <input id="days" name="days" type="number" min={1} max={366} defaultValue={DEFAULT_PACKAGE_DAYS} />
                </div>
                <div className="field">
                  <label htmlFor="phone">Số điện thoại</label>
                  <input id="phone" name="phone" defaultValue={learner.phone ?? ""} maxLength={30} />
                </div>
                <div className="field">
                  <label htmlFor="consultantId">Chuyên viên phụ trách</label>
                  <select id="consultantId" name="consultantId" defaultValue={learner.consultantId ?? ""}>
                    <option value="">— Tôi / giữ nguyên —</option>
                    {consultants.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="note">Ghi chú (mã thanh toán…)</label>
                  <input id="note" name="note" maxLength={1000} />
                </div>
              </ApiForm>
              {learner.status === "ACTIVE" && (
                <ApiForm
                  endpoint="/api/admin/learners"
                  method="PATCH"
                  extra={{ id: learner.id, action: "pause" }}
                  submitLabel="Tạm dừng tài khoản"
                  confirm="Tạm dừng tài khoản học viên này?"
                  buttonClassName="btn btn-outline mt-4"
                />
              )}
              {learner.status === "PAUSED" && (
                <ApiForm
                  endpoint="/api/admin/learners"
                  method="PATCH"
                  extra={{ id: learner.id, action: "resume" }}
                  submitLabel="Mở lại tài khoản"
                  buttonClassName="btn btn-outline mt-4"
                />
              )}
            </article>
          )}

          <article className="card">
            <h3 className="mb-3 text-lg font-bold">Zalo OA</h3>
            {learner.zaloLink ? (
              <p className="text-sm text-muted">
                Đã liên kết {dateTime(learner.zaloLink.linkedAt)} · {learner.zaloLink.followed ? "đang quan tâm OA" : "đã bỏ quan tâm"}
                <br />
                Tương tác cuối: {learner.zaloLink.lastInteractionAt ? dateTime(learner.zaloLink.lastInteractionAt) : "—"}
              </p>
            ) : (
              <p className="text-sm text-muted">Chưa liên kết. Hướng dẫn học viên vào Cài đặt → Nhắc học qua Zalo.</p>
            )}
            {learner.notifications.length > 0 && (
              <ul className="mt-3 grid gap-2 text-xs">
                {learner.notifications.map((n) => (
                  <li key={n.id} className="rounded-lg bg-[#f5f7f9] p-2.5">
                    <b>{NOTIFY_LABELS[n.status]}</b> · {n.kind} · {formatVnDate(n.localDate)}
                    {n.reason && <span className="block text-muted">{n.reason}</span>}
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="card">
            <h3 className="mb-3 text-lg font-bold">Ghi chú chăm sóc</h3>
            <ApiForm
              endpoint="/api/admin/notes"
              extra={{ learnerId: learner.id }}
              submitLabel="Thêm ghi chú"
              resetOnSuccess
              buttonClassName="btn btn-secondary"
            >
              <div className="field">
                <textarea name="body" required maxLength={2000} placeholder="Đã gọi điện, học viên bận công tác…" />
              </div>
            </ApiForm>
            <ul className="mt-4 grid gap-3 text-sm">
              {learner.notesAbout.map((n) => (
                <li key={n.id} className="border-l-[3px] border-line pl-3">
                  {n.body}
                  <small className="block text-muted">
                    {n.author?.name ?? "Hệ thống"} · {dateTime(n.createdAt)}
                  </small>
                </li>
              ))}
            </ul>
          </article>
        </aside>
      </div>
    </section>
  );
}
