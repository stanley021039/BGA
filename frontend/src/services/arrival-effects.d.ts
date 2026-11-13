export function isArrival(id: string): boolean;
export function playArrival(
  scene: {
    anchor: HTMLElement;
    img: HTMLImageElement | null;
    layer: HTMLElement;
    host: HTMLElement;
    cx: number;
    feet: number;
    height: number;
    paletteColors?: Record<string, string>;
  },
  id: string,
  duration: number,
): () => void;
