'use strict';
// Server-only geometry and asset allowlist. Browsers receive the revealed projection only.
const path = require('node:path');
const variants = require('../../assets/coc/variants.json');
const { getScenario, destinations } = require('./scenario-registry');
const ART = [
  {
    id: 'walnut-dusk',
    module: 'different-light-pulp-1',
    scene: 'walnut',
    title: '核桃街 · 暮色中的新路燈',
    alt: '暮色下的住宅街道與微泛綠光的路燈，沒有行人。',
  },
  {
    id: 'soup-chamber',
    module: 'poisoned-soup-pulp-1',
    scene: 'soup',
    title: '中央 · 湯與四扇門',
    alt: '封閉房間中的木桌、暗紅湯碗、椅子與門，沒有揭露門後的內容。',
  },
];
const SOUP = {
  soup: [320, 210],
  kitchen: [320, 65],
  library: [110, 210],
  servant: [530, 210],
  chapel: [320, 355],
};
const LIGHT = {
  home: [600, 350],
  walnut: [800, 150],
  sanitarium: [800, 350],
  records: [600, 550],
  hayes: [600, 150],
  boston: [1000, 350],
  house: [1000, 150],
  bazaar: [1000, 550],
  sudbury: [150, 550],
  rise: [350, 350],
  hill: [150, 150],
  cave: [350, 150],
  warehouse: [800, 550],
};
const SHORT_NAMES = {
  home: '阿卡姆住處',
  walnut: '核桃街',
  sanitarium: '療養院',
  records: '公開紀錄與圖書館',
  hayes: 'Hayes 辦公室',
  boston: '波士頓大學',
  house: 'Duncan 住處',
  bazaar: '大學市集',
  sudbury: 'Sudbury',
  rise: 'Crawford’s Rise',
  hill: 'Eye Bone Hill',
  cave: '山洞',
  warehouse: '工程倉庫',
  soup: '中央房間',
  kitchen: '北 · 廚房',
  library: '西 · 書庫',
  servant: '東 · 下僕房',
  chapel: '南 · 禮拜室',
};
const LIGHT_LINKS = [
  ['home', 'walnut'],
  ['home', 'sanitarium'],
  ['home', 'records'],
  ['home', 'hayes'],
  ['home', 'boston'],
  ['boston', 'house'],
  ['boston', 'bazaar'],
  ['home', 'rise'],
  ['rise', 'sudbury'],
  ['rise', 'hill'],
  ['hill', 'cave'],
  ['home', 'warehouse'],
];
function imageUrl(campaignId, id, size) {
  const version = variants[id][size].sha256;
  return `/api/coc/media/${encodeURIComponent(campaignId)}/${id}?size=${size}&v=${version}`;
}
function revealedMedia(state, explored = []) {
  const scenario = getScenario(state);
  if (state.status === 'waiting') return { map: null, illustrations: [] };
  const visited = new Set([...explored, ...(state.visitedScenes || []), state.scene]);
  const known = new Set([...visited, ...destinations(state).map((item) => item.id)]);
  const soup = state.module === 'poisoned-soup-pulp-1';
  if (soup && state.clues.includes('instructions'))
    Object.keys(SOUP).forEach((id) => known.add(id));
  const geometry = soup ? SOUP : LIGHT;
  const nodes = Object.entries(geometry)
    .filter(([id]) => known.has(id))
    .map(([id, [x, y]]) => ({
      id,
      x,
      y,
      label: SHORT_NAMES[id],
      name: scenario.SCENES[id].name,
      status: id === state.scene ? 'current' : visited.has(id) ? 'explored' : 'known',
    }));
  const visible = new Set(nodes.map((node) => node.id));
  const links = (
    soup
      ? Object.keys(SOUP)
          .filter((id) => id !== 'soup')
          .map((id) => ['soup', id])
      : LIGHT_LINKS
  )
    .filter(([from, to]) => visible.has(from) && visible.has(to))
    .map(([from, to]) => ({ from, to }));
  return {
    map: {
      title: soup ? '房間平面圖' : '調查路線圖',
      width: soup ? 740 : 1150,
      height: soup ? 450 : 650,
      nodes,
      links,
      note: soup
        ? '依已發現的平面圖與探索紀錄補入房間；門後內容仍待調查。'
        : '調查路線示意，不代表實際比例；只顯示已知地點。',
    },
    illustrations: ART.filter((art) => art.module === state.module && visited.has(art.scene)).map(
      ({ id, scene, title, alt }) => ({
        id,
        scene,
        title,
        alt,
        current: scene === state.scene,
        url: imageUrl(state.id, id, 1024),
        smallUrl: imageUrl(state.id, id, 256),
        mediumUrl: imageUrl(state.id, id, 512),
      }),
    ),
  };
}
function assetFile(state, id, explored, size = 1024) {
  if (!revealedMedia(state, explored).illustrations.some((art) => art.id === id)) return null;
  const asset = ART.find((art) => art.id === id && art.module === state.module);
  const variant = asset && variants[asset.id]?.[size];
  return variant ? path.join(__dirname, '../../assets/coc', variant.file) : null;
}
module.exports = { revealedMedia, assetFile };
