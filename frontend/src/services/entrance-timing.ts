// Compress the complete authored choreography, including alternate versions.
const shorter: Record<string, number> = {
  'stitch-stand-time': 4200,
  'stitch-gilgamesh': 3800,
  'stitch-hyorinmaru': 3600,
};
export function entrancePlaybackDuration(id: string, authoredMs: number): number {
  return Math.min(authoredMs, shorter[id.replace(/-alt$/, '')] ?? authoredMs);
}
