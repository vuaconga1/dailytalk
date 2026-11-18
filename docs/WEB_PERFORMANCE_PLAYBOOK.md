# Web Performance Playbook — WeWIN Daily Speaking

Keep soft navigation fast and Vercel Fluid Active CPU / Neon egress low.  
Stack: Next.js 15 App Router · Prisma 7 · Neon Postgres · optional OpenAI · R2 · QStash.

Do not weaken authz or validation for speed. Never log or return secrets, password hashes, or raw provider keys.

This file adapts the portable WEWIN IELTS playbook to **this product’s** routes, tables, and already-shipped patterns.

---

## 1. Goals

1. **Warm soft-nav** in the app shell (`/today`, `/plan`, `/history`, `/lesson`, `/settings`, `/shadowing`, `/admin/*`) aims for **tens of ms** of unavoidable server work when warm — not hundreds of ms of redundant JSON hydrate.
2. **Fluid Active CPU** stays low: billed by processing time. Fat JSON selects, curriculum bundle work, deep clones, and tight origin polls spike cost without a “background cron” to blame.
3. **Neon egress** stays lean: never pull `Attempt.lesson`, `Practice.turns`, `User.plan`, or `LessonContent.lesson` on paths that only need titles/counts/flags.
4. Correctness first: session validity, staff permissions, and AI usage caps stay intact.

### Non-negotiables

- Authz and input validation before payload slimming.
- Private user data: `Cache-Control: private, no-store` (session, practice turns, recordings).
- Never CDN-cache learner PII or staff boards.

---

## 2. Domain map (IELTS playbook → DailyTalk)

| Portable idea | DailyTalk equivalent |
|---|---|
| Public catalog / list | `LessonContent` bank list, shadowing exercise list, admin learner board, history/plan lists |
| Detail by id/slug | Open lesson (`Attempt` + `lesson` JSON), practice turns, shadowing exercise + transcript, admin learner detail |
| Lean attempts / history | History & plan UIs; today stats; streak badge |
| Persist grade on write | `Attempt.summary` on complete; shadowing attempt score on submit; `WeeklyReport` from cron |
| Soft-nav shell | `src/app/(app)/layout.tsx`, `src/app/admin/layout.tsx` |
| Media CDN | Cloudflare R2 via `AudioClip.r2Key` (fallback: inline `Bytes` — avoid on hot paths) |
| Live updates | Prefer QStash + daily `/api/cron/tick`; client poll only where UX needs it (≥10s) |

**Already aligned (do not regress):**

- Study reminders via **QStash** (not a 1–2s poll).
- Daily cron `/api/cron/tick` for expire / ensure / weekly / recordings.
- `getStreakDays` selects only `localDate` (no lesson/summary).
- Payment status poll = **10s**.
- `SessionWatch` = **60s** (and only when tab visible).
- Audio prefers R2 public URLs when configured.

---

## 3. Why CPU / egress rises here

Typical request-driven spikes in this repo:

1. **Session row always includes `profile` + `plan` JSON** (`SESSION_USER_SELECT`) on every soft-nav through layouts.
2. **History / plan / week review** load full `Attempt.lesson` (and often `summary`) for every day, then `normalizeLesson` in memory.
3. **Admin lesson bank** selects `lesson` for up to 200 rows only to derive audio clip keys.
4. **Admin learner detail** includes **all** attempts + `practice.turns` in one response.
5. **Curriculum modules** (`src/data/curriculum`, ~1.3MB TS) are imported through `@/domain/curriculum` on lesson open / onboard — cold start and deploy weight matter.
6. Opening today’s attempt with `include: { practice: true }` pulls `turns` even when the UI only needs progress flags.

Treat every hot path as: **list ≠ detail**, **persist on write**, **lean session for chrome**, **poll carefully**.

---

## 4. List ≠ detail (lean payloads)

| Surface | Must return | Must not load |
|---|---|---|
| App nav / streak | name, access flags, streak days | full `plan` days, all summaries |
| `/plan` roadmap | day, title, completed | full lesson trees, summaries, turns |
| `/history` list cards | day, date, title, completed, **lean** summary fields UI shows | full `lesson` (words/frames/dialogue), practice turns |
| `/today` stats | dates + summary signals needed for streak/progress | full lesson blobs |
| Admin learners board | identity, status, package, last studied, sessionsDone, support flags | full `profile` when a few fields suffice; all attempt summaries beyond last N |
| Admin lesson bank table | key, title, industry, position, level, uses, lastUsed, **audioReady/total** | full `lesson` JSON in the list query (prefer stored clip counts or a metadata column) |
| Shadowing catalog | slug, title, level, youtubeId | full transcript / cues |
| Detail (lesson player, practice, shadowing studio, admin learner day) | full lesson / turns / transcript as needed | — |

```text
❌ getPlanHistory selects lesson JSON only to read .title
✅ Persist plannedTitle / title on Attempt (already partly there) and select that

❌ Admin lessons findMany({ select: { lesson: true } }) × 200 to count audio keys
✅ Store audioTotal / audioReady on LessonContent, or compute once in audio:gen

❌ learnerDetail include all attempts + turns for the overview tab
✅ Lean attempt list; fetch turns only when staff opens one day
```

Treat any in-process list cache as **immutable** — shallow copy only. Avoid `structuredClone` / JSON round-trip of curriculum or lesson banks on the response path.

---

## 5. Soft navigation & shared shells

Layouts today:

- `(app)/layout.tsx` → `requireUser()` + optional `getStreakDays`
- `admin/layout.tsx` → `requireStaff()`

**Rules**

1. Shell may verify session (authz is non-negotiable) but should not force **fat** columns (`plan`, full `profile`) unless that route needs them.
2. Prefer a **lean session** shape for chrome (id, name, role, status, accessEndsAt, lockAt, isDemo, hasPlan boolean) and load `plan` / full `profile` only in `requirePlan` / onboarding / today / lesson.
3. Streak badge: keep `getStreakDays` lean; cache with React `cache()` (already) and avoid refetching full history.
4. Do not add ranking / admin aggregates into learner layout.
5. Marketing / login pages stay free of DB when unauthenticated.

When adding a feature, ask:

1. Does this add per-click RSC / DB work on soft-nav?
2. Can it be client TTL (~30–60s), deferred page fetch, or a stored counter?
3. Never skip authz to save a round-trip.

---

## 6. Caching

| Data | Approach |
|---|---|
| Shadowing public catalog (metadata) | Short `unstable_cache` or equivalent + tag invalidation on admin write |
| Lesson bank admin list | Lean rows; invalidate after generate / audio jobs |
| Per-user streak / today stats | React `cache()` per request + optional short client TTL if moved client-side |
| Session / practice / payments | `private, no-store` |
| Curriculum static modules | Prefer **lazy import by cluster** so one lesson open does not parse all 14 group files |

After admin writes that change public lists: invalidate by tag/path — do not rely on process restart.

---

## 7. Persist expensive work; do not recompute on read

| Work | Persist on | Read path |
|---|---|---|
| Lesson summary / errors / frames_used / level_signal | `POST /api/complete` → `Attempt.summary` | history, today, admin |
| Shadowing score | attempt submit → `ShadowingAttempt` | history / admin |
| Weekly rollup | cron `weekly` → `WeeklyReport` | admin / today report |
| TTS audio | `audio:gen` / first request → `AudioClip` (+ R2) | `/api/audio` redirect |
| Adapted / AI lesson body | first need → `LessonContent` | later learners reuse bank |

```text
❌ Re-run coach/summary scoring when opening history
✅ Read Attempt.summary

❌ Re-derive audio key lists from full lesson on every admin lessons pageview
✅ Persist counts (or clip index) when lesson/audio is written
```

Checkpoint / practice updates: patch `turns` or progress flags — do not rewrite unrelated JSON columns when a targeted update suffices.

---

## 8. Database access

### Lean queries

- Never `SELECT *` / bare `include` on hot lists; omit `lesson`, `turns`, `plan`, `profile` unless required.
- Cap growing lists: admin learners already `take: 300` — keep caps; add cursor/pagination before removing them.
- No N+1 on import/seed/audio backfill — `createMany` / `findMany` + `IN`.
- Open today’s attempt with a **progress select** when the player is not mounted; include `practice.turns` only on practice step / turn API.

### Indexes (ship with the query)

Existing useful indexes include `Attempt[userId, completed, localDate]`, `User[role, status]`, `Usage[userId, kind, createdAt]`. When adding filters/sorts:

1. List every new `where` / `orderBy`.
2. Composite order: **equality → range/null → sort**.
3. Migrate normally; never rewrite applied migrations.
4. No speculative indexes; do not drop without `EXPLAIN`.

### Targeted lookups

```text
❌ Load all attempts for user, find incomplete in memory
✅ where: { userId, completed: false, … } with unique/day constraints
```

---

## 9. Media & deploy weight

- Prefer **R2 + CDN URL** for shadowing/TTS; keep DB `Bytes` as fallback only.
- Do not embed audio bytes in list JSON or RSC props.
- Curriculum: avoid importing `@/domain/curriculum` (all clusters) from routes that only need `buildPlan` metadata or a single `renderLesson` — split entrypoints (`curriculum/meta`, `curriculum/clusters/<id>`).
- Large static curriculum stays out of client bundles (`server-only` boundaries).

---

## 10. Polling & realtime

| Client | Interval | Payload |
|---|---|---|
| `SessionWatch` | 60s + visibility | session validity only |
| Payment panel | ≥10s | status/code fields only |
| Practice timer / karaoke | local only | no origin poll |
| Study reminders | QStash one-shot | not a poll |

Never introduce ≤2s origin polling for dashboards. Prefer webhook (SePay) + light poll fallback for payments.

---

## 11. Admin, import, background

- Audio generation, curriculum checks, bulk account import: **scripts / admin actions / cron**, not learner soft-nav.
- Admin reports: lean rows + in-memory aggregate by key; do not hydrate all `turns` for charts.
- `dashboardCounts` should not call full `listLearners("support")` if a cheaper count/query exists once support signals are denormalized or precomputed.

---

## 12. Architecture helpers (target API shape)

| Helper | Used for | Constraint |
|---|---|---|
| `getStreakDays` | App header | dates only |
| `getPlanHistory` | `/plan` | day + title + completed (no lesson JSON) |
| `getTodayStatsHistory` | `/today` widgets | dates + lean summary signals |
| `getHistoryPageData` | `/history` | lean list + week reviews **without** full lesson trees when UI only needs titles + summary chips |
| `listLearners` | Admin board | metadata + last-N signals; bound `take` |
| `learnerDetail` / `getAttemptDay` | Staff deep dive | full lesson; turns **on demand** |
| `listLessonBank` | Admin lessons | metadata + audio counts; no lesson blob |
| `getLessonContent(key)` | Generate audio / preview | full lesson |
| `listShadowingCatalog` | `/shadowing` | slug/title/level/youtubeId |
| `getShadowingExercise(slug)` | Studio | transcript + cues |

---

## 13. Definition of Done (hot path)

Before merging changes that touch lists, soft-nav, practice checkpoint, polling, or serverless handlers:

- [ ] List/admin/history/plan responses stay lean (no full `lesson` / `turns` / transcripts unless that page is detail).
- [ ] No deep clone of curriculum or lesson banks on the hot path.
- [ ] Queries use lean `select` + `take`/pagination + matching indexes.
- [ ] Summaries / scores / weekly reports are persisted on write; views read stored values.
- [ ] App/admin shell does not pull fat `plan`/`profile` unless the route needs them.
- [ ] Polling stays ≥10s to origin (session watch may stay ~60s).
- [ ] Measured locally for touched hotspots: handler time + JSON/RSC payload size (warm); after deploy check Vercel → Usage → Fluid Active CPU and Neon egress.

---

## 14. Measurement (lightweight)

**Local (warm)**

- Compare response / RSC payload size for: `/plan`, `/history`, `/admin/learners`, `/admin/lessons`, `/shadowing`.
- Confirm plan/history no longer ship full lesson JSON per row.
- Optional script: hit lean list vs detail and write before/after snapshots under `tmp/perf/`.

**Production**

- Watch Fluid Active CPU and Neon data transfer.
- Spikes usually mean: fat session select, history lesson hydrate, admin detail-all-turns, or curriculum eager import.

**Directional targets**

- Plan/history list payload ≪ sum of full lessons for all days.
- Admin lesson table payload ≪ 200 full lessons.
- Soft-nav warm work dominated by lean session + small streak query.

---

## 15. Adoption checklist (DailyTalk)

1. Split **lean session** vs **full session** (`plan`/`profile` only where required).
2. Stop selecting `Attempt.lesson` on plan/history when title fields exist (`plannedTitle` / denormalized title).
3. Slim `getHistoryPageData` / week reviews to fields the UI actually renders.
4. Admin `listLessonBank`: drop full `lesson` from list; persist or separately fetch audio counts.
5. Admin `learnerDetail`: lean attempt list; load `practice.turns` per day on demand.
6. Lazy-load curriculum by cluster; keep `server-only` boundaries.
7. Keep practice/complete paths persisting summary/score; never re-score on history view.
8. Guard polls (payment ≥10s; session ~60s); no new tight polls.
9. Audit new `where`/`orderBy` + indexes in the same PR.
10. Copy §13 into PR review notes for hot-path changes.

---

## 16. Priority order for implementation

| Phase | Focus | Why |
|---|---|---|
| **P0** | Lean plan/history selects; lean session for shell | Every learner soft-nav + most-used pages |
| **P1** | Admin lessons list without lesson JSON; learner detail without all turns | Staff CPU/egress as learner count grows |
| **P2** | Curriculum lazy import by cluster | Cold start / deploy weight |
| **P3** | Denormalize support signals / audio counts if measurement still hot | Remove compute-on-read leftovers |
| **P4** | Perf smoke script + PR DoD habit | Prevent regressions |

---

## 17. Source mapping

| Source | Role |
|---|---|
| `wewin-ielts/docs/WEB_PERFORMANCE_PLAYBOOK.md` | Portable behaviors (list≠detail, soft-nav, indexes, polls) |
| `~/.cursor/rules/web-performance-standards.mdc` | Cross-project mandatory standard |
| This file | DailyTalk-specific names, hotspots, and phased plan |
