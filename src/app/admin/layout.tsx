import { AdminNav, type AdminLink } from "@/components/admin/admin-nav";
import { Brand } from "@/components/layout/brand";
import { LogoutButton } from "@/components/layout/logout-button";
import { can, ROLE_LABELS, type Permission } from "@/lib/access";
import { requireStaff } from "@/lib/page-guards";

const LINKS: (AdminLink & { permission: Permission })[] = [
  { href: "/admin", label: "Tổng quan", icon: "◈", permission: "viewLearners" },
  { href: "/admin/learners", label: "Học viên", icon: "◎", permission: "viewLearners" },
  { href: "/admin/lessons", label: "Ngân hàng bài", icon: "▦", permission: "manageLessons" },
  { href: "/admin/notifications", label: "Tin nhắn Zalo", icon: "✉", permission: "viewNotifications" },
  { href: "/admin/staff", label: "Nhân sự", icon: "⚙", permission: "manageStaff" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const links = LINKS.filter((l) => can(user.role, l.permission)).map(({ href, label, icon }) => ({ href, label, icon }));
  return (
    <div className="min-h-screen md:grid md:grid-cols-[200px_1fr] lg:grid-cols-[240px_1fr]">
      <aside className="flex flex-col bg-navy px-5 py-4 text-white md:sticky md:top-0 md:h-screen md:px-[15px] md:py-[25px] lg:px-[22px] lg:py-8">
        <Brand />
        <div className="mb-11 hidden text-[11px] tracking-[2px] text-[#a9c4d6] md:block">STAFF CONSOLE</div>
        <AdminNav links={links} />
      </aside>
      <main className="mx-auto w-full max-w-[1460px] px-4 py-[22px] md:p-[25px] lg:px-11 lg:py-[30px]">
        <header className="mb-[22px] flex items-center justify-end gap-3 md:mb-9">
          <div className="text-right text-[13px]">
            {user.name}
            <small className="block text-muted">{ROLE_LABELS[user.role]}</small>
          </div>
          <LogoutButton />
        </header>
        {children}
      </main>
    </div>
  );
}
