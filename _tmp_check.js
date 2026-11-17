
/* ════════════════ SHARED ════════════════ */
const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72'%3E%3Crect width='72' height='72' rx='12' fill='%23F3D9E3'/%3E%3Ctext x='36' y='44' font-size='30' text-anchor='middle' fill='%23C2316A'%3E%3F%3C/text%3E%3C/svg%3E";
const OTHER = 'อื่น ๆ';
const $ = id => document.getElementById(id);

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function today() { return new Date().toISOString().slice(0, 10); }
function pref(key, val) {
  try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch { return null; }
}
// items given as a bundle in the game (e.g. 2 boxes per gift) carry pack > 1
const packOf = item => item.pack > 1 ? item.pack : 1;
// show "1 ชิ้น" too when the same item is also sold in bigger packs
const hasPacks = name => data.items.some(i => i.name === name && packOf(i) > 1);
const packLabel = item => packOf(item) > 1 || hasPacks(item.name) ? `${packOf(item)} ชิ้น` : '';
const fullName = item => item.name + (packOf(item) > 1 ? ` (${packOf(item)} ชิ้น)` : '');

function img(src, cls, title) {
  return `<img${cls ? ` class="${cls}"` : ''} src="${esc(src || PLACEHOLDER)}" alt="" loading="lazy"${title ? ` title="${esc(title)}"` : ''} onerror="this.src='${PLACEHOLDER}'">`;
}

// Working copy of items.js — both tabs read it, the manage tab edits it, 💾 writes it back.
let data = window.SHOP_DATA
  ? JSON.parse(JSON.stringify(window.SHOP_DATA))
  : { shop: { name: 'ร้านไอเทม TalesRunner', contact_url: '#', contact_label: 'ทักแชทสั่งซื้อ', updated: today() }, items: [] };
data.sets = data.sets || [];

function categories() { return (data.shop.categories || []).filter(c => c !== OTHER).concat(OTHER); }
// sections switched off in the manage tab (still shown while editing the shop)
const catHidden = c => (data.shop.hidden_categories || []).includes(c);
const setsHidden = () => !!data.shop.hide_sets;
function catOf(item) { return categories().includes(item.category) ? item.category : OTHER; }

// Sets take their pieces from item stock in set order; whatever is left is sold separately.
function allocate(items, sets) {
  const left = new Map(items.map(i => [i.id, Math.max(0, i.stock || 0)]));
  const count = new Map();
  for (const s of sets) {
    const parts = (s.parts || []).filter(p => left.has(p.item) && p.qty > 0);
    let n = parts.length ? Math.min(...parts.map(p => Math.floor(left.get(p.item) / p.qty))) : 0;
    if (s.max != null && s.max >= 0) n = Math.min(n, s.max);
    for (const p of parts) left.set(p.item, left.get(p.item) - n * p.qty);
    count.set(s.id, n);
  }
  return { count, left };
}

/* ── unsaved changes ── */
let dirty = false;
function markDirty(msg) {
  dirty = true;
  $('btn-save').classList.add('dirty');
  $('export-status').textContent = msg || 'มีการแก้ไขที่ยังไม่บันทึก';
}
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

/* ── tabs ── */
let tab = location.hash === '#admin' || pref('tr-tab') === 'admin' ? 'admin' : 'shop';
function showTab(t) {
  tab = t;
  pref('tr-tab', t);
  history.replaceState(null, '', t === 'admin' ? '#admin' : location.pathname + location.search);
  $('tab-shop').hidden = t !== 'shop';
  $('tab-admin').hidden = t !== 'admin';
  $('tabbtn-shop').classList.toggle('on', t === 'shop');
  $('tabbtn-admin').classList.toggle('on', t === 'admin');
  renderHeader();
  if (t === 'shop') renderShop(); else renderAll();
  window.scrollTo({ top: 0 });
}
$('tabbtn-shop').addEventListener('click', () => showTab('shop'));
$('tabbtn-admin').addEventListener('click', () => showTab('admin'));

// keep the shop toolbar right under the sticky header (and the stash under both)
new ResizeObserver(() => document.documentElement.style.setProperty('--hdr-h', $('hdr').offsetHeight + 'px')).observe($('hdr'));
new ResizeObserver(() => document.documentElement.style.setProperty('--tb-h', document.querySelector('.toolbar-wrap').offsetHeight + 'px'))
  .observe(document.querySelector('.toolbar-wrap'));

/* ════════════════ TAB: หน้าร้าน ════════════════ */
const SETS_KEY = '__sets', SINGLES_KEY = '__singles';
// Item names containing the same keyword are shown next to each other (first match wins).
const DEFAULT_SERIES = [
  'สคูลแบนด์', 'มืดมน', 'ลูกหมา', 'น้อนหมา', 'เปลวไฟ', 'ออโรร่า', 'เฮนรี่ ไคเซอร์', 'จอมมารฮารุ',
  'ปิเอโร่โจ๊กเกอร์', 'กระต่าย', 'อึนกาบี', 'อึนฮวี', 'เลิฟเดลิเวอร์รี่', 'เลิฟแอนด์มอร์', 'ด็อกเตอร์',
  'ไนต์แมร์', 'มินิ', 'ตุ๊กตาข้อมือ', 'ฝันดี', 'โครงกระดูกน่ารัก', 'ไวท์เมมโมรี่', 'แฟนธ่อม', 'งานแต่ง',
  'โลฟเฟอร์', 'แมงมุม', 'ค้างคาว', 'หมออีกาขาว', 'แก้วเปลี่ยนสีชื่อ', 'ไส้เดือน', 'TR ', 'EXP '
];
const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
function thaiDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

let curCat = '';
let view = pref('tr-view') === 'list' ? 'list' : 'grid';
let VIEW_ITEMS = [], VIEW_SETS = [];

function seriesOf(name) {
  const series = Array.isArray(data.shop.series) && data.shop.series.length ? data.shop.series : DEFAULT_SERIES;
  const i = series.findIndex(k => name.includes(k));
  return i < 0 ? series.length : i;
}

function renderHeader() {
  const s = data.shop;
  $('shop-name').textContent = s.name || 'ร้านไอเทม TalesRunner';
  $('shop-subtitle').textContent = 'ราคาเป็นบาท' + (s.updated ? ' · อัปเดตล่าสุด ' + thaiDate(s.updated) : '');
}

// Build what the shop shows from the working data: singles = stock left after sets.
function buildView() {
  const { count, left } = allocate(data.items, data.sets);
  const byId = new Map(data.items.map(i => [i.id, i]));
  // hidden = kept in the 📦 stash, not listed in the shop (it can still be part of a set)
  VIEW_ITEMS = data.items
    .filter(i => !i.hidden)
    .map(i => ({ ...i, stock: left.get(i.id) }))
    .filter(i => i.stock > 0 || !((byId.get(i.id).stock || 0) > 0));
  VIEW_SETS = data.sets.map(st => ({
    ...st,
    stock: count.get(st.id) || 0,
    parts: (st.parts || []).map(p => ({ ...p, item: byId.get(p.item) })).filter(p => p.item)
  }));
}

function matches(q, ...names) { return !q || names.some(n => n.toLowerCase().includes(q)); }
function hideSold() { return $('hide-sold').checked || document.body.classList.contains('sc'); }
function query() { return $('q').value.toLowerCase().trim(); }

function filteredSets() {
  const q = query();
  return VIEW_SETS.filter(s => !(hideSold() && !(s.stock > 0)) && matches(q, s.name, ...s.parts.map(p => p.item.name)));
}
function filteredItems(ignoreCat) {
  const q = query();
  return VIEW_ITEMS.filter(i => {
    if (hideSold() && !(i.stock > 0)) return false;
    if (!matches(q, i.name)) return false;
    if (catHidden(catOf(i))) return false;
    if (!ignoreCat && categories().includes(curCat) && catOf(i) !== curCat) return false;
    return true;
  });
}

function editing() { return document.body.classList.contains('editing'); }

function sortList(list) {
  if (editing()) return list;  // edit mode always shows the arranged order
  const srt = $('sort').value;
  const byName = (a, b) => a.name.localeCompare(b.name, 'th') || packOf(b) - packOf(a);
  if (srt === 'group') list.sort((a, b) => seriesOf(a.name) - seriesOf(b.name) || byName(a, b));
  else if (srt === 'stock') list.sort((a, b) => (b.stock || 0) - (a.stock || 0) || byName(a, b));
  else if (srt === 'asc') list.sort((a, b) => (a.price || Infinity) - (b.price || Infinity) || byName(a, b));
  else if (srt === 'desc') list.sort((a, b) => (b.price || -1) - (a.price || -1) || byName(a, b));
  return list;
}

function renderChips(nSets, singles) {
  const count = c => singles.filter(i => catOf(i) === c).length;
  const chip = (val, label, n, main) =>
    `<button class="chip${main ? ' main' : ''}${val === curCat ? ' on' : ''}" data-cat="${esc(val)}">${esc(label)}<span>${n}</span></button>`;
  let html = chip('', 'ทั้งหมด', nSets + singles.length, true);
  if (VIEW_SETS.length && !setsHidden()) html += chip(SETS_KEY, '🎁 ขายเป็นเซ็ต', nSets, true);
  html += chip(SINGLES_KEY, '🧩 ขายแยกชิ้น', singles.length, true) + '<span class="chip-sep"></span>';
  html += categories().filter(c => count(c) > 0).map(c => chip(c, c, count(c), false)).join('');
  $('chips').innerHTML = html;
}

function priceTag(x, kind) {
  if (editing()) {
    return `<input class="price-in" type="number" min="0" value="${x.price ?? ''}" placeholder="ราคา"
      onchange="setPrice('${kind}', ${x.id}, this.value)" title="ราคา (บาท) — เว้นว่าง = สอบถาม">`;
  }
  return x.price > 0
    ? `<span class="price">${x.price.toLocaleString('th-TH')} ฿</span>`
    : `<span class="price ask">สอบถาม</span>`;
}
function qtyText(x, unit) { return x.stock > 0 ? `เหลือ ${x.stock}${unit ? ' ' + unit : ''}` : 'หมด'; }

function setCard(s) {
  const out = !(s.stock > 0);
  const ic = s.icon_cols > 0 ? s.icon_cols : null;
  return `<div class="set-card${out ? ' sold-out' : ''}" data-drag="set" data-id="${s.id}">
  ${out ? '<span class="badge-sold">ขายแล้ว</span>' : ''}
  <div class="set-icons${ic ? ' cols' : ''}"${ic ? ` style="--ic:${ic}"` : ''}>${s.parts.map(p => img(p.item.image, '', fullName(p.item))).join('')}</div>
  <div class="set-name">${esc(s.name)}</div>
  <ul class="set-parts">${s.parts.map(p => `<li>• ${esc(fullName(p.item))}${p.qty > 1 ? ` ×${p.qty}` : ''}</li>`).join('')}</ul>
  ${s.note ? `<div class="note">${esc(s.note)}</div>` : ''}
  <div class="meta">${priceTag(s, 'set')}<span class="qty">${qtyText(s, 'เซ็ต')}</span></div>
</div>`;
}
function card(item) {
  const out = !(item.stock > 0);
  return `<div class="card${out ? ' sold-out' : ''}${SEL.has(item.id) ? ' selected' : ''}" title="${esc(fullName(item))}" data-drag="item" data-id="${item.id}">
  ${out ? '<span class="badge-sold">ขายแล้ว</span>' : ''}
  ${img(item.image, 'icon')}
  <div class="name">${esc(item.name)}</div>
  ${packLabel(item) ? `<span class="pack">${packLabel(item)}</span>` : ''}
  <div class="meta">${priceTag(item, 'item')}<span class="qty">${qtyText(item)}</span></div>
  ${item.note ? `<div class="note" title="${esc(item.note)}">${esc(item.note)}</div>` : ''}
</div>`;
}
function row(item) {
  const out = !(item.stock > 0);
  return `<div class="row${out ? ' sold-out' : ''}${SEL.has(item.id) ? ' selected' : ''}" data-drag="item" data-id="${item.id}">
  ${img(item.image, 'icon')}
  <div class="name">${esc(item.name)}${packLabel(item) ? `<br><span class="pack">${packLabel(item)}</span>` : ''}${item.note ? `<small>${esc(item.note)}</small>` : ''}</div>
  <span class="qty">${qtyText(item)}</span>
  ${priceTag(item, 'item')}
</div>`;
}

function catHead(c, n) {
  if (!editing()) return `<h3 class="cat-head">${esc(c)} <span>${n} รายการ</span></h3>`;
  const k = userCats().indexOf(c), last = userCats().length - 1;
  const stashBtn = n ? `<button onclick="stashCat(this.closest('[data-cat-zone]').dataset.catZone)" title="เก็บไอเทมหมวดนี้ทั้งหมดเข้าคลัง">📦 เก็บทั้งหมด</button>` : '';
  const tag = catHidden(c) ? '<span class="hidden-tag" title="ซ่อนจากหน้าร้าน — เปิดได้ในแท็บจัดการ">ซ่อนอยู่</span>' : '';
  const rowBtns = `<button onclick="addRow(this.closest('[data-cat-zone]').dataset.catZone)" title="เพิ่มแถวว่างท้ายหมวด">＋ แถว</button>`
    + (rowCount(c) > 1 ? `<button onclick="removeRow(this.closest('[data-cat-zone]').dataset.catZone)" title="ลบแถวสุดท้าย (ของในแถวนั้นย้ายขึ้นไปแถวก่อนหน้า)">－ แถว</button>` : '');
  // อื่น ๆ is the fixed fallback: no rename / move / delete, but it can still be stashed
  if (c === OTHER) return `<h3 class="cat-head">${esc(c)} <span>${n} รายการ</span>${tag}<span class="cat-tools">${rowBtns}${stashBtn}</span></h3>`;
  return `<h3 class="cat-head" data-drag="cat" data-cat="${esc(c)}" title="ลากหัวข้อเพื่อย้ายตำแหน่งหมวด">
    <span class="cat-grip">⠿</span>
    <input class="cat-name" value="${esc(c)}" size="${Math.max(6, c.length)}" onchange="renameCat(${k}, this.value)" title="แก้ชื่อหมวด">
    <span>${n} รายการ</span>${tag}
    <span class="cat-tools">
      ${rowBtns}
      ${stashBtn}
      <button onclick="moveCat(${k}, -1)"${k === 0 ? ' disabled' : ''} title="เลื่อนหมวดขึ้น">▲</button>
      <button onclick="moveCat(${k}, 1)"${k === last ? ' disabled' : ''} title="เลื่อนหมวดลง">▼</button>
      <button onclick="delCat(${k})" title="ลบหมวด">🗑</button>
    </span>
  </h3>`;
}

function renderShop() {
  renderHeader();
  buildView();
  // sets keep the order arranged in the manage tab, unless sorting by price or stock
  const keepOrder = ['group', 'manual'].includes($('sort').value);
  const sets = keepOrder ? filteredSets() : sortList(filteredSets());
  if (catHidden(curCat) || (curCat === SETS_KEY && setsHidden())) curCat = '';
  const singlesAll = filteredItems(true);
  renderChips(setsHidden() ? 0 : sets.length, singlesAll);
  $('v-grid').classList.toggle('on', view === 'grid');
  $('v-list').classList.toggle('on', view === 'list');

  const setList = (curCat === '' || curCat === SETS_KEY) && !setsHidden() ? sets : [];
  const singles = curCat !== SETS_KEY ? sortList(filteredItems(false)) : [];
  $('summary').textContent =
    `เซ็ต ${setList.length} · ขายแยก ${singles.length} รายการ (มีของ ${singles.filter(i => i.stock > 0).length})`;

  const cols = data.shop.set_columns > 0 ? data.shop.set_columns : null;
  let html = '';
  if (setList.length) {
    html += `<section class="shop-part">
  <h2 class="part-head">🎁 ขายเป็นเซ็ต <span>${setList.length} เซ็ต</span>${setsHidden() ? '<span class="hidden-tag">ซ่อนอยู่</span>' : ''}</h2>
  <div class="sets${cols ? ' fixed' : ''}"${cols ? ` style="--cols:${cols};--cols-m:${Math.min(cols, 2)}"` : ''}>${setList.map(setCard).join('')}</div>
</section>`;
  }
  const ed = editing();
  if (singles.length || (ed && curCat !== SETS_KEY)) {
    const one = view === 'list' ? row : card;
    const wrap = view === 'list' ? 'list' : 'grid';
    // a category chip shows just that category; otherwise all (empty ones too while editing, as drop targets)
    const shown = categories().filter(c => !catHidden(c) && (!categories().includes(curCat) || c === curCat));
    html += `<section class="shop-part singles">
  <h2 class="part-head">🧩 ขายแยกชิ้น <span>${singles.length} รายการ</span></h2>
  ${shown.map(c => {
    const list = singles.filter(i => catOf(i) === c);
    if (!list.length && !ed) return '';
    const nRows = rowCount(c);
    let rows = '';
    for (let r = 0; r < nRows; r++) {
      const inRow = list.filter(i => rowOf(i) === r);
      if (!inRow.length && !ed) continue;
      rows += `<div class="cat-row" data-row="${r}">
      ${ed && nRows > 1 ? `<span class="row-label" data-drag="row" data-row="${r}" data-cat="${esc(c)}" title="ลากเพื่อเรียงแถว">⠿ แถว ${r + 1}</span>` : ''}
      <div class="${wrap}">${inRow.length ? inRow.map(one).join('') : '<div class="empty-drop">ลากไอเทมมาวางที่นี่</div>'}</div>
    </div>`;
    }
    return `<section class="cat-section" data-cat-zone="${esc(c)}">${catHead(c, list.length)}${rows}</section>`;
  }).join('')}
  ${ed ? '<button class="btn-add-cat" onclick="addCat()">+ เพิ่มหมวดหมู่</button>' : ''}
</section>`;
  }
  $('grid').innerHTML = html || '<div class="empty-state">ไม่พบไอเทมที่ค้นหา</div>';
  if (ed) renderStash();
}

function renderStash() {
  // count what is left after sets; pieces fully used by sets are already on sale as sets, so not listed here
  const { left } = allocate(data.items, data.sets);
  const all = data.items.filter(i => i.hidden && !((i.stock || 0) > 0 && left.get(i.id) === 0));
  const q = $('stash-q').value.toLowerCase().trim();
  const list = all.filter(i => matches(q, i.name));
  $('stash-count').textContent = `${all.length} รายการ`;
  $('stash-list').innerHTML = list.length
    ? list.map(i => `<div class="stash-row${SEL.has(i.id) ? ' selected' : ''}" data-drag="item" data-id="${i.id}" title="${esc(fullName(i))}">
        ${img(i.image)}
        <span class="nm">${esc(i.name)}<small>${packLabel(i) ? packLabel(i) + ' · ' : ''}มี ${left.get(i.id)}${left.get(i.id) < (i.stock || 0) ? ` (อีก ${(i.stock || 0) - left.get(i.id)} อยู่ในเซ็ต)` : ''}</small></span>
        <button onclick="unstash(${i.id})" title="วางขายในหมวดที่เคยอยู่ล่าสุด">วางขาย</button>
      </div>`).join('')
    : `<div class="empty-hint">${all.length ? 'ไม่พบในคลัง' : 'ยังไม่มีของในคลัง<br>ลากการ์ดจากหน้าร้านมาวางที่นี่<br>เพื่อเอาออกจากหน้าร้าน'}</div>`;
}
$('stash-q').addEventListener('input', renderStash);
// "เก็บทั้งหมด" on a category header: move every listed item of that category into the stash
function stashCat(c) {
  const list = data.items.filter(i => !i.hidden && catOf(i) === c);
  if (!list.length) return;
  if (!confirm(`เก็บไอเทมหมวด "${c}" ทั้งหมด ${list.length} รายการเข้าคลัง?`)) return;
  list.forEach(i => { i.hidden = true; });
  markDirty();
  renderShop();
}

$('q').addEventListener('input', renderShop);
$('sort').addEventListener('change', renderShop);
$('hide-sold').addEventListener('change', renderShop);
$('chips').addEventListener('click', e => {
  const b = e.target.closest('.chip');
  if (!b) return;
  curCat = b.dataset.cat;
  renderShop();
  window.scrollTo({ top: 0 });
});
$('v-grid').addEventListener('click', () => { view = 'grid'; pref('tr-view', view); renderShop(); });
$('v-list').addEventListener('click', () => { view = 'list'; pref('tr-view', view); renderShop(); });
$('btn-sc').addEventListener('click', () => { setEditing(false); document.body.classList.add('sc'); renderShop(); window.scrollTo({ top: 0 }); });

/* ── shop edit mode ── */
/* multi-select (edit mode): ids of picked item cards */
const SEL = new Set();
function updateSel() {
  $('sel-info').classList.toggle('on', SEL.size > 0);
  $('sel-count').textContent = `เลือกอยู่ ${SEL.size} ชิ้น`;
}
function clearSel() {
  SEL.clear();
  document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
  updateSel();
}
$('btn-sel-clear').addEventListener('click', clearSel);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && SEL.size) clearSel(); });

// "มุมมองแคปจอ": edit in the same packed layout the screenshot uses
function setPoster(on) {
  document.body.classList.toggle('poster', on);
  $('btn-poster').classList.toggle('on', on);
}
$('btn-poster').addEventListener('click', () => {
  const on = !document.body.classList.contains('poster');
  pref('tr-poster', on ? '1' : '0');  // remembered for the next time edit mode is opened
  setPoster(on);
  renderShop();
});

function setEditing(on) {
  if (!on) clearSel();
  setPoster(on && pref('tr-poster') === '1');
  document.body.classList.toggle('editing', on);
  $('btn-edit').textContent = on ? '✔ เสร็จสิ้นการแก้ไข' : '✏️ แก้ไขหน้าร้าน';
  $('sort').disabled = on;
  if (on) $('sort').value = 'manual';
}
$('btn-edit').addEventListener('click', () => { setEditing(!editing()); renderShop(); });

function setPrice(kind, id, v) {
  const obj = (kind === 'set' ? data.sets : data.items).find(x => x.id === id);
  obj.price = v === '' ? null : Math.max(0, parseFloat(v) || 0);
  markDirty();
}

// put similar names next to each other inside every category (same as the old automatic order)
$('btn-regroup').addEventListener('click', () => {
  if (!confirm('เรียงไอเทมทุกหมวดใหม่ให้ชื่อคล้ายกันอยู่ติดกัน?\n(ลำดับที่ลากไว้เองจะถูกแทนที่)')) return;
  const cats = categories();
  const catIdx = i => cats.indexOf(catOf(i));
  data.items.sort((a, b) => catIdx(a) - catIdx(b) || seriesOf(a.name) - seriesOf(b.name)
    || a.name.localeCompare(b.name, 'th') || packOf(b) - packOf(a));
  markDirty();
  renderShop();
});

/* rows inside a category: item.row (0-based) + shop.cat_rows[category] = how many rows it has */
const rowOf = item => Math.max(0, item.row | 0);
function rowCount(c) {
  const used = data.items.filter(i => catOf(i) === c).reduce((m, i) => Math.max(m, rowOf(i) + 1), 1);
  return Math.max(used, (data.shop.cat_rows || {})[c] || 1);
}
function setRowCount(c, n) {
  data.shop.cat_rows = { ...(data.shop.cat_rows || {}), [c]: n };
}
function addRow(c) { setRowCount(c, rowCount(c) + 1); markDirty(); renderShop(); }
function removeRow(c) {
  const n = rowCount(c);
  if (n <= 1) return;
  // items in the last row move up into the row before it
  data.items.forEach(i => { if (catOf(i) === c && rowOf(i) === n - 1) i.row = n - 2; });
  setRowCount(c, n - 1);
  markDirty();
  renderShop();
}

/* categories (อื่น ๆ is the fixed fallback and always last) */
function userCats() { return (data.shop.categories || []).filter(c => c !== OTHER); }
function addCat() {
  const name = (prompt('ชื่อหมวดหมู่ใหม่') || '').trim();
  if (!name) return;
  if (categories().includes(name)) { alert('มีหมวดชื่อนี้แล้ว'); return; }
  data.shop.categories = [...userCats(), name];
  markDirty();
  renderShop();
}
function renameCat(k, name) {
  const cats = userCats(), old = cats[k];
  name = name.trim();
  if (name && name !== old) {
    if (categories().includes(name)) alert('มีหมวดชื่อนี้แล้ว');
    else {
      cats[k] = name;
      data.shop.categories = cats;
      data.items.forEach(i => { if (i.category === old) i.category = name; });
      if (catHidden(old)) data.shop.hidden_categories = data.shop.hidden_categories.map(c => c === old ? name : c);
      if (data.shop.cat_rows && old in data.shop.cat_rows) {
        data.shop.cat_rows[name] = data.shop.cat_rows[old];
        delete data.shop.cat_rows[old];
      }
      if (curCat === old) curCat = name;
      markDirty();
    }
  }
  renderShop();
}
function moveCat(k, d) {
  const cats = userCats(), j = k + d;
  if (j < 0 || j >= cats.length) return;
  [cats[k], cats[j]] = [cats[j], cats[k]];
  data.shop.categories = cats;
  markDirty();
  renderShop();
}
function delCat(k) {
  const cats = userCats(), c = cats[k];
  const n = data.items.filter(i => i.category === c).length;
  if (!confirm(`ลบหมวด "${c}" ใช่ไหม?` + (n ? `\n(ไอเทม ${n} รายการจะย้ายไปหมวด "${OTHER}")` : ''))) return;
  cats.splice(k, 1);
  data.shop.categories = cats;
  data.items.forEach(i => { if (i.category === c) { i.category = OTHER; delete i.row; } });
  if (catHidden(c)) data.shop.hidden_categories = data.shop.hidden_categories.filter(x => x !== c);
  if (data.shop.cat_rows) delete data.shop.cat_rows[c];
  if (curCat === c) curCat = '';
  markDirty();
  renderShop();
}

/* drag cards: items move within/between categories, sets reorder among sets */
let drag = null, dropAt = null;
const shopGrid = $('shop-main');  // covers both the shop cards and the 📦 stash
function clearDropMarks() {
  shopGrid.querySelectorAll('.drop-before,.drop-after,.drop-zone,.cat-drop-before,.cat-drop-after,.drop-before-row,.drop-after-row')
    .forEach(el => el.classList.remove('drop-before', 'drop-after', 'drop-zone', 'cat-drop-before', 'cat-drop-after', 'drop-before-row', 'drop-after-row'));
}
// reorder categories by dragging a block next to another one (อื่น ๆ always stays last)
function moveCatTo(cat, ref, after) {
  const cats = userCats().filter(c => c !== cat);
  let at = ref === OTHER ? cats.length : cats.indexOf(ref) + (after ? 1 : 0);
  if (at < 0) at = cats.length;
  cats.splice(at, 0, cat);
  data.shop.categories = cats;
  markDirty();
  renderShop();
}
// click an item card (in the shop or the stash) to pick / unpick it
shopGrid.addEventListener('click', e => {
  if (!editing() || e.target.closest('input,button')) return;
  const el = e.target.closest('[data-drag="item"]');
  if (!el) return;
  const id = +el.dataset.id;
  if (SEL.has(id)) SEL.delete(id); else SEL.add(id);
  el.classList.toggle('selected', SEL.has(id));
  updateSel();
});
shopGrid.addEventListener('mousedown', e => {
  if (!editing() || e.target.closest('input,button')) return;
  const el = e.target.closest('[data-drag]');
  if (el) el.draggable = true;
});
document.addEventListener('mouseup', () => {
  if (!drag) shopGrid.querySelectorAll('[draggable="true"]').forEach(el => el.draggable = false);
});
shopGrid.addEventListener('dragstart', e => {
  const el = e.target.closest('[data-drag]');
  if (!el || !editing()) return;
  if (el.dataset.drag === 'cat') {
    drag = { type: 'cat', cat: el.dataset.cat, ids: [] };
    el.closest('.cat-section').classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    return;
  }
  if (el.dataset.drag === 'row') {
    drag = { type: 'row', cat: el.dataset.cat, row: +el.dataset.row };
    el.closest('.cat-row').classList.add('row-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    return;
  }
  const id = +el.dataset.id;
  // dragging a picked card carries every picked card along; otherwise just this one
  const ids = el.dataset.drag === 'item' && SEL.has(id) ? data.items.filter(i => SEL.has(i.id)).map(i => i.id) : [id];
  drag = { type: el.dataset.drag, id, ids };
  shopGrid.querySelectorAll(`[data-drag="${drag.type}"]`).forEach(x => { if (ids.includes(+x.dataset.id)) x.classList.add('dragging'); });
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', '');
});
shopGrid.addEventListener('dragover', e => {
  if (!drag) return;
  e.preventDefault();
  clearDropMarks();
  dropAt = null;
  if (drag.type === 'row') {
    const rowEl = e.target.closest('.cat-row');
    if (!rowEl) return;
    const zone = rowEl.closest('[data-cat-zone]');
    if (!zone || zone.dataset.catZone !== drag.cat) return;
    const targetRow = +rowEl.dataset.row;
    if (targetRow === drag.row) return;
    const r = rowEl.getBoundingClientRect();
    const after = e.clientY > r.top + r.height / 2;
    dropAt = { type: 'row', row: targetRow, after };
    rowEl.classList.add(after ? 'drop-after-row' : 'drop-before-row');
    return;
  }
  if (drag.type === 'cat') {
    // whole category block: before/after another block (sideways in the poster view, up/down otherwise)
    const sec = e.target.closest('.cat-section[data-cat-zone]');
    if (!sec || sec.dataset.catZone === drag.cat) return;
    const r = sec.getBoundingClientRect();
    const after = document.body.classList.contains('poster')
      ? e.clientX > r.left + r.width / 2
      : e.clientY > r.top + r.height / 2;
    dropAt = { cat: sec.dataset.catZone, after };
    sec.classList.add(after ? 'cat-drop-after' : 'cat-drop-before');
    return;
  }
  const stash = e.target.closest('#stash');
  if (stash) {
    // only shop cards can go into the stash (not sets, not rows already in it)
    if (drag.type === 'item' && drag.ids.some(id => !data.items.find(i => i.id === id).hidden)) {
      dropAt = { stash: true };
      stash.classList.add('drop-zone');
    }
    return;
  }
  const t = e.target.closest(`[data-drag="${drag.type}"]`);
  if (t && drag.ids.includes(+t.dataset.id)) return;
  dropAt = { ref: null, after: false, cat: null };
  if (t) {
    const vertical = t.parentElement.classList.contains('list');
    const r = t.getBoundingClientRect();
    dropAt.after = vertical ? e.clientY > r.top + r.height / 2 : e.clientX > r.left + r.width / 2;
    dropAt.ref = +t.dataset.id;
    t.classList.add(dropAt.after ? 'drop-after' : 'drop-before');
  }
  if (drag.type === 'item') {
    const zone = e.target.closest('[data-cat-zone]');
    const rowEl = e.target.closest('[data-row]');
    if (zone) {
      dropAt.cat = zone.dataset.catZone;
      dropAt.row = rowEl ? +rowEl.dataset.row : 0;
      if (!t) (rowEl || zone).classList.add('drop-zone');
    }
  }
});
shopGrid.addEventListener('drop', e => {
  e.preventDefault();
  if (!drag || !dropAt) return;
  if (drag.type === 'row') { if (dropAt?.type === 'row') moveRow(drag.cat, drag.row, dropAt.row, dropAt.after); }
  else if (drag.type === 'cat') moveCatTo(drag.cat, dropAt.cat, dropAt.after);
  else if (dropAt.stash) stashItems(drag.ids);
  else if (drag.type === 'item' && dropAt.cat) moveItems(drag.ids, dropAt.ref, dropAt.after, dropAt.cat, dropAt.row);
  else if (drag.type === 'set' && dropAt.ref !== null) moveSet(drag.id, dropAt.ref, dropAt.after);
});
shopGrid.addEventListener('dragend', () => {
  drag = dropAt = null;
  clearDropMarks();
  shopGrid.querySelectorAll('[data-drag],.cat-section').forEach(el => { el.draggable = false; el.classList.remove('dragging'); });
  shopGrid.querySelectorAll('.row-dragging').forEach(el => el.classList.remove('row-dragging'));
});

function moveItem(id, ref, after, cat, row) { moveItems([id], ref, after, cat, row); }
// move one or more items (kept in their current order) next to `ref`, or to the end of cat/row
function moveItems(ids, ref, after, cat, row) {
  const r = row > 0 ? row : 0;
  const moving = data.items.filter(i => ids.includes(i.id));
  const list = data.items.filter(i => !ids.includes(i.id));
  for (const it of moving) {
    it.category = cat;
    if (r > 0) it.row = r; else delete it.row;
    delete it.hidden;  // coming out of the stash = listed for sale
  }
  let at;
  if (ref !== null) {
    const k = list.findIndex(i => i.id === ref);
    at = after ? k + 1 : k;
  } else {
    // dropped on the empty part of a row: put them after that row's last item (or the category's)
    let last = -1, lastInCat = -1;
    list.forEach((x, j) => {
      if (catOf(x) !== cat) return;
      lastInCat = j;
      if (rowOf(x) === r) last = j;
    });
    if (last < 0) last = lastInCat;
    at = last < 0 ? list.length : last + 1;
  }
  list.splice(at, 0, ...moving);
  data.items = list;
  clearSel();
  markDirty();
  renderShop();
}
function moveRow(cat, fromRow, toRow, after) {
  const n = rowCount(cat);
  const order = Array.from({length: n}, (_, i) => i);
  order.splice(order.indexOf(fromRow), 1);
  let at = order.indexOf(toRow) + (after ? 1 : 0);
  if (at < 0) at = order.length;
  order.splice(at, 0, fromRow);
  const remap = new Map(order.map((old, idx) => [old, idx]));
  data.items.forEach(i => { if (catOf(i) === cat) i.row = remap.get(rowOf(i)) ?? rowOf(i); });
  markDirty();
  renderShop();
}
// "วางขาย" button in the stash: list it at the end of its own category
function unstash(id) {
  const it = data.items.find(i => i.id === id);
  moveItem(id, null, false, catOf(it), rowOf(it));
}
function stashItems(ids) {
  data.items.forEach(i => { if (ids.includes(i.id)) i.hidden = true; });
  clearSel();
  markDirty();
  renderShop();
}
function moveSet(id, ref, after) {
  const list = data.sets;
  const [s] = list.splice(list.findIndex(x => x.id === id), 1);
  const k = list.findIndex(x => x.id === ref);
  list.splice(after ? k + 1 : k, 0, s);
  markDirty();
  renderShop();
}
// leave screenshot mode with Esc or a click on the header
function leaveSc() { if (document.body.classList.contains('sc')) { document.body.classList.remove('sc'); renderShop(); } }
document.addEventListener('keydown', e => { if (e.key === 'Escape') leaveSc(); });
$('hdr').addEventListener('click', e => { if (!e.target.closest('button')) leaveSc(); });

/* ════════════════ TAB: จัดการ ════════════════ */
function status(el, msg, type) {
  const d = $(el);
  d.className = 'status ' + type;
  d.textContent = msg;
  d.style.display = msg ? '' : 'none';
}
function catOptions(selected) {
  const cats = categories();
  const cur = cats.includes(selected) ? selected : OTHER;
  return cats.map(c => `<option${c === cur ? ' selected' : ''}>${esc(c)}</option>`).join('');
}
function iconColOptions(selected) {
  return [['', 'อัตโนมัติ'], ['2', '2 รูป'], ['3', '3 รูป'], ['4', '4 รูป'], ['5', '5 รูป']]
    .map(([v, t]) => `<option value="${v}"${String(selected || '') === v ? ' selected' : ''}>${t}</option>`).join('');
}
const itemById = id => data.items.find(i => i.id === id);

/* ── show / hide sections in the shop ── */
function renderCatVis() {
  const listed = c => data.items.filter(i => !i.hidden && catOf(i) === c).length;
  const box = (key, label, count, on) => `<label class="${on ? '' : 'off'}">
    <input type="checkbox" data-key="${esc(key)}" ${on ? 'checked' : ''}> ${esc(label)} <small>${count}</small></label>`;
  $('cat-vis').innerHTML =
    box('__sets', '🎁 ขายเป็นเซ็ต', `${data.sets.length} เซ็ต`, !setsHidden()) +
    '<span class="sep"></span>' +
    categories().map(c => box(c, c, `${listed(c)} รายการ`, !catHidden(c))).join('');
}
$('cat-vis').addEventListener('change', e => {
  const key = e.target.dataset.key;
  if (!key) return;
  if (key === '__sets') data.shop.hide_sets = !e.target.checked;
  else {
    const set = new Set(data.shop.hidden_categories || []);
    if (e.target.checked) set.delete(key); else set.add(key);
    data.shop.hidden_categories = [...set];
  }
  markDirty();
  renderCatVis();
});

function renderAll() {
  renderCatVis();
  renderTable();
  renderSets();
  renderSetEditor();
}

/* ── item table ── */
function renderTable() {
  $('total').textContent = data.items.length;
  const tbody = $('item-tbody');
  if (!data.items.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:24px">ยังไม่มีไอเทม</td></tr>';
    return;
  }
  const { left } = allocate(data.items, data.sets);
  tbody.innerHTML = data.items.map((item, i) => {
    const badge = item.stock <= 0 ? '<span class="badge-out">ขายแล้ว</span>' : '<span class="badge-in">มีของ</span>';
    const inSets = (item.stock || 0) - left.get(item.id);
    const used = inSets > 0 ? `<span class="used-note">(เซ็ต ${inSets} แยก ${left.get(item.id)})</span>` : '';
    return `<tr data-k="${i}"${item.hidden ? ' style="opacity:.6"' : ''}>
  <td class="drag-handle" onmousedown="this.parentNode.draggable=true" title="ลากเพื่อเรียงลำดับ">⠿</td>
  <td style="text-align:center"><input type="checkbox" ${item.hidden ? '' : 'checked'} onchange="update(${i},'hidden',!this.checked)" style="width:auto;accent-color:var(--primary)" title="วางขายในหน้าร้าน"></td>
  <td>
    <div class="icon-cell">
      ${img(item.image, '', 'ID: ' + (item.talesbook_id || '-'))}
      <input value="${esc(item.name)}" onchange="update(${i},'name',this.value)" style="font-weight:500;min-width:180px">
    </div>
  </td>
  <td><input type="number" value="${packOf(item)}" min="1" onchange="update(${i},'pack',Math.max(1,parseInt(this.value)||1))" style="width:56px;text-align:center" title="จำนวนชิ้นต่อ 1 ชุด"></td>
  <td><select onchange="update(${i},'category',this.value)" style="width:110px">${catOptions(item.category)}</select></td>
  <td><input type="number" value="${item.price ?? ''}" placeholder="สอบถาม" onchange="update(${i},'price',this.value?parseFloat(this.value):null)" style="width:90px" min="0"></td>
  <td style="text-align:center">
    <input type="number" value="${item.stock ?? 0}" onchange="update(${i},'stock',parseInt(this.value)||0)" style="width:60px;text-align:center" min="0">
    ${badge}${used}
  </td>
  <td>
    <select onchange="update(${i},'unit',this.value)" style="width:70px">
      ${['ชิ้น', 'ชุด', 'อัน'].map(u => `<option${item.unit === u ? ' selected' : ''}>${u}</option>`).join('')}
    </select>
  </td>
  <td><input value="${esc(item.note || '')}" placeholder="—" onchange="update(${i},'note',this.value)"></td>
  <td><button class="btn-del" onclick="delItem(${i})" title="ลบ">🗑</button></td>
</tr>`;
  }).join('');
}

function update(i, field, val) { data.items[i][field] = val; markDirty(); renderAll(); }
function delItem(i) {
  const item = data.items[i];
  const inSets = data.sets.filter(s => s.parts.some(p => p.item === item.id));
  const warn = inSets.length ? `\n(จะถูกเอาออกจากเซ็ต: ${inSets.map(s => s.name).join(', ')})` : '';
  if (!confirm('ลบ "' + fullName(item) + '" ใช่ไหม?' + warn)) return;
  data.items.splice(i, 1);
  data.sets.forEach(s => { s.parts = s.parts.filter(p => p.item !== item.id); });
  draft.parts = draft.parts.filter(p => p.item !== item.id);
  markDirty();
  renderAll();
}

/* ── drag-to-reorder helper (item table, set table, parts of a set) ── */
function makeSortable(container, rowSel, getList, onDone) {
  let from = null;
  const clear = () => container.querySelectorAll('.drop-above,.drop-below').forEach(r => r.classList.remove('drop-above', 'drop-below'));
  container.addEventListener('dragstart', e => {
    const r = e.target.closest(rowSel);
    if (!r) return;
    from = +r.dataset.k;
    r.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  });
  container.addEventListener('dragover', e => {
    if (from === null) return;
    e.preventDefault();
    clear();
    const r = e.target.closest(rowSel);
    if (!r || +r.dataset.k === from) return;
    const b = r.getBoundingClientRect();
    r.classList.add(e.clientY > b.top + b.height / 2 ? 'drop-below' : 'drop-above');
  });
  container.addEventListener('drop', e => {
    e.preventDefault();
    const r = e.target.closest(rowSel);
    if (from === null || !r || +r.dataset.k === from) return;
    let to = +r.dataset.k + (r.classList.contains('drop-below') ? 1 : 0);
    if (from < to) to--;
    const list = getList();
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    from = null;
    onDone();
  });
  container.addEventListener('dragend', () => {
    from = null;
    clear();
    container.querySelectorAll(rowSel).forEach(r => { r.draggable = false; r.classList.remove('dragging'); });
  });
  document.addEventListener('mouseup', () => {
    if (from === null) container.querySelectorAll(rowSel + '[draggable="true"]').forEach(r => r.draggable = false);
  });
}

/* ── set builder ── */
let draft = { parts: [] };
let editingSetId = null;

// "มี 3 (เซ็ต 1 แยก 2)" (counts from the saved sets, not the one being edited)
function stockSplit(item, left) {
  const total = item.stock || 0;
  const single = left.get(item.id);
  return `<small>มี ${total} (เซ็ต ${total - single} แยก ${single})</small>`;
}

function renderPicker() {
  const q = $('s-q').value.toLowerCase().trim();
  const taken = new Set(draft.parts.map(p => p.item));
  const list = data.items.filter(i => !taken.has(i.id) && (!q || i.name.toLowerCase().includes(q))).slice(0, 60);
  const { left } = allocate(data.items, data.sets);
  $('s-picker').innerHTML = list.length
    ? list.map(i => `<div class="pick" onclick="addPart(${i.id})">
        ${img(i.image)}<span class="nm">${esc(fullName(i))}</span>${stockSplit(i, left)}<b>+</b>
      </div>`).join('')
    : '<div class="empty-hint">ไม่พบไอเทม</div>';
}

function renderSetEditor() {
  const { left } = allocate(data.items, data.sets);
  $('s-parts').innerHTML = draft.parts.length
    ? draft.parts.map((p, k) => {
        const it = itemById(p.item);
        return `<div class="part" data-k="${k}">
          <span class="grip" onmousedown="this.parentNode.draggable=true" title="ลากเพื่อเรียงลำดับ">⠿</span>
          ${img(it.image)}<span class="nm">${esc(fullName(it))}</span>${stockSplit(it, left)}
          <input type="number" min="1" value="${p.qty}" onchange="setPartQty(${k}, this.value)" title="จำนวนต่อ 1 เซ็ต">
          <button class="btn-del" onclick="removePart(${k})" title="เอาออก">✕</button>
        </div>`;
      }).join('')
    : '<div class="empty-hint">ยังไม่มีไอเทม — กดเลือกจากทางซ้าย</div>';

  // preview: how many sets this draft would make after the other sets take their share
  const others = data.sets.filter(s => s.id !== editingSetId);
  const max = $('s-max').value;
  const probe = { id: '__draft', parts: draft.parts, max: max === '' ? null : +max };
  const n = draft.parts.length ? allocate(data.items, [...others, probe]).count.get('__draft') : 0;
  const pv = $('s-preview');
  pv.className = 'status ' + (draft.parts.length ? (n > 0 ? 'ok' : 'err') : 'info');
  pv.textContent = draft.parts.length ? `ทำได้ ${n} เซ็ต` : 'เลือกไอเทมอย่างน้อย 1 ชิ้น';
  renderPicker();
}

function addPart(id) { draft.parts.push({ item: id, qty: 1 }); renderSetEditor(); }
function removePart(k) { draft.parts.splice(k, 1); renderSetEditor(); }
function setPartQty(k, v) { draft.parts[k].qty = Math.max(1, parseInt(v) || 1); renderSetEditor(); }

function saveSet() {
  const name = $('s-name').value.trim();
  if (!name) { status('set-status', '⚠️ ตั้งชื่อเซ็ตด้วยนะคะ', 'err'); return; }
  if (!draft.parts.length) { status('set-status', '⚠️ เลือกไอเทมใส่เซ็ตก่อนนะคะ', 'err'); return; }
  const priceV = $('s-price').value, maxV = $('s-max').value;
  const fields = {
    name,
    price: priceV ? parseFloat(priceV) : null,
    max: maxV === '' ? null : Math.max(0, parseInt(maxV) || 0),
    icon_cols: parseInt($('s-icols').value) || null,
    note: $('s-note').value.trim(),
    parts: draft.parts.map(p => ({ item: p.item, qty: p.qty }))
  };
  if (editingSetId !== null) {
    Object.assign(data.sets.find(s => s.id === editingSetId), fields);
    status('set-status', '✅ แก้ไขเซ็ตแล้ว', 'ok');
  } else {
    const id = data.sets.length ? Math.max(...data.sets.map(s => s.id)) + 1 : 1;
    data.sets.push({ id, ...fields });
    status('set-status', '✅ สร้างเซ็ตแล้ว', 'ok');
  }
  markDirty();
  resetSetForm(true);
}

function resetSetForm(keepStatus) {
  editingSetId = null;
  draft = { parts: [] };
  ['s-name', 's-price', 's-max', 's-note', 's-q', 's-icols'].forEach(x => $(x).value = '');
  $('s-save').textContent = '+ สร้างเซ็ต';
  $('s-cancel').hidden = true;
  if (keepStatus !== true) status('set-status', '', 'info');
  renderAll();
}

function editSet(id) {
  const s = data.sets.find(x => x.id === id);
  editingSetId = id;
  draft = { parts: s.parts.map(p => ({ ...p })) };
  $('s-name').value = s.name;
  $('s-price').value = s.price ?? '';
  $('s-max').value = s.max ?? '';
  $('s-note').value = s.note || '';
  $('s-icols').value = s.icon_cols || '';
  $('s-save').textContent = '✔ บันทึกการแก้ไขเซ็ต';
  $('s-cancel').hidden = false;
  status('set-status', '✏️ กำลังแก้ไข "' + s.name + '"', 'info');
  renderSetEditor();
  $('set-panel').scrollIntoView({ behavior: 'smooth' });
}

function delSet(id) {
  const s = data.sets.find(x => x.id === id);
  if (!confirm('ลบเซ็ต "' + s.name + '" ใช่ไหม? (ไอเทมจะกลับไปขายแยก)')) return;
  data.sets = data.sets.filter(x => x.id !== id);
  markDirty();
  if (editingSetId === id) resetSetForm(); else renderAll();
}

function renameSet(id, name) {
  name = name.trim();
  if (name) {
    data.sets.find(x => x.id === id).name = name;
    if (editingSetId === id) $('s-name').value = name;
    markDirty();
  }
  renderSets();
}
function setIconCols(id, v) {
  data.sets.find(x => x.id === id).icon_cols = v ? parseInt(v) : null;
  if (editingSetId === id) $('s-icols').value = v;
  markDirty();
}

function renderSets() {
  $('s-cols').value = data.shop.set_columns || '';
  $('set-total').textContent = data.sets.length;
  const tbody = $('set-tbody');
  if (!data.sets.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:18px">ยังไม่มีเซ็ต</td></tr>';
    return;
  }
  const { count } = allocate(data.items, data.sets);
  tbody.innerHTML = data.sets.map((s, k) => {
    const parts = s.parts.map(p => ({ ...p, it: itemById(p.item) })).filter(p => p.it);
    return `<tr data-k="${k}">
  <td class="drag-handle" onmousedown="this.parentNode.draggable=true" title="ลากเพื่อเรียงลำดับเซ็ต">⠿</td>
  <td>
    <input value="${esc(s.name)}" onchange="renameSet(${s.id}, this.value)" title="แก้ชื่อเซ็ตได้ตรงนี้" style="font-weight:600;min-width:160px">
    ${s.note ? `<span class="used-note">${esc(s.note)}</span>` : ''}
  </td>
  <td>
    <div class="set-mini">${parts.map(p => img(p.it.image, '', fullName(p.it))).join('')}</div>
    <span style="font-size:.75rem;color:var(--muted)">${parts.map(p => esc(fullName(p.it)) + (p.qty > 1 ? ' ×' + p.qty : '')).join(', ')}</span>
  </td>
  <td><select onchange="setIconCols(${s.id}, this.value)" style="width:90px">${iconColOptions(s.icon_cols)}</select></td>
  <td style="white-space:nowrap">${s.price ? s.price.toLocaleString('th-TH') + ' ฿' : 'สอบถาม'}</td>
  <td style="white-space:nowrap">${count.get(s.id) || 0} เซ็ต${s.max != null ? `<span class="used-note">สูงสุด ${s.max}</span>` : ''}</td>
  <td style="white-space:nowrap">
    <button class="btn-edit" onclick="editSet(${s.id})" title="แก้ไข">✏️</button>
    <button class="btn-del" onclick="delSet(${s.id})" title="ลบ">🗑</button>
  </td>
</tr>`;
  }).join('');
}

$('s-q').addEventListener('input', renderPicker);
$('s-max').addEventListener('input', renderSetEditor);
$('s-cols').addEventListener('change', e => { data.shop.set_columns = e.target.value ? parseInt(e.target.value) : null; markDirty(); });
$('s-icols').innerHTML = iconColOptions(null);

makeSortable($('item-tbody'), 'tr[data-k]', () => data.items, () => { markDirty('เปลี่ยนลำดับแล้ว — ยังไม่บันทึก'); renderAll(); });
makeSortable($('set-tbody'), 'tr[data-k]', () => data.sets, () => { markDirty('เปลี่ยนลำดับเซ็ตแล้ว — ยังไม่บันทึก'); renderAll(); });
makeSortable($('s-parts'), '.part[data-k]', () => draft.parts, renderSetEditor);

/* ════════════════ SAVE (writes items.js) ════════════════ */
function getJS() {
  const copy = JSON.parse(JSON.stringify(data));
  copy.shop.updated = today();
  return 'var SHOP_DATA = ' + JSON.stringify(copy, null, 2) + ';\n';
}
function saved(msg) {
  dirty = false;
  data.shop.updated = today();
  $('btn-save').classList.remove('dirty');
  $('export-status').textContent = msg;
  if (tab === 'shop') renderShop(); else renderHeader();
}
async function saveData() {
  const st = $('export-status');
  if (location.protocol !== 'file:') {
    // opened through server.js — it writes items.js
    try {
      st.textContent = '⏳ กำลังบันทึก…';
      const r = await fetch('/save', { method: 'POST', body: getJS() });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      saved('✅ บันทึกแล้ว!');
    } catch (e) { st.textContent = '❌ ' + e.message; }
  } else if (window.showSaveFilePicker) {
    // opened from the folder in Chrome/Edge — write straight into the chosen items.js
    try {
      const handle = await getSaveHandle();
      if (!handle) { st.textContent = 'ยกเลิกการบันทึก'; return; }
      const w = await handle.createWritable();
      await w.write(getJS());
      await w.close();
      $('btn-pick').hidden = false;
      saved('✅ บันทึกลง ' + handle.name + ' แล้ว!');
    } catch (e) { st.textContent = '❌ ' + e.message; }
  } else {
    // other browsers — download a new items.js
    const a = document.createElement('a');
    a.href = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(getJS());
    a.download = 'items.js';
    a.click();
    saved('✅ ดาวน์โหลดแล้ว — นำไปแทนไฟล์เดิม');
  }
}

/* remember the chosen items.js (IndexedDB keeps the file handle across reloads) */
let saveHandle = null;
function idb(mode, fn) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('tr-admin', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('kv');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const req = fn(open.result.transaction('kv', mode).objectStore('kv'));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    };
  });
}
async function getSaveHandle() {
  if (!saveHandle) {
    try { saveHandle = await idb('readonly', s => s.get('items-handle')) || null; } catch {}
  }
  if (saveHandle) {
    const opts = { mode: 'readwrite' };
    if (await saveHandle.queryPermission(opts) === 'granted' ||
        await saveHandle.requestPermission(opts) === 'granted') return saveHandle;
  }
  return pickSaveFile();
}
async function pickSaveFile() {
  try {
    saveHandle = await window.showSaveFilePicker({
      suggestedName: 'items.js',
      types: [{ description: 'items.js', accept: { 'text/javascript': ['.js'] } }]
    });
  } catch (e) {
    if (e.name === 'AbortError') return null;
    throw e;
  }
  try { await idb('readwrite', s => s.put(saveHandle, 'items-handle')); } catch {}
  return saveHandle;
}
async function changeSaveFile() {
  try {
    const h = await pickSaveFile();
    $('export-status').textContent = h ? '📁 จะบันทึกลง ' + h.name : '';
  } catch (e) { $('export-status').textContent = '❌ ' + e.message; }
}

/* ════════════════ START ════════════════ */
if (!window.SHOP_DATA) {
  $('load-notice').hidden = false;
  $('load-notice').textContent = '⚠️ โหลด items.js ไม่ได้ — ตรวจสอบว่าไฟล์ items.js อยู่ในโฟลเดอร์เดียวกัน';
}
if (new URLSearchParams(location.search).has('screenshot')) { document.body.classList.add('sc'); tab = 'shop'; }
showTab(tab);
