'use strict';
// Server-only registry. The public list contains metadata, never scenario truth.
const { fail } = require('./util');
const differentLight = require('./scenario');
const poisonedSoup = require('./poisoned-soup');
const modules = new Map([differentLight, poisonedSoup].map((item) => [item.META.id, item]));
function getScenario(state) {
  const module = modules.get(typeof state === 'string' ? state : state.module);
  if (!module)
    fail('COC_MODULE_VERSION', '找不到這份存檔所需的劇本版本，請保留存檔並聯絡管理者', 503);
  return module;
}
module.exports = {
  DEFAULT: differentLight,
  getScenario,
  listScenarios: () => [...modules.values()].map((item) => item.META),
  available: (state) => getScenario(state).available(state),
  destinations: (state) => getScenario(state).destinations(state),
  sceneFor: (state) => getScenario(state).sceneFor(state),
};
