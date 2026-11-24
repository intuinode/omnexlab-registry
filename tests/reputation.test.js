'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildQuery, parseResponse, sbBody, sbParse, verdictOf } = require('../scripts/reputation');

test('severity rules: when to warn and when to remove', () => {
  // nothing, or no information, is never a problem
  assert.equal(verdictOf({}).level, 'clean');
  assert.equal(verdictOf({ sb: null, dns: { a: null, b: null } }).level, 'clean');
  assert.equal(verdictOf({ sb: [], dns: { a: false, b: false } }).level, 'clean');
  // phishing or malware at Google is severe on its own
  assert.equal(verdictOf({ sb: ['SOCIAL_ENGINEERING'] }).level, 'severe');
  assert.equal(verdictOf({ sb: ['MALWARE'], dns: { a: false } }).level, 'severe');
  // unwanted / harmful software alone is only a warning
  assert.equal(verdictOf({ sb: ['UNWANTED_SOFTWARE'] }).level, 'mild');
  assert.equal(verdictOf({ sb: ['POTENTIALLY_HARMFUL_APPLICATION'] }).level, 'mild');
  // one DNS filter is a warning; two independent filters is severe
  assert.equal(verdictOf({ dns: { a: true, b: false } }).level, 'mild');
  assert.equal(verdictOf({ dns: { a: true, b: null } }).level, 'mild');
  assert.equal(verdictOf({ dns: { a: true, b: true } }).level, 'severe');
  // severe beats mild when both are present
  assert.equal(verdictOf({ sb: ['UNWANTED_SOFTWARE', 'MALWARE'] }).level, 'severe');
  // every non-clean verdict explains itself
  assert.ok(verdictOf({ sb: ['MALWARE'] }).reasons.length > 0);
});

test('DNS query is a well-formed A query', () => {
  const q = buildQuery('demo.omnexlab.site');
  assert.equal(q.readUInt16BE(4), 1, 'one question');
  assert.equal(q[12], 4, 'first label length');
  assert.equal(q.subarray(13, 17).toString(), 'demo');
  assert.deepEqual([...q.subarray(q.length - 4)], [0, 1, 0, 1], 'type A, class IN');
});

test('parses real-shaped DNS answers (normal, blocked-as-0.0.0.0, NXDOMAIN)', () => {
  const q = buildQuery('x.example.com');
  const answer = (rcode, ips) => {
    const head = Buffer.from(q.subarray(0, 12)); head.writeUInt16BE(0x8180 | rcode, 2); head.writeUInt16BE(ips.length, 6);
    const rrs = ips.map((ip) => Buffer.from([0xc0, 0x0c, 0, 1, 0, 1, 0, 0, 0, 60, 0, 4, ...ip.split('.').map(Number)]));
    return Buffer.concat([head, q.subarray(12), ...rrs]);
  };
  assert.deepEqual(parseResponse(answer(0, ['104.21.1.2', '172.67.1.2'])), { rcode: 0, addrs: ['104.21.1.2', '172.67.1.2'] });
  assert.deepEqual(parseResponse(answer(0, ['0.0.0.0'])), { rcode: 0, addrs: ['0.0.0.0'] });
  assert.deepEqual(parseResponse(answer(3, [])), { rcode: 3, addrs: [] });
  assert.equal(parseResponse(Buffer.alloc(3)), null);
});

test('Safe Browsing request and response shapes', () => {
  const body = sbBody(['a.omnexlab.site', 'b.omnexlab.site']);
  assert.deepEqual(body.threatInfo.threatEntries, [{ url: 'https://a.omnexlab.site/' }, { url: 'https://b.omnexlab.site/' }]);
  assert.ok(body.threatInfo.threatTypes.includes('SOCIAL_ENGINEERING') && body.threatInfo.threatTypes.includes('MALWARE'));
  assert.deepEqual(sbParse({}), {}, 'no matches means no threats');
  const parsed = sbParse({ matches: [
    { threatType: 'MALWARE', threat: { url: 'https://a.omnexlab.site/' } },
    { threatType: 'SOCIAL_ENGINEERING', threat: { url: 'https://a.omnexlab.site/' } },
    { threatType: 'UNWANTED_SOFTWARE', threat: { url: 'https://b.omnexlab.site/' } },
  ] });
  assert.deepEqual(parsed['a.omnexlab.site'].sort(), ['MALWARE', 'SOCIAL_ENGINEERING']);
  assert.deepEqual(parsed['b.omnexlab.site'], ['UNWANTED_SOFTWARE']);
});
