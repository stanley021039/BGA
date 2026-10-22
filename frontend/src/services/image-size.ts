// Character images and artworks accept ?size=128|256|512 for a WebP thumbnail.
// Every other URL (built-in art, emoji, data: or blob: previews) passes through.
const SIZED = /^\/(?:assets\/characters\/|characters\/|assets\/artworks\/)/;

export type ImageSize = 128 | 256 | 512;

export function sizedImage(url: string, size: ImageSize): string {
  if (!url || !SIZED.test(url)) return url;
  const parsed = new URL(url, 'http://localhost');
  parsed.searchParams.set('size', String(size));
  return parsed.pathname + parsed.search;
}
