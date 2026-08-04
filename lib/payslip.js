const path = require('path');
const PDFDocument = require('pdfkit');
const { numToWords } = require('./numToWords');
const { COMPANY, COMPANY_SUB } = require('./config');

const FONT_DIR = path.join(__dirname, '..', 'fonts');
const FONT_REG = path.join(FONT_DIR, 'DejaVuSans.ttf');
const FONT_BOLD = path.join(FONT_DIR, 'DejaVuSans-Bold.ttf');

// ---- Helpers đọc giá trị field từ Lark ----
function toNum(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (Array.isArray(v)) return toNum(v[0]);
  if (typeof v === 'object') return toNum(v.text ?? v.value ?? 0);
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}
function toText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(toText).filter(Boolean).join(', ');
  if (typeof v === 'object') return String(v.text ?? v.name ?? v.value ?? '');
  return String(v);
}
function extractName(userField) {
  if (!userField) return '';
  if (Array.isArray(userField)) return userField.map((u) => u.name || u.en_name || '').filter(Boolean).join(', ');
  return userField.name || '';
}

// ---- Định nghĩa các dòng lương ----
// cong=true: số lượng = số công (25/26); qtyField: lấy số lượng từ field 4.6; qtyText: nhãn cố định;
// qtyErr: hiển thị số lỗi; nếu không có gì -> khoản trọn gói (không có số lượng/đơn giá).
const LINE_DEFS = [
  { amount: 'Lương cơ bản', cong: true },
  { amount: 'Phụ cấp', cong: true },
  { amount: 'Lương chuyên cần', qtyText: 'Đạt' },
  { amount: 'Thưởng tích cực', qtyErr: 'Số lỗi trong tháng' },
  { amount: 'Lương tăng ca', qtyField: 'Số giờ tăng ca', unit: 'giờ' },
  { amount: 'Lương học việc', qtyField: 'Số giờ học việc', unit: 'giờ' },
  { amount: 'Lương ca live', qtyField: 'Số ca live', unit: 'ca' },
  { amount: 'Lương KPI mẫu (GV)', qtyField: 'Số mẫu (Giáo viên)', unit: 'mẫu' },
  { amount: 'Lương HH học viên hoàn thành', qtyRef: 'Doanh thu học viên hoàn thành', money: true },
  { amount: 'Lương KPI Sale' },
  { amount: 'Lương hoa hồng', qtyRef: 'Doanh thu bán (hóa đơn)', money: true },
  { amount: 'Lương video cơ bản', qtyField: 'SL Video cơ bản', unit: 'video' },
  { amount: 'Lương video phức tạp', qtyField: 'SL Video phức tạp', unit: 'video' },
  { amount: 'Lương ảnh đơn giản', qtyField: 'SL Ảnh đơn giản', unit: 'ảnh' },
  { amount: 'Lương ảnh phức tạp', qtyField: 'SL Ảnh phức tạp', unit: 'ảnh' },
  { amount: 'Lương slide', qtyField: 'SL Slide', unit: 'slide' },
  { amount: 'Lương KPI quay chụp', qtyRef: 'Tổng SP Media', unit: 'SP' },
  { amount: 'Thưởng người tham gia (Live)', qtyRef: 'Tổng member (Live)', unit: 'member' },
  { amount: 'Lương live kéo SĐT', qtyField: 'Số SĐT Tiktok live', unit: 'SĐT' },
  { amount: 'Lương kéo lead (Live)', qtyField: 'Tổng member (Live)', unit: 'member' },
  { amount: 'Lương HH phát sinh khách (Live)' },
  { amount: 'Lương bài đăng chuyên môn', qtyField: 'SL Bài chuyên môn', unit: 'bài' },
  { amount: 'Lương gủi ảnh hội nhóm', label: 'Lương gửi ảnh hội nhóm', qtyField: 'SL Hình ảnh hội nhóm', unit: 'ảnh' },
  { amount: 'Lương học viên 1-1', qtyField: 'SL Nhóm 1-1', unit: 'nhóm' },
  { amount: 'Lương ảnh feedback', qtyField: 'Số lượng ảnh feedback', unit: 'ảnh' },
  { amount: 'Lương KPI bài đăng chuyên môn' },
  { amount: 'Lương HH phát sinh khách (CĐ)' },
  { amount: 'Lương KPI bài đăng fanpage', qtyField: 'Số Bài đăng fanpage', unit: 'bài' },
];

function fmtMoney(n) {
  return Math.round(Number(n) || 0).toLocaleString('vi-VN').replace(/,/g, '.');
}
function fmtQty(n) {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, '');
}

// Xây dữ liệu phiếu từ record 4.6 (+ số công lấy từ 2.3)
function buildData(luongFields, meta) {
  const { person, month, level, position, congThuc, congMax } = meta;
  const lines = [];
  let total = 0;
  for (const def of LINE_DEFS) {
    const amount = toNum(luongFields[def.amount]);
    if (!(amount > 0)) continue;
    total += amount;
    let qtyLabel = '';
    let unitPrice = null;
    if (def.cong) {
      if (congThuc > 0) {
        qtyLabel = `${fmtQty(congThuc)}/${fmtQty(congMax || congThuc)} công`;
        unitPrice = amount / congThuc;
      }
    } else if (def.qtyField) {
      const q = toNum(luongFields[def.qtyField]);
      if (q > 0) {
        qtyLabel = `${fmtQty(q)} ${def.unit}`;
        unitPrice = amount / q;
      }
    } else if (def.qtyRef) {
      // Chỉ hiển thị số lượng tham chiếu (member/SP/doanh thu), KHÔNG suy ra đơn giá
      const q = toNum(luongFields[def.qtyRef]);
      qtyLabel = def.money ? `${fmtMoney(q)} đ` : `${fmtQty(q)} ${def.unit}`;
    } else if (def.qtyText) {
      qtyLabel = def.qtyText;
    } else if (def.qtyErr) {
      qtyLabel = `${fmtQty(toNum(luongFields[def.qtyErr]))} lỗi`;
    }
    lines.push({ label: def.label || def.amount, qtyLabel, unitPrice, amount });
  }
  return {
    company: COMPANY,
    companySub: COMPANY_SUB,
    person, month, level, position,
    lines, total,
    totalWords: numToWords(total),
    congNote: congThuc > 0 ? `${fmtQty(congThuc)}/${fmtQty(congMax || congThuc)} công thực tế trên công chuẩn` : null,
  };
}

// ---- Vẽ PDF ----
function buildPdf(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('reg', FONT_REG);
    doc.registerFont('bold', FONT_BOLD);

    const BLUE = '#2b5c9c';
    const RED = '#c0392b';
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;

    // Header
    doc.font('bold').fontSize(20).fillColor(BLUE).text(data.company, left, 40);
    doc.font('reg').fontSize(9).fillColor('#666').text(data.companySub, left, 64);
    doc.font('bold').fontSize(16).fillColor('#1a1a1a').text('PHIẾU LƯƠNG', left, 42, { width, align: 'right' });
    doc.font('reg').fontSize(11).fillColor(BLUE).text(`Kỳ lương: Tháng ${data.month}`, left, 64, { width, align: 'right' });
    doc.moveTo(left, 84).lineTo(right, 84).lineWidth(2).strokeColor(BLUE).stroke();

    // Thông tin nhân sự
    let y = 96;
    doc.fontSize(10.5).fillColor('#1a1a1a');
    const infoRow = (label, value, yy) => {
      doc.font('bold').fillColor('#555').text(label, left, yy, { continued: true });
      doc.font('reg').fillColor('#1a1a1a').text(' ' + (value || '-'));
    };
    infoRow('Họ và tên:', data.person, y);
    doc.font('bold').fillColor('#555').text('Level:', left + width / 2, y, { continued: true });
    doc.font('reg').fillColor('#1a1a1a').text(' ' + (data.level || '-'));
    y += 18;
    infoRow('Vị trí:', data.position, y);
    y += 26;

    // Bảng
    const cols = [
      { key: 'stt', title: 'STT', w: 34, align: 'center' },
      { key: 'label', title: 'Nội dung lương', w: width - 34 - 110 - 95 - 110, align: 'left' },
      { key: 'qty', title: 'Số lượng', w: 110, align: 'center' },
      { key: 'unit', title: 'Đơn giá (đ)', w: 95, align: 'right' },
      { key: 'amount', title: 'Thành tiền (đ)', w: 110, align: 'right' },
    ];
    const rowH = 22;
    const drawRow = (cells, yy, opts = {}) => {
      let x = left;
      for (let i = 0; i < cols.length; i++) {
        const c = cols[i];
        if (opts.fill) { doc.rect(x, yy, c.w, opts.h || rowH).fillColor(opts.fill).fill(); }
        doc.lineWidth(0.5).strokeColor('#cfd8e3').rect(x, yy, c.w, opts.h || rowH).stroke();
        doc.font(opts.bold ? 'bold' : 'reg').fontSize(opts.size || 9.5).fillColor(opts.color || '#1a1a1a');
        doc.text(cells[i] == null ? '' : String(cells[i]), x + 5, yy + 6, { width: c.w - 10, align: c.align, lineBreak: false });
        x += c.w;
      }
    };

    // Header bảng
    drawRow(cols.map((c) => c.title), y, { fill: BLUE, bold: true, color: '#fff' });
    y += rowH;

    // Các dòng
    data.lines.forEach((ln, idx) => {
      if (y > doc.page.height - 160) { doc.addPage(); y = 40; }
      const bg = idx % 2 === 1 ? '#f4f7fb' : null;
      drawRow([
        idx + 1,
        ln.label,
        ln.qtyLabel || '-',
        ln.unitPrice != null ? fmtMoney(ln.unitPrice) : '-',
        fmtMoney(ln.amount),
      ], y, bg ? { fill: bg } : {});
      y += rowH;
    });

    // Dòng tổng
    const totalH = 26;
    let x = left;
    const labelW = cols[0].w + cols[1].w + cols[2].w + cols[3].w;
    doc.rect(x, y, labelW, totalH).fillColor('#eaf1fa').fill();
    doc.lineWidth(0.5).strokeColor('#cfd8e3').rect(x, y, labelW, totalH).stroke();
    doc.font('bold').fontSize(11).fillColor(BLUE).text('TỔNG TIỀN LƯƠNG THỰC NHẬN', x + 6, y + 7, { width: labelW - 12, align: 'right' });
    x += labelW;
    doc.rect(x, y, cols[4].w, totalH).fillColor('#eaf1fa').fill();
    doc.lineWidth(0.5).strokeColor('#cfd8e3').rect(x, y, cols[4].w, totalH).stroke();
    doc.font('bold').fontSize(12).fillColor(RED).text(fmtMoney(data.total), x + 5, y + 7, { width: cols[4].w - 10, align: 'right' });
    y += totalH + 10;

    // Bằng chữ
    doc.font('reg').fontSize(10).fillColor('#444').text('Bằng chữ: ', left, y, { continued: true });
    doc.font('bold').fillColor('#1a1a1a').text(data.totalWords + '.');
    y += 22;

    // Ghi chú
    if (data.congNote) {
      doc.font('reg').fontSize(8.5).fillColor('#888')
        .text(`Ghi chú: Lương cơ bản & Phụ cấp tính theo tỉ lệ ${data.congNote}. Số tiền đã làm tròn đến hàng đồng.`, left, y, { width });
      y += 24;
    }

    // Chữ ký
    const signY = Math.max(y + 10, doc.page.height - 130);
    const third = width / 3;
    const sign = (title, cx) => {
      doc.font('bold').fontSize(10).fillColor('#1a1a1a').text(title, cx, signY, { width: third, align: 'center' });
      doc.font('reg').fontSize(8.5).fillColor('#888').text('(Ký, ghi rõ họ tên)', cx, signY + 15, { width: third, align: 'center' });
    };
    sign('Người lập bảng', left);
    sign('Kế toán', left + third);
    sign('Người nhận lương', left + 2 * third);

    doc.end();
  });
}

module.exports = { buildData, buildPdf, toNum, toText, extractName };
