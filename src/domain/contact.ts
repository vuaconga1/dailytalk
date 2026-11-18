import { Problem } from "@/lib/errors";

export const PHONE_MAX = 30;
export const EMAIL_MAX = 200;

/** Required learner phone (onboarding / settings). Digits with optional + and separators. */
export function readRequiredPhone(body: Record<string, unknown>): string {
  const raw = body.phone;
  if (typeof raw !== "string") throw new Problem("Hãy nhập số điện thoại.");
  const phone = raw.trim();
  if (!phone || phone.length > PHONE_MAX) throw new Problem("Hãy nhập số điện thoại hợp lệ.");
  if (!/^[+]?[\d\s().-]{8,}$/.test(phone)) throw new Problem("Số điện thoại không hợp lệ.");
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) throw new Problem("Số điện thoại không hợp lệ.");
  return phone;
}

/**
 * Reminder destination email. Empty or same as login → null (deliver to User.email).
 * Never changes the login email.
 */
export function readReminderEmail(body: Record<string, unknown>, loginEmail: string): string | null {
  const raw = body.reminder_email ?? body.reminderEmail;
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string" || raw.length > EMAIL_MAX) {
    throw new Problem("Email nhận nhắc không hợp lệ.");
  }
  const email = raw.trim().toLowerCase();
  if (!email) return null;
  if (!email.includes("@") || email.length > EMAIL_MAX) {
    throw new Problem("Email nhận nhắc không hợp lệ.");
  }
  const login = loginEmail.trim().toLowerCase();
  if (email === login) return null;
  return email;
}

export function reminderDestination(loginEmail: string, reminderEmail: string | null | undefined): string {
  return reminderEmail?.trim() || loginEmail;
}
