'use strict';

// UI consistency ratchet (docs/UI-COMPONENTS.md). Counts known drifts per file
// and fails when a file has more than .ui-baseline.json allows, so legacy code
// can only shrink. `--update` lowers the baseline after a cleanup; it never
// raises it. A deliberate exception carries `ui-check-allow <rule>: <reason>`
// on the same or the previous line.

const fs = require('node:fs');
const path = require('node:path');

const baselineName = '.ui-baseline.json';
const rules = {
  hex: {
    hint: 'use a --stitch-* colour token (frontend/src/styles/stitch-tokens.scss)',
    applies: (file) =>
      /\.(?:vue|scss|css)$/.test(file) && !/\/styles\/(?:stitch-tokens|_tokens)\.scss$/.test(file),
    pattern: /(?<![\w&#-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g,
  },
  'raw-control': {
    hint: 'use UiButton, UiField, UiCheckbox or UiFilePick instead of a raw control in a page',
    applies: (file) => file.startsWith('frontend/src/pages/') && file.endsWith('.vue'),
    pattern: /<(?:button|input|select|textarea)(?=[\s/>]|$)/g,
  },
  'old-token': {
    hint: 'use var(--stitch-space-*), var(--stitch-font-*) or another --stitch-* token',
    applies: (file) => /\.(?:vue|scss)$/.test(file),
    pattern: /\b[\w-]+\.(?:space|type|font)\(|var\(--(?:play|ui)-/g,
  },
};

function sourceFiles(root) {
  const found = [];
  (function walk(directory) {
    for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const relative = path.posix.join(directory, entry.name);
      if (entry.isDirectory()) walk(relative);
      else if (entry.isFile()) found.push(relative);
    }
  })('frontend/src');
  return found.sort();
}

// Vue slot shorthand (`<template #add>`) is not a colour.
const strip = (text) => text.replace(/<template\s+#[\w-]+/g, '<template');

function findings(root) {
  const result = Object.fromEntries(Object.keys(rules).map((rule) => [rule, {}]));
  for (const file of sourceFiles(root)) {
    const lines = strip(fs.readFileSync(path.join(root, file), 'utf8')).split(/\r?\n/);
    for (const [rule, { applies, pattern }] of Object.entries(rules)) {
      if (!applies(file)) continue;
      const allow = `ui-check-allow ${rule}`;
      lines.forEach((line, index) => {
        const count = line.match(pattern)?.length || 0;
        if (!count || line.includes(allow) || lines[index - 1]?.includes(allow)) return;
        (result[rule][file] ||= []).push({ line: index + 1, count, text: line.trim() });
      });
    }
  }
  return result;
}

function totals(found) {
  return Object.fromEntries(
    Object.entries(found).map(([rule, files]) => [
      rule,
      Object.fromEntries(
        Object.entries(files).map(([file, hits]) => [
          file,
          hits.reduce((sum, hit) => sum + hit.count, 0),
        ]),
      ),
    ]),
  );
}

function readBaseline(root) {
  const baseline = JSON.parse(fs.readFileSync(path.join(root, baselineName), 'utf8'));
  if (baseline.schemaVersion !== 1 || !baseline.rules) throw Error('Invalid UI baseline');
  for (const rule of Object.keys(baseline.rules))
    if (!rules[rule]) throw Error(`Unknown UI baseline rule ${rule}`);
  return baseline;
}

function writeBaseline(root, counts, previous) {
  const next = { schemaVersion: 1, rules: {} };
  for (const rule of Object.keys(rules)) {
    next.rules[rule] = {};
    for (const file of Object.keys(counts[rule]).sort()) {
      const limit = previous
        ? Math.min(counts[rule][file], previous.rules[rule]?.[file] ?? 0)
        : counts[rule][file];
      if (limit > 0) next.rules[rule][file] = limit;
    }
  }
  fs.writeFileSync(path.join(root, baselineName), JSON.stringify(next, null, 2) + '\n');
}

function check(root) {
  const found = findings(root),
    counts = totals(found),
    baseline = readBaseline(root);
  const over = [],
    under = [];
  for (const rule of Object.keys(rules)) {
    const allowed = baseline.rules[rule] || {};
    for (const file of new Set([...Object.keys(counts[rule]), ...Object.keys(allowed)])) {
      const now = counts[rule][file] || 0,
        limit = allowed[file] || 0;
      if (now > limit) over.push({ rule, file, now, limit });
      else if (now < limit) under.push({ rule, file, now, limit });
    }
  }
  for (const { rule, file, now, limit } of over) {
    console.error(`${file}: ${rule} ${now} > baseline ${limit} — ${rules[rule].hint}`);
    for (const hit of found[rule][file]) console.error(`  ${file}:${hit.line}: ${hit.text}`);
  }
  // A cleanup does not fail the check, so parallel PRs rarely conflict on the
  // baseline; `npm run ui:baseline` records it when convenient.
  if (under.length)
    console.log(
      `${under.length} file/rule counts are below the baseline; npm run ui:baseline can lower it.`,
    );
  return over.length === 0;
}

if (require.main === module) {
  const mode = process.argv[2] || '--check';
  const root = process.cwd();
  if (mode === '--update') {
    writeBaseline(root, totals(findings(root)), readBaseline(root));
    console.log('UI baseline lowered to the current counts.');
  } else if (mode === '--check') {
    if (check(root)) console.log('UI check: no new raw colours, raw page controls or old tokens.');
    else process.exitCode = 1;
  } else throw Error('Usage: node tools/ui-check.cjs [--check|--update]');
}

module.exports = { findings, totals, check, writeBaseline, rules };
