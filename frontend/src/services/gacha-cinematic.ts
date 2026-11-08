import type { GachaResult } from '../contracts/gacha';
export type GachaEnding = 'rise' | 'fall' | 'flat';
export type GachaSound =
  'gacha-rush' | 'gacha-shuffle' | 'gacha-success' | 'gacha-scream' | 'gacha-flat';
export function gachaChartRandom(id: string) {
  let seed = 2166136261;
  for (const letter of id) seed = Math.imul(seed ^ letter.charCodeAt(0), 16777619);
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}
const marketMoves = 48;
const candleStep = 20;
const candleInterval = 95;
const panStart = 24;
const trading = 2620;
const settlementTime = trading + marketMoves * candleInterval;
export const gachaTimeline = Object.freeze({
  order: 1150,
  sync: 2350,
  trading,
  candleInterval,
  panDelay: panStart * candleInterval,
  panDuration: (marketMoves - panStart) * candleInterval,
  settlement: settlementTime,
  complete: settlementTime + 1210,
});
export function gachaEnding(
  results: readonly Pick<GachaResult, 'rarity' | 'duplicate'>[],
): GachaEnding {
  if (results.some((item) => item.rarity === 'epic' || item.rarity === 'legendary')) return 'rise';
  const allCommon = results.every((item) => item.rarity === 'common');
  const allDuplicates = results.every((item) => item.duplicate);
  return results.length && (allCommon || allDuplicates) ? 'fall' : 'flat';
}
type ChartPoint = { x: number; y: number; quote: number };
function chartY(value: number) {
  return Math.round(278 - ((value - 10000) * 194) / 60000);
}
function quoteAtY(y: number) {
  return Math.round(10000 + ((278 - y) * 60000) / 194);
}
function chartSegments(points: ChartPoint[]) {
  return points.slice(1).map((point, index) => {
    const prior = points[index];
    return {
      path: `M${prior.x} ${prior.y}L${point.x} ${point.y}`,
      up: point.y < prior.y,
      quote: point.quote,
    };
  });
}
function chartCandles(points: ChartPoint[]) {
  return points.map((point, index) => {
    const priorY = points[Math.max(0, index - 1)].y;
    return {
      x: point.x,
      y: Math.min(priorY, point.y),
      height: Math.max(2, Math.abs(point.y - priorY)),
      up: point.y < priorY,
    };
  });
}
// Concentrate a swing into a few consecutive candles, with smaller moves around it.
function burstProgress(step: number, steps: number, start: number, count: number, share: number) {
  const end = start + count;
  const shoulder = (1 - share) / 2;
  if (step <= start) return (shoulder * step) / start;
  if (step <= end) return shoulder + (share * (step - start)) / count;
  return 1 - (shoulder * (steps - step)) / (steps - end);
}
function shoulderSwing(step: number, steps: number) {
  const phase = (2 * Math.PI * step) / steps;
  return Math.sin(phase) * Math.min(1, steps / 5);
}
function closingRunSteps(points: ChartPoint[], steps: number, count: number, share: number) {
  const recent = points.slice(-count - 1);
  const weights = recent
    .slice(1)
    .map((point, index) => Math.max(1, Math.abs(point.y - recent[index].y)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const lead = steps - count;
  return [
    ...Array<number>(lead).fill((1 - share) / lead),
    ...weights.map((w) => (w / total) * share),
  ];
}
// Both sides use the same sampled distance from the pivot so the false run gives no hint.
export function gachaChart(ending: GachaEnding, random: () => number = Math.random) {
  const drawIndex = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const opening = drawIndex(40000, 42999);
  const direction = drawIndex(0, 1) === 0 ? 1 : -1;
  const offset = drawIndex(0, 9999);
  const marketHigh = 60000 + offset;
  const marketLow = 24999 - Math.round(offset * 1.5);
  const pivotY = Math.round((chartY(marketHigh) + chartY(marketLow)) / 2);
  const ordinaryStep = Math.round((pivotY - chartY(marketHigh)) / 10);
  const openingY = chartY(opening);
  const swing = [
    drawIndex(46, 55) * direction,
    -drawIndex(48, 56) * direction,
    drawIndex(48, 56) * direction,
    -drawIndex(30, 39) * direction,
  ];
  const anchors = [
    openingY,
    ...swing.map((size) => pivotY + Math.round((size * ordinaryStep) / 10)),
    pivotY,
  ];
  const legs = anchors.slice(1).map((y, i) => ({
    delta: y - anchors[i],
    count: Math.max(1, Math.ceil(Math.abs(y - anchors[i]) / ordinaryStep)),
  }));
  const spare = marketMoves - 1 - legs.reduce((total, leg) => total + leg.count, 0);
  const longerLegs = legs.length - 1;
  const finalRun = drawIndex(1, 2);
  const points: ChartPoint[] = [{ x: candleStep, y: openingY, quote: opening }];
  legs.forEach(({ delta, count }, i) => {
    const isFinalLeg = i === longerLegs;
    const steps = isFinalLeg ? count : count + Math.floor((spare + i) / longerLegs);
    const hasBurst = i === 1 || i === 2;
    const burstCount = hasBurst ? drawIndex(2, 3) : 0;
    // Leave room for trading before the first burst and for a reaction after the second.
    const latestBurstStart = Math.min(
      steps - burstCount - 2,
      marketMoves - 10 - points.length - burstCount,
    );
    const earliestBurstStart = Math.min(latestBurstStart, Math.max(2, 10 - points.length));
    const burstStart = hasBurst ? drawIndex(earliestBurstStart, latestBurstStart) : 0;
    const burstShare = hasBurst ? drawIndex(70, 80) / 100 : 0;
    const closingRun = isFinalLeg
      ? closingRunSteps(points, steps, finalRun, drawIndex(65, 85) / 100)
      : [];
    let closingProgress = 0;
    for (let step = 1; step <= steps; step++) {
      let move = (delta * step) / steps;
      if (hasBurst) {
        move = delta * burstProgress(step, steps, burstStart, burstCount, burstShare);
        const burstEnd = burstStart + burstCount;
        const shoulderSize = 1.3 * ordinaryStep * Math.sign(delta);
        if (step < burstStart) {
          move += shoulderSize * shoulderSwing(step, burstStart);
        } else if (step > burstEnd && step < steps) {
          move += shoulderSize * shoulderSwing(step - burstEnd, steps - burstEnd);
        }
      } else if (isFinalLeg) {
        closingProgress += closingRun[step - 1];
        move = delta * closingProgress;
      } else if (step < steps) {
        move += drawIndex(-ordinaryStep, ordinaryStep) * 0.55;
      }
      const y = anchors[i] + Math.round(move);
      points.push({ x: (points.length + 1) * candleStep, y, quote: quoteAtY(y) });
    }
  });
  const turn = points[points.length - 1];
  const settlement =
    ending === 'rise'
      ? 60000 + Math.round((offset * 39999) / 9999)
      : ending === 'fall'
        ? 29999 - Math.round((offset * 29499) / 9999)
        : drawIndex(35000, 45000);
  const target = chartY(settlement);
  const last = { x: turn.x + candleStep, y: target, quote: settlement };
  const closingPoints = [turn, last];
  // Fit the whole trading run with room for wicks. Frame it without using the outcome.
  const marketY = points.map(({ y }) => y);
  const top = Math.min(chartY(47000), ...marketY);
  const bottom = Math.max(chartY(32000), ...marketY);
  const marketScale = Math.min(2.4, 166 / (bottom - top));
  const marketOffset = 179 - ((top + bottom) / 2) * marketScale;
  // Frame the entire closing move inside the chart while keeping its actual prices.
  const cameraScale = ending === 'flat' ? marketScale : 166 / Math.abs(target - pivotY);
  const finishY =
    ending === 'rise' ? 82 : ending === 'fall' ? 274 : marketOffset + target * marketScale;
  return {
    opening,
    baselineY: chartY(opening),
    panX: (marketMoves - panStart) * candleStep,
    marketScale,
    marketOffset,
    cameraScale,
    cameraY: finishY - target * cameraScale,
    finishY,
    limitY: ending === 'rise' ? chartY(60000) : chartY(29999),
    settlement,
    candles: chartCandles(points),
    market: chartSegments(points),
    closing: chartSegments(closingPoints)[0],
    closingCandle: chartCandles(closingPoints)[1],
    last,
  };
}
