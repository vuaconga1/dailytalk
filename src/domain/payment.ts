/** Reminder channels unlocked by a paid package (email via Resend and/or Zalo OA). */
export type ReminderChannel = "email" | "zalo";

export type PlanId = "email" | "full";

export type PaymentPlan = {
  id: PlanId;
  amount: number;
  days: number;
  label: string;
  description: string;
  channels: ReminderChannel[];
  packageName: string;
};

export const PLANS: PaymentPlan[] = [
  {
    id: "email",
    amount: 99_000,
    days: 30,
    label: "Gói 99.000 đ",
    description: "Mở lộ trình 30 ngày · nhắc học qua email",
    channels: ["email"],
    packageName: "Gói email 30 ngày",
  },
  {
    id: "full",
    amount: 500_000,
    days: 30,
    label: "Gói 500.000 đ",
    description: "Mở lộ trình 30 ngày · nhắc học qua email và Zalo",
    channels: ["email", "zalo"],
    packageName: "Gói email + Zalo 30 ngày",
  },
];

export function planOf(planId: unknown): PaymentPlan | undefined {
  return PLANS.find((p) => p.id === planId);
}

export function packageNameOf(planId: PlanId): string {
  return planOf(planId)?.packageName ?? "Gói học";
}

/** Transfer message: letters and digits only, so every bank app keeps it intact. */
export const PAYMENT_CODE_PREFIX = "WWP";
export const PAYMENT_CODE_PATTERN = /WWP[A-HJ-NP-Z2-9]{8}/i;

export function formatVnd(amount: number): string {
  return `${amount.toLocaleString("vi-VN")} đ`;
}

export type PaymentView = {
  code: string;
  planId: PlanId;
  days: number;
  amount: number;
  channels: ReminderChannel[];
  status: "PENDING" | "PAID";
  qrUrl: string | null;
  bank: { name: string; accountNo: string; accountName: string } | null;
};
