// Existing geometry/status fixtures now need to earn R energy before casting.
// Walk through the public scene API; no production state injection or test bypass.
function chargeScene(scene, room, users, id, advance) {
  const user = users.find((user) => user.id === id);
  const view = () => {
    if (room) return scene.view(room, id);
    for (const other of users) scene.view(other);
    return scene.view(user);
  };
  const move = (target) => (room ? scene.move(room, id, target) : scene.move(user, target));
  const original = view().visitors.find((actor) => actor.id === id);
  for (let i = 0; i < 25; i++) {
    move({ x: i % 2 ? 10 : 90, y: 50 });
    advance(6500);
    view();
  }
  move({ x: original.x, y: original.y });
  advance(10000);
  view();
  if (view().visitors.find((actor) => actor.id === id).energy !== 100)
    throw Error('Walking fixture did not earn full energy');
}
module.exports = { chargeScene };
