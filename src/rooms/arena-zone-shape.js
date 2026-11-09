'use strict';
const shapes = require('../../public/shared/arena-zone-shapes.json');

function containsZonePoint(zone, point, kind) {
  if (
    !point ||
    point.x < zone.x ||
    point.x > zone.x + zone.width ||
    point.y < zone.y ||
    point.y > zone.y + zone.height
  )
    return false;
  const x = ((point.x - zone.x) * 100) / zone.width;
  const y = ((point.y - zone.y) * 100) / zone.height;
  const points = shapes[zone.shape] || shapes[kind];
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, ay] = points[j],
      [bx, by] = points[i];
    const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
    if (
      Math.abs(cross) < 1e-7 &&
      x >= Math.min(ax, bx) &&
      x <= Math.max(ax, bx) &&
      y >= Math.min(ay, by) &&
      y <= Math.max(ay, by)
    )
      return true;
    if (ay > y !== by > y && x < ax + ((y - ay) * (bx - ax)) / (by - ay)) inside = !inside;
  }
  return inside;
}
module.exports = { containsZonePoint };
