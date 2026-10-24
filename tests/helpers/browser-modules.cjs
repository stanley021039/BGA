'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..');
const engines = path.join(root, 'frontend/src/engines');
const catalog = require('../../tools/browser-modules.json');
const cache = new Map();
let ts;

// Preserve the DOM/clock/network fixtures used by the behavioral regressions.
// Execute actual imports in one realm with a per-window module cache, rather
// than stripping imports or keeping a second copy of the retired source.
function browserSource(file) {
  const name = path.basename(String(file));
  if (!catalog[name]) return fs.readFileSync(file, 'utf8');
  if (cache.has(name)) return cache.get(name);
  ts ||= createRequire(path.join(root, 'frontend/package.json'))('typescript');
  const definitions = new Map();
  function visit(id) {
    if (definitions.has(id)) return;
    const source = fs.readFileSync(path.join(engines, id), 'utf8');
    const output = ts.transpileModule(source, {
      fileName: id,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    definitions.set(id, output);
    for (const match of output.matchAll(/require\(["']\.\/([^"']+)["']\)/g)) visit(match[1]);
  }
  visit(name);
  const names = Object.fromEntries(
    [...definitions.keys()].map((id) => [
      id,
      catalog[id][1] === 'UIWidgets' ? 'GameUI' : catalog[id][1],
    ]),
  );
  const source = `(function () {
    const definitions = {${[...definitions].map(([id, code]) => JSON.stringify(id) + ': function(module, exports, require) {\n' + code + '\n}').join(',\n')}};
    const names = ${JSON.stringify(names)};
    const owner = typeof window === 'undefined' ? globalThis : window;
    if (!owner.__bgaTestModules) Object.defineProperty(owner, '__bgaTestModules', { value: Object.create(null) });
    const cache = owner.__bgaTestModules;
    function load(id, entry = false) {
      if (!entry && Object.hasOwn(owner, names[id])) return { default: owner[names[id]] };
      if (cache[id]) return cache[id].exports;
      const module = { exports: {} }; cache[id] = module;
      definitions[id](module, module.exports, dep => load(dep.replace(/^\\.\\//, '')));
      owner[names[id]] = module.exports.default;
      return module.exports;
    }
    load(${JSON.stringify(name)}, true);
  })();`;
  cache.set(name, source);
  return source;
}
module.exports = {
  ...fs,
  browserSource,
  fixtureSource(source) {
    ts ||= createRequire(path.join(root, 'frontend/package.json'))('typescript');
    const code = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const names = Object.fromEntries(Object.entries(catalog).map(([name, [, api]]) => [name, api]));
    return `(function() {
      const exports = {};
      const names = ${JSON.stringify(names)};
      const require = id => {
        const api = names[id.split('/').pop()];
        if (!api) throw Error('Unprovided module fixture: ' + id);
        return { get default() { return (typeof window === 'undefined' ? globalThis : window)[api]; } };
      };
      ${code}
      Object.assign(globalThis, exports);
    })();`;
  },
  withEngineImports(context) {
    if (typeof context.require !== 'function') return context;
    const resolve = context.require;
    context.require = (id) => {
      const name = path.basename(id),
        api = catalog[name]?.[1];
      if (id.includes('/engines/') && api) {
        const owner = context.window || globalThis.window || {};
        return { default: owner[api === 'UIWidgets' ? 'GameUI' : api] };
      }
      return resolve(id);
    };
    return context;
  },
  readFileSync(file, ...options) {
    if (
      typeof file === 'string' &&
      catalog[path.basename(file)] &&
      /(?:public|engines)[/\\]/.test(file)
    ) {
      const value = browserSource(file);
      return options[0] === 'utf8' || options[0] === 'utf-8' ? value : Buffer.from(value);
    }
    return fs.readFileSync(file, ...options);
  },
};
