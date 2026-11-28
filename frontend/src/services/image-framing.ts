import centers from '../assets/character-framing.json';
export function centerChoiceImage(image: HTMLImageElement) {
  if (!image.naturalWidth || !image.naturalHeight) return;
  const url = new URL(image.currentSrc || image.src, location.href);
  const center = url.pathname.startsWith('/assets/characters/')
    ? (centers as Record<string, number>)[url.pathname.split('/').pop() || '']
    : undefined;
  const rect = image.getBoundingClientRect();
  const width = Math.min(rect.width, (rect.height * image.naturalWidth) / image.naturalHeight);
  image.style.translate = center === undefined ? '' : `${(0.5 - center) * width}px 0px`;
}
