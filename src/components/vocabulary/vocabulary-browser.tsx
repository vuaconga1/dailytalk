"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { VocabGroup, VocabWord } from "@/domain/vocabulary-catalog";

type PositionLink = { id: string; label: string; count: number };
type IndustryLink = { id: string; label: string; positions: PositionLink[] };

type Props = {
  industries: IndustryLink[];
  industryId: string;
  positionId: string;
  groups: VocabGroup[];
};

function WordCard({ word }: { word: VocabWord }) {
  return (
    <article className="min-w-0 rounded-xl border-[1.5px] border-black bg-white p-4">
      <h3 className="text-lg font-extrabold leading-snug text-navy">{word.word}</h3>
      <p className="mt-1 text-sm font-medium text-ink-secondary">{word.meaning}</p>
      {(word.ipa || word.posLabel) && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
          {word.ipa && <code className="rounded-md bg-navy px-2 py-1 font-mono text-[13px] text-white">/{word.ipa}/</code>}
          {word.posLabel && <span className="rounded-full bg-gold-soft px-2 py-1 text-navy">{word.posLabel}</span>}
        </p>
      )}
      {word.example && (
        <p className="mt-3 border-t border-black/10 pt-3 text-sm leading-relaxed text-ink">
          <span className="mr-1.5 text-[11px] font-bold tracking-wider text-ink-secondary">ex</span>
          <span className="italic">{word.example}</span>
        </p>
      )}
    </article>
  );
}

function IndustryDropdown({ industries, industryId }: { industries: IndustryLink[]; industryId: string }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const industry = industries.find((item) => item.id === industryId);
  const needle = filter.trim().toLowerCase();
  const matches = useMemo(
    () => (needle ? industries.filter((item) => item.label.toLowerCase().includes(needle)) : industries),
    [industries, needle],
  );

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setFilter("");
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-black">Nhóm ngành</p>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border-[1.5px] border-black bg-white px-3 py-2.5 text-left text-sm font-semibold text-navy transition hover:bg-navy-soft"
      >
        <span className="min-w-0 truncate">{industry?.label ?? "Chọn nhóm ngành"}</span>
        <svg
          className={`size-4 shrink-0 text-navy transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="Nhóm ngành"
          className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-xl border-[1.5px] border-black bg-white shadow-(--ww-frame-shadow)"
        >
          <div className="border-b border-black/10 p-2">
            <label className="relative block">
              <span className="sr-only">Tìm nhóm ngành</span>
              <svg
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-navy"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchRef}
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Tìm nhóm ngành…"
                className="w-full rounded-lg border-[1.5px] border-black bg-white py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-gold/50"
              />
            </label>
          </div>
          <ul className="max-h-64 overflow-y-auto p-1">
            {matches.map((item) => {
              const first = item.positions[0];
              const href = first ? `/vocabulary?industry=${item.id}&position=${first.id}` : "/vocabulary";
              const active = item.id === industryId;
              return (
                <li key={item.id} role="option" aria-selected={active}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`block rounded-lg px-3 py-2 text-sm font-semibold ${
                      active ? "bg-navy text-white" : "text-navy hover:bg-navy-soft"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
            {!matches.length && (
              <li className="px-3 py-3 text-sm text-ink-secondary">Không có nhóm ngành khớp “{filter.trim()}”.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export function VocabularyBrowser({ industries, industryId, positionId, groups }: Props) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          words: needle
            ? group.words.filter((word) =>
                `${word.word} ${word.meaning} ${word.example ?? ""}`.toLowerCase().includes(needle),
              )
            : group.words,
        }))
        .filter((group) => group.words.length > 0),
    [groups, needle],
  );
  const total = groups.reduce((sum, group) => sum + group.words.length, 0);
  const shown = visible.reduce((sum, group) => sum + group.words.length, 0);
  const industry = industries.find((item) => item.id === industryId);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="min-w-0 rounded-2xl border-2 border-black bg-white p-3 lg:sticky lg:top-24">
        <IndustryDropdown industries={industries} industryId={industryId} />
        {industry && (
          <div className="mt-3 border-t border-black/10 pt-3">
            <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-black">Vị trí</p>
            <div className="grid max-h-[min(60vh,420px)] gap-1 overflow-y-auto">
              {industry.positions.map((position) => {
                const active = position.id === positionId;
                return (
                  <Link
                    key={position.id}
                    href={`/vocabulary?industry=${industry.id}&position=${position.id}`}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
                      active ? "bg-gold-soft font-bold text-navy" : "text-ink hover:bg-gray-100"
                    }`}
                  >
                    <span className="min-w-0 truncate">{position.label}</span>
                    <span className="shrink-0 text-xs font-bold text-ink-secondary">{position.count}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </aside>

      <div className="min-w-0">
        <label className="mb-4 block">
          <span className="mb-1.5 block text-sm font-bold text-navy">Tìm trong vị trí này</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Gõ từ tiếng Anh, nghĩa, hoặc câu ví dụ"
            className="w-full rounded-xl border-[1.5px] border-black bg-white px-4 py-3 text-sm"
          />
        </label>
        <p className="mb-4 text-sm text-ink-secondary">{needle ? `${shown} / ${total} từ` : `${total} từ`}</p>
        {visible.map((group) => (
          <section key={group.id} className="mb-8">
            <h2 className="mb-3 text-lg font-extrabold text-navy">
              {group.label} <span className="text-sm font-bold text-ink-secondary">({group.words.length})</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.words.map((word) => (
                <WordCard key={`${group.id}-${word.word}`} word={word} />
              ))}
            </div>
          </section>
        ))}
        {!visible.length && (
          <p className="rounded-xl border-[1.5px] border-black bg-white p-4 text-sm text-ink-secondary">
            Không có từ khớp với “{query.trim()}”.
          </p>
        )}
      </div>
    </div>
  );
}
