'use strict';
// Every workflow that writes the registry shares one concurrency group. GitHub's default keeps only
// ONE waiting run per group and silently cancels the others, which would drop users' requests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', '.github', 'workflows');

test('registry-writing workflows queue every run and read the latest registry', () => {
  let found = 0;
  for (const f of fs.readdirSync(DIR)) {
    const t = fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\r\n/g, '\n');
    if (!t.includes('group: registry-writes')) continue;
    found++;
    assert.match(t, /\n {2}queue: max\n/, `${f}: queue: max`);
    assert.match(t, /\n {2}cancel-in-progress: false\n/, `${f}: never cancel a running write`);
    assert.match(t, /ref: main/, `${f}: check out the latest main`);
  }
  assert.ok(found >= 4);
});
