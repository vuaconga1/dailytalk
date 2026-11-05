import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { requireUser } from "@/lib/page-guards";
import { isCurrentProfile } from "@/lib/profile";

export default async function OnboardingPage() {
  const user = await requireUser();
  const current = isCurrentProfile(user.profile);
  if (user.plan && current) redirect("/today");
  return (
    <section className="mx-auto w-full min-w-0 max-w-[860px]">
      <div className="mb-6 text-center sm:mb-8">
        <div className="eyebrow">THIẾT LẬP HỒ SƠ HỌC TẬP · KHOẢNG 2 PHÚT</div>
        <h1 className="page-title !text-[clamp(28px,3vw,37px)]">Hiểu bạn trước khi bắt đầu.</h1>
        <p className="mx-auto mt-3 max-w-[620px] text-muted">
          Cho WeWIN biết công việc, người bạn cần giao tiếp và mục tiêu. Lộ trình sẽ xoay quanh đúng những tình huống đó.
        </p>
      </div>
      <OnboardingForm restart={Boolean(user.plan && !current)} />
    </section>
  );
}
