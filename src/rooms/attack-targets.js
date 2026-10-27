const effects = require('../../public/shared/attack-effects.json');
const rules = require('../../public/shared/scene-rules.json');
const { sceneDistance } = require('./scene-combat');

const areas = new Map(
  effects.filter((effect) => effect.area).map((effect) => [effect.id, effect.area]),
);
const isAreaAttack = (effect) => areas.has(effect);

// Geometry uses percentages of the longer scene edge, matching sceneDistance.
// Aim comes from the nearest live actor, never a client-supplied target list.
function inAttackArea(self, aim, actor, effect, aspect, override) {
  const area = override || areas.get(effect);
  const range =
    override?.range ?? (isAreaAttack(effect) ? rules.areaAttackRange : rules.attackRange);
  const divisor = Math.max(1, aspect);
  const x = ((actor.x - self.x) * aspect) / divisor,
    y = (actor.y - self.y) / divisor;
  if (area?.shape === 'screenBeam') return Math.abs(y) <= area.width / 2;
  if (Math.hypot(x, y) > range + 1e-8) return false;
  if (!area) return true;
  const ax = ((aim.x - self.x) * aspect) / divisor,
    ay = (aim.y - self.y) / divisor;
  const distance = Math.hypot(ax, ay);
  const ux = distance ? ax / distance : self.facing === 'left' ? -1 : 1;
  const uy = distance ? ay / distance : 0;
  const forward = x * ux + y * uy,
    lateral = y * ux - x * uy,
    cross = Math.abs(lateral);
  if (area.shape === 'burst') return Math.hypot(forward - distance, cross) <= area.radius + 1e-8;
  if (forward < -1e-8 || forward > range + 1e-8) return false;
  if (area.shape === 'fan') return cross <= forward * Math.tan((area.angle * Math.PI) / 360) + 1e-8;
  if (['rectangle', 'targetRays'].includes(area.shape)) return cross <= area.width / 2;
  if (area.shape === 'beam')
    return cross <= area.width / 2 || Math.hypot(forward - range, cross) <= area.blastRadius;
  if (area.shape === 'cone') return cross <= 4 + forward * Math.tan((area.angle * Math.PI) / 360);
  return false;
}
function selectBijuuDirections(self, actors, aspect) {
  const nearby = [...actors]
    .filter(
      (actor) =>
        actor.id !== self.id &&
        actor.kind !== 'fragment' &&
        actor.health > 0 &&
        sceneDistance(self, actor, aspect) <= rules.areaAttackRange,
    )
    .sort(
      (a, b) =>
        sceneDistance(self, a, aspect) - sceneDistance(self, b, aspect) || a.id.localeCompare(b.id),
    );
  if (!nearby.length) return [];
  const directions = [];
  for (const actor of nearby) {
    const angle =
      actor.x === self.x && actor.y === self.y
        ? self.facing === 'left'
          ? Math.PI
          : 0
        : Math.atan2(actor.y - self.y, (actor.x - self.x) * aspect);
    if (
      directions.every(
        (ray) =>
          Math.abs(Math.atan2(Math.sin(angle - ray.angle), Math.cos(angle - ray.angle))) > 0.06,
      )
    )
      directions.push({ x: actor.x, y: actor.y, angle });
    if (directions.length === 3) break;
  }
  for (const offset of [-0.32, 0.32, -0.64, 0.64]) {
    if (directions.length === 3) break;
    const angle = directions[0].angle + offset;
    if (
      directions.some(
        (ray) =>
          Math.abs(Math.atan2(Math.sin(angle - ray.angle), Math.cos(angle - ray.angle))) <= 0.06,
      )
    )
      continue;
    const divisor = Math.max(1, aspect);
    directions.push({
      angle,
      x: Math.max(0, Math.min(100, self.x + (Math.cos(angle) * divisor) / aspect)),
      y: Math.max(0, Math.min(100, self.y + Math.sin(angle) * divisor)),
    });
  }
  return directions.map(({ x, y }) => ({ x, y }));
}
function selectAttackTargets(self, actors, effect, aspect) {
  if (['shield', 'sphere'].includes(effect)) return [self];
  const range = isAreaAttack(effect) ? rules.areaAttackRange : rules.attackRange;
  const nearby = [...actors]
    .filter(
      (actor) =>
        actor.id !== self.id &&
        actor.ownerId !== self.id &&
        actor.health > 0 &&
        (areas.get(effect)?.shape === 'screenBeam' || sceneDistance(self, actor, aspect) <= range),
    )
    .sort(
      (a, b) =>
        sceneDistance(self, a, aspect) - sceneDistance(self, b, aspect) || a.id.localeCompare(b.id),
    );
  if (!nearby.length) return [];
  const area = areas.get(effect);
  if (!area) return nearby.slice(0, 1);
  if (effect === 'bijuu_beam') {
    const rays = selectBijuuDirections(self, nearby, aspect);
    return nearby
      .filter((actor) =>
        rays.some((ray) =>
          inAttackArea(self, ray, actor, effect, aspect, {
            shape: 'rectangle',
            width: 7,
            range: rules.areaAttackRange,
          }),
        ),
      )
      .slice(0, rules.maximumAreaTargets);
  }
  return nearby
    .filter((actor) => {
      return inAttackArea(self, nearby[0], actor, effect, aspect);
    })
    .slice(0, rules.maximumAreaTargets);
}
module.exports = { isAreaAttack, selectAttackTargets, inAttackArea, selectBijuuDirections };
