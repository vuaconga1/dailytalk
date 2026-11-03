# WeWIN Daily Speaking — mã nguồn MVP

Phiên bản 0.1, ngày 30/10/2026. Bộ mã nguồn chạy độc lập để WeWIN/IT thử nghiệm và phát triển tiếp; chưa phải bản vận hành thương mại hoàn chỉnh.

## Chạy ngay, không cần API key

Yêu cầu Python 3.11+ có dữ liệu múi giờ hệ thống (zoneinfo); khuyến nghị Python 3.12. Nếu Windows thiếu múi giờ, cài `python -m pip install tzdata`. Không có dependency JavaScript; không cần npm install.

```bash
cd wewin-daily-speaking
python3 server.py
```

Windows: dùng `python server.py` thay `python3 server.py`.

Mở http://localhost:8000. Bấm **Trải nghiệm demo không cần đăng ký** để có hồ sơ thử riêng, hoặc tạo tài khoản bằng email/mật khẩu. Sau đó làm khảo sát và đi hết bài học.

Demo là chế độ mặc định:
- Kế hoạch chọn bài theo quy tắc, không giả là AI đã lập kế hoạch.
- Audio dùng giọng English có sẵn của trình duyệt; chất lượng và khả dụng tùy thiết bị.
- Hội thoại theo kịch bản minh họa bằng nhập chữ; phản hồi được gắn nhãn demo.
- Không gửi yêu cầu đến dịch vụ AI, Zalo hay email; không phát sinh phí API.

## Tài khoản mẫu để demo sản phẩm

```bash
python seed_demo.py
```

Tạo (hoặc làm mới) học viên **Nguyễn Minh Anh**, chuyên viên kinh doanh ngành logistics, lĩnh vực Công việc văn phòng:
- Email `minhanh.nguyen@wewin.edu.vn`, mật khẩu `WeWIN2026` (đổi bằng `--email` / `--password`).
- Lộ trình 30 buổi cá nhân hóa; 12 buổi đã hoàn thành với hội thoại và tổng kết đầy đủ; chuỗi 9 ngày liên tiếp.
- Buổi 13 ("Give a progress update") để trống, sẵn sàng trình diễn trực tiếp trong buổi demo.

Ngày học tính lùi từ hôm nay, nên chạy lại lệnh trước mỗi buổi demo để làm mới dữ liệu. Trong chế độ demo, nút Ghi âm ở phần hội thoại dùng nhận dạng giọng nói của trình duyệt (Chrome/Edge).

## Deploy lên dailytalk.wewin.edu.vn

Trỏ bản ghi DNS `A` của `dailytalk.wewin.edu.vn` về IP máy chủ và mở cổng 80/443.

**Cách 1 – Docker + Caddy (tự cấp HTTPS):**

```bash
cp .env.production.example .env      # chỉnh AI_MODE / API key nếu cần
docker compose up -d --build
docker compose exec app python seed_demo.py   # tạo tài khoản demo
```

Dữ liệu nằm trong volume `app-data`, chứng chỉ trong `caddy-data`.

**Cách 2 – systemd + Nginx:**

```bash
sudo useradd --system wewin
sudo cp -r . /opt/wewin-daily-speaking && cd /opt/wewin-daily-speaking
sudo cp .env.production.example .env
sudo mkdir -p /var/lib/wewin-dailytalk && sudo chown -R wewin /var/lib/wewin-dailytalk /opt/wewin-daily-speaking
sudo cp deploy/wewin-dailytalk.service /etc/systemd/system/ && sudo systemctl enable --now wewin-dailytalk
sudo certbot certonly --nginx -d dailytalk.wewin.edu.vn
sudo cp deploy/nginx/dailytalk.wewin.edu.vn.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/dailytalk.wewin.edu.vn.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo -u wewin python3 seed_demo.py
```

`APP_ORIGIN=https://dailytalk.wewin.edu.vn` bắt buộc: server chỉ chấp nhận đúng Host/Origin này và tự bật cookie Secure.

## Tính năng đã có

1. Đăng ký/đăng nhập; mật khẩu PBKDF2; cookie HttpOnly, SameSite; CSRF; kiểm tra quyền sở hữu dữ liệu.
2. Khảo sát nghề/vai trò, mục tiêu, khó khăn, lĩnh vực và giờ học theo giờ Việt Nam.
3. 8 câu kiểm tra ngữ pháp/đọc hiểu, chấm tại máy chủ, chia hai mức hỗ trợ ban đầu. Chưa đo nghe/phát âm và không chứng nhận CEFR.
4. Kế hoạch 30 buổi. Trong chế độ thật, AI chọn và sắp xếp bài theo hồ sơ từ danh mục được phép; kiểm tra đầu ra JSON, mã bài và đủ 30 ngày.
5. Ngân hàng 18 bài mẫu: 6 bài nền tảng + 4 bài/lĩnh vực (đời sống, văn phòng, du lịch). Lộ trình 30 buổi có các buổi ôn lại, không phải 30 bài hoàn toàn khác nhau. Nội dung là seed cho IT kiểm thử, cần học thuật duyệt/mở rộng trước pilot.
6. Từ vựng/ý nghĩa, cấu trúc, mục tiêu giao tiếp, ví dụ và đánh dấu hoàn thành bước.
7. Shadowing: nghe cả đoạn/từng câu, đổi tốc độ, ghi âm và nghe lại tại thiết bị. Audio thật được tổng hợp một lần rồi lưu dùng chung theo nội dung/mô hình/giọng. Không có file MP3 tạo sẵn trong gói ZIP.
8. Hội thoại 1–1 theo lượt, tối đa một phiên 300 giây/ngày; tối đa 20 lượt. Máy chủ cấp deadline, không đặt lại khi reload hoặc mở nhiều tab. Giới hạn chạy đến nửa đêm Việt Nam nếu phiên bắt đầu sát ngày mới. Không có tạm dừng.
9. Chế độ AI thật: ghi âm → gửi nhận dạng → kiểm tra/sửa transcript → gửi câu → AI trả lời bằng chữ → bấm nghe giọng AI. Có nhập chữ thay thế và ghi nhận riêng số lượt từ ghi âm.
10. Tổng kết có điểm mạnh, điểm cần cải thiện, bước tiếp theo và bằng chứng là câu thực sự đã gửi; lưu nhật ký. Không suy ra điểm phát âm từ transcript.
11. Lưu tài khoản, hồ sơ, kế hoạch, tiến độ và transcript trong SQLite; phần ghi âm STT được xử lý trong bộ nhớ, không chủ động lưu file thô.
12. Lưu giờ học, lựa chọn nhắc và công cụ xuất danh sách nhắc dạng dry-run để nối Zalo về sau.

## Bật AI thật

Sao chép `.env.example` thành `.env`, điền giá trị rồi khởi động lại. Không đưa `.env` vào Git, ZIP hoặc mã frontend.

```dotenv
AI_MODE=openai
OPENAI_API_KEY=<khóa riêng của môi trường thử nghiệm>
OPENAI_TEXT_MODEL=<model hỗ trợ Responses và JSON object>
OPENAI_TRANSCRIBE_MODEL=<model hỗ trợ audio/transcriptions>
OPENAI_TTS_MODEL=<model hỗ trợ audio/speech MP3>
OPENAI_VOICE=alloy
```

Tên mô hình để trống có chủ đích: IT cần kiểm tra mô hình/tính khả dụng/giọng và lịch ngừng hỗ trợ trên tài khoản của WeWIN. Adapter HTTP hiện dùng:
- `POST https://api.openai.com/v1/responses`
- `POST https://api.openai.com/v1/audio/transcriptions`
- `POST https://api.openai.com/v1/audio/speech`

Tài liệu: https://developers.openai.com/api/docs/guides/audio và https://developers.openai.com/api/docs/pricing.

Không có API key được cấp trong phiên tạo mã nguồn; do đó chưa kiểm thử cuộc gọi trả phí hoặc xác nhận chất lượng/độ trễ giọng nói thật. Adapter cần một smoke test với model cụ thể trước khi mở cho học viên. Lỗi provider hiện trả thông báo để thử lại, không tự thay bằng phản hồi demo như thể đó là AI thật.

### Chuẩn bị audio trước giờ học

```bash
# Chỉ kiểm tra số audio còn thiếu, chưa phát sinh phí
python3 prepare_audio.py --lesson L01
# Chạy tổng hợp cho một bài bằng API đã cấu hình
python3 prepare_audio.py --lesson L01 --confirm-costs
```

Bỏ `--lesson` để tạo cho toàn bộ ngân hàng. Script phải chạy khi không có job tạo audio đồng thời; dùng để chuẩn bị offline, chưa phải hàng đợi sản xuất. Thay model/voice/nội dung sẽ tạo cache khác.

### Giới hạn và đo usage

- 5 phút là thời gian phiên từ lúc sẵn sàng đến kết thúc, gồm thời gian chờ và gõ; không phải 5 phút âm thanh thuần. Kết thúc sớm không được tạo lại phiên trong ngày.
- Không tạo cuộc gọi hội thoại/nhận dạng/giọng trả lời mới sau deadline. Cuộc gọi đã bắt đầu hợp lệ trước deadline có thể hoàn thành sau đó; UI dừng phát audio khi hết giờ.
- Tối đa 20 lượt phản hồi, mỗi câu tối đa 1.000 ký tự; mỗi upload tối đa 4 MB; UI tự dừng ghi âm sau 45 giây. Backend chưa phân tích thời lượng file, nên cần bổ sung kiểm tra media duration khi triển khai thật.
- `MAX_PROVIDER_CALLS_PER_USER_DAY` mặc định 90, gồm cả request thất bại; thử tạo kế hoạch tối đa 3 lần/ngày. Dữ liệu usage có reservation và token trả về từ model text, byte STT/character TTS; đây chưa phải sổ chi phí USD hoàn chỉnh.
- Cần thêm ngân sách toàn hệ thống, giới hạn bằng tiền, đối soát billing và cảnh báo. Cấu hình spend limit ở tài khoản nhà cung cấp.

## Lưu trữ và cấu hình máy chủ

Mặc định dữ liệu ở `data/wewin.sqlite3`, audio ở `data/audio/`. Bảo toàn thư mục này giữa các lần deploy; không đưa dữ liệu học viên vào mã nguồn.

Các biến môi trường khác:

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| HOST | 127.0.0.1 | Địa chỉ bind |
| PORT | 8000 | Cổng chạy |
| APP_ORIGIN | http://localhost:8000 | Origin chính xác, gồm scheme/host/port |
| DATA_DIR | data cạnh server.py | Đường dẫn lưu bền vững |
| MAX_PROVIDER_CALLS_PER_USER_DAY | 90 | Hạn mức request API mỗi người/ngày |

Nếu chạy tên miền khác phải đặt APP_ORIGIN đúng. HTTPS origin tự bật cờ Secure cho cookie. Ghi âm browser yêu cầu HTTPS hoặc localhost; kiểm tra Safari/Chrome và trình duyệt trong Zalo, hướng dẫn mở ngoài nếu không hỗ trợ.

MVP dùng `ThreadingHTTPServer` của Python, phục vụ frontend và API cùng origin. Không dùng trực tiếp như một nền tảng production công khai. Mô hình khóa hiện tại dành cho một tiến trình. Khi chuyển sang nhiều worker/container cần khóa giao dịch/hàng đợi phân tán, request idempotency bền vững, database và storage phù hợp.

## Nhắc học/Zalo

```bash
python3 reminders.py --at 2026-10-30T20:30:00+07:00
```

Chỉ xuất JSON học viên chọn nhắc đúng phút và chưa hoàn thành bài ngày đó. Script không gửi tin, không ghi đã gửi, không tự chạy định kỳ. Vì chưa có thanh toán, nó cũng chưa kiểm tra quyền lợi trả phí.

Để dùng thật, IT bổ sung worker/scheduler, liên kết đúng định danh OA–tài khoản, xác nhận loại tin/mẫu và điều kiện gửi, kiểm tra đồng ý/quyền học ngay trước gửi, transaction chống trùng, retry có giới hạn và nhật ký provider. Không đưa khóa Zalo lên trình duyệt. Không xem bước chọn giờ là chứng cứ đã gửi thành công.

## Cấu trúc source

```text
server.py          HTTP API, auth, SQLite, session quota, audio cache
ai.py              Adapter Responses / STT / TTS; demo riêng biệt
content.py         Câu hỏi đầu vào, chấm điểm, ngân hàng bài
prepare_audio.py   Chuẩn bị audio dùng chung bằng API
reminders.py       Xuất nhắc học dry-run
web/index.html     Trang ứng dụng
web/style.css      Giao diện responsive xanh navy, teal, vàng
web/app.js         Khảo sát, lộ trình, bài học, audio, ghi âm, chat, tổng kết
tests/test_app.py  Kiểm tra tích hợp không gọi API trả phí
.env.example       Cấu hình mẫu, không có secret
```

## API chính

GET `/api/config`, `/api/me`, `/api/today`, `/api/history`, `/api/audio?lesson=L01&line=all`.

POST `/api/register`, `/api/login`, `/api/logout`, `/api/onboard`, `/api/settings`, `/api/checkpoint`, `/api/practice/start`, `/api/transcribe`, `/api/practice/turn`, `/api/reply-audio`, `/api/complete`.

`/api/demo` chỉ hoạt động trong AI_MODE=demo, tạo tài khoản giả không có quyền truy cập dữ liệu khác. Không có endpoint bỏ qua đăng nhập trong chế độ openai.

API đã đăng nhập yêu cầu cookie; mọi POST sau auth cần X-CSRF-Token từ `/api/me`. API không bật CORS. Object ID không thay thế kiểm tra quyền; máy chủ luôn lọc theo user_id.

## Kiểm tra

```bash
python3 -m unittest discover -s tests -v
node --check web/app.js
```

Kiểm tra tự động bao phủ: luồng đầy đủ và tổng kết idempotent; chấm đầu vào ở server; ngăn đọc/ghi chéo tài khoản; CSRF/origin; hết hạn không tạo lại phiên; khóa khi lượt trước đang xử lý; điều kiện hoàn thành; mở bài ngày sau; giữ kế hoạch; cache audio; từ chối mã bài AI bịa; cookie HttpOnly/SameSite.

Đã kiểm tra giao diện desktop qua trình duyệt ở chế độ demo: khảo sát → kế hoạch → từ vựng → shadowing → hội thoại bằng nhập chữ → tổng kết. Chưa kiểm thử microphone thật, Safari/iPhone/Android, dịch vụ AI trả phí hoặc gửi Zalo thật. Team cần hoàn thành kiểm thử này trước pilot.

## IT cần hoàn thiện trước vận hành thương mại

- Cổng thanh toán, quyền học hết hạn/bảo lưu; bảng quản trị tư vấn/học thuật.
- Xác minh email, quên mật khẩu, quản trị tài khoản; chống đăng ký hàng loạt và rate limit toàn hệ thống. Tắt demo trong môi trường thật.
- Điều khoản/chính sách lưu dữ liệu, thời hạn retention, xóa/export, backup và thử khôi phục. Chưa có luồng trẻ em.
- Bài nghe và bài nói đầu vào, rubric chuẩn; học thuật duyệt và tăng ngân hàng bài.
- Cá nhân hóa sâu hơn về từ vựng/độ khó; kế hoạch hiện chọn bài theo hồ sơ ban đầu, chưa tự lập lại sau mỗi ngày. Phản hồi cuối buổi đã có nhưng chưa tự quyết định tăng/hạ cấp.
- Audio prewarm theo hàng đợi, xử lý provider timeout/retry có giới hạn; đo latency và billing.
- Xác nhận client hết thời gian trong mọi trạng thái (nhiều tab, reload, nền, lỗi mạng); backend đã chặn cấp lại phiên và request sau deadline.
- Ghi nhận consent có version/timestamp bền vững; log/audit; mã hóa/sao lưu storage phù hợp.
- Chuyển backend sang web server/framework production và HTTPS reverse proxy; persistent storage, khóa liên tiến trình và giám sát lỗi.

Đây là source khởi điểm có thể chạy và mở rộng, không phải tuyên bố đã hoàn tất các tích hợp thương mại nói trên.
