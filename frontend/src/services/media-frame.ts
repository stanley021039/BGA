// Frame surfaces are shared with barrage artwork; choose ink from the resolved
// surface, including composited gradient stops, rather than the default text.
export function mediaFrameText(background: string, image = 'none'): string {
  function parse(color: string): number[] | null {
    if (/^#[a-f\d]{3}$/i.test(color))
      return [...color.slice(1)].map((value) => parseInt(value + value, 16)).concat(1);
    if (/^#[a-f\d]{6}$/i.test(color))
      return [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16)).concat(1);
    if (!/^rgba?\(/i.test(color)) return null;
    const values = (color.match(/[\d.]+/g) || []).map(Number);
    if (values.length < 3 || values.some((value) => !Number.isFinite(value))) return null;
    return [...values.slice(0, 3), Math.min(1, Math.max(0, values[3] ?? 1))];
  }
  const base = parse(background);
  const stops = (image.match(/rgba?\([^)]+\)|#[a-f\d]{3,8}\b/gi) || [])
    .map(parse)
    .filter((value): value is number[] => !!value && value[3] > 0);
  if (!base && !stops.length) return '#111111';
  const surface = base || [255, 253, 243, 1];
  const luminances = [surface, ...stops].map((color) => {
    const linear = color.slice(0, 3).map((value, index) => {
      const channel = (value * color[3] + surface[index] * (1 - color[3])) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return linear.reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  });
  const dark = 0.005605391624202723;
  const light = 0.9535594780808016;
  const contrast = (ink: number) =>
    Math.min(
      ...luminances.map((value) => (Math.max(value, ink) + 0.05) / (Math.min(value, ink) + 0.05)),
    );
  return contrast(dark) >= contrast(light) ? '#111111' : '#f8fafc';
}

export function mediaFrameBackground(ink: string): string {
  return mediaFrameText(ink) === '#111111' ? '#14202b' : '#fffdf3';
}
