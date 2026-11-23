'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { build } = require('../scripts/build-public');
const { config } = require('../scripts/lib');

test('public files are deterministic and never expose owners', () => {
  const a = JSON.stringify(build());
  const b = JSON.stringify(build());
  assert.equal(a, b);
  assert.ok(!/"owner"|"github"/.test(JSON.stringify(build().registry)));
});

test('rules.json mirrors the real config', () => {
  const { rules } = build();
  assert.deepEqual(rules.reservedNames, config.reserved);
  assert.deepEqual(rules.supportedHosts.suffixes, config.allowedTargetSuffixes);
  assert.equal(rules.limits.subdomainsPerGitHubAccount, config.maxPerUser);
  assert.ok(new RegExp(rules.name.pattern).test('my-app'));
  assert.ok(!new RegExp(rules.name.pattern).test('-bad'));
});

test('the documented issue body format is parseable by the bot', () => {
  const { parseIssue } = require('../scripts/process-issue');
  const f = parseIssue(build().rules.how.issueBodyFormat);
  assert.equal(f.action, 'Create a new subdomain');
  assert.equal(f.name, '<name>');
  assert.ok(f.mode.startsWith('Through Cloudflare'));
});
