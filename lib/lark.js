// Các hàm gọi Lark Open API (Larksuite quốc tế: open.larksuite.com)
const { LARK_HOST, APP_TOKEN } = require('./config');

async function larkToken() {
  const r = await fetch(`${LARK_HOST}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: process.env.LARK_APP_ID,
      app_secret: process.env.LARK_APP_SECRET,
    }),
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error('Lark token error: ' + JSON.stringify(j));
  return j.tenant_access_token;
}

async function getRecord(token, tableId, recordId) {
  const url = `${LARK_HOST}/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${tableId}/records/${recordId}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json();
  if (j.code !== 0) throw new Error('getRecord error: ' + JSON.stringify(j));
  return j.data.record;
}

async function listRecords(token, tableId) {
  let items = [];
  let pageToken = null;
  do {
    const url = new URL(`${LARK_HOST}/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${tableId}/records`);
    url.searchParams.set('page_size', '500');
    if (pageToken) url.searchParams.set('page_token', pageToken);
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    if (j.code !== 0) throw new Error('listRecords error: ' + JSON.stringify(j));
    items = items.concat(j.data.items || []);
    pageToken = j.data.has_more ? j.data.page_token : null;
  } while (pageToken);
  return items;
}

// Upload file PDF vào Lark, trả về file_token dùng cho field Đính kèm của Bitable
async function uploadMedia(token, fileName, buffer) {
  const form = new FormData();
  form.append('file_name', fileName);
  form.append('parent_type', 'bitable_file');
  form.append('parent_node', APP_TOKEN);
  form.append('size', String(buffer.length));
  form.append('file', new Blob([buffer], { type: 'application/pdf' }), fileName);
  const r = await fetch(`${LARK_HOST}/open-apis/drive/v1/medias/upload_all`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error('uploadMedia error: ' + JSON.stringify(j));
  return j.data.file_token;
}

async function updateRecord(token, tableId, recordId, fields) {
  const url = `${LARK_HOST}/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${tableId}/records/${recordId}`;
  const r = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error('updateRecord error: ' + JSON.stringify(j));
  return j.data.record;
}

module.exports = { larkToken, getRecord, listRecords, uploadMedia, updateRecord };
