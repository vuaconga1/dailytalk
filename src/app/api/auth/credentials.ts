import { Problem } from "@/lib/errors";

export function readCredentials(body: Record<string, unknown>, minPassword: number) {
  const { email, password } = body;
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    password.length < minPassword ||
    password.length > 128 ||
    email.length > 200 ||
    !email.includes("@")
  ) {
    throw new Problem(`Email hợp lệ và mật khẩu từ ${Math.max(minPassword, 1)} đến 128 ký tự.`);
  }
  return { email: email.trim().toLowerCase(), password };
}
