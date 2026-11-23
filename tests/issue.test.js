'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseIssue, decide, normalizeTarget, actionOf } = require('../scripts/process-issue');

const form = (action, name, target) =>
  `### What do you want to do?\r\n\r\n${action}\r\n\r\n### Subdomain name\r\n\r\n${name}\r\n\r\n### Where your site lives (address only)\r\n\r\n${target || '_No response_'}\r\n`;

const existing = [
  { name: 'taken-one', entry: { owner: { github: 'alice' }, record: { CNAME: 'alice.github.io' } } },
];
const base = { author: 'bob', existing, ageDays: 400 };

test('parses an issue form body (including Windows line endings)', () => {
  const f = parseIssue(form('Create a new subdomain', 'myapp', 'myapp.vercel.app'));
  assert.equal(f.name, 'myapp');
  assert.equal(f.target, 'myapp.vercel.app');
  assert.equal(parseIssue(form('Remove my subdomain', 'x', '')).target, '');
});

test('normalises targets and actions', () => {
  assert.equal(normalizeTarget('https://MyApp.Vercel.app/path?x=1'), 'myapp.vercel.app');
  assert.equal(normalizeTarget('abc.vercel-dns-017.com.'), 'abc.vercel-dns-017.com');
  assert.equal(actionOf('Remove my subdomain'), 'remove');
  assert.equal(actionOf('Change where my subdomain points'), 'update');
  assert.equal(actionOf('Create a new subdomain'), 'create');
});

test('creates a subdomain owned by the issue author', () => {
  const r = decide({ ...base, fields: parseIssue(form('Create a new subdomain', 'bobs-site', 'bob.github.io')) });
  assert.equal(r.ok, true);
  assert.equal(r.entry.owner.github, 'bob');
});

test('rejects taken, reserved, impersonating, wrong-host and too-young requests', () => {
  const t = (name, target, extra = {}) => decide({ ...base, ...extra, fields: parseIssue(form('Create a new subdomain', name, target)) });
  assert.equal(t('taken-one', 'bob.github.io').ok, false);
  assert.equal(t('admin', 'bob.github.io').ok, false);
  assert.equal(t('paypal-pay', 'bob.github.io').ok, false);
  assert.equal(t('my-site', 'evil.example.com').ok, false);
  assert.equal(t('my-site', 'bob.github.io', { ageDays: 3 }).ok, false);
  assert.equal(t('my-site', '').ok, false);
});

test('only the owner can change or remove', () => {
  const change = (author) => decide({ ...base, author, fields: parseIssue(form('Change where my subdomain points', 'taken-one', 'new.github.io')) });
  assert.equal(change('bob').ok, false);
  assert.equal(change('alice').ok, true);
  assert.equal(change('intuinode').ok, true); // maintainer
  const remove = (author) => decide({ ...base, author, fields: parseIssue(form('Remove my subdomain', 'taken-one', '')) });
  assert.equal(remove('bob').ok, false);
  assert.equal(remove('alice').op, 'remove');
});

test('one subdomain per person', () => {
  const ex = [...existing, { name: 'bobs-first', entry: { owner: { github: 'bob' }, record: { CNAME: 'b.github.io' } } }];
  const r = decide({ ...base, existing: ex, fields: parseIssue(form('Create a new subdomain', 'bobs-second', 'bob.github.io')) });
  assert.equal(r.ok, false);
});

test('error messages cannot ping users or inject markup', () => {
  const r = decide({ ...base, fields: parseIssue(form('Create a new subdomain', '@everyone`<img>', 'x.github.io')) });
  assert.equal(r.ok, false);
  assert.ok(!/[@`<>]/.test(r.message.replace(/\[submit a new request\]\(https:\/\/[^)]*\)/, '')));
});

test('garbage bodies are rejected, not crashed on', () => {
  assert.equal(decide({ ...base, fields: parseIssue('hello') }).ok, false);
  assert.equal(decide({ ...base, fields: parseIssue(undefined) }).ok, false);
});
