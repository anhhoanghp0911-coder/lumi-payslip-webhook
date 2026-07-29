// Vercel serverless function -> URL: https://<project>.vercel.app/api/payslip
const { handlePayslip } = require('../lib/handler');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    res.status(200).json({ ok: true, service: 'lumi-payslip-webhook' });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (!body || typeof body !== 'object') body = {};

  try {
    const out = await handlePayslip(body);
    res.status(out.status).json(out.body);
  } catch (e) {
    res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
};
