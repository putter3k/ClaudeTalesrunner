const http = require('http');
const fs   = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
};

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0]; // strip query string

  // POST /save — write items.js
  if (req.method === 'POST' && url === '/save') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        fs.writeFileSync(path.join(ROOT, 'items.js'), body, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        console.log('💾 บันทึก items.js แล้ว');
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // Serve static files
  const filePath = path.join(ROOT, url === '/' ? 'index.html' : url);
  const ext = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found: ' + url);
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'text/plain',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('\n🚀 เซิร์ฟเวอร์เปิดแล้ว!');
  console.log(`   หน้าร้าน  →  http://localhost:${PORT}`);
  console.log(`   จัดการ    →  http://localhost:${PORT}/admin.html`);
  console.log('\nกด Ctrl+C เพื่อปิด\n');
  exec(`start http://localhost:${PORT}/admin.html`);
});
