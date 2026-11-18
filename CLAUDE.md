# TalesRunner item shop — project notes for Claude

The owner sells TalesRunner in-game items. The site is in Thai and is shared with customers **as screenshots**, so nothing is hidden from viewers on purpose: the admin tab is visible and that's fine. Reply to the owner in Thai or English to match their message. They prefer short answers and don't want long testing loops for small changes.

## Files
| File | Purpose |
|---|---|
| `admin.html` | **The app (owner's editor).** This was `shop.html`; it was renamed on 2026-11-17. One file with 2 tabs: 🛒 หน้าร้าน (shop) and ⚙️ จัดการ (manage). All new work goes here. |
| `index.html` | **Public copy for GitHub Pages.** It is identical to `admin.html` except for one extra line, `<style>#btn-edit,#btn-save,#btn-pick,#tabbtn-admin{display:none!important}</style>`, which hides editing. **After changing admin.html, re-sync index.html**: copy it and re-add that line. |
| `board.html` | **Screenshot board** (made 2026-11-17). It is a fixed grid of cols × rows slots that never reflows. Boxes are free blocks with any title, not tied to a category. They snap to the slots: drag the title to move a box, drag the corner to resize it, and double-click or ✏️ to rename it. Each item sits at **its own spot** inside a box, so empty gaps are allowed. Dropping onto an occupied spot swaps the two. ⇱ packs the items to the top-left. The right panel lists every sellable item not yet on the board, and it is independent of admin's `hidden`/`category`. Sets are not shown. Data is stored in the same items.js under `shop.board = {cols, rows, size:'s'|'m'|'l', boxes:[{id,title,x,y,w,h,items:[{id,x,y}]}]}`. Older `{cat,...}` boxes are migrated automatically. It has its own copy of the shared helpers and save code (same IndexedDB handle as admin). If items.js is saved from admin while board is open, reload board first, or its save overwrites admin's changes. |
| `items.js` | The data: `var SHOP_DATA = {...};`, loaded with a `<script>` tag so the page works from `file://`. The owner edits it through the page and has set many prices and orders by hand, so **never regenerate or overwrite it**. Edit it surgically, and back it up first. |
| `server.js` | Optional: `node server.js` starts port 3000, and `POST /save` writes `items.js`. It opens admin.html. |
| `_tmp_check.js` | Leftover script extracted for a syntax check. Safe to delete. |
| `.git/`, `.gitattributes` | GitHub repo `https://github.com/putter3k/tr-shop` (branch main). The owner commits from another PC; git is **not installed on this PC**. |
| `dl.js` | Downloads icons by Tales Book ID into `images/<id>.png`. |
| `fetch-item.js` | Looks up items on Tales Book. |
| `snap.ps1` / `snap.bat` | Points at `index.html` (fixed 2026-11-17). Takes a headless Edge/Chrome screenshot of `<page>?screenshot`, trims the blank bottom, and splits into 2 images if very tall. Output goes to `screenshots/shop-yyyyMMdd-HHmm(-1/-2).png`. Options: `-Parts auto\|1\|2 -Width 1600 -NoOpen`. **Keep the file as UTF-8 with BOM** (it contains Thai text for PowerShell 5.1). |
| `stock20261116.md` | Inventory read from 47 game screenshots (`Screenshot 20261116/`): 374 slots, 110 kinds. |
| `backups/20261117-0410/` | Full backup of everything as of 2026-11-17. |

## Data model (`SHOP_DATA`)
- `shop`:
  - Basics: `name`, `contact_url` (still a placeholder), `contact_label`, `updated`.
  - Categories:
    - `categories`: an ordered array. `'อื่น ๆ'` (OTHER) is always last and can't be moved or deleted.
    - `series`, `set_columns`.
    - `hidden_categories`: an array. The key `'__sets'` hides the whole set section.
    - `hide_sets`.
    - `cat_rows`: `{cat: number of rows}`.
    - `set_rows`: number of rows in the set section.
  - `updated` now includes Thai time: `YYYY-MM-DDTHH:MM` (UTC+7), displayed as "17 พ.ย. 2569 13:01 น.".
- `items[]`:
  - Identity: `id`, `talesbook_id`, `name`.
  - Stock: `pack` (pieces per pack; a multi-piece item is split into one row per pack size, and the pack shows on a 2nd line), `stock`, `unit`.
  - Display: `category`, `image`, `price`, `note`, `row` (0-based row inside its category).
  - `hidden`: true means the item is in the stash (คลัง) and not shown in the shop.
- `sets[]`: `id`, `name`, `price`, `max`, `icon_cols`, `note`, `row` (0-based set row), `parts:[{item, qty}]`.
- `allocate(items, sets)` gives pieces to sets in set order and returns `{count, left}`. Singles are shown with `stock = left`. Admin shows the split as "มี 3 (เซ็ต 1 แยก 2)".

## Features done in admin.html (formerly shop.html)
- Added on the other PC (2026-11-17):
  - **Drag whole rows**: the ⠿ row label moves a row up or down within a category, or into another category (`moveRow`).
  - **Set rows**: the set section has ＋/－ แถว buttons. Sets drag into rows, and set rows drag to reorder (`setRowCount`, `addSetRow`, `removeSetRow`, `moveSetRow`, `moveSetToRow`).
  - The date shows the time.
- Sets section ("ขายเป็นเซ็ต") and singles section ("ขายแยกชิ้น") grouped by category.
- Manage tab:
  - Category visibility checkboxes.
  - Set builder: pick parts, drag their order, set icon columns per set, rename.
  - Item table with drag order. No add-item form; the save button is at the top.
- Shop tab → **✏️ แก้ไขหน้าร้าน** (edit mode):
  - Prices are edited inline. Cards drag between categories and rows, and **multi-select** works with click + drag (Esc clears).
  - Right-side **stash (คลัง)**: drag items in and out. Each category has a 📦 เก็บทั้งหมด button. The stash excludes pieces fully used in sets.
  - Category tools: add, rename, delete, ▲▼, and ＋/－ rows (no limit per row). Hidden categories are hidden in edit mode too.
  - **▦ มุมมองแคปจอ** (poster view) edits in the same layout as the screenshot. **Drag category blocks** by their ⠿ header to reorder them; the pink line shows before or after. This was the latest feature. It passed in headless Edge, but **real mouse drag was not yet confirmed by the owner**.
- 💾 บันทึก turns yellow when there are unsaved changes. It saves via server.js if it is running. Otherwise, in Chrome/Edge it uses the File System Access API with the file handle kept in IndexedDB. Otherwise it downloads `items.js`.
- Screenshot mode: `index.html?screenshot` / `admin.html?screenshot` or the 📷 button (Esc or a header click exits). Poster CSS uses `body:is(.sc,.poster)`.

## Tales Book (icons and names)
- Search: `https://talesbook.org/api/items?q=<name>&page=N` (60 per page; some items need paging).
- Item: `/api/items/<id>`. Icon: `https://cdn.talesbook.org/<icon>`.
- Fixed IDs:
  - ตั๋วเทลส์ = 58368
  - กำไลดินแดนสายลม = 49657
  - ปิเอโร่ = 125314 / 125308 / 125302
  - I am เนสสึ = 80177
  - คริส = 89906
- Not for sale: เลนส์. "(ความทนทาน)" is removed from names.

## Testing tips
- Node is installed but may not be on PATH, so call it by full path. Syntax-check with `node --check` on the extracted script.
- Headless Edge is at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`. Screenshot a temporary `_test-*.html` copy with an injected probe script and delete it afterwards. Never test on the real items.js in a way that saves.
- PowerShell 5.1: `.ps1` files with Thai text need a BOM. Launch native exes with `Start-Process -Wait` to avoid NativeCommandError.

## Possible next steps (offered, not requested)
- Confirm that poster-view block dragging feels OK with a real mouse.
- Have the owner test board.html with a real mouse. Possible extras: multi-select drag on the board, and a snap.ps1 option for board.html.
- Add a small script that syncs index.html from admin.html automatically.
- Set a real `contact_url`.
- A phone-width option for snap.
