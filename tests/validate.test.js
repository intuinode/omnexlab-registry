'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkName, checkTarget, checkEntry, checkUniqueness } = require('../scripts/lib');

const good = { owner: { github: 'octocat' }, record: { CNAME: 'octocat.github.io' } };

test('accepts a normal entry', () => {
  assert.deepEqual(checkEntry('my-app', good), []);
});

test('rejects bad names', () => {
  for (const n of ['ab', '-abc', 'abc-', 'ABC', 'a_b_c', 'a--b', 'xn--abc', 'x'.repeat(33)]) {
    assert.ok(checkName(n).length > 0, `${n} should be rejected`);
  }
});

test('rejects reserved and impersonation names', () => {
  assert.ok(checkName('admin').length > 0);
  assert.ok(checkName('paypal-login').length > 0);
  assert.ok(checkName('my-google-app').length > 0);
});

test('only allows known hosts for CNAME targets', () => {
  assert.deepEqual(checkTarget('octocat.github.io'), []);
  assert.deepEqual(checkTarget('site.netlify.app'), []);
  assert.ok(checkTarget('evil.example.com').length > 0);
  assert.ok(checkTarget('notgithub.io').length > 0);
  assert.ok(checkTarget('a.omnexlab.site').length > 0);
  assert.ok(checkTarget('Octocat.github.io').length > 0);
});

test('accepts Vercel project CNAME targets but not look-alikes', () => {
  assert.deepEqual(checkTarget('6499cda284159879.vercel-dns-017.com'), []);
  assert.deepEqual(checkTarget('cname.vercel-dns.com'), []);
  assert.ok(checkTarget('evil.vercel-dns-017.com.attacker.net').length > 0);
  assert.ok(checkTarget('abc.vercel-dns-17.com').length > 0);
});

test('only maintainers may set proxied', () => {
  assert.ok(checkEntry('my-app', { ...good, proxied: false }).length > 0);
  const m = { owner: { github: 'intuinode' }, record: good.record };
  assert.deepEqual(checkEntry('my-app', { ...m, proxied: false }), []);
  assert.ok(checkEntry('my-app', { ...m, proxied: 'no' }).length > 0);
});

test('rejects wrong record types and extra fields', () => {
  assert.ok(checkEntry('my-app', { ...good, record: { A: '1.2.3.4' } }).length > 0);
  assert.ok(checkEntry('my-app', { ...good, record: { CNAME: 'a.github.io', TXT: 'x' } }).length > 0);
  assert.ok(checkEntry('my-app', { ...good, extra: 1 }).length > 0);
  assert.ok(checkEntry('my-app', { owner: { github: 'not valid!' }, record: good.record }).length > 0);
  assert.ok(checkEntry('my-app', null).length > 0);
});

test('limits subdomains per owner but not for maintainers', () => {
  const two = [
    { name: 'one-app', entry: good },
    { name: 'two-app', entry: good },
  ];
  assert.equal(checkUniqueness(two).length, 1);
  const m = { owner: { github: 'intuinode' }, record: good.record };
  assert.equal(checkUniqueness([{ name: 'a-app', entry: m }, { name: 'b-app', entry: m }]).length, 0);
});
