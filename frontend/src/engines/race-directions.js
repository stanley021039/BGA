let RaceDirections;
(function (root, factory) {
  RaceDirections = factory();
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  // RaceBoard and the legacy board project forward to the right. The six
  // vectors match their staggered lane geometry (44px per lane/segment).
  const rows = [
    ['前左', '右上', '↗', 22, -44],
    ['前方', '右', '→', 44, 0],
    ['前右', '右下', '↘', 22, 44],
    ['後左', '左上', '↖', -22, -44],
    ['後方', '左', '←', -44, 0],
    ['後右', '左下', '↙', -22, 44],
  ].map(([value, label, arrow, dx, dy]) =>
    Object.freeze({ value, label, arrow, dx, dy, description: `${arrow} 向${label}（${value}）` }),
  );
  const faces = new Map(rows.map((face) => [face.value, face]));
  return Object.freeze({
    get: (value) => (typeof value === 'string' ? faces.get(value) || null : null),
    byIndex: (index) =>
      Number.isInteger(index) && index >= 0 && index < rows.length ? rows[index] : null,
    markup(value) {
      const face = faces.get(value);
      if (!face) return '';
      const angle = (Math.atan2(face.dy, face.dx) * 180) / Math.PI + 90;
      return `<svg viewBox="-28 -28 56 56" width="64" height="64" aria-hidden="true" focusable="false"><path transform="rotate(${angle})" d="M0 19V-18M-12-6L0-18 12-6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    },
    resultText(text, values) {
      const directions = [
        ...new Set(
          (Array.isArray(values) ? values : [])
            .map((value) => faces.get(value)?.description)
            .filter(Boolean),
        ),
      ];
      return (
        (text || '擲骰完成。') + (directions.length ? ` · 畫面方向：${directions.join('、')}` : '')
      );
    },
  });
});

export default RaceDirections;
