import type { ReactNode } from "react";

type Props = {
  title: ReactNode;
  index?: number;
  badge?: ReactNode;
  children?: ReactNode;
  level?: 2 | 3;
  className?: string;
};

export function SectionHeading({ title, index, badge, children, level = 3, className = "" }: Props) {
  const Tag = level === 2 ? "h2" : "h3";
  return (
    <div className={`mb-4 border-b-2 border-black pb-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {index !== undefined && (
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-navy text-sm font-bold text-gold-light">{index}</span>
          )}
          <Tag className={`min-w-0 font-extrabold tracking-tight text-navy ${level === 2 ? "text-xl md:text-2xl" : "text-lg md:text-xl"}`}>
            {title}
          </Tag>
        </div>
        {badge}
      </div>
      {children && <div className="mt-1.5 text-sm text-ink-secondary">{children}</div>}
    </div>
  );
}
