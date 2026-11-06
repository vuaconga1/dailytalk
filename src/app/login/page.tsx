import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { Brand } from "@/components/layout/brand";
import { isDemo } from "@/server/ai/config";
import { getSessionState, SESSION_END_MESSAGES } from "@/server/auth";

export default async function LoginPage() {
  const { user, ended } = await getSessionState();
  if (user) redirect("/");
  return (
    <div className="min-h-screen bg-white md:grid md:grid-cols-[1.05fr_1fr]">
      <section className="relative flex flex-col justify-center bg-gradient-to-br from-navy to-navy-deep p-6 text-white md:px-[10%] md:py-14">
        <Brand />
        <div className="eyebrow mt-5 !text-[#a9c4d6]">DAILY SPEAKING</div>
        <h1 className="mt-6 max-w-[550px] text-[32px] leading-[1.15] font-bold tracking-[-1.3px] md:mt-16 md:text-[55px]">
          15 phút mỗi ngày.
          <br />
          Mở lời tự tin hơn.
        </h1>
        <p className="max-w-[440px] text-sm leading-[1.8] text-[#b9cddd] md:text-[17px]">
          Học từ và mẫu câu. Nghe, nói theo. Thực hành tình huống cùng AI và nhận phản hồi sau mỗi buổi.
        </p>
        <div className="my-7 hidden gap-4 md:flex" aria-hidden="true">
          {["Aa", "♪", "↔", "✓"].map((c) => (
            <span key={c} className="grid size-[60px] place-items-center rounded-full border border-white/15 text-[21px] text-gold">
              {c}
            </span>
          ))}
        </div>
        <small className="hidden text-[#a9c4d6] md:block">Đạo Đức · Trí Tuệ · Bản Lĩnh</small>
      </section>
      <AuthForm demoEnabled={isDemo} notice={ended ? SESSION_END_MESSAGES[ended] : ""} />
    </div>
  );
}
