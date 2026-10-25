'use strict';

const { prepaint } = require('../../frontend/src/engines/prepaint.js');

const markup = `<dialog id="entry-intro" data-ui-dialog-frame="true" open aria-label="網站開場" tabindex="-1">
  <div class="entry-intro-art">
    <img data-entry-src="/assets/auth/login-864.webp" width="864" height="486" fetchpriority="high" alt="歡迎來到 Ave Mujica 的世界">
    <span class="entry-intro-brand">302捉猶團</span>
  </div>
  <button class="entry-intro-skip" type="button" aria-label="略過開場動畫">略過開場 <span aria-hidden="true">→</span></button>
  <button class="entry-intro-sound" type="button" hidden>播放入場音效 ♪</button>
</dialog>`;

// Decorate built documents after the normal authorization checks.
// The document and its requests load normally beneath this temporary overlay.
function withEntryIntro(document, { authPage = false } = {}) {
  const html = Buffer.isBuffer(document) ? document.toString('utf8') : document;
  if (
    html.includes('id="entry-intro"') ||
    !/<html\b/i.test(html) ||
    !/<(?:body|main)\b/i.test(html)
  )
    return document;
  const assets = `<link rel="stylesheet" href="/shared/entry-intro.css">`;
  const overlay = authPage ? '' : markup;
  // Some legacy documents omit optional head/body tags. Keep those documents intact.
  if (!/<body\b/i.test(html))
    return html.replace(
      /<main\b/i,
      `<script data-prepaint>(${prepaint.toString()})();</script>` + assets + overlay + '<main',
    );
  const paint = `<script data-prepaint>(${prepaint.toString()})();</script>`;
  const painted = /<head\b/i.test(html)
    ? html.replace(/<head\b[^>]*>/i, (tag) => tag + paint)
    : html.replace(/<html\b[^>]*>/i, (tag) => tag + paint);
  const hasHead = /<\/head\s*>/i.test(html);
  return painted
    .replace(/<\/head\s*>/i, assets + '</head>')
    .replace(/<body\b[^>]*>/i, (tag) => tag + (hasHead ? '' : assets) + overlay);
}

module.exports = { withEntryIntro };
