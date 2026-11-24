export type BossPhaseProfile = {
  paths: string[];
  final: string[];
  core?: number[];
  eyes?: number[][];
  extraEyes?: number[][];
  vents?: number[][];
};
export const bossPhaseProfiles: Record<string, BossPhaseProfile>;
