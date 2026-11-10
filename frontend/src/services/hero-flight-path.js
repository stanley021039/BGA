// The crest occurs early enough to see both the ascent and the dive.
export function heroFlightLift(height, fromY, toY) {
  const crestY = fromY + (toY - fromY) * 0.43;
  return Math.min(340, height * 0.56, Math.max(0, crestY - Math.min(72, height * 0.1)));
}

export function heroFlightArc(progress) {
  const climb = progress <= 0.43;
  const t = climb ? progress / 0.43 : (1 - progress) / 0.57;
  return Math.sin((t * Math.PI) / 2);
}
