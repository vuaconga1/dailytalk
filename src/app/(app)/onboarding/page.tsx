import { redirect } from "next/navigation";
import { CheckoutSteps } from "@/components/onboarding/checkout-steps";
import { OnboardingForm, type OnboardingValues } from "@/components/onboarding/onboarding-form";
import { isTrial } from "@/domain/access";
import { requireUser } from "@/server/http/page-guards";
import { isCurrentProfile } from "@/domain/profile";

export default async function OnboardingPage() {
  const user = await requireUser();
  const current = isCurrentProfile(user.profile);
  const trial = isTrial(user);
  const done = Boolean(user.plan && current);
  if (done && !trial) redirect("/today");
  const p = done && current ? user.profile : null;
  const initial: Partial<OnboardingValues> | undefined = p
    ? {
        age: p.age ? String(p.age) : "",
        gender: p.gender ?? "",
        industry: p.industry,
        industry_other: p.industry_other,
        position: p.position,
        position_other: p.position_other,
        audiences: p.audiences,
        goals: p.goals,
        self_level: p.self_level,
        frequency: p.frequency,
        duration_months: p.duration_months ? String(p.duration_months) : "",
        study_time: p.study_time,
        reminders: p.reminders,
      }
    : undefined;
  return (
    <section className="mx-auto w-full min-w-0 max-w-[860px]">
      <div className="mb-6 text-left sm:mb-8">
        <h1 className="text-xl font-bold leading-snug tracking-[-0.5px] text-navy sm:text-2xl md:text-[26px]">
          Cho WeWIN biết công việc, người bạn cần giao tiếp và mục tiêu. Lộ trình sẽ xoay quanh đúng những tình huống đó.
        </h1>
      </div>
      {trial && <CheckoutSteps current={0} formDone={done} />}
      <OnboardingForm
        restart={Boolean(user.plan && !current)}
        editing={done}
        defaultName={user.isDemo ? "" : user.name}
        initial={initial}
      />
    </section>
  );
}
