# LUMI – Webhook tạo phiếu lương PDF từ Lark Base

Khi bấm nút **“Ra bảng lương”** trên một dòng của bảng **2.3 Bảng chấm công**, Lark gọi service này →
service đọc số liệu lương của nhân sự đó (tháng tương ứng) từ **4.6 Bảng tính lương**, dựng **PDF phiếu lương**,
rồi **đính PDF vào cột “Bảng lương”** của đúng dòng vừa bấm.

## Luồng hoạt động

```
Nút "Ra bảng lương" (2.3)
   → Lark Automation "Send HTTP request" (POST record_id)
      → Webhook /api/payslip
         → đọc 2.3 (Nhân sự, Tháng, số công) + 4.6 (các khoản lương) + 2.4 (Vị trí, Level)
         → tạo PDF (pdfkit, font DejaVu Sans có tiếng Việt)
         → upload PDF lên Lark, ghi vào field đính kèm "Bảng lương"
```

## 1. Biến môi trường (bắt buộc)

Đặt trên nền tảng hosting (Vercel/Render/…), **không commit vào code**:

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `LARK_APP_ID` | ✅ | App ID của Lark app (đã có quyền Bitable + Drive) |
| `LARK_APP_SECRET` | ✅ | App Secret |
| `WEBHOOK_SECRET` | nên có | Chuỗi bí mật; Lark phải gửi kèm trong body để chặn gọi lạ |
| `LARK_APP_TOKEN` | tùy chọn | app_token của base (mặc định đã set sẵn base LUMI) |
| `TBL_CHAMCONG` / `TBL_LUONG` / `TBL_CONFIG` | tùy chọn | table_id 2.3 / 4.6 / 2.4 (đã set mặc định) |
| `FIELD_ATTACH` | tùy chọn | tên field đính kèm ở 2.3 (mặc định “Bảng lương”) |
| `FIELD_TONG` | tùy chọn | tên field số ghi tổng ở 2.3 (mặc định “Tổng lương”) |

Quyền Lark app cần bật: `bitable:app` (đọc/ghi record) và `drive:drive`/`drive:file` (upload media).

## 2. Deploy lên Vercel (khuyến nghị)

1. Vào https://vercel.com → **Add New → Project** → **Import** repo GitHub này.
2. Framework preset: **Other**. Không cần build command.
3. **Settings → Environment Variables**: thêm `LARK_APP_ID`, `LARK_APP_SECRET`, `WEBHOOK_SECRET`.
4. **Deploy**. Endpoint sẽ là:
   ```
   https://<tên-project>.vercel.app/api/payslip
   ```
   Mở bằng trình duyệt (GET) thấy `{"ok":true,...}` là chạy.

### Deploy thay thế: Render / Railway / VPS
`npm install` rồi `npm start` (chạy `server.js`, cổng `PORT`). Endpoint là `https://<host>/payslip`.

## 3. Cấu hình nút + automation trong Lark Base (bảng 2.3)

1. Field **“Ra bảng lương”** (nút) → thiết lập hành động **“Trigger automation / Chạy tự động hóa”**.
2. Tạo Automation:
   - **Trigger**: When button “Ra bảng lương” is clicked.
   - **Action**: **Send HTTP request**
     - Method: `POST`
     - URL: endpoint ở bước 2
     - Headers: `Content-Type: application/json`
     - Body (JSON):
       ```json
       {
         "secret": "<GIÁ TRỊ WEBHOOK_SECRET>",
         "record_id": "{{Record ID của dòng hiện tại}}"
       }
       ```
       (Chèn biến “Record ID” của bản ghi kích hoạt vào chỗ `record_id`.)
3. Lưu & bật automation. Bấm nút trên 1 dòng → vài giây sau PDF xuất hiện ở cột **“Bảng lương”**.

> Nếu Lark bản của bạn không chèn được Record ID, có thể gửi thay bằng
> `{ "secret": "...", "person": "{{Nhân sự}}", "month": "{{Tháng}}" }` — service vẫn tra được 4.6,
> nhưng khi đó **sẽ không tự đính kèm ngược vào dòng 2.3** (vì thiếu record_id). Ưu tiên dùng `record_id`.

## 4. Cách tính phiếu

- Mỗi khoản lương > 0 trong 4.6 thành 1 dòng: Nội dung / Số lượng / Đơn giá / Thành tiền.
- Đơn giá = Thành tiền ÷ Số lượng (khớp tuyệt đối); khoản trọn gói (hoa hồng, %…) để trống số lượng/đơn giá.
- **Số công** lấy từ 2.3: `Số công trong tháng` / `Số công làm việc max`.
- Tổng = cộng các dòng hiển thị. Tự đọc đúng mọi vị trí; nhân sự nhiều vị trí sẽ gộp đủ khoản của các vị trí.

## Lưu ý

- Không đưa App Secret / WEBHOOK_SECRET vào git. Chỉ đặt ở Environment Variables.
- Font tiếng Việt (DejaVu Sans) nằm trong `fonts/` và được đóng gói kèm (`vercel.json → includeFiles`).
