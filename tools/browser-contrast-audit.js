// Read-only expression for a native browser's evaluate(). Does not mutate the page.
// Reports candidates, not a WCAG certification: images/gradients/opacity need inspection.
(function auditTextContrast() {
  const failures = [],
    manual = [],
    counts = { checked: 0, hidden: 0, disabled: 0 };
  const modal = document.querySelector('dialog[open]');
  function rgba(value) {
    const numbers = value.match(/[\d.]+/g)?.map(Number);
    if (/^rgba?\(/.test(value) && numbers?.length >= 3)
      return [...numbers.slice(0, 3), numbers[3] ?? 1];
    if (/^color\(srgb /.test(value) && numbers?.length >= 3)
      return [...numbers.slice(0, 3).map((n) => n * 255), numbers[3] ?? 1];
    return null;
  }
  function over(top, bottom) {
    const alpha = top[3] + bottom[3] * (1 - top[3]);
    return [
      ...top
        .slice(0, 3)
        .map((n, i) => (alpha ? (n * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / alpha : 0)),
      alpha,
    ];
  }
  function luminance(color) {
    return color
      .slice(0, 3)
      .map((n) => n / 255)
      .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
      .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
  }
  for (const element of document.querySelectorAll('body *')) {
    if (modal && !modal.contains(element)) {
      counts.hidden++;
      continue;
    }
    const text = [...element.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent)
      .join(' ')
      .trim();
    if (
      !text ||
      !element ||
      element.closest(
        'script,style,noscript,svg,canvas,[aria-hidden="true"],[hidden],.ui-sr-only,.sr-only',
      )
    )
      continue;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      counts.hidden++;
      continue;
    }
    if (element.closest(':disabled,[aria-disabled="true"]')) {
      counts.disabled++;
      continue;
    }
    let current = element,
      background = [0, 0, 0, 0],
      reason = element.closest('.barrage-frame-preview,.game-barrage-framed')
        ? 'artwork-layer'
        : '',
      clipped = false;
    const layers = [];
    while (current) {
      const style = getComputedStyle(current),
        box = current.getBoundingClientRect();
      if (style.visibility !== 'visible' || style.display === 'none') clipped = true;
      if (
        /(auto|scroll|hidden|clip)/.test(style.overflowX + style.overflowY) &&
        (rect.bottom <= box.top ||
          rect.top >= box.bottom ||
          rect.right <= box.left ||
          rect.left >= box.right)
      )
        clipped = true;
      if (
        Number(style.opacity) < 1 ||
        style.filter !== 'none' ||
        style.mixBlendMode !== 'normal' ||
        style.textShadow !== 'none'
      )
        reason = 'opacity/filter/blend/shadow';
      if (background[3] < 0.999) {
        if (style.backgroundImage !== 'none') reason = 'image/gradient';
        const layer = rgba(style.backgroundColor);
        if (!layer) reason = 'unsupported-background';
        else background = over(background, layer);
      }
      layers.push(
        current.tagName.toLowerCase() +
          (current.classList.length ? '.' + [...current.classList].slice(0, 3).join('.') : ''),
      );
      current = current.parentElement;
    }
    if (clipped) {
      counts.hidden++;
      continue;
    }
    const style = getComputedStyle(element),
      foreground = rgba(style.color);
    const label = { text: text.slice(0, 90), path: layers.slice(0, 4).join(' < ') };
    if (!foreground || background[3] < 0.999 || reason) {
      manual.push({ ...label, reason: reason || 'transparent-canvas/unsupported-color' });
      continue;
    }
    const fg = over(foreground, background),
      a = luminance(fg),
      b = luminance(background);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    counts.checked++;
    if (ratio < 4.5)
      failures.push({
        ...label,
        ratio: Math.round(ratio * 100) / 100,
        color: style.color,
        background: background.slice(0, 3).map(Math.round),
      });
  }
  return {
    scheme: document.documentElement.dataset.colorScheme,
    viewport: [innerWidth, innerHeight],
    counts,
    failures,
    manual,
  };
});
