# LUMI – Tạo phiếu lương PDF từ Lark Base (thuần GitHub)

Khi bấm nút **“Ra bảng lương”** trên một dòng của bảng **2.3 Bảng chấm công**, GitHub Actions chạy →
đọc số liệu lương của nhân sự đó (tháng tương ứng) từ **4.6 Bảng tính lương**, dựng **PDF phiếu lương**,
rồi **đính PDF vào cột “Bảng lương”** của đúng dòng vừa bấm. **Không cần Vercel / hosting ngoài.**

## Luồng hoạt động (thuần git – GitHub Actions)

```
Nút "Ra bảng lương" (2.3)
   → Lark Automation "Send HTTP request" → gọi API GitHub (repository_dispatch)
      → GitHub Actions chạy run-action.js
         → đọc 2.3 (Nhân sự, Tháng, số công) + 4.6 (các khoản lương) + 2.4 (Vị trí, Level)
         → tạo PDF (pdfkit, font DejaVu Sans có tiếng Việt)
         → upload PDF lên Lark, ghi vào field đính kèm "Bảng lương"
```

> Ghi chú tốc độ: mỗi lần bấm, GitHub dựng lại môi trường + cài thư viện nên PDF hiện ra sau **~30–60 giây**
> (đánh đổi để không cần hosting). Cần nhanh vài giây thì xem “Phương án Vercel” ở cuối.

## 1. Thêm Secrets cho repo (Settings → Secrets and variables → Actions)

| Secret | Bắt buộc | Giá trị |
|---|---|---|
| `LARK_APP_ID` | ✅ | `cli_aadcf2704538ded4` |
| `LARK_APP_SECRET` | ✅ | App Secret của Lark app |
| `WEBHOOK_SECRET` | không | Để trống cũng được (Actions đã được bảo vệ bằng token GitHub) |

Quyền Lark app cần bật: `bitable:app` (đọc/ghi record) và `drive:drive` / `drive:file` (upload media).

## 2. Tạo token để nút Lark gọi được API GitHub

Tạo **Personal Access Token (classic)** với scope **`repo`** (hoặc fine-grained: quyền *Contents: Read and write* cho repo này).
Token này chỉ dùng để “châm ngòi” workflow. **Không đặt trong code**, chỉ dán vào cấu hình HTTP của Lark (mục 3).

## 3. Cấu hình nút + automation trong Lark Base (bảng 2.3)

1. Field **“Ra bảng lương”** (nút) → hành động **“Trigger automation / Chạy tự động hóa”**.
2. Automation:
   - **Trigger**: When button “Ra bảng lương” is clicked.
   - **Action**: **Send HTTP request**
     - Method: `POST`
     - URL:
       ```
       https://api.github.com/repos/anhhoanghp0911-coder/lumi-payslip-webhook/dispatches
       ```
     - Headers:
       ```
       Authorization: Bearer <TOKEN GITHUB Ở MỤC 2>
       Accept: application/vnd.github+json
       X-GitHub-Api-Version: 2022-11-28
       User-Agent: lumi-lark
       Content-Type: application/json
       ```
     - Body (JSON):
       ```json
       {
         "event_type": "payslip",
         "client_payload": { "record_id": "{{Record ID của dòng hiện tại}}" }
       }
       ```
3. Lưu & bật automation. Bấm nút → chờ ~30–60s → PDF hiện ở cột **“Bảng lương”**.

> API `dispatches` trả về **204 No Content** khi nhận lệnh thành công (chưa phải kết quả PDF).
> Xem tiến trình chạy ở tab **Actions** của repo.

## 4. Test nhanh không cần Lark

Tab **Actions → “Tạo phiếu lương” → Run workflow**, nhập `record_id` (hoặc `person` + `month`) rồi chạy.

## 5. Cách tính phiếu

- Mỗi khoản lương > 0 trong 4.6 thành 1 dòng: Nội dung / Số lượng / Đơn giá / Thành tiền.
- Đơn giá = Thành tiền ÷ Số lượng (khớp tuyệt đối); khoản trọn gói (hoa hồng, %…) để trống số lượng/đơn giá.
- **Số công** lấy từ 2.3: `Số công trong tháng` / `Số công làm việc max`.
- Tổng = cộng các dòng hiển thị. Nhân sự nhiều vị trí sẽ gộp đủ khoản của các vị trí.

## Biến môi trường

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `LARK_APP_TOKEN` | base LUMI đã set sẵn | app_token của base |
| `TBL_CHAMCONG` / `TBL_LUONG` / `TBL_CONFIG` | 2.3 / 4.6 / 2.4 đã set sẵn | table_id |
| `FIELD_ATTACH` | `Bảng lương` | field đính kèm ở 2.3 |
| `FIELD_TONG` | `Tổng lương` | field số ghi tổng ở 2.3 (tùy chọn) |

---

## Phương án khác: Vercel (nhanh ~vài giây, cần hosting)

Repo cũng chạy được như webhook. Deploy repo lên Vercel (preset *Other*), thêm env `LARK_APP_ID`,
`LARK_APP_SECRET`, `WEBHOOK_SECRET`. Endpoint: `https://<project>.vercel.app/api/payslip`.
Khi đó nút Lark gọi thẳng endpoint này bằng `POST { "secret": "...", "record_id": "{{Record ID}}" }`.
File `api/payslip.js` (Vercel) và `server.js` (Render/Railway/VPS) đã sẵn cho hướng này.
