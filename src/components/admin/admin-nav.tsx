"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type AdminLink = { href: string; label: string; icon: string };

export function AdminNav({ links }: { links: AdminLink[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Quản trị" className="flex flex-wrap gap-1 md:grid md:gap-[9px]">
      {links.map((l) => {
        const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-[10px] px-[9px] py-[9px] text-xs whitespace-nowrap transition md:px-[15px] md:py-[13px] md:text-[15px] ${
              active ? "bg-white/10 text-white" : "text-[#bad0dd] hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className="inline-block w-5 text-gold md:w-7">{l.icon}</span>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
