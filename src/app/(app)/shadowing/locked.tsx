import Link from "next/link";
import { PAYMENT_ENABLED } from "@/domain/access";

export function ShadowingLocked() {
  return (
    <section className="mx-auto w-full max-w-[640px] rounded-2xl border-2 border-black bg-white p-6 text-center shadow-(--ww-frame-shadow) sm:p-8">
      <div className="mb-2 text-xs font-bold tracking-wider text-gold uppercase">Shadowing</div>
      <h1 className="mb-3 border-b-2 border-black pb-3 text-2xl font-extrabold text-navy md:text-[28px]">Dành cho học viên đã kích hoạt.</h1>
      {PAYMENT_ENABLED ? (
        <>
          <p className="text-ink-secondary">
            Phòng luyện shadowing với video thực tế mở ngay khi bạn thanh toán gói học. Tài khoản được kích hoạt tự động sau khi chuyển khoản.
          </p>
          <Link href="/payment" className="btn mt-5">
            Chọn gói học →
          </Link>
        </>
      ) : (
        <>
          <p className="text-ink-secondary">
            Phòng luyện shadowing với video thực tế mở khi tài khoản đang hoạt động. Hoàn tất hồ sơ học tập để kích hoạt, hoặc liên hệ chuyên viên WeWIN nếu tài khoản đã hết hạn.
          </p>
          <Link href="/today" className="btn mt-5">
            Về trang học →
          </Link>
        </>
      )}
    </section>
  );
}
