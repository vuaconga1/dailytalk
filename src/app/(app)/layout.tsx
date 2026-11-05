import { redirect } from "next/navigation";
import { AppNav, Crumb } from "@/components/layout/app-nav";
import { isStaff } from "@/lib/access";
import { Brand } from "@/components/layout/brand";
import { LogoutButton } from "@/components/layout/logout-button";
import { getHistory } from "@/lib/learning";
import { requireUser } from "@/lib/page-guards";
import { streak } from "@/lib/stats";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (isStaff(user.role)) redirect("/admin");
  const days = user.plan ? streak(await getHistory(user.id)) : null;

  const hasPlan = Boolean(user.plan);

  return (
    <div className="flex min-h-screen flex-col bg-[#edf3fd]">
      <header className="sticky top-0 z-40 w-full border-b border-[#142954] bg-[#091734] text-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-4 px-4 md:px-7">
          <div className="flex shrink-0 items-center gap-3">
            <Brand href="/today" />
            <span className="hidden rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold tracking-wider text-amber-300 sm:inline-block border border-white/10">
              DAILY SPEAKING
            </span>
          </div>

          <AppNav hasPlan={hasPlan} className="hidden flex-1 justify-center xl:flex" />

          <div className="ml-auto flex shrink-0 items-center gap-3">
            {days !== null && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1 text-xs font-bold text-amber-300 border border-amber-400/30 whitespace-nowrap">
                <span className="size-2 rounded-full bg-amber-400 animate-pulse-glow" />
                Chuỗi {days} ngày
              </span>
            )}

            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-xs font-bold text-slate-950 shadow-xs ring-2 ring-white/20">
                {initials(user.name)}
              </span>
              <div className="hidden max-w-[160px] text-left text-xs md:block">
                <div className="truncate font-semibold text-white leading-tight">{user.name}</div>
                <small className="block text-slate-300">Học viên WeWIN</small>
              </div>
            </div>

            <div className="border-l border-white/15 pl-2">
              <LogoutButton variant="dark" />
            </div>
          </div>
        </div>

        {hasPlan && (
          <div className="border-t border-white/10 xl:hidden">
            <AppNav hasPlan={hasPlan} className="mx-auto max-w-[1280px] px-3 py-2 md:px-6" />
          </div>
        )}
      </header>

      <main className="mx-auto w-full min-w-0 max-w-[1280px] flex-1 px-4 py-6 md:px-8 md:py-8 lg:py-10">
        <Crumb />
        {children}
      </main>

      <footer className="border-t border-[#e2e8f4] bg-white/60">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-1 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between md:px-8">
          <b className="font-bold tracking-wide text-amber-700">Đạo Đức · Trí Tuệ · Bản Lĩnh</b>
          <span>15 phút mỗi ngày. Tự tin hơn trong công việc.</span>
        </div>
      </footer>
    </div>
  );
}
