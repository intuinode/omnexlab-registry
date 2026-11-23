'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const req = (url, headers = {}, method = 'GET') => new Request(url, { method, headers });
const res = (type = 'text/html; charset=utf-8', status = 200, headers = {}) =>
  new Response('<html></html>', { status, headers: { 'content-type': type, ...headers } });

test('injects only into successful HTML page loads of user sites', async () => {
  const { shouldInject } = await import('../worker/badge.mjs');
  const doc = { 'sec-fetch-dest': 'document' };
  assert.equal(shouldInject(req('https://demo.omnexlab.site/', doc), res()), true);
  assert.equal(shouldInject(req('https://demo.omnexlab.site/'), res()), true, 'plain requests with no fetch metadata still count');
});

test('never touches non-HTML, iframes, scripts, errors, downloads or non-GET', async () => {
  const { shouldInject } = await import('../worker/badge.mjs');
  const u = 'https://demo.omnexlab.site/';
  assert.equal(shouldInject(req(u), res('application/json')), false);
  assert.equal(shouldInject(req(u), res('text/css')), false);
  assert.equal(shouldInject(req(u, { 'sec-fetch-dest': 'iframe' }), res()), false);
  assert.equal(shouldInject(req(u, { 'sec-fetch-dest': 'script' }), res()), false);
  assert.equal(shouldInject(req(u), res('text/html', 404)), false);
  assert.equal(shouldInject(req(u), res('text/html', 301)), false);
  assert.equal(shouldInject(req(u), res('text/html', 200, { 'content-disposition': 'attachment; filename=a.html' })), false);
  assert.equal(shouldInject(req(u, {}, 'POST'), res()), false);
});

test('never touches our own website', async () => {
  const { shouldInject } = await import('../worker/badge.mjs');
  assert.equal(shouldInject(req('https://omnexlab.site/'), res()), false);
  assert.equal(shouldInject(req('https://www.omnexlab.site/'), res()), false);
});
