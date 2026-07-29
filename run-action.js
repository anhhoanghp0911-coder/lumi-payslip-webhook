// Điểm chạy cho GitHub Actions. Lấy dữ liệu từ event (repository_dispatch/workflow_dispatch)
// qua biến môi trường rồi gọi cùng logic tạo phiếu lương.
const { handlePayslip } = require('./lib/handler');

(async () => {
  const payload = {
    secret: process.env.WEBHOOK_SECRET || undefined,
    record_id: process.env.EVENT_RECORD_ID || undefined,
    person: process.env.EVENT_PERSON || undefined,
    month: process.env.EVENT_MONTH || undefined,
  };
  console.log('Input:', JSON.stringify({ record_id: payload.record_id, person: payload.person, month: payload.month }));
  try {
    const out = await handlePayslip(payload);
    console.log('Result:', JSON.stringify(out.body));
    if (!out.body || !out.body.ok) process.exit(1);
  } catch (e) {
    console.error('ERROR:', (e && e.stack) || e);
    process.exit(1);
  }
})();
