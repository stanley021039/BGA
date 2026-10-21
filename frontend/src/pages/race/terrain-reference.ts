import road from './terrain-art/terrain-01-R.svg';
import offroad from './terrain-art/terrain-02-O.svg';
import mud from './terrain-art/terrain-03-M.svg';
import wall from './terrain-art/terrain-04-X.svg';
import unknown from './terrain-art/terrain-05-unknown.svg';
import toxin from './terrain-art/terrain-06-G.svg';
import glass from './terrain-art/terrain-07-V.svg';
import ramp from './terrain-art/terrain-08-J.svg';
import fire from './terrain-art/terrain-09-F.svg';
import salt from './terrain-art/terrain-10-S.svg';

// Approved RD24–33. Presentation only; movement remains owned by the engine.
export const terrainReference = [
  {
    key: 'R',
    name: '公路',
    art: road,
    help: '耗 1 移動。非滑行、本次全程公路且未停車，可取得公路骰加速資格。',
  },
  { key: 'O', name: '荒地', art: offroad, help: '耗 1 移動。荒地不算公路。' },
  { key: 'M', name: '泥地', art: mud, help: '耗 2 移動；剩餘 1 點仍可進入。' },
  { key: 'X', name: '岩壁', art: wall, help: '耗 1 移動；進入立即淘汰，不能用損傷槽抵擋。' },
  {
    key: '?',
    name: '未知危險',
    art: unknown,
    help: '進入才翻開危險標記；實際消耗與效果屆時揭露。',
  },
  { key: 'G', name: '毒液', art: toxin, help: '耗 1 移動，並立即停止這次移動。' },
  {
    key: 'V',
    name: '玻璃',
    art: glass,
    help: '耗 1 移動，沿進入方向再滑 1 格；接續結算落點效果。',
  },
  {
    key: 'J',
    name: '跳台',
    art: ramp,
    help: '耗 1 移動。限從正後方進入，擲跳躍骰向前跳並結束移動；其他方向進入會淘汰。',
  },
  { key: 'F', name: '火焰', art: fire, help: '耗 1 移動；可操作車輛著火，之後移動前擲火焰骰。' },
  {
    key: 'S',
    name: '鹽灘',
    art: salt,
    help: '耗 1 移動。非滑行且未停車時，可取得公路骰加速資格。',
  },
] as const;
