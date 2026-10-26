interface PlaybackStroke {
  tool: string;
  version?: number;
  strokeId?: string;
  points: [number, number][];
  pointTimes?: number[];
}
declare const api: {
  create(options?: {
    now?: () => number;
    requestFrame?: typeof requestAnimationFrame;
    cancelFrame?: typeof cancelAnimationFrame;
    onFrame?: () => void;
    maxLead?: number;
    catchupLead?: number;
  }): {
    add(stroke: PlaybackStroke): boolean;
    view<T extends PlaybackStroke>(stroke: T): T | null;
    reset(): void;
    finish(options?: { notify?: boolean }): boolean;
    metrics(): {
      pendingSamples: number;
      pendingEntries: number;
      leadMs: number;
      scheduled: boolean;
    };
  };
};
export default api;
