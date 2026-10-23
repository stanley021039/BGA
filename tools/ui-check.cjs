'use strict';

// Counts may shrink without refreshing the baseline. A trusted Git comparison
// also rejects new occurrences, so removing old drift cannot fund new drift.
// --migrate seeds newly covered legacy syntax from committed source, never the
// working tree. Exceptions must be comments with an explicit rule and reason.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const baselineName = '.ui-baseline.json';
const schemaVersion = 2;
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
    pattern: /<(?:button|input|select|textarea)(?=[\s/>]|$)/gi,
  },
  'old-token': {
    hint: 'use var(--stitch-space-*), var(--stitch-font-*) or another --stitch-* token',
    applies: (file) => /\.(?:vue|scss|css)$/.test(file),
    pattern:
      /(?<![\w-])(?:[\w-]+\s*\.\s*)?(?:space|font)\s*\(|(?<![\w-])[\w-]+\s*\.\s*type\s*\(|\bvar\s*\(\s*--(?:play|ui)-/g,
  },
  important: {
    hint: 'fix the shared component or selector instead of adding !important',
    applies: (file) => /\.(?:vue|scss|css)$/.test(file),
    pattern: /!\s*important\b/gi,
  },
};
const legacyRules = {
  hex: rules.hex,
  'raw-control': rules['raw-control'],
  'old-token': {
    ...rules['old-token'],
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
      else if (entry.isFile() && Object.values(rules).some((rule) => rule.applies(relative)))
        found.push(relative);
    }
  })('frontend/src');
  return found.sort();
}

// Preserve newlines and ignore comment-looking text inside quoted values.
// A directive in a JavaScript string or an HTML attribute is never an exception.
function commentsAndCode(text) {
  const comments = [];
  let code = '',
    quote = '',
    line = 1,
    index = 0;
  while (index < text.length) {
    const char = text[index];
    if (quote) {
      code += char;
      index++;
      if (char === '\n') line++;
      if (char === '\\' && index < text.length) {
        const escaped = text[index++];
        code += escaped;
        if (escaped === '\n') line++;
      } else if (char === quote) quote = '';
      continue;
    }
    const closing = text.startsWith('<!--', index)
      ? '-->'
      : text.startsWith('/*', index)
        ? '*/'
        : text.startsWith('//', index) && text[index - 1] !== ':'
          ? '\n'
          : '';
    if (closing) {
      const opening = closing === '-->' ? 4 : 2;
      const end = text.indexOf(closing, index + opening);
      const stop = end < 0 ? text.length : end;
      const body = text.slice(index + opening, stop);
      body.split('\n').forEach((part, offset) => {
        comments.push({ line: line + offset, text: part });
      });
      const finish = closing === '\n' || end < 0 ? stop : stop + closing.length;
      const removed = text.slice(index, finish);
      code += removed.replace(/[^\n]/g, ' ');
      line += removed.split('\n').length - 1;
      index = finish;
      continue;
    }
    if (char === '"' || char === "'" || char === '\x60') quote = char;
    code += char;
    if (char === '\n') line++;
    index++;
  }
  return { code, comments };
}

// Lightweight scope tracking supplements Git's line diff. Git can align a moved,
// identical declaration as unchanged; its selector/template ancestors must also
// survive. Script blocks are opaque: if changed, their legacy hits need cleanup
// or an explained exception rather than an uncertain automatic exemption.
function sourceContexts(code, file) {
  const events = [{ offset: 0, key: '' }],
    html = [],
    css = [],
    siblings = new Map(),
    voidTags = new Set(
      'area base br col embed hr img input link meta param source track wbr'.split(' '),
    );
  let mode = file.endsWith('.vue') ? 'html' : 'style',
    statement = 0,
    quote = '',
    index = 0;
  const normalized = (value) => value.trim().replace(/\s+/g, ' ');
  const scopeName = (text) => {
    const key = JSON.stringify([html.map((tag) => tag.text), css, text]),
      ordinal = siblings.get(key) || 0;
    siblings.set(key, ordinal + 1);
    return JSON.stringify([text, ordinal]);
  };
  const emit = (offset, opaque = '') =>
    events.push({ offset, key: JSON.stringify([mode, html.map((tag) => tag.text), css, opaque]) });
  emit(0);
  while (index < code.length) {
    const char = code[index];
    if (mode === 'style' && quote) {
      if (char === '\\') index++;
      else if (char === quote) quote = '';
      index++;
      continue;
    }
    if (mode === 'style' && (char === '"' || char === "'" || char === '\x60')) {
      quote = char;
      index++;
      continue;
    }
    if (
      file.endsWith('.vue') &&
      char === '<' &&
      (mode === 'html' || /^<\/style\s*>/i.test(code.slice(index)))
    ) {
      const opening = code.slice(index).match(/^<(\/?)([\w:-]+)\b/);
      if (opening) {
        let end = index + opening[0].length,
          attributeQuote = '';
        for (; end < code.length; end++) {
          const value = code[end];
          if (attributeQuote) {
            if (value === attributeQuote) attributeQuote = '';
          } else if (value === '"' || value === "'") attributeQuote = value;
          else if (value === '>') break;
        }
        if (end === code.length) {
          emit(index, normalized(code.slice(index)));
          break;
        }
        const name = opening[2].toLowerCase(),
          closing = !!opening[1],
          text = normalized(code.slice(index, end + 1));
        if (!closing && name === 'script') {
          const close = code.indexOf('</script', end + 1);
          if (close < 0) throw Error(file + ': cannot establish script scope');
          emit(end + 1, normalized(code.slice(end + 1, close)));
          index = close;
        } else {
          if (closing) {
            if (name === 'style') {
              css.length = 0;
              mode = 'html';
            }
            const ancestor = html.findLastIndex((tag) => tag.name === name);
            if (ancestor >= 0) html.splice(ancestor);
          } else if (!voidTags.has(name) && !/\/\s*>$/.test(text)) {
            html.push({ name, text: scopeName(text) });
            if (name === 'style') {
              mode = 'style';
              statement = end + 1;
            }
          }
          index = end + 1;
          emit(index);
        }
        continue;
      }
    }
    if (mode === 'style') {
      if (char === '{') {
        css.push(scopeName(normalized(code.slice(statement, index))));
        statement = index + 1;
        emit(index + 1);
      } else if (char === '}') {
        css.pop();
        statement = index + 1;
        emit(index + 1);
      } else if (char === ';') statement = index + 1;
    }
    index++;
  }
  if (quote || css.length || html.length)
    return () => JSON.stringify(['uncertain-scope', normalized(code)]);
  return (offset) => {
    let low = 0,
      high = events.length;
    while (low + 1 < high) {
      const middle = (low + high) >>> 1;
      if (events[middle].offset <= offset) low = middle;
      else high = middle;
    }
    return events[low].key;
  };
}

// Keep the existing schema/rule IDs. CSS colour functions are compared by exact
// Git occurrence, never converted into fungible numeric baseline allowance.
function colourFunctionMatches(code, file, contextAt) {
  const matches = [],
    pattern = /(?<![\w-])(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\s*\(/gi;
  for (const opening of code.matchAll(pattern)) {
    const argumentsAt = opening.index + opening[0].length,
      css = !file.endsWith('.vue') || JSON.parse(contextAt(opening.index))[0] === 'style',
      literal =
        opening[1].toLowerCase() === 'color'
          ? /^\s*(?:srgb(?:-linear)?|display-p3|a98-rgb|prophoto-rgb|rec2020|xyz(?:-d50|-d65)?)\s+[+-]?(?:\d|\.\d)/i
          : /^\s*[+-]?(?:\d|\.\d)/;
    // Outside CSS, only literal colour construction is covered. Runtime player
    // colours and unrelated helpers with variable arguments are not raw tokens.
    if (!css && !literal.test(code.slice(argumentsAt))) continue;
    let index = argumentsAt,
      depth = 1,
      quote = '';
    for (; index < code.length && depth; index++) {
      const char = code[index];
      if (quote) {
        if (char === '\\') index++;
        else if (char === quote) quote = '';
      } else if (char === '"' || char === "'") quote = char;
      else if (char === '(') depth++;
      else if (char === ')') depth--;
    }
    matches.push({
      0: code.slice(opening.index, index),
      index: opening.index,
      kind: 'color-function',
    });
  }
  return matches;
}

function nativeComponentMatches(code) {
  const matches = [];
  for (const tag of code.matchAll(/<component\b(?:[^'"<>]|"[^"]*"|'[^']*')*>/gi)) {
    for (const attribute of tag[0].matchAll(
      /([:@\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g,
    )) {
      const name = attribute[1].toLowerCase(),
        value = (attribute[2] ?? attribute[3] ?? attribute[4]).trim(),
        native = /^(?:button|input|select|textarea)$/i,
        bound = value.match(/^(['"\x60])(button|input|select|textarea)\1$/i);
      if (
        (name === 'is' && native.test(value)) ||
        ((name === ':is' || name === 'v-bind:is') && bound)
      ) {
        matches.push({ 0: tag[0], index: tag.index, kind: 'static-native-component' });
        break;
      }
    }
  }
  return matches;
}

function scanSources(sources, { validateAllows = true } = {}) {
  const result = Object.fromEntries(Object.keys(rules).map((rule) => [rule, {}]));
  for (const [file, source] of Object.entries(sources)) {
    const { code, comments } = commentsAndCode(source);
    const allows = new Map();
    for (const comment of comments) {
      if (!comment.text.includes('ui-check-allow')) continue;
      const directive = comment.text.match(/^\s*\*?\s*ui-check-allow\s+([\w-]+)\s*:\s*(.*?)\s*$/);
      if (!directive || !rules[directive[1]] || !/[\p{L}\p{N}]/u.test(directive[2])) {
        if (validateAllows)
          throw Error(
            file + ':' + comment.line + ': invalid ui-check-allow; use a known rule and a reason',
          );
        continue;
      }
      if (!allows.has(comment.line)) allows.set(comment.line, new Set());
      allows.get(comment.line).add(directive[1]);
    }
    // Keep string length/newlines stable so offsets map to the original file.
    const cleaned = code
      .replace(/<template\b(?:"[^"]*"|'[^']*'|[^'">])*>/g, (tag) =>
        tag.replace(/(\s)#[\w.-]+(?=[\s=>])/g, (slot) => slot.replace(/[^\n\r]/g, ' ')),
      )
      .replace(/@function\s+(?:space|font)(?=\s*\()/g, (declaration) =>
        declaration.replace(/[^\n\r]/g, ' '),
      );
    const lines = cleaned.split(/\r?\n/),
      starts = [0],
      contextAt = sourceContexts(cleaned, file);
    for (const newline of cleaned.matchAll(/\n/g)) starts.push(newline.index + 1);
    const lineAt = (offset) => {
      let low = 0,
        high = starts.length;
      while (low + 1 < high) {
        const middle = (low + high) >>> 1;
        if (starts[middle] <= offset) low = middle;
        else high = middle;
      }
      return low + 1;
    };
    for (const [rule, { applies, pattern }] of Object.entries(rules)) {
      if (!applies(file)) continue;
      const matches = [...cleaned.matchAll(pattern)];
      if (rule === 'hex') matches.push(...colourFunctionMatches(cleaned, file, contextAt));
      if (rule === 'raw-control') matches.push(...nativeComponentMatches(cleaned));
      for (const match of matches) {
        const line = lineAt(match.index),
          endLine = lineAt(match.index + match[0].length - 1);
        let allowed = false;
        for (let commentLine = line - 1; commentLine <= endLine; commentLine++)
          if (allows.get(commentLine)?.has(rule)) allowed = true;
        if (!allowed)
          (result[rule][file] ||= []).push({
            line,
            endLine,
            count: 1,
            ...(match.kind ? { kind: match.kind } : {}),
            text: lines
              .slice(line - 1, endLine)
              .join('\n')
              .trim(),
            context: contextAt(match.index),
          });
      }
    }
  }
  return result;
}

function workingSources(root) {
  return Object.fromEntries(
    sourceFiles(root).map((file) => [file, fs.readFileSync(path.join(root, file), 'utf8')]),
  );
}

function findings(root) {
  return scanSources(workingSources(root));
}

function totals(found) {
  return Object.fromEntries(
    Object.entries(found).map(([rule, files]) => [
      rule,
      Object.fromEntries(
        Object.entries(files).map(([file, hits]) => [
          file,
          hits.reduce((sum, hit) => sum + (hit.kind === 'color-function' ? 0 : hit.count), 0),
        ]),
      ),
    ]),
  );
}

function parseBaseline(text, { allowLegacy = false } = {}) {
  const baseline = JSON.parse(text);
  const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (
    !object(baseline) ||
    ![schemaVersion, ...(allowLegacy ? [1] : [])].includes(baseline.schemaVersion) ||
    !object(baseline.rules) ||
    Object.keys(baseline).some((key) => !['schemaVersion', 'rules'].includes(key))
  )
    throw Error('Invalid UI baseline schema; legacy schema 1 requires --migrate');
  const expected = baseline.schemaVersion === 1 ? Object.keys(legacyRules) : Object.keys(rules);
  if (
    Object.keys(baseline.rules).length !== expected.length ||
    expected.some((rule) => !Object.hasOwn(baseline.rules, rule))
  )
    throw Error('Invalid UI baseline rules');
  for (const [rule, files] of Object.entries(baseline.rules)) {
    if (!object(files)) throw Error('Invalid UI baseline entries for ' + rule);
    for (const [file, count] of Object.entries(files)) {
      if (
        !file.startsWith('frontend/src/') ||
        file.includes('\\') ||
        file.split('/').some((part) => !part || part === '.' || part === '..') ||
        !rules[rule].applies(file) ||
        !Number.isSafeInteger(count) ||
        count < 0
      )
        throw Error('Invalid UI baseline count/path: ' + rule + ' ' + file);
    }
  }
  return baseline;
}

function readBaseline(root, options) {
  return parseBaseline(fs.readFileSync(path.join(root, baselineName), 'utf8'), options);
}

function git(root, args, options = {}) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options,
    });
  } catch (error) {
    throw Error(
      'UI check needs a readable Git base: git ' + args.slice(0, 3).join(' ') + ' failed',
      {
        cause: error,
      },
    );
  }
}

function reference(root, baseRef) {
  if (
    !baseRef &&
    !process.env.UI_CHECK_BASE_SHA &&
    process.env.CI &&
    !/^(0|false)$/i.test(process.env.CI)
  )
    throw Error('UI check in CI requires UI_CHECK_BASE_SHA; comparison was not skipped');
  const ref = baseRef || process.env.UI_CHECK_BASE_SHA || 'HEAD';
  const sha = git(root, ['rev-parse', '--verify', '--end-of-options', ref + '^{commit}']).trim();
  const entries = git(root, ['ls-tree', '-rz', sha, '--', 'frontend/src'])
    .split('\0')
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^(100\d+) blob ([\da-f]+)\t([\s\S]+)$/);
      return match && { oid: match[2], file: match[3] };
    })
    .filter((entry) => entry && Object.values(rules).some((rule) => rule.applies(entry.file)));
  const sources = {};
  if (entries.length) {
    const contents = git(root, ['cat-file', '--batch'], {
      encoding: null,
      input: entries.map((entry) => entry.oid).join('\n') + '\n',
    });
    let offset = 0;
    for (const entry of entries) {
      const newline = contents.indexOf(10, offset);
      const header = contents
        .subarray(offset, newline)
        .toString('utf8')
        .match(/^([\da-f]+) blob (\d+)$/);
      if (!header || header[1] !== entry.oid)
        throw Error('Invalid Git source response for ' + entry.file);
      const size = Number(header[2]);
      offset = newline + 1;
      sources[entry.file] = contents.subarray(offset, offset + size).toString('utf8');
      offset += size + 1;
    }
  }
  const baselineExists = git(root, ['ls-tree', '--name-only', sha, '--', baselineName]).trim();
  const baseline = baselineExists
    ? parseBaseline(git(root, ['show', sha + ':' + baselineName]), { allowLegacy: true })
    : null;
  const found = scanSources(sources, { validateAllows: false });
  return { sha, sources, found, limits: upgradedLimits(baseline, sources, totals(found)) };
}

// Use actual added lines, not a pool of identical old text. The scope key above
// additionally catches Git aligning identical text under a changed parent.
function addedLines(root, sha, sources, baseSources) {
  const tracked = new Set(
    git(root, ['ls-files', '-z', '--', 'frontend/src']).split('\0').filter(Boolean),
  );
  const added = new Map(),
    changed = new Set();
  const diff = git(root, [
    '-c',
    'core.quotePath=false',
    'diff',
    '--no-ext-diff',
    '--no-textconv',
    '--no-renames',
    '--text',
    '--no-color',
    '--unified=0',
    sha,
    '--',
    ':(glob)frontend/src/**/*.vue',
    ':(glob)frontend/src/**/*.scss',
    ':(glob)frontend/src/**/*.css',
  ]);
  let file = null;
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) file = null;
    else if (line.startsWith('+++ ')) {
      if (line === '+++ /dev/null') file = null;
      else {
        if (!line.startsWith('+++ b/'))
          throw Error('UI check cannot safely parse Git diff path: ' + line);
        file = line.slice(6);
        if (!Object.hasOwn(sources, file))
          throw Error('UI check cannot match Git diff to working source: ' + file);
        changed.add(file);
        if (!added.has(file)) added.set(file, new Set());
      }
    } else if (line.startsWith('@@ ')) {
      const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
      if (!hunk) throw Error('UI check cannot safely parse a Git diff hunk');
      if (file) {
        const start = Number(hunk[1]),
          count = hunk[2] === undefined ? 1 : Number(hunk[2]);
        for (let number = start; number < start + count; number++) added.get(file).add(number);
      }
    }
  }
  for (const [name, source] of Object.entries(sources)) {
    if (!tracked.has(name) || !Object.hasOwn(baseSources, name))
      added.set(name, new Set(source.split('\n').map((_, index) => index + 1)));
    else if (
      source.replace(/\r\n/g, '\n') !== baseSources[name].replace(/\r\n/g, '\n') &&
      !changed.has(name)
    )
      throw Error('UI check cannot verify changed source with Git diff: ' + name);
  }
  return added;
}

// Schema 1 did not scan CSS old tokens, whitespace forms or !important.
// Its extra migration allowance is bounded by those forms in committed source.
function upgradedLimits(previous, sources, counts) {
  if (!previous) return counts;
  if (previous.schemaVersion === schemaVersion) return previous.rules;
  const oldCounts = Object.fromEntries(Object.keys(legacyRules).map((rule) => [rule, {}]));
  for (const [file, source] of Object.entries(sources)) {
    const lines = source.replace(/<template\s+#[\w-]+/g, '<template').split(/\r?\n/);
    for (const [rule, { applies, pattern }] of Object.entries(legacyRules)) {
      if (!applies(file)) continue;
      const allow = 'ui-check-allow ' + rule;
      const count = lines.reduce(
        (sum, line, index) =>
          sum +
          (line.includes(allow) || lines[index - 1]?.includes(allow)
            ? 0
            : line.match(pattern)?.length || 0),
        0,
      );
      if (count) oldCounts[rule][file] = count;
    }
  }
  return Object.fromEntries(
    Object.keys(rules).map((rule) => [
      rule,
      Object.fromEntries(
        Object.entries(counts[rule]).map(([file, count]) => [
          file,
          Math.min(
            count,
            (previous.rules[rule]?.[file] || 0) +
              Math.max(0, count - (oldCounts[rule]?.[file] || 0)),
          ),
        ]),
      ),
    ]),
  );
}

function writeBaseline(root, counts, previous) {
  const next = { schemaVersion, rules: {} };
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

function check(root, { baseRef, report = console } = {}) {
  const sources = workingSources(root),
    found = scanSources(sources),
    counts = totals(found),
    baseline = readBaseline(root),
    base = reference(root, baseRef),
    added = addedLines(root, base.sha, sources, base.sources);
  let failed = false,
    under = 0;
  report.log('UI reference: ' + base.sha);
  for (const rule of Object.keys(rules)) {
    const allowed = baseline.rules[rule];
    for (const file of new Set([...Object.keys(counts[rule]), ...Object.keys(allowed)])) {
      const now = counts[rule][file] || 0,
        limit = allowed[file] || 0,
        trustedLimit = base.limits[rule][file] || 0;
      if (limit > trustedLimit) {
        failed = true;
        report.error(file + ': ' + rule + ' baseline ' + limit + ' > trusted base ' + trustedLimit);
      }
      if (now > limit) {
        failed = true;
        report.error(
          file + ': ' + rule + ' ' + now + ' > baseline ' + limit + ' — ' + rules[rule].hint,
        );
      } else if (now < limit) under++;
      const existing = new Map();
      for (const hit of base.found[rule][file] || []) {
        const key = JSON.stringify([
          hit.kind || 'literal',
          hit.context,
          hit.text.replace(/\s+/g, ' '),
        ]);
        existing.set(key, (existing.get(key) || 0) + hit.count);
      }
      for (const hit of found[rule][file] || []) {
        const key = JSON.stringify([
            hit.kind || 'literal',
            hit.context,
            hit.text.replace(/\s+/g, ' '),
          ]),
          remaining = existing.get(key) || 0;
        let onAddedLine = false;
        for (let line = hit.line; line <= hit.endLine; line++)
          if (added.get(file)?.has(line)) onAddedLine = true;
        existing.set(key, Math.max(0, remaining - hit.count));
        if (onAddedLine || hit.count > remaining) {
          failed = true;
          report.error(
            file + ':' + hit.line + ': new ' + rule + ' occurrence — ' + rules[rule].hint,
          );
          report.error('  ' + hit.text);
        }
      }
    }
  }
  if (under)
    report.log(
      under + ' file/rule counts are below the baseline; npm run ui:baseline can lower it.',
    );
  return !failed;
}

if (require.main === module) {
  try {
    const mode = process.argv[2] || '--check';
    if (process.argv.length > 3) throw Error('Unexpected UI check argument');
    const root = process.cwd();
    if (mode === '--migrate') {
      const previous = readBaseline(root, { allowLegacy: true });
      if (previous.schemaVersion !== 1) throw Error('Only schema 1 can be migrated');
      const base = reference(root);
      writeBaseline(root, base.limits, {
        schemaVersion,
        rules: upgradedLimits(previous, base.sources, totals(base.found)),
      });
      console.log('UI baseline schema migrated using committed source ' + base.sha + '.');
    } else if (mode === '--update') {
      if (check(root)) {
        writeBaseline(root, totals(findings(root)), readBaseline(root));
        console.log('UI baseline lowered to the current counts.');
      } else process.exitCode = 1;
    } else if (mode === '--check') {
      if (check(root))
        console.log(
          'UI check: no new raw hex/CSS colour functions, raw page controls, old tokens or !important.',
        );
      else process.exitCode = 1;
    } else throw Error('Usage: node tools/ui-check.cjs [--check|--update|--migrate]');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  findings,
  totals,
  check,
  writeBaseline,
  parseBaseline,
  scanSources,
  upgradedLimits,
  rules,
};
