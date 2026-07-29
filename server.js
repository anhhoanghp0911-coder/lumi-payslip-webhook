// Server độc lập (dùng cho Render / Railway / VPS). URL: http://<host>:<port>/payslip
const http = require('http');
const { handlePayslip } = require('./lib/handler');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'lumi-payslip-webhook' }));
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    return;
  }
  let data = '';
  req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
  req.on('end', async () => {
    let body = {};
    try { body = JSON.parse(data || '{}'); } catch { body = {}; }
    try {
      const out = await handlePayslip(body);
      res.writeHead(out.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(out.body));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: String((e && e.message) || e) }));
    }
  });
});

server.listen(PORT, () => console.log('lumi-payslip-webhook listening on ' + PORT));
