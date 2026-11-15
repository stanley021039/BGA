const fs = require('node:fs'),
  path = require('node:path'),
  ts = require('typescript');
const code = ts.transpileModule(
  fs.readFileSync(path.resolve(__dirname, '../../src/services/entrance-timing.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
const loaded = { exports: {} };
new Function('module', 'exports', code)(loaded, loaded.exports);
module.exports = loaded.exports;
