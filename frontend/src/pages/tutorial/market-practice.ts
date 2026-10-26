import MarketCurve from '../../engines/market-curve.js';
// Deliberately fixed teaching inputs; never a forecast or an official quote.
export function createMarketPractice() {
  const rules = MarketCurve!.createCurveSnapshot({
    frozenAt: '2026-01-01T00:00:00Z',
    targetDate: '2026-01-02',
    observations: [],
  });
  let phase = 0,
    tick = 5,
    points: number | null = null;
  return {
    snapshot: () => ({
      phase,
      tick,
      forecast: MarketCurve!.forecastFromTick(tick),
      actual: phase >= 2 ? 0.8 : null,
      points,
      done: phase === 3,
    }),
    forecast(value: number) {
      if (phase !== 0) throw Error('示範已截止，預測不能再修改');
      MarketCurve!.forecastFromTick(value);
      tick = value;
    },
    next() {
      if (phase === 0) phase = 1;
      else if (phase === 1) phase = 2;
      else if (phase === 2) {
        points = MarketCurve!.unitsToPoints(MarketCurve!.scorePredictionUnits(tick, 0.8, rules));
        phase = 3;
      }
    },
  };
}

export function tutorialForecastTick(value: unknown) {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : NaN;
  const tick = Math.round(n * 10);
  if (!Number.isFinite(n) || Math.abs(n * 10 - tick) > 1e-8)
    throw Error('請輸入 -10% 至 +10%，每格 0.1%');
  MarketCurve.forecastFromTick(tick);
  return tick;
}
