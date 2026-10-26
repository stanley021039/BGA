import type { CurveMarketRules } from '../contracts/market';
interface MarketCurveApi {
  readonly CURVE_RULE_VERSION: 3;
  readonly POINT_UNITS: number;
  readonly FORECAST_MIN_TICK: number;
  readonly FORECAST_MAX_TICK: number;
  createCurveSnapshot(options: {
    frozenAt: string;
    targetDate: string;
    observations?: { targetDate: string; returnPct: number; fetchedAt: string }[];
  }): CurveMarketRules;
  validateCurveSnapshot(value: unknown): unknown;
  forecastFromTick(tick: number): number;
  scorePrediction(tick: number, actual: number, rules: CurveMarketRules): number;
  scorePredictionUnits(tick: number, actual: number, rules: CurveMarketRules): number;
  pointsToUnits(points: number): number;
  unitsToPoints(units: number): number;
}
declare const api: MarketCurveApi;
export default api;
