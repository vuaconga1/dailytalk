# Shadowing (trang luyện riêng) — Tài liệu triển khai

Tài liệu này mô tả **những gì đã được xây dựng** cho tính năng Shadowing độc lập (trang `/shadowing`), cách **thêm video mới**, và các **quy tắc / bẫy** cần biết khi một AI hoặc dev khác tiếp tục làm việc trên nó. Đặc tả gốc (yêu cầu nghiệp vụ, thuật toán chấm điểm) nằm ở `SHADOWING_FEATURE_SPEC.md` — tài liệu này là phần "đã làm như thế nào".

> Tính năng này **không liên quan** đến bước shadowing bên trong mỗi bài học (lesson). Đây là một trang riêng, dữ liệu riêng, API riêng.

---

## 1. Tóm tắt nhanh

- Video được **nhúng iframe YouTube** (IFrame Player API, `controls: 0`), **không tải video về**.
- Transcript + thời gian từng từ lấy từ **phụ đề YouTube** do server tự fetch (innertube client ANDROID → `captionTracks` → `fmt=json3`). Nếu YouTube chặn, admin có thể **dán SRT/VTT**.
- Admin chỉnh transcript tự do; thời gian được **căn lại tự động** bằng cách align từ transcript với từ trong phụ đề (Levenshtein theo từ), không cần bấm giờ tay.
- IPA từng câu sinh từ **CMUdict** (`cmu-pronouncing-dictionary`), không dùng AI, không có bản dịch.
- Hai chế độ cho học viên:
  - **Luyện từng câu**: nghe câu mẫu (video tự dừng cuối câu), ghi âm, chấm điểm ngay trên trình duyệt; có **Shadow tự động** (phát câu → tự ghi âm → chấm → sang câu tiếp).
  - **Đọc cả bài**: ghi âm toàn bộ, gửi lên server; server **chấm lại**, lưu kết quả + bản ghi (R2 hoặc DB), giữ bản ghi **18 ngày**, có **lịch sử**.
- Nhận dạng giọng nói: **Web Speech API** (Chrome/Edge). Chấm điểm: **WER không dùng AI** theo spec (đồng âm, số → chữ, Anh-Anh/Anh-Mỹ, đuôi -s/-ed, gần đúng).
- Quyền: chỉ học viên **ACTIVE** (`hasActiveAccess(user)`). Admin quản lý ở `/admin/shadowing` (quyền `manageLessons`).

---

## 2. Thêm một video mới (quy trình chuẩn)

### Cách 1 — Qua trang admin (khuyến nghị)

1. Đăng nhập tài khoản staff có quyền `manageLessons`, vào **`/admin/shadowing`**.
2. Form "Tạo bài":
   - **Link YouTube**: dán link dạng `https://www.youtube.com/watch?v=XXXX`, `youtu.be/XXXX`, `/shorts/XXXX`, `/embed/XXXX` hoặc chỉ ID 11 ký tự.
   - **Tiêu đề** (để trống → lấy tiêu đề YouTube).
   - **Trình độ** (vd `A2`, `B1`, `B2`…).
   - **Phụ đề SRT/VTT** (tuỳ chọn): chỉ dán khi YouTube không cho lấy phụ đề.
3. Bấm tạo → server fetch phụ đề, sinh transcript, cues, IPA rồi chuyển sang trang sửa `/admin/shadowing/<id>`.
4. Ở trang sửa:
   - **Rà transcript**: sửa chính tả, dấu câu, tách câu (mỗi câu nên kết thúc bằng `.`, `?`, `!`). Phụ đề tự động (ASR) thường thiếu dấu câu và sai tên riêng — đây là bước quan trọng nhất.
   - Xem **bảng thời gian + IPA** bên dưới để kiểm tra từng câu có thời gian hợp lý không.
   - Đặt **Trạng thái = PUBLISHED** để học viên thấy. `DRAFT` = ẩn, `ARCHIVED` = ẩn nhưng giữ lịch sử.
   - `Thứ tự` (order) quyết định vị trí trong danh mục; `Giới hạn ghi âm (giây)` cho "Đọc cả bài" (5–300, mặc định ≈ thời lượng × 1.3 + 10).
5. Mở `/shadowing/<slug>` bằng tài khoản học viên để kiểm tra (staff bị layout `(app)` chuyển về `/admin`, nên dùng iframe preview trong trang admin hoặc tài khoản học viên/demo).

**Lấy lại phụ đề** (nút "Refetch"): fetch lại caption từ YouTube (hoặc từ SRT/VTT dán vào). Tick "ghi đè transcript" nếu muốn thay transcript bằng bản mới; không tick thì giữ transcript đã sửa và chỉ căn lại thời gian.

### Cách 2 — Bằng script (khi cần tạo hàng loạt)

Tạo file tạm trong `scripts/`, chạy bằng `npx tsx --conditions=react-server scripts/<file>.ts`, xong thì xoá. Logic phải giống action `create` trong `src/app/api/admin/shadowing/route.ts`:

```ts
import { prisma } from "../src/server/db";
import { deriveContent, uniqueSlug } from "../src/server/shadowing/store";
import { captionTranscript, fetchYoutubeVideo, parseYoutubeId } from "../src/server/shadowing/youtube";

const LINKS = ["https://www.youtube.com/watch?v=dGLObch14e4"];

async function main() {
  for (const link of LINKS) {
    const youtubeId = parseYoutubeId(link)!;
    const video = await fetchYoutubeVideo(youtubeId);
    const title = video.title ?? youtubeId;
    const transcript = captionTranscript(video.words);
    const last = await prisma.shadowingExercise.aggregate({ _max: { order: true } });
    const row = await prisma.shadowingExercise.create({
      data: {
        slug: await uniqueSlug(title),
        title,
        level: "B1",
        youtubeId,
        durationSec: video.durationSec,
        transcript,
        captionWords: video.words,
        captionSource: video.source,
        maxRecordSeconds: Math.min(300, Math.max(5, Math.round((video.durationSec ?? 20) * 1.3 + 10))),
        order: (last._max.order ?? 0) + 1,
        status: "DRAFT",
        ...deriveContent(transcript, video.words, youtubeId),
      },
    });
    console.log(row.slug, transcript.split("\n").length, "câu");
  }
}

main().finally(() => prisma.$disconnect());
```

Sau đó vẫn nên vào admin rà transcript rồi mới PUBLISHED.

**Nếu đổi transcript/caption trực tiếp trong DB** (không qua API), luôn gọi lại `deriveContent(transcript, captionWords, youtubeId)` và ghi `cues` + `annotations`. Cues cũ tự bị vô hiệu khi transcript không khớp (`validateCues`), lúc đó trang học viên rơi về thời gian **ước lượng** (kém chính xác).

### Chọn video phù hợp

- Có **phụ đề tiếng Anh** (ưu tiên phụ đề do người làm; ASR vẫn được nhưng cần sửa transcript nhiều hơn).
- Video **cho phép nhúng** (embedding allowed). Nếu chủ kênh tắt nhúng, iframe báo lỗi 101/150.
- Độ dài lý tưởng 1–4 phút; quá dài thì "Đọc cả bài" vượt giới hạn 300 giây.
- Lời nói rõ, ít nhạc nền, ít người nói chồng lên nhau (nhận dạng giọng nói và căn thời gian chính xác hơn).
- Các ký hiệu trong phụ đề như `>>` (đổi người nói), `[Music]`, `(laughs)`, `♪` được lọc khi sinh transcript.

---

## 3. Kiến trúc & bản đồ file

Stack: Next.js 15 App Router (Turbopack), React 19, Tailwind 4, Prisma 7 + Neon, Cloudflare R2 (`@aws-sdk/client-s3`).

### Domain thuần (dùng chung client + server, không I/O)

| File | Nội dung |
|---|---|
| `src/domain/shadowing/transcript.ts` | `transcriptLines` (tách câu, giữ nguyên văn bản gốc, gộp `Mr.`, `e.g.`, số thập phân…), `spokenText`, `lineKey`, `wordCount` |
| `src/domain/shadowing/scoring.ts` | Chuẩn hoá từ, đồng âm, số → chữ, Anh-Anh/Mỹ, `alignSequences` (DP có cắt tiền tố/hậu tố + giới hạn ô), `gradeText`, `gradeShadowing`, `pickClosestAlternatives`, `scoreTone` |
| `src/domain/shadowing/cues.ts` | `buildCues` (align transcript ↔ caption words, thêm đệm đầu/cuối câu **không chồng nhau**), `validateCues`, `estimateCues` (fallback), `lineIndexAt`, `wordIndexAt`, `displayWords` |
| `src/domain/shadowing/types.ts` | Kiểu công khai, `STATUS_LABELS`, hằng số: `RECORDING_TTL_DAYS = 18`, `MAX_RECORDING_BYTES = 4MB`, `RECORD_SECONDS`, `STT_PROVIDERS = ["web-speech"]` |

### Server

| File | Nội dung |
|---|---|
| `src/server/shadowing/youtube.ts` | `parseYoutubeId`, `fetchYoutubeVideo` (innertube ANDROID, ưu tiên track `en` không phải ASR), `json3Words`, `subtitleWords` (SRT/VTT), `captionTranscript` |
| `src/server/shadowing/ipa.ts` | `sentenceIpa`: Arpabet (CMUdict) → IPA, dấu nhấn đặt trước âm đầu, từ một âm tiết không đánh dấu |
| `src/server/shadowing/store.ts` | `deriveContent`, `listCatalog`, `getPublishedExercise`, `toPublicExercise`, `submitAttempt` (chấm lại phía server, lưu bản ghi), `historyFor`, `attemptResult`, `attemptRecording`, `purgeExpiredRecordings`, `deleteExercise`, `sniffRecording` (kiểm tra magic bytes webm/ogg/mp4/wav) |
| `src/server/integrations/r2.ts` | Thêm `putPrivateObject` / `getPrivateObject` / `deletePrivateObject`, env tuỳ chọn `R2_PRIVATE_BUCKET` |

### API

| Route | Mô tả |
|---|---|
| `POST /api/admin/shadowing` | `staffRoute("manageLessons")`, `action`: `create` / `update` / `refetch` / `delete` |
| `POST /api/shadowing/submit` | multipart: `slug`, `sttProvider`, `recognizedText`, `alternatives` (JSON), `durationMs`, `recording` (file). Yêu cầu ACTIVE |
| `GET /api/shadowing/history?slug=` | Lịch sử của user cho bài đó |
| `GET /api/shadowing/attempt?id=` | Kết quả chi tiết một lần nộp |
| `GET /api/shadowing/recording?id=` | Stream bản ghi (`private, no-store`, `nosniff`); chủ bài hoặc staff có `viewLearners` |
| `GET /api/cron/tick` | Thêm job `recordings`: xoá bản ghi hết hạn (throttle 10 phút, mỗi lần 50) |

### Trang

| Đường dẫn | File |
|---|---|
| `/admin/shadowing` | `src/app/admin/shadowing/page.tsx` — danh sách + form tạo |
| `/admin/shadowing/[id]` | `src/app/admin/shadowing/[id]/page.tsx` — sửa, refetch, xoá, preview iframe, bảng thời gian + IPA, 100 lần nộp gần nhất kèm audio |
| `/shadowing` | `src/app/(app)/shadowing/page.tsx` — chuyển tới bài đầu tiên hoặc trạng thái trống; `locked.tsx` cho tài khoản chưa ACTIVE |
| `/shadowing/[slug]` | `src/app/(app)/shadowing/[slug]/page.tsx` |

Nav: link "Shadowing" trong `src/components/layout/app-nav.tsx` (prop `showShadowing = hasActiveAccess(user)` từ `src/app/(app)/layout.tsx`) và trong `src/app/admin/layout.tsx`.

### Component client (`src/components/shadowing/`)

| File | Vai trò |
|---|---|
| `use-youtube-player.ts` | Nạp IFrame API; nội suy thời gian giữa các lần YouTube báo; `TimeStore` + `useTimeSelector` (useSyncExternalStore); `playRange(start, end, {onDone, onCancel})` tự dừng cuối câu (dừng sớm `PAUSE_LATENCY` = 60ms × tốc độ để bù trễ postMessage); cờ `ranging` khi đang phát một câu |
| `capture.ts` | `startCapture`: Web Speech (continuous, 5 alternatives, tự khởi động lại khi Chrome ngắt) + MediaRecorder song song; `CAPTURE_MESSAGES` thông báo lỗi tiếng Việt |
| `shadowing-practice.tsx` | State machine chính: `idle → starting → recording → processing → recorded / submitting`; Shadow tự động (chờ 250ms trước khi ghi, 1200ms trước câu tiếp); điểm từng câu lưu `localStorage` `wewin_shadowing_progress_<slug>`; phím tắt |
| `video-panel.tsx`, `transcript-panel.tsx`, `studio.tsx`, `karaoke-text.tsx` | Giao diện video, danh sách câu, thẻ ghi âm, karaoke |
| `shadowing-result.tsx`, `shadowing-history.tsx`, `shadowing-catalog.tsx` | Kết quả căn từ, lịch sử, danh mục bài |

### Dữ liệu (`prisma/schema.prisma`)

- `ShadowingExercise`: `slug`, `title`, `level`, `instructions`, `youtubeId`, `durationSec`, `transcript`, `captionWords` (JSON `[{w,s,e,sp?}]`), `captionSource` (`youtube:en`, `youtube:en:asr`, `file`), `cues` (JSON, version 2), `annotations` (IPA), `maxRecordSeconds`, `status`, `order`.
- `ShadowingAttempt`: kết quả chấm (score, WER, đếm đúng/sai/thiếu/thừa, `wordResults`, `errorSummary`), `recordingKey` (`r2:<key>` hoặc `db`, null khi đã xoá), `recordingExpiresAt`.
- `ShadowingRecording`: bytes bản ghi khi không có R2 private bucket.

Đổi schema xong chạy `npm run db:push` rồi **khởi động lại dev server** (client Prisma cũ bị cache sẽ gây lỗi kiểu `findMany` không tồn tại).

---

## 4. Luồng dữ liệu thời gian (quan trọng nhất)

1. `fetchYoutubeVideo` → danh sách từ có thời gian (`captionWords`), từ `tOffsetMs` của json3.
2. `captionTranscript(words)` → transcript ban đầu (mỗi câu một dòng).
3. `buildCues(transcript, captionWords, videoId)`:
   - Tách câu bằng `transcriptLines`, tách từ hiển thị bằng `displayWords`.
   - Align từ transcript ↔ caption bằng `alignSequences` + `speechWordsMatch` → từ khớp/thay thế nhận thời gian của caption; từ chèn thêm được nội suy.
   - Thời gian câu = từ đầu → từ cuối, cộng đệm `LEAD_IN = 0.15s` / `TAIL = 0.25s`, **chia khoảng trống giữa hai câu** để không câu nào chồng lên câu kế.
4. `validateCues` ở trang học viên: chỉ dùng cues nếu cùng `videoId` và cùng danh sách câu; nếu không → `estimateCues` theo độ dài chữ.

Vì vậy: **sửa transcript qua admin là an toàn** — thời gian được tính lại từ `captionWords` đã lưu.

---

## 5. Bẫy đã gặp & cách đã xử lý

- **Câu đang chọn nhảy sang câu sau khi "Nghe câu mẫu" xong**: do đệm thời gian chồng nhau + logic "đi theo video" vẫn chạy khi phát một câu. Đã sửa: đệm không chồng nhau, theo dõi chỉ khi `player.playing && !player.ranging`, và `setPlaying(false)` ngay khi range dừng.
- **YouTube dừng trễ** vì `pauseVideo()` đi qua postMessage → dừng sớm 60ms.
- **"e.g." bị nối lại thành "e. g."**: tách câu phải cắt theo span của văn bản gốc, không ghép lại token.
- **Prisma update với `cues: undefined` giữ nguyên giá trị cũ** → `deriveContent` trả `Prisma.DbNull` khi không build được cues.
- **Next.js không cho export hằng số tuỳ ý từ file `page.tsx`** → hằng số dùng chung đặt trong `src/domain/shadowing/types.ts`.
- **Không đặt side effect trong state updater** (StrictMode gọi hai lần) — ví dụ toggle mute.
- **Web Speech không chạy trong trình duyệt nhúng của Cursor/Electron** (báo lỗi "cần kết nối Internet"). Test micro bằng Chrome/Edge thật. Firefox/Safari không hỗ trợ đầy đủ → UI báo không hỗ trợ.
- **Staff không vào được trang học viên** (layout `(app)` chuyển về `/admin`). Test bằng tài khoản học viên/demo (demo được tính là ACTIVE).
- Màn hình login chưa hỗ trợ `?next=`, nên 401 chuyển về `/login`.
- Không đọc/ghi file `.env` bằng agent; nếu cần R2 private bucket thì tự thêm `R2_PRIVATE_BUCKET=<tên bucket>` (không đặt → bản ghi lưu trong DB).

---

## 6. Checklist kiểm tra sau khi thêm video

1. `/admin/shadowing/<id>`: bảng thời gian không có câu nào `start ≥ end`, IPA hiển thị cho hầu hết câu.
2. `/shadowing/<slug>` (tài khoản học viên):
   - Video tải được (không lỗi nhúng).
   - Chọn một câu → "Nghe câu mẫu" (phím `R`) → video dừng đúng cuối câu và **vẫn giữ câu đó**.
   - Karaoke tô đúng từ đang nói.
   - Phát tự do → câu đang chọn đi theo video.
   - Ghi âm một câu (Chrome) → có điểm và căn từ.
   - Shadow tự động chạy qua vài câu.
   - "Đọc cả bài" → nộp → lịch sử có thêm một lần, "Xem lại" phát được audio.
3. `npx tsc --noEmit` và `npx eslint src/components/shadowing src/domain/shadowing` không lỗi.

Kiểm tra nhanh bằng API (chạy trong console trang khi đã đăng nhập học viên):

```js
const fd = new FormData();
fd.set("slug", "<slug>");
fd.set("sttProvider", "web-speech");
fd.set("recognizedText", "câu nói thử bằng tiếng anh");
fd.set("durationMs", "9000");
await (await fetch("/api/shadowing/submit", { method: "POST", body: fd })).json();
await (await fetch("/api/shadowing/history?slug=<slug>")).json();
```

---

## 7. Prompt mẫu cho AI khác

> Đọc `SHADOWING_IMPLEMENTATION.md` và `SHADOWING_FEATURE_SPEC.md`. Thêm các video YouTube sau vào trang Shadowing: `<link 1>`, `<link 2>`… Dùng logic của action `create` trong `src/app/api/admin/shadowing/route.ts` (script tạm trong `scripts/`, chạy bằng `npx tsx --conditions=react-server`, xoá sau khi chạy). Với mỗi video: rà lại transcript (dấu câu, tên riêng, mỗi câu một dòng), gọi lại `deriveContent` sau khi sửa, kiểm tra không câu nào có `start ≥ end`, đặt `level` phù hợp và để `DRAFT` cho tôi duyệt. Không tải video về, không sửa schema, không đụng phần shadowing trong lesson.
