import type { PingSurface } from './interaction-source';
import type { PingContext, PingEvent, PingModel, PingTarget } from '../contracts/pings';

export function pingAnchors(state: PingSurface): [string, HTMLElement, string][] {
  const pairs: [string, HTMLElement | null, string][] = [['header', document.querySelector('[data-site-header]'), '頁首'], ['chat', document.querySelector('[data-ping-anchor="chat"]'), '聊天室'], ['players', document.querySelector('[data-ping-anchor="players"]'), '玩家區']];
  for (const [key, label] of [['lobby-stage', '好友大廳'], ['game-list', '遊戲選單'], ['room-list', '房間列表']]) pairs.push([key, document.querySelector(`[data-ping-anchor="${key}"]`), label]);
  const players = [...document.querySelectorAll<HTMLElement>('[data-ping-player]')];
  for (const player of state.players) { const matches = players.filter(node => node.dataset.pingPlayer === player.id), node = matches.find(node => node.getClientRects().length) || matches[0]; if (node) pairs.push(['player:' + player.id, node, player.name]); }
  return pairs.filter((entry): entry is [string, HTMLElement, string] => !!entry[1]);
}
const canvas = (state: PingSurface) => state.type === 'draw' ? document.querySelector<HTMLCanvasElement>('canvas#drawCanvas') : null;
export function capturePing(model: PingModel, state: PingSurface, context: PingContext, node: Element, x: number, y: number): PingTarget {
  const viewport = (): PingTarget => ({ kind: 'viewport', x: Math.max(0, Math.min(1, x / innerWidth)), y: Math.max(0, Math.min(1, y / innerHeight)) });
  if (node.closest('.chip-row,.q-player-tray,#hand,.hand,[data-private]')) return viewport();
  const cell = state.type === 'thunder' && node.closest<HTMLElement>('[data-ping-cell][data-x][data-y]');
  if (cell) return { kind: 'surface', key: `race-cell:${cell.dataset.x}:${cell.dataset.y}`, epoch: context.scene, ...model.point(cell.getBoundingClientRect(), x, y) };
  const surface = canvas(state); if (surface === node && surface.getClientRects().length) { const rect = surface.getBoundingClientRect(); if (rect.width && rect.height) return { kind: 'surface', key: 'draw-canvas', epoch: context.scene, ...model.point(rect, x, y) }; }
  for (const [key, element] of pingAnchors(state).reverse()) if (element.contains(node)) { const rect = element.getBoundingClientRect(); if (rect.width && rect.height) return { kind: 'element', key, ...model.point(rect, x, y) }; }
  return viewport();
}
export function resolvePing(model: PingModel, state: PingSurface, context: PingContext, event: PingEvent, anchors = pingAnchors(state)) {
  const fallback = (label: string) => ({ x: innerWidth / 2, y: 72, edge: false, dx: 0, dy: 0, label });
  if (event.scene !== context.scene) return fallback('畫面已更新');
  const target = event.target;
  if (target.kind === 'viewport') return { ...model.place({ left: 0, top: 0, width: innerWidth, height: innerHeight }, target, innerWidth, innerHeight), label: '畫面位置' };
  let found: [string, HTMLElement, string] | undefined;
  if (target.kind === 'surface' && target.epoch === context.scene) {
    if (target.key === 'draw-canvas') { const surface = canvas(state); if (surface) found = [target.key, surface, '畫布']; }
    const match = /^race-cell:([0-5]):([0-9]{1,6})$/.exec(target.key);
    if (match && state.type === 'thunder') { const cell = document.querySelector<HTMLElement>(`[data-ping-cell][data-x="${match[1]}"][data-y="${match[2]}"]`); if (cell) found = [target.key, cell, '賽道第 ' + (Number(match[2]) + 1) + ' 段']; }
  } else if (target.kind === 'element') found = anchors.find(([key]) => key === target.key);
  if (!found || !found[1].isConnected || !found[1].getClientRects().length) return fallback('目標目前不可見');
  const rect = found[1].getBoundingClientRect(), position = model.place(rect, target, innerWidth, innerHeight);
  let minX = 0, minY = 0, maxX = innerWidth, maxY = innerHeight;
  for (let parent = found[1].parentElement; parent && parent !== document.body; parent = parent.parentElement) { const style = getComputedStyle(parent), box = parent.getBoundingClientRect(); if (/auto|scroll|hidden|clip/.test(style.overflowX)) { minX = Math.max(minX, box.left); maxX = Math.min(maxX, box.right); } if (/auto|scroll|hidden|clip/.test(style.overflowY)) { minY = Math.max(minY, box.top); maxY = Math.min(maxY, box.bottom); } }
  const rawX = rect.left + rect.width * target.x, rawY = rect.top + rect.height * target.y, clippedX = rawX < minX ? rawX - minX : rawX > maxX ? rawX - maxX : 0, clippedY = rawY < minY ? rawY - minY : rawY > maxY ? rawY - maxY : 0;
  if (clippedX || clippedY) { position.edge = true; position.dx = clippedX; position.dy = clippedY; }
  if (position.edge) { if (Math.abs(position.dx) > Math.abs(position.dy)) position.x = position.dx > 0 ? innerWidth - 32 : 32; else position.y = position.dy > 0 ? innerHeight - 48 : 48; }
  return { ...position, label: found[2] };
}
