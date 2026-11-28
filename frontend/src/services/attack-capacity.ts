// Keep already-started ultimates intact; when full, ordinary visuals yield first.
// No extra canvas, delayed replay, or gameplay/cast restriction is introduced.
export function replaceableAttack<T extends { slot: string }>(active: T[]): T | undefined {
  return active.find((item) => item.slot !== 'r');
}
