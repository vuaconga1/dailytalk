import { AdminNav, type AdminLink } from "@/components/admin/admin-nav";
import { Brand } from "@/components/layout/brand";
import { LogoutButton } from "@/components/layout/logout-button";
import { SessionWatch } from "@/components/layout/session-watch";
import { can, ROLE_LABELS, type Permission } from "@/domain/access";
import { requireStaff } from "@/server/http/page-guards";

const LINKS: (AdminLink & { permission: Permission })[] = [
  { href: "/admin", label: "Tổng quan", icon: "◈", permission: "viewLearners" },
  { href: "/admin/learners", label: "Học viên", icon: "◎", permission: "viewLearners" },
  { href: "/admin/lessons", label: "Ngân hàng bài", icon: "▦", permission: "manageLessons" },
  { href: "/admin/shadowing", label: "Shadowing", icon: "◉", permission: "manageLessons" },
  { href: "/admin/notifications", label: "Tin nhắn Zalo", icon: "✉", permission: "viewNotifications" },
  { href: "/admin/staff", label: "Nhân sự", icon: "⚙", permission: "manageStaff" },
  { href: "/admin/settings", label: "Cấu hình AI", icon: "✦", permission: "manageSettings" },
];

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const links = LINKS.filter((l) => can(user.role, l.permission)).map(({ href, label, icon }) => ({ href, label, icon }));
  return (
    <div className="flex min-h-screen flex-col bg-[#edf3fd]">
      {/* Header màu xanh dương đồng bộ WeWIN Daily Speaking */}
      <header className="sticky top-0 z-40 w-full border-b border-amber-400/15 bg-gradient-to-r from-[#0b1a3a] via-[#0f2452] to-[#0b1a3a] text-white shadow-[0_6px_24px_-10px_rgba(6,16,37,0.6)]">
        <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between gap-2 px-3 sm:gap-4 sm:px-4 md:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <Brand href="/admin" />
            <span className="hidden rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-300 lg:inline-block">
              DAILY SPEAKING
            </span>
            <span className="hidden items-center sm:inline-flex gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/15 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-blue-200">
              <span className="size-1.5 rounded-full bg-blue-400" />
              STAFF CONSOLE
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1 pr-1 pl-1 transition-colors hover:border-white/30 hover:bg-white/10 sm:pr-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-[11px] font-bold text-slate-950 ring-2 ring-white/20">
                {initials(user.name)}
              </span>
              <div className="hidden max-w-[160px] min-w-0 text-left text-xs sm:block">
                <div className="truncate font-semibold leading-tight text-white">{user.name}</div>
                <small className="block leading-tight text-slate-300">{ROLE_LABELS[user.role]}</small>
              </div>
            </div>

            <LogoutButton variant="dark" />
          </div>
        </div>
      </header>

      <SessionWatch />

      <div className="flex-1 md:grid md:grid-cols-[200px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="flex flex-col bg-navy px-4 py-4 text-white md:sticky md:top-16 md:h-[calc(100vh-64px)] md:px-[15px] md:py-6 lg:px-[20px]">
          <div className="mb-4 hidden text-[11px] font-bold tracking-[2px] text-[#a9c4d6] uppercase md:block">
            Menu Quản trị
          </div>
          <AdminNav links={links} />
        </aside>

        <main className="mx-auto w-full min-w-0 max-w-[1460px] px-4 py-6 md:p-8 lg:px-11 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
