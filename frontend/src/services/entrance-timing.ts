// One ceiling for every entrance, including future additions and alternate versions.
export const MAX_ENTRANCE_DURATION_MS = 1000;
export function entrancePlaybackDuration(_id: string, authoredMs: number): number {
  return Math.min(authoredMs, MAX_ENTRANCE_DURATION_MS);
}
