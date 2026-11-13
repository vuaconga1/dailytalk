"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  {
    href: "/today",
    label: "Hôm nay",
    crumb: "Hôm nay",
    icon: (
      <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: "/plan",
    label: "Lộ trình",
    crumb: "Lộ trình",
    icon: (
      <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: "/shadowing",
    label: "Shadowing",
    crumb: "Shadowing",
    icon: (
      <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    ),
  },
  {
    href: "/history",
    label: "Nhật ký",
    crumb: "Nhật ký",
    icon: (
      <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Cài đặt",
    crumb: "Cài đặt",
    icon: (
      <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

function isActive(pathname: string, href: string) {
  return (
    pathname === href ||
    (href === "/today" && pathname.startsWith("/lesson")) ||
    (href === "/shadowing" && pathname.startsWith("/shadowing/"))
  );
}

type NavProps = { hasPlan: boolean; showShadowing: boolean; className?: string; tabs?: boolean };

export function AppNav({ hasPlan, showShadowing, className = "", tabs = false }: NavProps) {
  const pathname = usePathname();
  if (!hasPlan) return null;

  return (
    <nav aria-label="Điều hướng chính" className={`flex items-center gap-1 ${className}`}>
      {LINKS.filter((l) => showShadowing || l.href !== "/shadowing").map((l) => {
        const active = isActive(pathname, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center rounded-lg border font-medium whitespace-nowrap transition-all duration-200 active:scale-95 ${
              tabs
                ? "min-w-0 flex-1 flex-col gap-0.5 px-1 py-1 text-[11px] sm:flex-none sm:flex-row sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-[13px]"
                : "gap-1.5 px-3 py-1.5 text-[13px]"
            } ${
              active
                ? "border-amber-400/60 bg-amber-400/10 font-semibold text-white shadow-[0_0_0_3px_rgba(212,167,44,0.15)]"
                : "border-transparent text-white hover:-translate-y-px hover:border-white/25 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span
              className={`transition-colors ${
                active ? "text-amber-400" : "text-amber-400 group-hover:text-amber-300"
              }`}
            >
              {l.icon}
            </span>
            <span className={tabs ? "max-w-full truncate" : undefined}>{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Crumb() {
  const pathname = usePathname();
  if (pathname.startsWith("/onboarding") || pathname.startsWith("/payment")) return null;
  const label = pathname.startsWith("/lesson")
    ? "Buổi học hôm nay"
    : (LINKS.find((l) => isActive(pathname, l.href))?.crumb ?? "Khảo sát");

  return (
    <div className="mb-6 flex items-center gap-2 text-xs md:text-sm text-slate-500 font-medium">
      <span className="hover:text-slate-700 transition-colors">Không gian học tập</span>
      <span>/</span>
      <span className="text-navy font-semibold">{label}</span>
    </div>
  );
}
