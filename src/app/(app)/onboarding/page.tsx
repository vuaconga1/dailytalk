import { redirect } from "next/navigation";
import { CheckoutSteps } from "@/components/onboarding/checkout-steps";
import { OnboardingForm, type OnboardingValues } from "@/components/onboarding/onboarding-form";
import { isTrial } from "@/domain/access";
import { requireUser } from "@/server/http/page-guards";
import { isCurrentProfile } from "@/domain/profile";
import { loadSessionPlan } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function OnboardingPage() {
  const user = await requireUser();
  const data = await loadSessionPlan(user.id);
  const contact = await prisma.user.findUnique({
    where: { id: user.id },
    select: { phone: true, reminderEmail: true },
  });
  const current = isCurrentProfile(data.profile);
  const trial = isTrial(user);
  const done = Boolean(data.plan && current);
  if (done && !trial) redirect("/today");
  const p = done && current ? data.profile : null;
  const loginEmail = user.isDemo ? "" : user.email;
  const initial: Partial<OnboardingValues> | undefined = p
    ? {
        phone: contact?.phone ?? "",
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
        reminder_email: contact?.reminderEmail || loginEmail,
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
        restart={Boolean(data.plan && !current)}
        editing={done}
        defaultName={user.isDemo ? "" : user.name}
        defaultEmail={loginEmail}
        defaultPhone={contact?.phone ?? ""}
        initial={initial}
      />
    </section>
  );
}
