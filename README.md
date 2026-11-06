# WeWIN Daily Speaking

15 phút tiếng Anh mỗi ngày: từ vựng & mẫu câu → nghe & shadowing → hội thoại 3 phút với AI Coach → tổng kết.

Stack: Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Prisma 7 + Neon Postgres · OpenAI (tuỳ chọn).

## Chạy local

Yêu cầu Node.js 20+ và một database Neon (https://console.neon.tech).

```bash
npm install
cp .env.example .env        # điền DATABASE_URL, SESSION_SECRET
npm run db:push             # tạo bảng trên Neon
npm run seed:demo           # tạo học viên mẫu (tuỳ chọn)
npm run dev
```

Mở http://localhost:3000. Bấm **Trải nghiệm demo không cần đăng ký** để có hồ sơ thử riêng, hoặc tạo tài khoản bằng email/mật khẩu.

## Chế độ AI

`AI_MODE="demo"` (mặc định) không gửi yêu cầu nào đến dịch vụ AI và không phát sinh phí:
- Kế hoạch chọn bài theo quy tắc, không giả là AI đã lập kế hoạch.
- Audio dùng giọng English có sẵn của trình duyệt.
- Hội thoại theo kịch bản minh hoạ; nút Ghi âm dùng nhận dạng giọng nói của trình duyệt (Chrome/Edge).

`AI_MODE="openai"` cần `OPENAI_API_KEY` và đủ ba model `OPENAI_TEXT_MODEL`, `OPENAI_TRANSCRIBE_MODEL`, `OPENAI_TTS_MODEL`. Mỗi lần gọi AI được ghi trước vào bảng `Usage`, giới hạn bởi `MAX_PROVIDER_CALLS_PER_USER_DAY` (mặc định 90) và tối đa 3 lần tạo kế hoạch mỗi ngày. Audio TTS được lưu vào bảng `AudioClip` và dùng chung.

## Tài khoản mẫu

`npm run seed:demo` tạo (hoặc làm mới) học viên **Nguyễn Minh Anh**, chuyên viên kinh doanh ngành logistics:
- `minhanh.nguyen@wewin.edu.vn` / `WeWIN2026` và `demo@wewin.edu.vn` / `123` (cùng dữ liệu).
- Lộ trình 30 buổi; 12 buổi đã hoàn thành kèm hội thoại và tổng kết; chuỗi 9 ngày liên tiếp.
- Buổi 13 ("Give a progress update") để trống, sẵn sàng trình diễn trực tiếp.

Ngày học tính lùi từ hôm nay, nên chạy lại lệnh trước mỗi buổi demo. Tạo tài khoản riêng: `npm run seed:demo -- --email x@y.z --password secret123`.

## Vận hành: kích hoạt, nhắc học, theo dõi

Luồng học viên: đăng ký → điền hồ sơ học tập → xác nhận hồ sơ → xem phân loại và lộ trình tham khảo 30 ngày → **học thử 1 buổi** (trạng thái `LEAD`) → chuyên viên tư vấn, nhận thanh toán ngoài hệ thống và bấm **Kích hoạt** trong `/admin` → học 30 ngày (`ACTIVE`, hết hạn tự chuyển `EXPIRED`).

Vai trò (`User.role`): `LEARNER`, `CONSULTANT` (kích hoạt, chăm sóc), `ACADEMIC` (ngân hàng bài, audio), `ADMIN` (toàn quyền, tạo nhân sự). Tạo admin đầu tiên:

```bash
ADMIN_EMAIL=admin@wewin.edu.vn ADMIN_PASSWORD=... npm run seed:admin
```

**Hồ sơ học tập.** Form 8 trường: ngành nghề (+ khác), vị trí công việc theo ngành (+ khác), đối tượng giao tiếp, mục tiêu (chọn nhiều), trình độ tự đánh giá, tần suất dùng tiếng Anh. Danh sách lựa chọn nằm ở `src/domain/profile-options.ts`: 30 ngành và vị trí theo danh sách chính thức của WeWIN; đối tượng giao tiếp, mục tiêu, trình độ, tần suất **vẫn là danh sách tạm**. Không có bài đánh giá đầu vào: `src/domain/classify.ts` xác định trình độ (trình độ tự chọn, hạ 1 bậc nếu hầu như không dùng tiếng Anh) và 3 kỹ năng ưu tiên kèm giải thích tiếng Việt. Học viên có hồ sơ kiểu cũ được chuyển về form; điền lại sẽ xoá các buổi đã học.

**Giáo trình 30 ngày soạn sẵn.** `src/domain/curriculum/` chứa logic ghép lộ trình; dữ liệu 14 nhóm nghề có cách giao tiếp giống nhau nằm ở `src/data/curriculum/*.ts` (, mỗi nhóm 30 bài đầy đủ: tình huống, từ vựng, mẫu câu, hội thoại shadowing, role-play). `members.ts` gán từng vị trí trong 30 ngành vào một nhóm, kèm chức danh tiếng Anh và vài từ thay thế (ví dụ `{doc}` = "the tax return" cho kế toán thuế). Mẫu câu dùng chung; chỗ trống `{person}`, `{job}`, `{doc}`… được điền theo vị trí và **đối tượng giao tiếp** học viên chọn (khách hàng / đối tác / cấp trên / đồng nghiệp đổi người đối thoại trong bài). Chọn "Nhà tuyển dụng" thì ngày 26–27 thành chuyên đề phỏng vấn; chọn "đi công tác / du lịch" thì ngày 19–20 thành chuyên đề công tác (`modules.ts`). Sau khi sửa nội dung, chạy `npm run check:curriculum` để kiểm tra cấu trúc, chỗ trống chưa điền và độ phủ vị trí.

**Cấu trúc một bài.** Mỗi ngày có đúng 5 từ mới (IPA giọng Mỹ, loại từ, nghĩa; không lặp lại trong cùng nhóm nghề) và đúng 4 mẫu câu (nghĩa, cấu trúc, cách dùng). Hội thoại shadowing có 8 câu; 4 câu của người học dùng đủ 4 mẫu câu và cả 5 từ. Trong hội thoại AI, danh sách 4 mẫu câu tự đánh dấu khi học viên đã nói; AI dẫn dắt để học viên dùng các mẫu còn thiếu, và tổng kết lưu `frames_used`. Cách nhận diện mẫu câu dùng chung ở `src/domain/frames.ts`. Bước Tổng kết và trang Nhật ký có **tổng kết tuần** (buổi 1–7, 8–14, …, 29–30: số buổi, từ vựng, mẫu câu đã dùng, lỗi lặp lại, gợi ý ôn tập), tính trong `src/domain/week.ts`.

**Lộ trình động.** Khi xác nhận hồ sơ, lộ trình 30 ngày được ghép từ giáo trình (không gọi AI); mỗi ngày lưu `ref` tới bài gốc. Khi học viên mở buổi học, hệ thống chọn giữa bài của ngày đó và bài chưa đạt gần đây (demo: quy tắc, chưa đạt → học lại 1 lần; OpenAI: AI chọn và viết trọng tâm theo lỗi thường gặp, độ khó ±1 bậc), rồi dựng bài cho học viên và lưu vào ngân hàng `LessonContent` để dùng chung. Giáo trình viết ở mức Sơ cấp; khi bật AI và trình độ làm việc khác Sơ cấp, AI viết lại bài cho trình độ đó (giữ tình huống và cấu trúc mẫu câu) và cũng lưu vào ngân hàng. Mỗi tổng kết có `level_signal` (dưới / đúng / trên trình độ); trình độ làm việc (`profile.working_level`) đổi sau 2 tín hiệu cùng chiều liên tiếp (buổi 1 chỉ cần 1). `Attempt.selectedBy`, `plannedTitle`, `focus`, `lessonKey` lưu lý do để chuyên viên xem.

**Cron.** Vercel Hobby chỉ chạy cron 1 lần/ngày, nên dùng cron ngoài (cron-job.org hoặc Upstash QStash) gọi mỗi 5–10 phút:

```
GET https://<APP_URL>/api/cron/tick
Authorization: Bearer <CRON_SECRET>
```

Mỗi lần chạy: chuyển tài khoản hết hạn sang `EXPIRED`; chuẩn bị bài trong vòng 60 phút trước giờ học; gửi nhắc Zalo từ 10 phút trước giờ học (mỗi học viên tối đa 1 tin/ngày, ghi ở bảng `Notification`); tạo tổng kết tuần trước (`WeeklyReport`, đánh dấu học viên cần hỗ trợ). Có thể chạy một phần: `?jobs=study`, `?jobs=weekly&week=2026-10-26`.

**Zalo OA.** Dùng tin tư vấn (miễn phí) của OA API v3. Học viên quan tâm OA, vào **Cài đặt → Nhắc học qua Zalo** tạo mã `WWxxxxxx` và gửi mã vào khung chat OA; webhook `POST /api/zalo/webhook` (cấu hình trên developers.zalo.me, sự kiện `follow`, `unfollow`, `user_send_text`) liên kết tài khoản. Zalo chỉ cho gửi tin tư vấn trong một khoảng thời gian sau lần tương tác cuối (`ZALO_CS_WINDOW_HOURS`, mặc định 48 giờ), nên tin nhắc mời học viên trả lời "OK"; ngoài cửa sổ, tin được ghi `SKIPPED` kèm lý do. Chưa có biến `ZALO_*` thì mọi tin chỉ được ghi log (chạy thử).

**Audio R2.** Audio shadowing tạo một lần cho mỗi câu, lưu trên Cloudflare R2 (biến `R2_*`) và trả về bằng redirect tới URL công khai; chưa cấu hình R2 thì lưu trong bảng `AudioClip`. Học thuật xem ngân hàng bài và tạo trước audio cho từng bài ở `/admin/lessons`.

## Deploy lên Vercel

1. Import repo vào Vercel (framework Next.js được nhận tự động qua `vercel.json`).
2. Environment Variables: `DATABASE_URL` (pooled URL của Neon), `SESSION_SECRET` (chuỗi ngẫu nhiên ≥16 ký tự), `AI_MODE` và các biến OpenAI nếu dùng, `APP_URL`, `CRON_SECRET`, các biến `ZALO_*` và `R2_*` (xem `.env.example`).
3. Chạy `npm run db:push` (và `npm run seed:demo` nếu cần) với `DATABASE_URL` production.
4. Gắn domain `dailytalk.wewin.edu.vn` trong Vercel → Settings → Domains.

## Cấu trúc

```
prisma/schema.prisma        User (vai trò, trạng thái gói), Attempt, Practice, Usage, AudioClip, LessonContent,
                            ZaloLink/ZaloLinkCode/ZaloToken, Notification, WeeklyReport, StaffNote
src/app/                    route Next.js (trang + API), chỉ ghép dữ liệu và gọi server/
src/components/<feature>/   UI theo tính năng (lesson, history, admin, onboarding…)
src/client/api.ts           fetch helper phía trình duyệt
src/domain/                 logic nghiệp vụ thuần, không IO, dùng được cả client và server
  types.ts                  kiểu dữ liệu chung (Lesson, Summary, LearnerProfile…)
  profile-options.ts        danh sách ngành, vị trí, đối tượng, mục tiêu, trình độ, tần suất (tạm)
  profile.ts, classify.ts   kiểm tra form hồ sơ, nhãn hiển thị · phân loại trình độ/kỹ năng
  curriculum/               gán vị trí → nhóm, ghép lộ trình, dựng bài, ngày ôn tập
  access.ts                 vai trò, quyền, học thử / kích hoạt
  content.ts                18 bài mẫu cũ (lộ trình tạo trước khi có giáo trình, dữ liệu demo)
  frames.ts, week.ts, stats.ts, karaoke.ts
src/data/curriculum/*.ts    dữ liệu giáo trình 30 ngày của 14 nhóm nghề (file lớn, chỉ đọc khi sửa nội dung)
src/lib/                    tiện ích chung: errors.ts, time.ts
src/server/                 chỉ chạy trên server (import "server-only")
  db.ts                     Prisma client dùng chung
  http/api.ts, page-guards  bọc route handler, kiểm tra đăng nhập/quyền cho trang
  auth.ts, throttle.ts      cookie phiên ký HMAC + bcrypt, giới hạn đăng nhập
  ai/                       adapter AI (demo / OpenAI): config, lesson, coach, adapt, speech, prompts
  learning/                 lessons (mở buổi theo ngày), practice (khoá phiên), history, usage (hạn mức), audio
  integrations/             zalo.ts (Zalo OA), r2.ts (Cloudflare R2)
  jobs.ts, notify.ts        tác vụ cron, outbox tin nhắn
  admin.ts                  truy vấn cho trang quản trị, tín hiệu "cần hỗ trợ"
src/app/api/**              route handlers (auth, onboard, practice, audio, complete, zalo, cron, admin…)
src/app/(app)/**            trang Hôm nay, Buổi học, Lộ trình, Nhật ký, Cài đặt, Hồ sơ học tập
src/app/admin/**            Tổng quan, Học viên, Ngân hàng bài, Tin nhắn Zalo, Nhân sự
src/components/lesson/**    trình học 4 bước (ghi âm, nhận dạng giọng nói, đồng hồ phiên)
scripts/seed-demo.ts        dữ liệu học viên mẫu · scripts/seed-admin.ts  admin đầu tiên
```

## Tính năng

1. Đăng ký/đăng nhập (bcrypt, cookie HttpOnly SameSite, chặn POST khác origin), chế độ demo không cần tài khoản.
2. Hồ sơ học tập nhiều bước có bước xác nhận; kết quả phân loại hiển thị bằng lời (trình độ, kỹ năng ưu tiên và lý do), không chỉ điểm số.
3. Lộ trình tham khảo 30 tình huống; nội dung chi tiết chỉ tạo khi bắt đầu từng ngày và điều chỉnh theo kết quả thật.
4. Shadowing: nghe cả đoạn/từng câu, đổi tốc độ, ghi âm và nghe lại ngay trên thiết bị.
5. Hội thoại một phiên 300 giây/ngày, tối đa 20 lượt; deadline do máy chủ cấp, không đặt lại khi reload hoặc mở nhiều tab.
6. Tổng kết có điểm mạnh, điểm cần cải thiện, bước tiếp theo và bằng chứng là câu học viên thực sự đã gửi; không suy ra điểm phát âm từ transcript.
7. Ghi âm gửi nhận dạng chỉ xử lý trong bộ nhớ, không lưu file thô.
