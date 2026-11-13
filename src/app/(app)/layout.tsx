import { redirect } from "next/navigation";
import { AppNav, Crumb } from "@/components/layout/app-nav";
import { hasActiveAccess, isStaff } from "@/domain/access";
import { Brand } from "@/components/layout/brand";
import { LogoutButton } from "@/components/layout/logout-button";
import { NavProgress } from "@/components/layout/nav-progress";
import { SessionWatch } from "@/components/layout/session-watch";
import { SiteFooter } from "@/components/layout/site-footer";
import { formatVnDateTime } from "@/lib/time";
import { getHistory } from "@/server/learning/history";
import { requireUser } from "@/server/http/page-guards";
import { streak } from "@/domain/stats";

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
  const showShadowing = hasActiveAccess(user);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 w-full border-b border-amber-400/15 bg-[#0b1a3a] text-white shadow-[0_6px_24px_-10px_rgba(6,16,37,0.6)]">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-2 px-3 sm:gap-4 sm:px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <Brand href="/today" />
            <span className="hidden whitespace-nowrap rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-300 2xl:inline-block">
              DAILY SPEAKING
            </span>
          </div>

          <AppNav
            hasPlan={hasPlan}
            showShadowing={showShadowing}
            className="hidden rounded-xl border border-white/10 bg-white/5 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] lg:flex lg:shrink-0"
          />

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {days !== null && (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-400/50 bg-amber-400/15 px-2.5 py-1 text-xs font-bold text-amber-300 transition-colors hover:bg-amber-400/25">
                <span className="size-2 rounded-full bg-amber-400 animate-pulse-glow" />
                <span className="hidden sm:inline">Chuỗi</span> {days} ngày
              </span>
            )}

            <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1 pr-1 pl-1 transition-colors hover:border-white/30 hover:bg-white/10 xl:pr-3" title={user.name}>
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-[11px] font-bold text-slate-950 ring-2 ring-white/20">
                {initials(user.name)}
              </span>
              <div className="hidden max-w-[180px] min-w-0 text-left text-xs xl:block">
                <div className="truncate font-semibold leading-tight text-white">{user.name}</div>
                <small className="block leading-tight text-slate-300">Học viên WeWIN</small>
              </div>
            </div>

            <LogoutButton variant="dark" />
          </div>
        </div>

        {/* Mobile/tablet secondary navigation (< lg) without browser scrollbar */}
        {hasPlan && (
          <div className="border-t border-amber-400/15 lg:hidden bg-[#07132b]">
            <div className="mx-auto max-w-[1600px] px-2 py-1.5 sm:px-4 md:px-6">
              <AppNav tabs hasPlan={hasPlan} showShadowing={showShadowing} className="flex sm:gap-2" />
            </div>
          </div>
        )}
      </header>

      <SessionWatch />
      <NavProgress />
      <main className="mx-auto w-full min-w-0 max-w-[1280px] flex-1 px-4 py-6 md:px-8 md:py-8 lg:py-10">
        {user.lockAt && (
          <p className="note mb-5">
            Bạn đã hoàn thành lộ trình 30 ngày. Tài khoản còn dùng được đến {formatVnDateTime(user.lockAt)} để xem lại bài học và
            đánh giá; sau đó tài khoản sẽ bị khóa cho đến khi WeWIN kích hoạt lại.
          </p>
        )}
        <Crumb />
        {children}
      </main>

      <SiteFooter homeHref="/today" />
    </div>
  );
}
