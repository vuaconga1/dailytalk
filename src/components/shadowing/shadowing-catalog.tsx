import Link from "next/link";
import type { ShadowingCatalogItem } from "@/domain/shadowing/types";

function Items({ items, current }: { items: ShadowingCatalogItem[]; current: string }) {
  return (
    <ol className="grid gap-1">
      {items.map((item, i) => {
        const active = item.slug === current;
        return (
          <li key={item.slug}>
            <Link
              href={`/shadowing/${item.slug}`}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[44px] items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] transition-colors ${
                active ? "bg-navy font-semibold text-white shadow-sm" : "text-ink-secondary hover:bg-navy-soft/70"
              }`}
            >
              <span className={`w-6 shrink-0 text-xs font-bold ${active ? "text-amber-300" : "text-muted"}`}>{String(i + 1).padStart(2, "0")}</span>
              <span className="min-w-0 flex-1 truncate" title={item.title}>
                {item.title}
              </span>
              {item.level && (
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-white/15 text-white" : "bg-blue-soft text-blue-accent"}`}>
                  {item.level}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

function Header({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-navy text-white">
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <b className="block text-sm leading-tight text-navy">Shadowing</b>
        <small className="text-xs text-muted">Nghe và nói theo</small>
      </div>
      <span className="badge !px-2 !py-0.5 text-[11px]">{count} bài</span>
    </div>
  );
}

/** Exercise list: sticky sidebar on wide screens, a collapsible list above the player otherwise. */
export function ShadowingCatalog({ items, current }: { items: ShadowingCatalogItem[]; current: string }) {
  const index = items.findIndex((i) => i.slug === current);
  return (
    <>
      <aside className="hidden xl:block">
        <div className="sticky top-20 rounded-2xl border border-line bg-white p-3 shadow-[0_4px_20px_-4px_rgba(20,40,90,0.05)]">
          <div className="px-1 pb-3">
            <Header count={items.length} />
          </div>
          <div className="max-h-[calc(100vh-190px)] overflow-y-auto pr-1">
            <Items items={items} current={current} />
          </div>
        </div>
      </aside>
      <details className="group rounded-2xl border border-line bg-white p-3 xl:hidden">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
            <Header count={items.length} />
          </div>
          <span className="shrink-0 text-xs text-muted">
            Bài {index + 1}/{items.length} <span className="inline-block transition-transform group-open:rotate-180">▾</span>
          </span>
        </summary>
        <div className="mt-3 max-h-[50vh] overflow-y-auto border-t border-line pt-3">
          <Items items={items} current={current} />
        </div>
      </details>
    </>
  );
}
