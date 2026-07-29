// Cấu hình chung. App ID/Secret LẤY TỪ BIẾN MÔI TRƯỜNG, không hardcode.
module.exports = {
  LARK_HOST: process.env.LARK_HOST || 'https://open.larksuite.com',

  // Base LUMI GROUP
  APP_TOKEN: process.env.LARK_APP_TOKEN || 'C3NwbW615aEIllsNqYql8GP7ghc',

  // Bảng nguồn
  TBL_CHAMCONG: process.env.TBL_CHAMCONG || 'tblwH3lbblquCBvf', // 2.3 Bảng chấm công (nơi đặt nút)
  TBL_LUONG:    process.env.TBL_LUONG    || 'tbllIUXidh6Sh2gH', // 4.6 Bảng tính lương (số liệu lương)
  TBL_CONFIG:   process.env.TBL_CONFIG   || 'tblsnZceifbi8d7U', // 2.4 Bảng cấu hình cơ chế lương (Vị trí + Level)

  // Tên field trên 2.3 để ghi kết quả
  FIELD_ATTACH: process.env.FIELD_ATTACH || 'Bảng lương',  // field Đính kèm (type 17)
  FIELD_TONG:   process.env.FIELD_TONG   || 'Tổng lương',  // field Số (type 2) — ghi tổng, tùy chọn

  COMPANY: process.env.COMPANY_NAME || 'LUMI GROUP',
  COMPANY_SUB: process.env.COMPANY_SUB || 'Học viện & Thẩm mỹ LUMI',
};
