'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { checkEmail, emailRecords, emailFromFields, fingerprint } = require('../scripts/email');
const { parseEmailIssue, decideEmail, waitingMessage } = require('../scripts/process-email');
const { checkEntry, config } = require('../scripts/lib');
const { desiredRecords, plan, MARK } = require('../scripts/sync');

const key = (bits) => crypto.generateKeyPairSync('rsa', { modulusLength: bits, publicKeyEncoding: { type: 'spki', format: 'der' }, privateKeyEncoding: { type: 'pkcs8', format: 'der' } }).publicKey.toString('base64');
const DKIM = 'p=' + key(1024);
const mx = { provider: 'resend', dkim: DKIM, sendingMx: 'feedback-smtp.us-east-1.amazonses.com' };
const owner = { name: 'bobs-app', entry: { owner: { github: 'bob' }, record: { CNAME: 'bob.github.io' } } };

test('accepts both Resend record styles and receiving', () => {
  assert.deepEqual(checkEmail(mx), []);
  assert.deepEqual(checkEmail({ provider: 'resend', dkim: DKIM, sendingCname: { send: 'abc.forge.rmta.net', rsend: 'def.resend-dns.com' } }), []);
  assert.deepEqual(checkEmail({ ...mx, receivingMx: 'inbound-smtp.eu-west-1.amazonaws.com' }), []);
  assert.deepEqual(checkEmail({ ...mx, receivingMx: 'receive-euw1.forge.rmta.net' }), []);
});

test('refuses anything that is not a Resend record', () => {
  const bad = [
    { ...mx, sendingMx: 'mail.evil.com' },
    { ...mx, sendingMx: 'feedback-smtp.us-east-1.amazonses.com.evil.com' },
    { ...mx, receivingMx: 'mx.evil.com' },
    { ...mx, dkim: 'p=notakey' },
    { ...mx, dkim: 'v=spf1 +all' },
    { ...mx, dkim: 'p=' + key(512) },
    { ...mx, extraTxt: 'v=spf1 +all' },
    { ...mx, provider: 'other' },
    { provider: 'resend', dkim: DKIM },
    { ...mx, sendingCname: { send: 'abc.forge.rmta.net' } },
    { provider: 'resend', dkim: DKIM, sendingCname: { send: 'evil.example.com' } },
    { provider: 'resend', dkim: DKIM, sendingCname: { send: 'notrmta.net' } },
  ];
  for (const e of bad) assert.ok(checkEmail(e).length > 0, JSON.stringify(e).slice(0, 90));
});

test('all records live under mail.<name> and none are proxied', () => {
  const r = emailRecords('bobs-app', { ...mx, receivingMx: 'inbound-smtp.us-east-1.amazonaws.com' }, 'omnexlab.site');
  assert.ok(r.every((x) => x.name === 'mail.bobs-app.omnexlab.site' || x.name.endsWith('.mail.bobs-app.omnexlab.site')));
  assert.ok(r.every((x) => x.proxied !== true));
  assert.ok(r.some((x) => x.name === '_dmarc.mail.bobs-app.omnexlab.site' && x.content.includes('p=quarantine')));
  assert.equal(r.filter((x) => x.type === 'MX').length, 2);
});

test('checkEntry validates the email block', () => {
  assert.deepEqual(checkEntry(owner.name, { ...owner.entry, email: mx }), []);
  assert.ok(checkEntry(owner.name, { ...owner.entry, email: { ...mx, sendingMx: 'x.evil.com' } }).length > 0);
});

const form = (over = {}) => {
  const v = { action: 'Set up or change email records', name: 'bobs-app', dkim: DKIM, sendingMx: 'feedback-smtp.us-east-1.amazonses.com.', send: '_No response_', rsend: '_No response_', receivingMx: '_No response_', use: 'Password resets for people who sign up in my app.', agree: '- [X] I will only send mail people asked for', ...over };
  const labels = { action: 'What do you want to do?', name: 'Email subdomain', dkim: 'DKIM value', sendingMx: 'Sending MX value', send: 'send CNAME target', rsend: 'rsend CNAME target', receivingMx: 'Receiving MX value', use: 'What will you send', agree: 'Email rules' };
  return Object.keys(labels).map((k) => `### ${labels[k]}\r\n\r\n${v[k]}\r\n`).join('\r\n');
};
const decide = (over = {}, extra = {}) => decideEmail({ fields: parseEmailIssue(form(over)), author: 'bob', existing: [owner], ageDays: 400, ...extra });

test('a good request waits for approval and records what was reviewed', () => {
  const r = decide();
  assert.equal(r.ok, true);
  assert.equal(r.domain, 'mail.bobs-app.omnexlab.site');
  assert.equal(r.entry.email.sendingMx, 'feedback-smtp.us-east-1.amazonses.com');
  assert.ok(waitingMessage(r).includes(`email-review:${r.fp}`));
  // a changed request has a different fingerprint, so an old approval cannot apply to it
  assert.notEqual(fingerprint(r.name, emailFromFields({ dkim: DKIM, sendingMx: 'feedback-smtp.eu-west-1.amazonses.com' })), r.fp);
});

test('accepts names typed as full or mail. domains, and DKIM wrapped over lines', () => {
  assert.equal(decide({ name: 'mail.bobs-app.omnexlab.site' }).ok, true);
  assert.equal(decide({ dkim: DKIM.slice(0, 60) + '\n' + DKIM.slice(60) }).ok, true);
});

test('only the owner, with agreement, a purpose and an old enough account', () => {
  assert.equal(decide({}, { author: 'mallory' }).ok, false);
  assert.equal(decide({ agree: '- [ ] I will only send' }).ok, false);
  assert.equal(decide({ use: 'spam' }).ok, false);
  assert.equal(decide({}, { ageDays: 10 }).ok, false);
  assert.equal(decide({ name: 'nobody' }).ok, false);
  assert.equal(decide({}, { settings: { enabled: false } }).ok, false);
});

test('removing email keeps the website', () => {
  const ex = [{ name: 'bobs-app', entry: { ...owner.entry, email: mx } }];
  const r = decide({ action: 'Remove my email records' }, { existing: ex });
  assert.equal(r.op, 'remove');
  assert.equal(r.entry.email, undefined);
  assert.equal(r.entry.record.CNAME, 'bob.github.io');
});

test('sync: creates mail records, removes them again, and never touches hand-made records', () => {
  const withMail = desiredRecords([{ name: 'bobs-app', entry: { ...owner.entry, email: mx } }], config);
  assert.equal(withMail.length, 5); // CNAME + DKIM + DMARC + send MX + send SPF
  const live = withMail.map((r, i) => ({ id: String(i), comment: MARK, proxied: r.proxied ?? false, ...r, content: r.type === 'TXT' ? `"${r.content}"` : r.content }));
  const hand = [
    { id: 'h1', type: 'MX', name: 'omnexlab.site', content: 'mx1.spacemail.com', priority: 0, comment: 'spacemail' },
    { id: 'h2', type: 'TXT', name: 'omnexlab.site', content: 'v=spf1 include:spf.spacemail.com ~all', comment: 'spacemail' },
  ];
  const same = plan(withMail, [...live, ...hand]);
  assert.deepEqual([same.creates.length, same.updates.length, same.deletes.length], [0, 0, 0]);
  const without = plan(desiredRecords([owner], config), [...live, ...hand]);
  assert.equal(without.deletes.length, 4);
  assert.ok(without.deletes.every((d) => d.comment === MARK && d.name.includes('mail.bobs-app')));
});

test('sync: switching the email add-on off removes mail records only', () => {
  const off = desiredRecords([{ name: 'bobs-app', entry: { ...owner.entry, email: mx } }], { ...config, email: { enabled: false } });
  assert.deepEqual(off.map((r) => r.type), ['CNAME']);
});
