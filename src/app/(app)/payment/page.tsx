import { CheckoutSteps } from "@/components/onboarding/checkout-steps";
import { PaymentPanel } from "@/components/payment/payment-panel";
import { notFound } from "next/navigation";
import { isTrial, PAYMENT_ENABLED } from "@/domain/access";
import { planOf } from "@/domain/payment";
import { requirePlan } from "@/server/http/page-guards";

export default async function PaymentPage() {
  if (!PAYMENT_ENABLED) notFound();
  const user = await requirePlan();
  const trial = isTrial(user);
  const defaultMonths = planOf(user.profile.duration_months)?.months ?? 1;

  return (
    <section className="mx-auto w-full min-w-0 max-w-[1040px]">
      <div className="mb-6 text-center sm:mb-8">
        <div className="eyebrow">THANH TOÁN · KÍCH HOẠT NGAY SAU KHI CHUYỂN KHOẢN</div>
        <h1 className="page-title !text-[clamp(28px,3vw,37px)]">{trial ? "Lộ trình của bạn đã sẵn sàng." : "Gia hạn gói học."}</h1>
        <p className="mx-auto mt-3 max-w-[640px] text-muted">
          {trial
            ? "Chọn gói và quét mã QR để mở toàn bộ lộ trình. Tài khoản được kích hoạt tự động, không cần chờ duyệt."
            : "Thời gian của gói mới được cộng nối tiếp sau ngày hết hạn hiện tại."}
        </p>
      </div>
      {trial && <CheckoutSteps current={1} formDone />}
      <PaymentPanel defaultMonths={defaultMonths} trial={trial} />
    </section>
  );
}
