const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm');
test('shared header applies button primitives to navigation without changing native controls', () => {
  const source = fs.readFileSync(require.resolve('../public/shared/site-header.js'), 'utf8');
  const controls = Array.from({ length: 5 }, () => ({
    classList: {
      values: new Set(),
      add(...names) {
        names.forEach((n) => this.values.add(n));
      },
    },
  }));
  const seen = [];
  const document = {
    querySelector: () => ({ querySelector: () => null }),
    querySelectorAll: (selector) => {
      seen.push(selector);
      return controls;
    },
  };
  const accountStart = source.search(/\bconst\s+account\s*=/);
  assert.ok(accountStart >= 0, 'account binding must delimit the navigation setup');
  vm.runInNewContext(source.slice(0, accountStart) + '})();', { document });
  assert.ok(seen[0].includes('.site-links summary'));
  assert.ok(seen[0].includes('.game-toolbar nav>a'));
  for (const c of controls) {
    assert.ok(c.classList.values.has('ui-button'));
    assert.ok(c.classList.values.has('ui-navigation-button'));
  }
  assert.equal(controls[0].onclick, undefined, 'native navigation is not replaced');
});
