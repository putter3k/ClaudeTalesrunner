const https = require('https');
const fs    = require('fs');
const path  = require('path');

const API_BASE = 'https://talesbook.org/api/items';
const CDN_BASE = 'https://cdn.talesbook.org/';
const IMG_DIR  = path.join(__dirname, 'images');

if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

const ids = process.argv.slice(2);
if (!ids.length) {
  console.log('วิธีใช้: node dl.js <id> [id ...]');
  console.log('ตัวอย่าง: node dl.js 113395 113397 113399');
  process.exit(0);
}

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'TalesRunner-Shop/1.0' } }, res => {
      if (res.statusCode >= 300 && res.headers.location)
        return get(res.headers.location).then(resolve).catch(reject);
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'TalesRunner-Shop/1.0' } }, res => {
      if (res.statusCode >= 300 && res.headers.location) {
        file.close(); fs.unlink(dest, () => {});
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', e => { fs.unlink(dest, () => {}); reject(e); });
    }).on('error', reject);
  });
}

(async () => {
  for (const id of ids) {
    process.stdout.write(`${id}... `);
    try {
      const r = await get(`${API_BASE}/${id}`);
      const item = JSON.parse(r.body);
      await download(CDN_BASE + item.icon, path.join(IMG_DIR, `${id}.png`));
      console.log(`✅ ${item.name}`);
    } catch (e) {
      console.log(`❌ ${e.message}`);
    }
  }
})();
