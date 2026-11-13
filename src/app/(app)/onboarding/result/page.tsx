import Link from "next/link";
import { RoadmapGrid } from "@/components/plan/roadmap-grid";
import { requirePlan } from "@/server/http/page-guards";
import { profileLabels } from "@/domain/profile";
import { isTrial } from "@/domain/access";

export default async function OnboardingResultPage() {
  const user = await requirePlan();
  const { classification } = user.profile;
  const labels = profileLabels(user.profile);
  const trial = isTrial(user);

  return (
    <section>
      <div className="eyebrow">KẾT QUẢ PHÂN LOẠI · LỘ TRÌNH THAM KHẢO</div>
      <h1 className="page-title mb-6">Lộ trình dành cho {labels.position.toLowerCase()}.</h1>

      <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <article className="card">
          <div className="eyebrow">TRÌNH ĐỘ BẮT ĐẦU</div>
          <h2 className="mb-2 text-[28px] font-bold text-navy">{classification.level_label}</h2>
          <p className="leading-[1.7] text-muted">{classification.summary_vi}</p>
          <p className="mt-4 text-sm">
            <b>Bối cảnh:</b> {labels.industry} · giao tiếp với {labels.audiences.join(", ").toLowerCase()}
          </p>
        </article>
        <article className="card">
          <div className="eyebrow">KỸ NĂNG CẦN ƯU TIÊN</div>
          <ol className="grid gap-3">
            {classification.priorities.map((p, i) => (
              <li key={p.skill} className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-teal-soft text-sm font-bold text-teal">{i + 1}</span>
                <span>
                  <b className="block">{p.label}</b>
                  <small className="text-muted">{p.why_vi}</small>
                </span>
              </li>
            ))}
          </ol>
        </article>
      </div>

      <article className="card mb-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">30 chủ đề tham khảo</h2>
            <p className="mt-1 max-w-[760px] text-sm text-muted">{user.plan.goal}</p>
          </div>
          <span className="badge badge-gold">THAM KHẢO · ĐIỀU CHỈNH THEO KẾT QUẢ</span>
        </div>
        <p className="note mb-5">
          Đây mới là tên chủ đề. Từ vựng, mẫu câu, shadowing và hội thoại của mỗi ngày chỉ được tạo khi bạn bắt đầu ngày đó, dựa trên
          kết quả các buổi trước, nên chủ đề có thể được thay đổi để vừa sức và sát với lỗi bạn hay gặp.
        </p>
        <RoadmapGrid days={user.plan.days} current={1} />
      </article>

      <div className="flex flex-wrap items-center gap-3">
        <Link href="/lesson" className="btn btn-gold">
          {trial ? "Học thử miễn phí ngày 1 →" : "Bắt đầu học ngày 1 →"}
        </Link>
        {trial && (
          <Link href="/payment" className="btn btn-outline">
            Thanh toán để mở toàn bộ lộ trình
          </Link>
        )}
      </div>
    </section>
  );
}
