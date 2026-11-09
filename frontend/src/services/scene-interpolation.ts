import { sceneWalk, type Passage } from '../engines/scene-path.js';
export function interpolateSceneVisitor(
  visitor: {
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    remainingMs: number;
    passage?: Passage | null;
  },
  elapsed: number,
) {
  const target = { x: visitor.targetX, y: visitor.targetY };
  const nominal = sceneWalk(visitor, target, 0, visitor.passage).remainingMs;
  const adjusted = visitor.remainingMs > 0 ? (elapsed * nominal) / visitor.remainingMs : nominal;
  return sceneWalk(visitor, target, adjusted, visitor.passage);
}
