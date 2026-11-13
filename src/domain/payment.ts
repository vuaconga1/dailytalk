/** VND per month of access. */
export const PRICE_PER_MONTH = 500_000;
export const DAYS_PER_MONTH = 30;
export const PLAN_MONTHS = [1, 2, 3, 4, 5, 6] as const;

export type PaymentPlan = { months: number; amount: number; label: string };

export const PLANS: PaymentPlan[] = PLAN_MONTHS.map((months) => ({
  months,
  amount: months * PRICE_PER_MONTH,
  label: `${months} tháng`,
}));

export function planOf(months: unknown): PaymentPlan | undefined {
  return PLANS.find((p) => p.months === Number(months));
}

export function packageNameOf(months: number): string {
  return `Gói ${months} tháng`;
}

/** Transfer message: letters and digits only, so every bank app keeps it intact. */
export const PAYMENT_CODE_PREFIX = "WWP";
export const PAYMENT_CODE_PATTERN = /WWP[A-HJ-NP-Z2-9]{8}/i;

export function formatVnd(amount: number): string {
  return `${amount.toLocaleString("vi-VN")} đ`;
}

export type PaymentView = {
  code: string;
  months: number;
  amount: number;
  status: "PENDING" | "PAID";
  qrUrl: string | null;
  bank: { name: string; accountNo: string; accountName: string } | null;
};
