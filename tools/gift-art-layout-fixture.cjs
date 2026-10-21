'use strict';
// Manual browser regression: node tools/gift-art-layout-fixture.cjs
// Install frontend dependencies first. Open the printed loopback URL at desktop/mobile sizes.
const http = require('node:http');
const path = require('node:path');
const sass = require('../frontend/node_modules/sass');
const css = sass.compile(path.join(__dirname, '../frontend/src/styles/gift.scss')).css;
const images = [
  ['square', 72, 72],
  ['wide', 1600, 90],
  ['tall', 90, 1600],
  ['large-transparent', 4096, 4096],
];
const art = images.map(([name, width, height]) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 100 100"><rect x="5" y="5" width="90" height="90" fill="teal"/><circle cx="50" cy="50" r="25" fill="gold"/></svg>`;
  return `<span class="vue-gift-art" data-case="${name}"><img alt="" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></span>`;
});
art.push(
  '<span class="vue-gift-art" data-case="fallback"><span aria-hidden="true">🎁</span></span>',
);
const title = '<strong>可以完整換行的長禮物名稱與必要說明，不應被圖片遮蓋</strong>';
const sections = [
  `<div class="vue-gift-card-grid">${art.map((a) => `<button>${a}${title}<small>選禮／心願</small></button>`).join('')}</div>`,
  `<div class="vue-gift-delivery-grid">${art.map((a) => `<article><strong>朋友送來</strong>${a}<h3>禮物名稱</h3><p>最想要 · +3</p></article>`).join('')}</div>`,
  ...art.map(
    (a) => `<article class="vue-gift-result-entry">${a}<div>${title}</div><b>+3</b></article>`,
  ),
  ...art.map(
    (a) =>
      `<section class="vue-gift-spotlight">${a}<p>朋友送來的禮物</p><button>跳過</button></section>`,
  ),
].join('');
const html = `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GiftArt 圖片邊界回歸</title><style>${css}
body{margin:16px;font:16px/1.5 sans-serif;--play-line:#777;--play-surface:#fff;--play-ink:#222}main{display:grid;gap:16px}</style>
<h1>GiftArt 圖片邊界回歸</h1><p>使用實際 gift.scss；選禮、收禮、明細、焦點 × 方／橫／直／大透明圖／fallback。</p><output id="report">等待圖片載入</output><main>${sections}</main>
<script>
window.addEventListener('load',()=>{
 const failures=[],slots=document.querySelectorAll('.vue-gift-art');
 for(const slot of slots){
  const image=slot.firstElementChild,a=slot.getBoundingClientRect(),b=image.getBoundingClientRect();
  if(b.left<a.left-.5||b.right>a.right+.5||b.top<a.top-.5||b.bottom>a.bottom+.5)failures.push(slot.dataset.case+':overflow');
  if(image.tagName==='IMG'&&(!image.complete||!image.naturalWidth))failures.push(slot.dataset.case+':not-loaded');
  if(slot.parentElement.matches('button,.vue-gift-delivery-grid article')&&slot.nextElementSibling.getBoundingClientRect().top<b.bottom-.5)failures.push(slot.dataset.case+':title-overlap');
 }
 if(document.documentElement.scrollWidth>innerWidth)failures.push('page:horizontal-overflow');
 document.querySelector('#report').textContent=failures.length?'FAIL '+failures.join(', '):'PASS '+slots.length+'/'+slots.length+' 圖片槽，無水平溢出';
});</script></html>`;
http
  .createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  })
  .listen(15000, '127.0.0.1', () => console.log('GiftArt regression: http://127.0.0.1:15000'));
