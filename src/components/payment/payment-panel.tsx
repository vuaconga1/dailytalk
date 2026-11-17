"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/client/api";
import { formatVnd, PLANS, type PlanId, type PaymentView } from "@/domain/payment";
import { TRIAL_STUDY_DAYS } from "@/domain/access";

const POLL_MS = 10_000;

function CopyRow({ label, value, display }: { label: string; value: string; display?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="flex min-w-0 items-center gap-2">
        <b className="truncate text-sm text-navy">{display ?? value}</b>
        <button
          type="button"
          className="shrink-0 rounded-md border border-slate-200 px-2 py-0.5 text-xs font-semibold text-blue-accent hover:bg-slate-50"
          onClick={() => {
            void navigator.clipboard?.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Đã chép" : "Chép"}
        </button>
      </span>
    </div>
  );
}

function channelLabel(channels: string[]): string {
  const hasZalo = channels.includes("zalo");
  const hasEmail = channels.includes("email");
  if (hasEmail && hasZalo) return "Nhắc học qua email và Zalo";
  if (hasEmail) return "Nhắc học qua email";
  if (hasZalo) return "Nhắc học qua Zalo";
  return "Không nhắc học tự động";
}

export function PaymentPanel({ defaultPlanId, trial }: { defaultPlanId: PlanId; trial: boolean }) {
  const router = useRouter();
  const [planId, setPlanId] = useState<PlanId>(defaultPlanId);
  const [payment, setPayment] = useState<PaymentView | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setPayment(null);
    setError("");
    api<PaymentView>("/api/payment", { planId })
      .then((p) => !cancelled && setPayment(p))
      .catch((err: unknown) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [planId]);

  const code = payment?.code;
  const paid = payment?.status === "PAID";
  useEffect(() => {
    if (!code || paid) return;
    const timer = setInterval(() => {
      api<PaymentView>(`/api/payment?code=${encodeURIComponent(code)}`)
        .then((p) => setPayment((current) => (current?.code === p.code ? p : current)))
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [code, paid]);

  useEffect(() => {
    if (!paid) return;
    const timer = setTimeout(() => {
      router.replace("/today");
      router.refresh();
    }, 2500);
    return () => clearTimeout(timer);
  }, [paid, router]);

  if (paid && payment) {
    return (
      <div className="card mx-auto max-w-[560px] text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-teal-soft text-2xl text-teal">✓</div>
        <h2 className="mb-2 text-2xl font-bold text-navy">Thanh toán thành công!</h2>
        <p className="text-muted">
          WeWIN đã nhận {formatVnd(payment.amount)} và kích hoạt {payment.days} ngày học ({channelLabel(payment.channels).toLowerCase()}).
          Đang chuyển đến buổi học…
        </p>
        <Link href="/today" className="btn mt-6">
          Vào học ngay →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="card">
        <h2 className="mb-1 text-xl font-bold text-navy">1. Chọn gói học</h2>
        <p className="mb-4 text-sm text-muted">Mỗi gói mở lộ trình 30 ngày. Khác biệt ở kênh nhắc học.</p>
        <div className="grid gap-2.5">
          {PLANS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={planId === p.id}
              onClick={() => setPlanId(p.id)}
              className={`rounded-xl border p-4 text-left transition ${
                planId === p.id ? "border-teal bg-teal-soft" : "border-[#cfdae1] bg-white hover:border-teal"
              }`}
            >
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <b className="text-navy">{p.label}</b>
                <span className="text-sm font-semibold text-teal">{formatVnd(p.amount)}</span>
              </span>
              <small className="mt-1 block text-muted">{p.description}</small>
            </button>
          ))}
        </div>
        {trial && (
          <div className="mt-6 border-t border-slate-100 pt-5">
            <p className="mb-3 text-sm text-muted">
              Chưa sẵn sàng? Bạn được học thử miễn phí {TRIAL_STUDY_DAYS} buổi trước khi thanh toán.
            </p>
            <Link href="/onboarding/result" className="btn btn-outline">
              Học thử miễn phí {TRIAL_STUDY_DAYS} buổi →
            </Link>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="mb-1 text-xl font-bold text-navy">2. Quét mã QR để thanh toán</h2>
        <p className="mb-4 text-sm text-muted">
          Mở ứng dụng ngân hàng, quét mã: số tiền và nội dung chuyển khoản được điền sẵn. Vui lòng giữ nguyên nội dung để hệ
          thống tự kích hoạt.
        </p>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {!payment && !error && <p className="py-16 text-center text-sm text-muted">Đang tạo mã thanh toán…</p>}
        {payment && !payment.qrUrl && (
          <p className="note">Cổng thanh toán chưa được cấu hình. Vui lòng liên hệ chuyên viên WeWIN để được hỗ trợ.</p>
        )}
        {payment?.qrUrl && payment.bank && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- remote VietQR image, sized by the service */}
            <img
              src={payment.qrUrl}
              alt={`Mã QR chuyển khoản ${formatVnd(payment.amount)}`}
              className="mx-auto mb-4 w-full max-w-[300px] rounded-xl border border-slate-100"
            />
            <div className="mb-4">
              <CopyRow label="Ngân hàng" value={payment.bank.name} />
              <CopyRow label="Số tài khoản" value={payment.bank.accountNo} />
              <CopyRow label="Chủ tài khoản" value={payment.bank.accountName} />
              <CopyRow label="Số tiền" value={String(payment.amount)} display={formatVnd(payment.amount)} />
              <CopyRow label="Nội dung" value={payment.code} />
            </div>
            <p className="mb-3 text-sm text-muted">
              Nội dung gợi ý khi chuyển tay: <b className="text-navy">HỌC PHÍ _ TÊN HỌC VIÊN</b> — nếu quét QR, hãy giữ nguyên mã{" "}
              <b className="text-navy">{payment.code}</b> để hệ thống tự nhận.
            </p>
            <p className="mb-4 text-sm text-muted">
              Xin cảm ơn Quý PH đã tin tưởng và đồng hành cùng WeWIN.
              <br />
              <b className="text-navy">WEWIN Education</b>
            </p>
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
              <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
              Đang chờ thanh toán… Trang sẽ tự chuyển khi nhận được tiền.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
