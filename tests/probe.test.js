'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { classify, hostKind } = require('../scripts/probe');

// Responses captured from the real hosts.
const ghGone = { status: 404, server: 'GitHub.com', vercelError: '', body: "<h1>404</h1> There isn't a GitHub Pages site here." };
const ghOk = { status: 200, server: 'GitHub.com', vercelError: '', body: '<!doctype html>' };
const vcGone = { status: 404, server: 'Vercel', vercelError: 'DEPLOYMENT_NOT_FOUND', body: 'The deployment could not be found' };
const vcOk = { status: 421, server: 'Vercel', vercelError: '', body: 'Misdirected Request' };

test('recognises host types', () => {
  assert.equal(hostKind('intuinode.github.io'), 'github');
  assert.equal(hostKind('bridge-app.vercel.app'), 'vercel');
  assert.equal(hostKind('6499cda284159879.vercel-dns-017.com'), 'vercel');
  assert.equal(hostKind('cname.vercel-dns.com'), 'vercel');
  assert.equal(hostKind('site.netlify.app'), null);
  assert.equal(hostKind('evilgithub.io'), null);
});

test('GitHub Pages: only the explicit "no site here" page counts as unattached', () => {
  assert.equal(classify('u.github.io', ghGone), 'unattached');
  assert.equal(classify('u.github.io', ghOk), 'attached');
  assert.equal(classify('u.github.io', { status: 404, server: 'GitHub.com', body: 'Your own 404 page' }), 'attached');
  assert.equal(classify('u.github.io', { status: 503, server: 'GitHub.com', body: '' }), 'attached');
});

test('Vercel: only DEPLOYMENT_NOT_FOUND counts as unattached', () => {
  assert.equal(classify('p.vercel.app', vcGone), 'unattached');
  assert.equal(classify('p.vercel.app', vcOk), 'attached');
  assert.equal(classify('p.vercel.app', { status: 401, server: 'Vercel', vercelError: '', body: '' }), 'attached');
  assert.equal(classify('p.vercel.app', { status: 404, server: 'Vercel', vercelError: '', body: 'app-level 404' }), 'attached');
});

test('network problems and unknown hosts never trigger removal', () => {
  assert.equal(classify('u.github.io', { error: 'timeout' }), 'unknown');
  assert.equal(classify('p.vercel.app', null), 'unknown');
  assert.equal(classify('site.netlify.app', vcGone), 'unverifiable');
});
