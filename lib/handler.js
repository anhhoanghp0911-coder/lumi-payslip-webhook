const { larkToken, getRecord, listRecords, uploadMedia, updateRecord } = require('./lark');
const { buildData, buildPdf, toNum, toText, extractName } = require('./payslip');
const { TBL_CHAMCONG, TBL_LUONG, TBL_CONFIG, FIELD_ATTACH, FIELD_TONG } = require('./config');

function slug(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// payload: { secret, record_id? (của 2.3), person?, month? }
async function handlePayslip(payload) {
  const need = process.env.WEBHOOK_SECRET || '';
  if (need && payload.secret !== need) {
    return { status: 401, body: { ok: false, error: 'invalid secret' } };
  }

  const token = await larkToken();

  let person = payload.person;
  let month = payload.month;
  let congThuc = 0;
  let congMax = 0;
  const chamcongId = payload.record_id;

  if (chamcongId) {
    const rec = await getRecord(token, TBL_CHAMCONG, chamcongId);
    const f = rec.fields;
    person = extractName(f['Nhân sự']) || person;
    month = toText(f['Tháng']) || month;
    congThuc = toNum(f['Số công trong tháng']);
    congMax = toNum(f['Số công làm việc max']);
  }

  if (!person || !month) {
    return { status: 400, body: { ok: false, error: 'Thiếu Nhân sự hoặc Tháng' } };
  }

  // Tìm dòng lương ở 4.6 theo Nhân sự + Tháng
  const luongRecs = await listRecords(token, TBL_LUONG);
  const match = luongRecs.find(
    (r) => extractName(r.fields['Nhân sự']) === person && toText(r.fields['Tháng']) === month
  );
  if (!match) {
    return { status: 404, body: { ok: false, error: `Không tìm thấy dòng lương cho "${person}" tháng ${month} ở bảng 4.6` } };
  }

  // Vị trí + Level đọc từ 2.4 (single-select -> chữ đọc được), gộp các vị trí của nhân sự
  let position = '';
  let level = '';
  try {
    const cfg = await listRecords(token, TBL_CONFIG);
    const rows = cfg.filter((r) => (extractName(r.fields['Nhân sự']) || '').split(', ').includes(person));
    const pos = [...new Set(rows.map((r) => toText(r.fields['Vị trí'])).filter(Boolean))];
    const lv = [...new Set(rows.map((r) => toText(r.fields['Level'])).filter(Boolean))];
    position = pos.join('; ');
    level = lv.join('; ');
  } catch (e) { /* không chặn nếu đọc config lỗi */ }

  const data = buildData(match.fields, { person, month, level, position, congThuc, congMax });
  const pdf = await buildPdf(data);

  const fileName = `Phieu_luong_${slug(person)}_${month.replace('/', '-')}.pdf`;
  const fileToken = await uploadMedia(token, fileName, pdf);

  // Ghi PDF vào field đính kèm của đúng dòng 2.3
  if (chamcongId) {
    try {
      await updateRecord(token, TBL_CHAMCONG, chamcongId, {
        [FIELD_ATTACH]: [{ file_token: fileToken }],
        [FIELD_TONG]: data.total,
      });
    } catch (e) {
      // Nếu field Tổng lương là công thức/không ghi được -> chỉ ghi đính kèm
      await updateRecord(token, TBL_CHAMCONG, chamcongId, {
        [FIELD_ATTACH]: [{ file_token: fileToken }],
      });
    }
  }

  return { status: 200, body: { ok: true, person, month, total: data.total, file_token: fileToken } };
}

module.exports = { handlePayslip };
