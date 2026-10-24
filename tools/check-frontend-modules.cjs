'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}
function check(base = root) {
  const errors = [];
  for (const file of files(path.join(base, 'public')))
    if (/\.(?:js|mjs|cjs)$/i.test(file))
      errors.push(path.relative(base, file) + ': executable source belongs in the module build');
  for (const file of files(path.join(base, 'frontend/pages'))) {
    if (!file.endsWith('.html')) continue;
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/<script\b([^>]*)>/gi))
      if (!/\btype\s*=\s*["']module["']/i.test(match[1]))
        errors.push(path.relative(base, file) + ': page scripts must be ES module entries');
  }
  const catalog = JSON.parse(fs.readFileSync(path.join(base, 'tools/browser-modules.json')));
  const names = [...new Set(Object.values(catalog).map(([, api]) => api))];
  const globalAPI = new RegExp('\\b(?:window|globalThis|root)\\.(' + names.join('|') + ')\\b');
  for (const file of files(path.join(base, 'frontend/src'))) {
    if (!/\.(?:vue|js|ts)$/.test(file) || file.endsWith('.d.ts')) continue;
    // Remove comments, retaining quoted code so a string-based global lookup
    // cannot silently recreate a runtime dependency on the retired scripts.
    const source = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');
    const match = source.match(globalAPI);
    if (match) errors.push(path.relative(base, file) + ': import ' + match[1] + ' explicitly');
  }
  return errors;
}
if (require.main === module) {
  const errors = check();
  for (const error of errors) console.error(error);
  if (errors.length) process.exitCode = 1;
  else
    console.log(
      'Frontend modules: no public executable scripts, classic page entries or implicit shared APIs.',
    );
}
module.exports = { check };
