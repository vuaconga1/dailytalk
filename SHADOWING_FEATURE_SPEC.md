# Đặc tả tính năng Shadowing (WEWIN IELTS)

Tài liệu bàn giao để dựng lại tính năng **Shadowing** (nghe câu mẫu → nhại lại → máy nhận diện giọng nói → chấm mức khớp nội dung) trên một web khác. Mô tả đúng như bản đang chạy tại `https://ielts.wewin.edu.vn/learn/shadowing/<slug>`.

> Stack gốc: Next.js (App Router) + React + Tailwind + Prisma/Postgres + Cloudflare R2. Không bắt buộc dùng lại stack này; các phần thuật toán và luồng xử lý độc lập framework.

---

## 1. Tóm tắt

| Hạng mục | Cách làm hiện tại |
|---|---|
| Speech-to-text | **Web Speech API của trình duyệt** (`SpeechRecognition` / `webkitSpeechRecognition`), `lang = "en-US"`. Không gọi API AI trả phí. |
| Ghi âm | `MediaRecorder` + `getUserMedia` (echoCancellation, noiseSuppression). |
| Chấm điểm | **Thuật toán cục bộ, không AI**: căn từ bằng Levenshtein theo từ → WER → `score = max(0, 100 × (1 − WER))`. |
| Ý nghĩa điểm | Mức **khớp nội dung** giữa câu mẫu và cái máy nghe được. **Không phải điểm phát âm.** |
| Thời điểm từng câu/từ | Forced alignment offline (stable-ts / Whisper chạy local, miễn phí) → lưu JSON `cues`. Không có thì ước lượng theo độ dài chữ. |
| IPA | Sinh từ CMUdict (local, miễn phí). Bản dịch tiếng Việt nhập tay qua admin/script. |
| Lưu bản ghi | Bucket private (R2/S3), stream qua API có kiểm quyền, tự xoá sau **18 ngày**. |

---

## 2. Mô hình dữ liệu

### 2.1 `ShadowingExercise` (bài luyện)

| Field | Kiểu | Ghi chú |
|---|---|---|
| `id` | string (cuid) | |
| `slug` | string unique | Sinh từ title (bỏ dấu, `a-z0-9-`, tối đa 64 ký tự, thêm `-2`, `-3`… nếu trùng). |
| `title` | string | |
| `level` | string? | VD `B1`, `B2`… dùng để lọc catalog theo level. |
| `instructions` | text? | |
| `audioUrl` | string | Audio mẫu (CDN). Nếu có video thì đây là track audio tách từ video. |
| `videoUrl` | string? | Video mẫu (tuỳ chọn). Có video → player hiển thị video + phụ đề karaoke. |
| `transcript` | text | Văn bản mẫu. Mỗi dòng có thể có nhãn người nói `A:`, `Man:`… |
| `cues` | JSON? | Timing từng câu/từ (xem 2.3). |
| `annotations` | JSON? | IPA + bản dịch từng câu (xem 2.4). |
| `maxRecordSeconds` | int, mặc định 30 | Clamp trong [5, 300]. Dùng cho chế độ đọc cả bài. |
| `status` | `PUBLISHED` / `DRAFT` / `ARCHIVED` | Chỉ `PUBLISHED` hiện cho học viên. |
| `order` | int | Thứ tự trong catalog. |

Index: `(status, order)`.

### 2.2 `ShadowingAttempt` (một lần nộp bài – chỉ ở chế độ **đọc cả bài**)

| Field | Ghi chú |
|---|---|
| `userId`, `exerciseId` | Cascade delete. |
| `sttProvider` | Chuỗi định danh engine, hiện chỉ chấp nhận `"web-speech"` (whitelist ở server). |
| `recognizedText` | Text cuối cùng server dùng để chấm (đã chọn alternative tốt nhất), tối đa 5000 ký tự. |
| `normalizedText` | Các token đã chuẩn hoá, nối bằng dấu cách. |
| `score` (0–100), `wer` (float) | |
| `totalWords`, `correctCount`, `substitutionCount`, `deletionCount`, `insertionCount` | |
| `wordResults` (JSON) | Mảng kết quả căn từ (xem 4.4). |
| `errorSummary` (JSON) | `{ missing: string[], incorrect: {expected, actual}[], extra: string[] }`. |
| `recordingKey`, `recordingMime`, `recordingMs`, `recordingExpiresAt` | Bản ghi private; `recordingKey = null` sau khi đã purge. |
| `createdAt` | |

Index: `(userId, exerciseId, createdAt)`, `(exerciseId, createdAt)`, `(recordingExpiresAt)`.

### 2.3 Định dạng `cues`

```json
{
  "version": 2,
  "aligner": "stable-ts",
  "audioUrl": "<đúng audioUrl lúc align>",
  "lines": [
    {
      "text": "<đúng câu thứ i của transcriptLines(transcript)>",
      "start": 0.12, "end": 3.85,
      "words": [{ "w": "Hello", "s": 0.12, "e": 0.48 }]
    }
  ]
}
```

**Quy tắc hợp lệ** (nếu sai bất kỳ điều nào → coi như không có cues, client tự ước lượng):
- `version` là 1 hoặc 2; `audioUrl` phải **trùng** audioUrl hiện tại của bài.
- Số câu trong `lines` phải **bằng** số câu của `transcriptLines(transcript)`, và `lines[i].text` phải **trùng chính xác** câu thứ i.
- `start`, `end` là số hữu hạn ≥ 0; `end = max(start, end)`.
- `words` (chỉ v2) lọc bỏ phần tử sai kiểu; nếu trống → ước lượng word timing (4.6).

→ Sửa transcript hoặc đổi audio sẽ tự vô hiệu cues cũ, tránh lệch karaoke.

### 2.4 Định dạng `annotations`

```json
{ "version": 1, "lines": [{ "text": "<câu>", "ipa": "/.../", "translation": "Bản dịch" }] }
```

- Ghép với câu transcript theo **key không phân biệt hoa thường/dấu câu**: `text.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, " ").trim()`. Nhờ vậy sửa nhẹ ở câu khác không làm mất annotation.
- Mỗi field tối đa 1000 ký tự; dòng không có cả ipa lẫn translation thì bỏ.
- Trả về client dạng mảng `{ ipa: string|null, translation: string|null }[]` song song với các câu; `null` nếu không câu nào có dữ liệu.

---

## 3. Tách transcript thành câu (`transcriptLines`)

Dùng ở **cả client lẫn server lẫn script align**, nên phải là một hàm dùng chung, kết quả xác định.

1. Tách theo xuống dòng, trim, bỏ dòng trống.
2. Mỗi dòng: nếu bắt đầu bằng nhãn người nói khớp regex
   `^([A-Z][A-Za-z.'’]*(?: [A-Z][A-Za-z.'’]*){0,2}):\s+` (VD `A:`, `Man:`, `Sales Associate:`) → tách `speaker`, phần còn lại là body.
3. Tách body thành câu bằng regex `[^.!?]+(?:[.!?]+["'”’]?|$)`.
4. Gộp lại nếu câu trước kết thúc bằng từ viết tắt: `Mr. Mrs. Ms. Dr. Prof. Sr. Jr. vs. etc. e.g. i.e.` (không phân biệt hoa thường).
5. `speaker` chỉ gắn cho câu đầu tiên của dòng.

Kết quả: `{ speaker: string|null, text: string }[]`.

`spokenText(transcript)` = nối các `text` bằng dấu cách (**không bao gồm nhãn người nói** – người học không đọc nhãn).

---

## 4. Thuật toán chấm điểm (không AI)

### 4.1 Tokenize & chuẩn hoá

```
tokenize(text):
  text.normalize("NFKC")
  → split theo khoảng trắng → tách tiếp theo dấu gạch [-–—]+
  → mỗi token: { raw, norm = normalizeWord(raw) } → bỏ token có norm rỗng

normalizeWord(raw):
  NFKC → lowercase → thay ’ ‘ ` ´ bằng '
  → xoá dấu câu . , ! ? : ; " ( ) [ ] { } … “ ” « »
  → bỏ ' ở đầu/cuối → canonicalizeSpelling (gộp biến thể chính tả Anh/Mỹ)
```

### 4.2 Đổi số thành chữ (`spellOutNumbers`) – áp dụng cho cả câu mẫu và text nhận dạng

- `h:mm` → `"h m"` (VD `8:30` → `8 30`, `8:00` → `8`).
- Số 1–3 chữ số → chữ (`12` → `twelve`, `145` → `one hundred forty five`). Số lớn hơn giữ nguyên.
- Lý do: recognizer hay viết `12` trong khi transcript viết `twelve`.

### 4.3 So khớp từ khoan dung cho giọng nói (`speechWordsMatch`)

Hai từ được coi là **đúng** nếu:
1. Giống hệt nhau; hoặc
2. Cùng `soundKey`:
   - bỏ dấu `'`;
   - gộp **từ đồng âm** về một key: `to/too/two`, `there/their/theyre`, `your/youre`, `its/it's`, `no/know`, `right/write`, `here/hear`, `by/buy/bye`, `for/four`, `one/won`, `weather/whether`, `where/wear`, `new/knew`, `see/sea`, `be/bee`, `our/hour`, `son/sun`, `meet/meat`, `week/weak`, `through/threw`, `eight/ate`, `whole/hole`, `piece/peace`, `wait/weight`, `would/wood`, `i/eye`, `ok/okay`, `mom/mum`, `gray/grey`, `cent/sent`, `made/maid`, `tail/tale`, `male/mail`, `allowed/aloud`, `flour/flower`, `fair/fare`, `pair/pear`, `plane/plain`, `break/brake`, `road/rode`, `steal/steel`, `dear/deer`, `night/knight`, `not/knot`, `which/witch`, `whose/whos`, `were/we're`;
   - quy chính tả Anh → Mỹ: `-our(s)`→`-or(s)` (từ ≥3 ký tự trước), `-tre(s)`→`-ter(s)`, `-is(e|es|ed|ing)`→`-iz…`, `-ll(ed|ing|er)`→`-l…`; hoặc
3. Chỉ khác đuôi `-s / -es / -d / -ed` (từ ngắn hơn ≥ 3 ký tự, từ dài = từ ngắn + đuôi); hoặc
4. Từ ngắn hơn ≥ 5 ký tự và khoảng cách Levenshtein ký tự ≤ 1 (≤ 2 nếu từ ngắn hơn ≥ 9 ký tự).

Từ ngắn như `want/went` **không** được tính là khớp.

### 4.4 Căn từ (`alignWords`) – Levenshtein theo từ

- Bảng DP `(n+1) × (m+1)`, chi phí: khớp 0, thay 1, xoá 1, chèn 1 (dùng `speechWordsMatch` để xác định khớp).
- Truy vết ngược, ưu tiên: đường chéo khớp → đường chéo thay → xoá (missing) → chèn (extra).
- Mỗi phần tử kết quả:

```ts
type WordResult =
  | { status: "correct";   expected: string; actual: string }
  | { status: "incorrect"; expected: string; actual: string; nearMiss: boolean }
  | { status: "missing";   expected: string }
  | { status: "extra";     actual: string };
```

`nearMiss = charDistance(expected, actual) ≤ max(1, floor(len(expected)/4))` (chỉ để hiển thị nhãn "gần đúng").

### 4.5 Tính điểm

```
expected = tokenize(spellOutNumbers(spokenText(transcript)))   // rỗng → lỗi EMPTY_TRANSCRIPT
actual   = tokenize(spellOutNumbers(recognized))
wordResults = alignWords(expected, actual, speechWordsMatch)
WER   = (substitution + deletion + insertion) / len(expected)
score = round(max(0, 100 × (1 − WER)))
```

Ngưỡng hiển thị: **≥ 80** xuất sắc (xanh lá), **≥ 60** khá (xanh dương ở trang kết quả, vàng ở badge câu), **< 60** cần luyện thêm.

### 4.6 Chọn phương án nhận dạng gần nhất (`pickClosestAlternatives`)

Web Speech trả về tối đa 5 phương án cho mỗi đoạn đã chốt (`segments: string[][]`). Với mỗi đoạn:

```
vocab = tập soundKey của các từ trong transcript (đã spellOutNumbers)
với mỗi alternative (tối đa 5):
  words = tokenize(spellOutNumbers(alt))
  known = số từ có soundKey ∈ vocab
  hits  = known − (len(words) − known) / 2
chọn alt có hits lớn nhất (hoà → giữ phương án đầu của recognizer)
```

Nối các alt đã chọn bằng dấu cách. Giới hạn 200 đoạn. Nếu không có segments hợp lệ → dùng `text` gốc.

> Hệ quả: điểm có xu hướng **dễ** hơn thực tế vì recognizer + bước chọn này đều nghiêng về câu mẫu. Đây là chủ đích để không phạt người học vì lỗi nhận dạng.

### 4.7 Ước lượng timing khi không có cues

- **Theo câu**: chia thời lượng audio theo trọng số `len(text) + 6` (6 = khoảng nghỉ giữa câu).
- **Theo từ** trong một câu `[start, end]`: trọng số mỗi từ = `max(2, số ký tự chữ/số)` + 2.5 nếu kết thúc bằng `.!?`, + 1.5 nếu kết thúc bằng `,;:-–—`. Mỗi từ dài tối thiểu 0.05s.
- UI hiện ghi chú: "Thời điểm từng câu được ước lượng theo độ dài, có thể lệch vài giây."

---

## 5. Speech-to-text phía trình duyệt

Interface trừu tượng để sau này thay engine mà không phải sửa UI/API:

```ts
interface SpeechRecognizerProvider {
  id: "web-speech";               // server whitelist theo id này
  isSupported(): boolean;
  start(opts: { lang: string; onText?(t: string): void; onError?(c: SpeechErrorCode): void }): {
    stop(): Promise<{ text: string; segments: string[][] }>;
    abort(): void;
  };
}
type SpeechErrorCode = "not-allowed" | "audio-capture" | "network" | "unsupported" | "other";
```

Cài đặt Web Speech:
- `continuous = true`, `interimResults = true`, `maxAlternatives = 5`, `lang = "en-US"`.
- `onresult`: gom text đã chốt (`isFinal`) + text tạm (interim) → gọi `onText(fullText)` để hiện live.
- **Tự khởi động lại**: Chrome tự kết thúc phiên sau khoảng im lặng → trong `onend`, nếu chưa bấm dừng và không có lỗi nghiêm trọng thì "commit" text hiện có rồi `start()` phiên mới.
- Lỗi `no-speech`, `aborted` → bỏ qua. `not-allowed`/`service-not-allowed`/`audio-capture`/`network` → lỗi nghiêm trọng, dừng hẳn.
- `stop()`: đặt cờ dừng, gọi `rec.stop()`, resolve khi `onend` chạy hoặc sau **timeout 3s**. Text interim còn lại được tính là một segment.
- Lưu ý: Chrome/Edge gửi audio lên server Google/Microsoft, Safari dùng dịch vụ Apple → **cần internet**; Firefox không hỗ trợ.

Kiểm tra hỗ trợ khi mount: `provider.isSupported() && navigator.mediaDevices.getUserMedia && typeof MediaRecorder !== "undefined"`. Không hỗ trợ → hiện thông báo "Khuyên dùng Chrome, Edge hoặc Safari trên máy tính".

### Ghi âm song song

- `getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })`.
- MIME ưu tiên: `audio/webm;codecs=opus` → `audio/webm` → `audio/mp4` → `audio/ogg` (cái đầu tiên `MediaRecorder.isTypeSupported`). Đuôi file: mp4→`m4a`, ogg→`ogg`, còn lại `webm`.
- `recorder.start(250)` (chunk 250ms). Đồng hồ cập nhật mỗi 200ms; quá giới hạn thì tự dừng.
- Khi dừng: chờ `recorder.onstop` **và** `speech.stop()`, sau đó tắt mọi track mic, tạo Blob + `URL.createObjectURL` để nghe lại. Thu hồi object URL khi thay bản ghi / unmount.

---

## 6. Hai chế độ luyện

Mặc định là **Luyện từng câu** nếu bài có video **hoặc** ≥ 4 câu; ngược lại là **Đọc cả bài**. Người dùng chuyển qua lại bằng segmented control; chuyển chế độ sẽ dừng ghi âm đang chạy và tắt auto-shadow.

### 6.1 Luyện từng câu (chấm hoàn toàn trên client, không gửi server)

State machine: `idle → starting → recording → processing → idle`.

1. Người dùng chọn câu (click thẻ câu / ←→ / nút câu trước-sau). Audio mẫu tua tới `cue.start`.
2. Bấm "Nghe câu mẫu" (hoặc phím **R**): phát từ `cue.start` và **tự dừng ở `cue.end`**.
3. Bấm micro (hoặc phím **M**): bắt đầu ghi + nhận dạng. Audio mẫu bị pause.
   - Giới hạn thời gian câu: `maxSec = max(4, round(cueDuration × 2 + 2))` (không có cue thì coi cue dài 3s).
4. Dừng (bấm nút đỏ / hết giờ / lỗi nghiêm trọng) → `pickClosestAlternatives(câu, segments)` → `gradeShadowing(câu, text)` → hiện kết quả ngay.
5. Lưu điểm câu vào `localStorage["wewin_shadowing_progress_<slug>"] = { [index]: score }` để lần sau mở lại vẫn thấy badge điểm (chỉ điểm, không có chi tiết từ).

**Auto-shadow** (nút "Shadow tự động"):
- Bật → phát câu hiện tại.
- Câu mẫu phát xong (dừng ở `cue.end` hoặc audio `ended`) → sau **250ms** tự bắt đầu ghi âm câu đó.
- Ghi xong và chấm xong → sau **1200ms** chuyển sang câu tiếp theo và phát. Câu cuối → tự tắt auto-shadow.
- Tắt giữa chừng → huỷ timer, dừng ghi nếu đang ghi. Lỗi mic → tự tắt.

### 6.2 Đọc cả bài (chấm & lưu trên server)

State machine: `idle → starting → recording → processing → recorded → submitting → (kết quả) | recorded (nếu lỗi)`.

1. Bấm micro → ghi toàn bài, giới hạn `maxRecordSeconds`.
2. Dừng → hiện: trình phát bản ghi, "Văn bản hệ thống nghe được", số từ.
   - Không nghe được gì → cảnh báo vàng, nút nộp bị disable.
3. "Ghi âm lại" → về `idle`. "Nộp bài" → gửi `multipart/form-data` lên API (mục 7).
4. Thành công → thay khu ghi âm bằng **thẻ kết quả**, tăng `refreshKey` để reload lịch sử.
5. 401 → hiện link "Đăng nhập ngay" với `?next=<trang hiện tại>`. Lỗi khác → map `code` sang thông báo i18n `errors.<CODE>`.

---

## 7. API

Tất cả trả JSON lỗi dạng `{ error: string, code: string }`. Map status:
`UNAUTHORIZED 401`, `FORBIDDEN 403`, `NOT_FOUND 404`, `RECORDING_GONE 410`, `NO_SPEECH 422`, `DB_UNAVAILABLE 503`, mã khác 400, lỗi không xác định 500 (`code: "SERVER"`).

### 7.1 `POST /api/shadowing/:slug/submit` (cần đăng nhập, tài khoản còn hạn)

Form fields:

| Field | Bắt buộc | Ghi chú |
|---|---|---|
| `recognizedText` | ✔ | Text nhận dạng gốc. |
| `sttProvider` | ✔ | Phải nằm trong whitelist (`web-speech`). |
| `alternatives` | | JSON `string[][]`, ≤ 50 000 ký tự; parse lỗi → bỏ qua. |
| `recording` | | File ≤ **4 MB**. Server **dò magic bytes**, không tin MIME client: WebM `1A 45 DF A3`, Ogg `OggS`, MP4 `ftyp` ở byte 4–8, WAV `RIFF....WAVE`. Không khớp → 400 `UNSUPPORTED_RECORDING`. |
| `durationMs` | | Số dương, làm tròn. |

Xử lý server:
1. Tìm bài `PUBLISHED` theo slug, kiểm tra provider.
2. **Chấm lại trên server** (không tin điểm client): `pickClosestAlternatives(transcript, alternatives) ?? recognizedText` → trim, cắt 5000 ký tự → rỗng thì 422 `NO_SPEECH` → `gradeShadowing`.
3. Lưu bản ghi vào storage private với key `private/shadowing-recordings/<attemptId>.<ext>`, `CacheControl: private, no-store`.
4. Tạo attempt, `recordingExpiresAt = now + 18 ngày`. Nếu insert DB lỗi → xoá file vừa upload.
5. Kích hoạt purge bản ghi hết hạn (throttle 10 phút/instance, mỗi lần tối đa 50 bản).
6. Trả `ShadowingAttemptResult` với header `Cache-Control: private, no-store`.

Response:

```ts
{
  attemptId, sttProvider, recognizedText, transcript, createdAt,
  score, wer, totalWords, correctCount, substitutionCount, deletionCount, insertionCount,
  normalizedText, wordResults, errorSummary,
  recordingUrl: string | null,        // "/api/shadowing/attempts/<id>/recording" nếu còn hạn
  recordingExpiresAt: string | null
}
```

### 7.2 `GET /api/shadowing/:slug/history`
→ `{ signedIn: boolean, items: { attemptId, score, correctCount, totalWords, createdAt, hasRecording }[] }`, 30 lần gần nhất của user hiện tại, mới nhất trước. Chưa đăng nhập → `signedIn: false`.

### 7.3 `GET /api/shadowing/attempts/:attemptId`
→ `ShadowingAttemptResult`. Chỉ **chủ attempt** hoặc **ADMIN/TEACHER** được xem.

### 7.4 `GET /api/shadowing/attempts/:attemptId/recording`
Stream file bản ghi (cùng quyền như 7.3). Header: `Content-Type` theo mime đã lưu, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`. Hết hạn/đã xoá → 410 `RECORDING_GONE`. **Không bao giờ** trả URL public của bucket.

### 7.5 Admin
- CRUD bài: `GET/POST /api/admin/shadowing`, `GET/PUT/DELETE /api/admin/shadowing/:id`. Xoá bài → xoá luôn các file bản ghi liên quan.
- Upload audio/video: `POST /api/admin/shadowing/audio`.
- Sinh IPA: `POST /api/admin/shadowing/ipa` body `{ sentences: string[] }` (≤ 500 câu, mỗi câu ≤ 500 ký tự) → `{ ipa: string[] }`. Tra CMUdict (Arpabet → IPA, trọng âm 1→`ˈ`, 2→`ˌ`, `AH0`→`ə`, `ER0`→`ɚ`), chạy **chỉ ở server** vì từ điển nặng ~3–4 MB.
- Admin xem 100 attempt gần nhất của một bài, kèm tên học viên, text nhận dạng, link bản ghi.
- Mọi thay đổi bài → xoá cache catalog/trang bài.

### 7.6 Trang học viên (SSR/ISR)
- `/learn/shadowing` (catalog), `/learn/shadowing/level/:level`, `/learn/shadowing/:slug`. Revalidate 300s.
- Dữ liệu trang chi tiết là `PublicShadowingExercise`: `id, slug, title, level, instructions, audioUrl, videoUrl, maxRecordSeconds, transcript, cues (đã validate → CueTiming[] | null), annotations (LineAnnotation[] | null)`. URL media đã chuyển sang CDN.

---

## 8. Giao diện

### 8.1 Bố cục

Desktop (≥ `xl`): lưới 12 cột. Mobile: xếp chồng 1 cột, thanh điều khiển transcript **cố định ở đáy màn hình** (có `safe-area-inset-bottom`), nội dung chừa `padding-bottom` để không bị che.

```
┌──────────────────────────── 7 cột ────────────────────────────┐┌────────── 5 cột (sticky top) ──────────┐
│ [1] PLAYER MẪU (audio hoặc video)                              ││ [4] TRANSCRIPT                          │
│   tiêu đề + badge level                                        ││  header: "Transcript" · N câu · M từ    │
│   video 16:9 + phụ đề karaoke đè lên / khung phụ đề karaoke    ││   [IPA ON/OFF] [Dịch ON/OFF] [A- sm A+]  │
│   thanh tua · thời gian                                        ││  thanh tiến độ: "Đã luyện x/N · TB y%" │
│   [-5s] [▶] [+5s]   [0.5x 0.75x 1x 1.25x] [CC] [🔊]           ││    → "Luyện câu < 60 điểm"              │
├────────────────────────────────────────────────────────────────┤│  danh sách thẻ câu (cuộn, tự cuộn tới   │
│ [2] [Luyện từng câu | Đọc cả bài]          [✨ Shadow tự động] ││  câu đang chọn):                        │
├────────────────────────────────────────────────────────────────┤│   01 [Speaker:] câu (karaoke nếu active) │
│ [3] STUDIO GHI ÂM (theo chế độ)                                ││      IPA (mono, xám)                    │
│   header: icon mic · tiêu đề · "Câu i / N" hoặc "Tối đa mm:ss"  ││      bản dịch (nghiêng) / "Xem nghĩa"   │
│   ...nội dung theo trạng thái (8.3)...                         ││      [chi tiết chấm câu + bản ghi]  85% │
│                                                                ││  thanh điều khiển:                      │
│                                                                ││   [↻ Nghe lại] [‹] (▶) [›] [🎤 Ghi âm]  │
│                                                                ││   "Câu i / N · Space · ←/→ · R · M"     │
└────────────────────────────────────────────────────────────────┘└─────────────────────────────────────────┘
┌──────────────────────────────────── 12 cột ────────────────────────────────────────────────────────────┐
│ [5] LỊCH SỬ LÀM BÀI (thu gọn mặc định) · badge "n lần" · 🏆 điểm cao nhất                               │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Toàn trang chỉ dùng **một phần tử media mẫu duy nhất** (audio hoặc video); player, karaoke, transcript và điều khiển câu đều dùng chung `ref` tới phần tử đó.

### 8.2 Player mẫu
- Tốc độ: 0.5x / 0.75x / 1x / 1.25x. Tua ±5s. Thanh tua dạng range, tô màu phần đã phát. Âm lượng hiện slider khi hover.
- Có video: `<video playsInline>` 16:9, click để play/pause, phụ đề câu hiện tại đè dưới đáy (nền đen 75%). Không video: khung "Phụ đề Karaoke" phía trên thanh tua.
- Nút CC bật/tắt phụ đề.

### 8.3 Studio – các trạng thái

**Luyện từng câu**
- *Chưa ghi*: thẻ câu hiện tại (số thứ tự, speaker, câu karaoke cỡ lớn, IPA, bản dịch) + nút micro tròn 80px, chữ "Bấm micro để bắt đầu nói", gợi ý "Nên đeo tai nghe để tránh tiếng loa lọt vào micro."
- *Đang ghi / xử lý*: nút dừng tròn đỏ 64px (spinner khi xử lý), đồng hồ `mm:ss / mm:ss`, dòng trạng thái, 10 vạch sóng âm động, khung "Hệ thống đang nghe bạn đọc:" hiển thị text live.
- *Đã chấm*: badge `xx%` + nhận xét (Rất tốt / Khá tốt / Cần luyện thêm) + số từ; khung **đối chiếu từ** (8.5); trình phát giọng mình; nút [Ghi âm lại] [Nghe câu mẫu] [Câu tiếp theo →].

**Đọc cả bài**
- *Idle*: nút micro lớn. *Đang ghi*: như trên, kèm badge "Đang thu…". *Đã ghi*: badge "Đã ghi âm xong", trình phát bản ghi, text nhận dạng + số từ, nút [Ghi âm lại] [Nộp bài & xem điểm]. *Có kết quả*: thay bằng thẻ kết quả (8.4).

Lỗi hiển thị trong hộp đỏ dưới studio; 401 kèm link đăng nhập.

### 8.4 Thẻ kết quả (cả bài & xem lại trong lịch sử)
1. Tiêu đề + nhận xét theo ngưỡng điểm; ô điểm lớn `xx/100`.
2. Lưới 4 ô: Từ đúng `a/b`, Sai khác, Bỏ sót, Đọc thừa.
3. Ghi chú bắt buộc: *"Điểm này cho biết phần hệ thống nhận diện được khớp với câu mẫu bao nhiêu, không phải điểm phát âm."*
4. Đối chiếu từ (8.5).
5. "Hệ thống nghe được": text nhận dạng.
6. So sánh âm thanh 2 cột: audio mẫu | bản ghi của bạn (+ "Bản ghi được lưu đến <ngày>" hoặc "Bản ghi đã hết hạn lưu trữ").
7. Nút "Luyện lại bài này".

### 8.5 Đối chiếu từ (aligned transcript)
Hiển thị **câu mẫu** từng từ, tô theo trạng thái, có chú giải màu:
- Đúng: nền xanh lá nhạt, chữ xanh lá.
- Sai: nền đỏ nhạt; từ mẫu ở trên, bên dưới là từ máy nghe được gạch ngang (+ "(gần đúng)" nếu `nearMiss`); tooltip "Hệ thống nghe: <từ>".
- Thiếu: nền cam nhạt, gạch chân chấm.
- Thừa: chữ xám gạch ngang.
- Chặn copy/select khối này.

### 8.6 Karaoke
- Trong câu đang active: từ **đang phát** được tô nền đậm + phóng nhẹ; từ **đã qua** đậm màu; từ **chưa tới** xám.
- Cập nhật bằng `requestAnimationFrame` trong lúc phát (không chỉ `timeupdate`) cho mượt.
- Câu được coi là active khi đang phát hoặc `currentTime ∈ [start − 0.25s, end + 0.35s]`.
- Click một từ → tua tới `word.s` và phát.
- Ghép token hiển thị với `words` của cue: số lượng bằng nhau thì ghép 1-1; khác thì ghép theo text đã bỏ dấu câu, cho phép nhìn trước 1 từ.
- Ba biến thể màu: `hero` (studio), `card` (transcript), `video` (phụ đề trên video).

### 8.7 Transcript
- Click thẻ câu → chọn câu và tua audio tới đầu câu (bị khoá khi đang ghi).
- Câu active: viền + nền xanh nhạt, số thứ tự nền đậm, hiển thị karaoke và chi tiết chấm câu.
- Badge điểm bên phải mỗi câu đã luyện (màu theo ngưỡng).
- Bật/tắt IPA và Dịch được nhớ trong `localStorage` (`wewin_shadowing_show_ipa`, `wewin_shadowing_show_translation`). Khi tắt Dịch, mỗi câu vẫn có link "Xem nghĩa" để mở riêng.
- Cỡ chữ 3 mức `sm / base / lg`.
- Danh sách cao tối đa `100vh − 320px`, tự cuộn để câu active nằm khoảng 1/3 phía trên.
- Khi đang phát tự do, câu active tự cập nhật theo `currentTime` (cộng 0.05s bù sai số khi tua).

### 8.8 Phím tắt (bị tắt khi focus vào input/textarea/select/button/link, hoặc khi giữ Ctrl/Cmd/Alt, hoặc khi đang ghi)
`Space` phát/dừng · `←/→` câu trước/sau · `R` nghe lại câu · `M` bật/tắt ghi âm.

### 8.9 Lịch sử
Thu gọn mặc định. Mở ra: danh sách "Lần n" + ngày giờ + badge "Audio" nếu còn bản ghi + điểm `xx/100` + `a/b từ` + nút "Xem lại" (tải chi tiết attempt và hiển thị thẻ kết quả ngay dưới). Chưa đăng nhập → lời mời đăng nhập. Chưa có lần nào → empty state.

### 8.10 Nguyên tắc chung
- Responsive: không tràn ngang (`min-w-0`, `break-words`), vùng chạm ≥ 44px.
- Toàn bộ chữ giao diện qua i18n (vi mặc định, en). **Không dịch** nội dung transcript.
- Không hiển thị enum kỹ thuật hay key i18n thô cho học viên.

---

## 9. Quy trình nội dung (offline, miễn phí)

1. Admin tạo bài: title, level, audio/video, transcript (mỗi lượt thoại một dòng, có thể có `Speaker:`), maxRecordSeconds, status, order.
2. **Tạo cues** (khuyến nghị, cho karaoke và cắt câu chính xác): chạy forced alignment local
   - Giải mã audio → mono 16 kHz bằng ffmpeg.
   - `stable-ts` align transcript (mỗi câu một dòng, `original_split=True`) với model Whisper `base.en` (CPU). Nếu có câu không lấy được timing thì chạy lại bằng engine còn lại (`whisper` ↔ `faster-whisper`), chọn kết quả ít câu thiếu hơn.
   - Gán từng từ vào câu theo vị trí ký tự; câu thiếu timing thì nối từ `end` của câu trước.
   - Nới mỗi câu `−0.15s` ở đầu và `+0.25s` ở cuối (không chồng sang câu kề) để phát lại không cụt âm đầu/cuối.
   - Lưu theo định dạng 2.3 kèm `audioUrl` đã align.
3. **IPA**: tự sinh bằng CMUdict (nút trong admin hoặc script). **Bản dịch**: nhập tay hoặc import JSON.
4. Mỗi lần sửa transcript/audio → cần align lại (cues cũ tự bị vô hiệu).

---

## 10. Bảo mật & quyền riêng tư

- Nộp bài bắt buộc đăng nhập; tài khoản hết hạn bị chặn.
- Server **luôn chấm lại**, không tin điểm từ client; whitelist `sttProvider`; giới hạn kích thước text/alternatives/file.
- Bản ghi giọng nói là dữ liệu cá nhân: bucket private, truy cập qua API kiểm quyền (chủ sở hữu hoặc giáo viên/admin), `no-store`, tự xoá sau 18 ngày, file bị xoá theo khi xoá bài. (Xoá user hiện chỉ cascade bản ghi DB; file còn lại sẽ không truy cập được và nên được dọn bằng job riêng khi làm lại.)
- Lưu ý pháp lý: Web Speech gửi audio cho hãng trình duyệt xử lý. Nếu cần cam kết dữ liệu không rời hệ thống thì phải thay bằng STT tự host.

---

## 11. Hạn chế đã biết & gợi ý khi làm lại

1. **Web Speech được đánh dấu "chỉ để test"**: không chạy trên Firefox, cần mạng, độ chính xác tuỳ trình duyệt, recognizer tự "sửa" theo ngữ cảnh → điểm dễ hơn thực tế. Interface provider đã tách sẵn để thay bằng engine khác (VD Whisper tự host, Vosk, Azure Pronunciation Assessment…). Engine trả phí cần được duyệt chi phí trước.
2. **Điểm không phải điểm phát âm**: chỉ đo mức khớp chữ. Muốn chấm phát âm/ngữ điệu thật cần engine pronunciation assessment (cấp âm vị).
3. **Chế độ từng câu không lưu server**: chỉ lưu điểm vào localStorage của trình duyệt (mất khi đổi máy, không có chi tiết từ khi tải lại). Nếu cần theo dõi tiến độ thì nên thêm API lưu điểm theo câu.
4. Nút nộp bài đang ghi "Nộp bài & Xem điểm AI" nhưng thực tế **không dùng AI**. Nên đổi nhãn khi làm lại để tránh hiểu nhầm.
5. Một vài chuỗi còn hardcode thay vì i18n (thông báo trình duyệt không hỗ trợ, "Chưa phát hiện giọng nói rõ ràng", nhãn "Audio", đơn vị "từ" trong ô Từ đúng).
6. UI hiện dùng một số màu tím/indigo; khi làm lại nên theo bảng màu thương hiệu của web đích.

---

## 12. Checklist nghiệm thu

- [ ] Tách câu đúng với dialogue (`A: ... B: ...`), viết tắt `Mr.`/`Dr.` không bị cắt câu.
- [ ] Không có cues: vẫn chuyển câu/nghe lại được (timing ước lượng) và hiện ghi chú "ước lượng".
- [ ] Có cues: "Nghe lại câu" dừng đúng cuối câu; karaoke chạy mượt; click từ thì tua đúng.
- [ ] Sửa transcript sau khi align → karaoke tự về chế độ ước lượng, không lệch.
- [ ] Ghi âm dài vẫn liên tục (Chrome tự ngắt sau im lặng → tự nối phiên).
- [ ] Từ chối quyền mic / không có mic / mất mạng → thông báo đúng, nút về trạng thái idle, auto-shadow tự tắt.
- [ ] Auto-shadow: phát → ghi → chấm → câu tiếp, dừng ở câu cuối, tắt được giữa chừng.
- [ ] Chấm điểm: đồng âm (`their/there`), số (`12` ↔ `twelve`, `8:30`), chính tả Anh/Mỹ (`colour/color`), đuôi `-s/-ed` đều tính đúng; `want/went` tính sai.
- [ ] Nộp bài khi chưa đăng nhập → 401 + link đăng nhập quay lại đúng trang.
- [ ] File giả MIME (đổi đuôi) bị từ chối; file > 4 MB bị từ chối.
- [ ] User khác không mở được attempt/bản ghi của người khác; giáo viên/admin mở được.
- [ ] Bản ghi quá 18 ngày bị xoá, kết quả hiện "đã hết hạn lưu trữ".
- [ ] Mobile: thanh điều khiển cố định đáy không che nội dung, không tràn ngang.
- [ ] Phím tắt không kích hoạt khi đang gõ trong ô input.

---

## Phụ lục: file nguồn tham chiếu (repo WEWIN)

| Phần | File |
|---|---|
| Trang | `src/app/learn/shadowing/[slug]/page.tsx` |
| Component chính / state machine | `src/components/shadowing/shadowing-practice.tsx` |
| Transcript + điều khiển câu | `shadowing-transcript.tsx`, `use-sentence-playback.ts`, `shadowing-control-bar.tsx` |
| Player / karaoke / kết quả / lịch sử | `shadowing-audio-player.tsx`, `shadowing-karaoke-line.tsx`, `shadowing-result.tsx`, `shadowing-history.tsx` |
| Đối chiếu từ | `src/components/dictation/dictation-result.tsx` (`AlignedTranscript`) |
| STT | `src/lib/shadowing/stt/client.ts` |
| Chấm điểm | `src/lib/shadowing/scoring.ts`, `src/lib/dictation/scoring.ts` |
| Tách câu / cues / annotation / IPA | `src/lib/shadowing/transcript.ts`, `cues.ts`, `annotations.ts`, `ipa.ts` |
| Nghiệp vụ server / lưu bản ghi | `src/lib/shadowing/store.ts`, `recording-storage.ts`, `http.ts` |
| API | `src/app/api/shadowing/**`, `src/app/api/admin/shadowing/**` |
| Schema | `prisma/schema.prisma` (`ShadowingExercise`, `ShadowingAttempt`) |
| Align offline | `scripts/shadowing-cues.ts`, `scripts/align-shadowing.py`, `scripts/shadowing-annotations.ts` |
