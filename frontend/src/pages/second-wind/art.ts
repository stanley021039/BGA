// URLs are emitted with Vite content hashes. Only visible images are requested.
const files = import.meta.glob<string>('../../assets/second-wind/*.webp', {
  eager: true,
  query: '?url&no-inline',
  import: 'default',
});
const baseFiles = import.meta.glob<string>('../../assets/second-wind-base/*.webp', {
  eager: true,
  query: '?url&no-inline',
  import: 'default',
});
export function athleteArt(id: string, kind: 'card' | 'portrait' | 'twist' = 'portrait'): string {
  return (
    files[`../../assets/second-wind/${id}-${kind}.webp`] ||
    baseFiles[`../../assets/second-wind-base/${id}-${kind}.webp`] ||
    ''
  );
}
export const athleteHero = files['../../assets/second-wind/hero.webp'];
export function trackArt(id: string, width = 1600): string {
  return files[`../../assets/second-wind/${id}-${width}.webp`] || '';
}
export { trackPoint } from './track-layout';
