#!/usr/bin/env node
/**
 * ใช้ดึงข้อมูลไอเทมจาก Tales Book และดาวน์โหลดรูปไอคอน
 *
 * วิธีใช้:
 *   node fetch-item.js <item_id> [item_id ...]
 *
 * ตัวอย่าง:
 *   node fetch-item.js 109115
 *   node fetch-item.js 88581 88804 102030
 *
 * สคริปต์จะ:
 *   1. ดึงชื่อและ icon จาก https://talesbook.org/api/items/<id>
 *   2. บันทึกรูปไว้ที่ images/<id>.png
 *   3. อัปเดต items.js โดยเพิ่มไอเทมใหม่ (ถ้ายังไม่มี) หรืออัปเดต image+name
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const API_BASE = 'https://talesbook.org/api/items';
const CDN_BASE = 'https://cdn.talesbook.org/';
const IMG_DIR  = path.join(__dirname, 'images');
const JS_FILE = path.join(__dirname, 'items.js');

if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

const ids = process.argv.slice(2);
if (!ids.length) {
  console.log('วิธีใช้: node fetch-item.js <item_id> [item_id ...]\nตัวอย่าง: node fetch-item.js 109115 88581');
  process.exit(0);
}

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'TalesRunner-Shop/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'TalesRunner-Shop/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlink(dest, () => {});
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', (e) => { fs.unlink(dest, () => {}); reject(e); });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchItem(id) {
  console.log(`\n📦 ดึงข้อมูล item ${id}...`);
  let res;
  try {
    res = await get(`${API_BASE}/${id}`);
  } catch (e) {
    console.error(`  ❌ ไม่สามารถเชื่อมต่อได้: ${e.message}`);
    return null;
  }
  if (res.status !== 200) {
    console.error(`  ❌ HTTP ${res.status} — ไม่พบไอเทม`);
    return null;
  }

  let item;
  try { item = JSON.parse(res.body); } catch {
    console.error('  ❌ parse JSON ไม่ได้'); return null;
  }

  console.log(`  ✅ ชื่อ: ${item.name}`);

  const iconUrl = CDN_BASE + item.icon;
  const iconDest = path.join(IMG_DIR, `${id}.png`);
  try {
    await download(iconUrl, iconDest);
    console.log(`  🖼  บันทึกรูป: images/${id}.png`);
  } catch (e) {
    console.warn(`  ⚠️  ดาวน์โหลดรูปไม่ได้: ${e.message}`);
  }

  return { talesbook_id: parseInt(id), name: item.name, image: `images/${id}.png` };
}

function nextId(items) {
  return items.length ? Math.max(...items.map(i => i.id)) + 1 : 1;
}

(async () => {
  for (const id of ids) {
    const result = await fetchItem(id);
    if (!result) { await sleep(500); continue; }

    // อัปเดต items.js
    let data = { shop: { name: 'ร้านไอเทม TalesRunner', contact_url: '#', contact_label: 'ทักแชทสั่งซื้อ', updated: new Date().toISOString().slice(0,10) }, items: [] };
    if (fs.existsSync(JS_FILE)) {
      try {
        const src = fs.readFileSync(JS_FILE, 'utf8').replace(/^var SHOP_DATA\s*=\s*/, '').replace(/;\s*$/, '');
        data = JSON.parse(src);
      } catch {}
    }

    const existing = data.items.find(i => i.talesbook_id === result.talesbook_id);
    if (existing) {
      existing.name  = result.name;
      existing.image = result.image;
      console.log(`  ♻️  อัปเดตชื่อ+รูปใน items.js (id: ${existing.id})`);
    } else {
      data.items.push({
        id:          nextId(data.items),
        talesbook_id: result.talesbook_id,
        name:        result.name,
        image:       result.image,
        price:       null,
        stock:       1,
        unit:        'ชิ้น',
        note:        ''
      });
      console.log(`  ➕ เพิ่มไอเทมใหม่ใน items.js (ตั้งราคาด้วยตัวเองนะคะ)`);
    }

    fs.writeFileSync(JS_FILE, 'var SHOP_DATA = ' + JSON.stringify(data, null, 2) + ';\n', 'utf8');
    await sleep(500);
  }

  console.log('\n✨ เสร็จแล้ว! อย่าลืมตั้งราคาและสต็อกใน items.js ด้วยนะคะ');
})();
