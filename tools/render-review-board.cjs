'use strict';
// Local QA only: render a contact sheet from screenshots captured in a native browser.
// node tools/render-review-board.cjs [manifest.json] [output-directory]
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const sharp = require('sharp');
const names = {
  lobby: '遊戲大廳',
  login: '登入／註冊',
  achievements: '成就收藏冊',
  'draw-words': '你畫我猜題庫',
  gifts: '送禮題庫',
  music: '音樂庫',
  community: '留言板',
  credits: '製作與素材',
  rules: '遊戲規則',
  settings: '帳號與形象設定',
  collection: '收藏庫',
  profile: '我的角色',
  history: '對局歷史',
  draw: '你畫我猜',
  musicquiz: '猜歌',
  minimal: '極簡畫家',
  bluff: '瞎掰王',
  telephone: '電話畫猜',
  studio: '畫室',
  majority: '同頻俱樂部',
  trpg: '霧港跑團',
  gift: '送禮達人',
  admin: '管理後台',
  poker: '德州撲克',
  market: '股市冥燈',
  quacks: '郎中闖江湖',
  race: '雷霆之路',
  'admin-game-audio': '猜歌音檔管理',
  'sound-library': '音效素材庫',
};
async function main() {
  const manifest = path.resolve(process.argv[2] || 'work/preview/review-shots.json');
  const root = path.resolve(process.argv[3] || 'work/preview/review-board');
  const input = path.join(path.dirname(manifest), 'shots');
  await fs.mkdir(root, { recursive: true });
  const rows = JSON.parse(await fs.readFile(manifest, 'utf8'));
  for (const row of rows) {
    if (path.basename(row.file) !== row.file || !/^[a-z0-9-]+\.png$/.test(row.file))
      throw Error('Invalid screenshot filename');
    const source = path.join(input, row.file),
      metadata = await sharp(source).metadata();
    row.width = metadata.width;
    row.height = metadata.height;
    row.thumb = row.file.replace(/\.png$/, '.webp');
    await fs.copyFile(source, path.join(root, row.file));
    await sharp(source)
      .resize({ width: 480, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(path.join(root, row.thumb));
    row.name = names[row.id] || row.id;
  }
  const data = JSON.stringify(rows).replace(/</g, '\\u003c');
  const html = `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BGA 全頁驗收畫布 · 2.19.2</title>
<style>
:root{color-scheme:light dark;--bg:light-dark(#f4f3ee,#171916);--fg:light-dark(#20211e,#f5f3ee);--panel:light-dark(#fff,#252821);--muted:light-dark(#5b6056,#bfc6b7);--line:light-dark(#c8cec1,#505a47);--accent:light-dark(#0051b8,#9ac0ff)}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,"Microsoft JhengHei",sans-serif}header{position:sticky;top:0;z-index:2;padding:16px 24px;background:var(--panel);border-bottom:1px solid var(--line)}h1{font-size:22px;margin:0}header p{margin:4px 0 12px;color:var(--muted)}.controls{display:flex;flex-wrap:wrap;align-items:center;gap:12px}label{display:flex;align-items:center;gap:8px}select,input,button{font:inherit;color:var(--fg);background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:7px 10px}button{cursor:pointer}button:hover{border-color:var(--accent)}:focus-visible{outline:3px solid var(--accent);outline-offset:2px}input[type=range]{width:150px}main{padding:24px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,var(--tile,340px)),1fr));gap:20px}.tile{min-width:0;background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}.caption{padding:12px;display:grid;gap:6px}.caption h2{font-size:17px;margin:0}.meta{font-size:13px;color:var(--muted)}.image{display:block;padding:0;border:0;border-radius:0;width:100%;height:230px;background:var(--bg)}.image img{display:block;width:100%;height:100%;object-fit:contain}.reviewed{color:var(--muted);font-size:14px}.reviewed input{width:18px;height:18px}.missing{display:grid;place-items:center;height:230px;color:var(--muted)}.tile select{width:100%;font-size:14px}.empty{padding:24px}dialog{padding:0;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--fg);width:calc(100vw - 32px);height:calc(100dvh - 32px);max-width:none;max-height:none}dialog::backdrop{background:#000b}.dialog-head{position:sticky;top:0;display:flex;align-items:center;gap:12px;justify-content:space-between;padding:12px;background:var(--panel);border-bottom:1px solid var(--line);z-index:1}.dialog-head strong{overflow-wrap:anywhere}.original{display:block;max-width:100%;height:auto;margin:auto}.original.actual{max-width:none;margin:0}dialog .scroll{overflow:auto;height:calc(100% - 70px)}a{color:var(--accent)}@media(max-width:600px){header,main{padding:12px}.controls{gap:8px}.image{height:210px}.dialog-head{flex-wrap:wrap}.dialog-head strong{width:100%}dialog .scroll{height:calc(100% - 110px)}}
</style><header><h1>BGA 全頁驗收畫布</h1><p id="summary"></p><div class="controls"><label>主題<select id="theme"><option value="dark">深色</option><option value="light">淺色</option></select></label><label>尺寸<select id="device"><option value="desktop">桌機</option><option value="mobile">手機</option></select></label><label>縮圖大小<input id="zoom" type="range" min="220" max="700" step="40" value="340"></label><label>搜尋<input id="search" type="search" placeholder="頁名或路徑"></label><output id="progress" aria-live="polite"></output></div></header><main id="board"></main><dialog id="detail"><div class="dialog-head"><strong id="detail-title"></strong><button id="actual" type="button">原始大小</button><a id="source" target="_blank" rel="noopener">開啟頁面</a><button id="close" type="button">關閉</button></div><div class="scroll"><img id="original" class="original" alt=""></div></dialog>
<script>
const shots=${data},ids=[...new Set(shots.map(s=>s.id))],board=document.querySelector('#board'),theme=document.querySelector('#theme'),device=document.querySelector('#device'),search=document.querySelector('#search'),dialog=document.querySelector('#detail'),original=document.querySelector('#original');
const stateKey='bga-review-151-v2.19.2';let checked={};try{checked=JSON.parse(localStorage.getItem(stateKey)||'{}')}catch{}
function progress(){document.querySelector('#progress').textContent=ids.filter(id=>checked[id]).length+' / '+ids.length+' 頁已檢查'}
function label(s){return s.caption||((s.mode.includes('active')?'遊戲進行中':s.mode.includes('result')?'結果':s.mode.includes('dialog')?'對話框':'頁面入口')+' · '+s.width+' × '+s.height)}
function open(s){document.querySelector('#detail-title').textContent=s.name+' · '+label(s);original.src=s.file;original.alt=s.name+'完整渲染';original.classList.remove('actual');document.querySelector('#actual').textContent='原始大小';document.querySelector('#source').href='http://127.0.0.1:15003'+s.path;dialog.showModal()}
function draw(){board.replaceChildren();const mode=theme.value+'-'+device.value;for(const id of ids){const all=shots.filter(s=>s.id===id),name=all[0].name;if(!(name+' '+all[0].path).toLowerCase().includes(search.value.toLowerCase()))continue;const variants=all.filter(s=>s.mode===mode||s.mode.endsWith('-'+mode));const tile=document.createElement('article');tile.className='tile';const image=document.createElement('button');image.type='button';image.className='image';image.setAttribute('aria-label','放大'+name);const img=document.createElement('img');img.loading='eager';img.alt=name;image.append(img);const caption=document.createElement('div');caption.className='caption';const heading=document.createElement('h2');heading.textContent=name;const meta=document.createElement('div');meta.className='meta';const select=document.createElement('select');select.setAttribute('aria-label',name+'畫面階段');for(const s of variants){const option=document.createElement('option');option.textContent=label(s);select.append(option)}let selected=variants[0];function update(){selected=variants[select.selectedIndex];if(selected){img.src=selected.thumb;meta.textContent=selected.path+' · '+(selected.scheme?selected.scheme:'獨立固定配色')+' · '+(selected.manual?'含圖像／特效，需人工確認':'已量測文字對比');image.disabled=false}else{img.removeAttribute('src');meta.textContent='此組合未拍攝';image.disabled=true}}select.onchange=update;image.onclick=()=>selected&&open(selected);const review=document.createElement('label');review.className='reviewed';const box=document.createElement('input');box.type='checkbox';box.checked=!!checked[id];box.onchange=()=>{checked[id]=box.checked;try{localStorage.setItem(stateKey,JSON.stringify(checked))}catch{}progress()};review.append(box,document.createTextNode('已檢查'));caption.append(heading,meta,select,review);tile.append(image,caption);board.append(tile);update()}progress()}
theme.onchange=device.onchange=search.oninput=draw;document.querySelector('#zoom').oninput=e=>board.style.setProperty('--tile',e.target.value+'px');document.querySelector('#close').onclick=()=>dialog.close();document.querySelector('#actual').onclick=()=>{original.classList.toggle('actual');document.querySelector('#actual').textContent=original.classList.contains('actual')?'適合視窗':'原始大小'};document.querySelector('#summary').textContent=ids.length+' 個頁面 · '+shots.length+' 張實際渲染圖 · 2.19.2 · 點圖查看完整長頁；遊戲階段由各卡選單切換。';draw();
</script></html>`;
  await fs.writeFile(path.join(root, 'index.html'), html);
  console.log(
    JSON.stringify({ root, pages: new Set(rows.map((r) => r.id)).size, screenshots: rows.length }),
  );
  http
    .createServer(async (req, res) => {
      const name = new URL(req.url, 'http://127.0.0.1').pathname.slice(1) || 'index.html';
      if (!/^(?:index\.html|[a-z0-9-]+\.(?:png|webp))$/.test(name)) {
        res.writeHead(404);
        res.end();
        return;
      }
      try {
        const bytes = await fs.readFile(path.join(root, name));
        res.writeHead(200, {
          'Content-Type': name.endsWith('.html')
            ? 'text/html; charset=utf-8'
            : name.endsWith('.png')
              ? 'image/png'
              : 'image/webp',
          'Cache-Control': 'no-store',
        });
        res.end(bytes);
      } catch {
        res.writeHead(404);
        res.end();
      }
    })
    .listen(15004, '127.0.0.1', () => console.log('Review board: http://127.0.0.1:15004'));
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
