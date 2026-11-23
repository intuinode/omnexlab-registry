'use strict';
// Guards the on-page SEO basics so a page can't silently lose them.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DOCS = path.join(__dirname, '..', 'docs');
const SITE = 'https://omnexlab.site';
const pages = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html') && e.name !== '404.html') pages.push(p);
  }
})(DOCS);

const urlOf = (file) => {
  const rel = path.relative(DOCS, file).split(path.sep).join('/');
  return rel === 'index.html' ? `${SITE}/` : `${SITE}/${rel}`;
};
const get = (h, re) => (h.match(re) || [])[1];

test('there are pages to check', () => assert.ok(pages.length >= 9));

test('every page has one H1, a sensible title and description, and a canonical URL', () => {
  const titles = new Set(), descs = new Set();
  for (const f of pages) {
    const h = fs.readFileSync(f, 'utf8');
    const name = path.relative(DOCS, f);
    assert.equal((h.match(/<h1[\s>]/g) || []).length, 1, `${name}: exactly one <h1>`);
    const title = get(h, /<title>([^<]*)<\/title>/);
    const desc = get(h, /<meta name="description" content="([^"]*)">/);
    assert.ok(title && title.length >= 20 && title.length <= 60, `${name}: title length ${title && title.length}`);
    assert.ok(desc && desc.length >= 70 && desc.length <= 165, `${name}: description length ${desc && desc.length}`);
    assert.ok(!titles.has(title), `${name}: duplicate title`); titles.add(title);
    assert.ok(!descs.has(desc), `${name}: duplicate description`); descs.add(desc);
    assert.equal(get(h, /<link rel="canonical" href="([^"]*)">/), urlOf(f), `${name}: canonical`);
    assert.ok(/<html lang="en">/.test(h), `${name}: lang attribute`);
  }
});

test('every page has Open Graph and Twitter card tags pointing at a real image', () => {
  assert.ok(fs.existsSync(path.join(DOCS, 'og.png')), 'docs/og.png exists');
  for (const f of pages) {
    const h = fs.readFileSync(f, 'utf8');
    const name = path.relative(DOCS, f);
    for (const tag of ['og:title', 'og:description', 'og:url', 'og:image', 'og:image:alt']) {
      assert.ok(h.includes(`property="${tag}"`), `${name}: ${tag}`);
    }
    assert.ok(h.includes('name="twitter:card" content="summary_large_image"'), `${name}: twitter card`);
    assert.equal(get(h, /property="og:url" content="([^"]*)"/), urlOf(f), `${name}: og:url matches canonical`);
  }
});

test('structured data is valid JSON on every page that has it', () => {
  for (const f of pages) {
    const h = fs.readFileSync(f, 'utf8');
    for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      assert.doesNotThrow(() => JSON.parse(m[1]), `${path.relative(DOCS, f)}: JSON-LD parses`);
    }
  }
});

test('sitemap lists every page, and robots.txt points at it', () => {
  const sm = fs.readFileSync(path.join(DOCS, 'sitemap.xml'), 'utf8');
  for (const f of pages) assert.ok(sm.includes(`<loc>${urlOf(f)}</loc>`), `sitemap lists ${urlOf(f)}`);
  assert.ok(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(sm), 'sitemap has lastmod');
  assert.ok(fs.readFileSync(path.join(DOCS, 'robots.txt'), 'utf8').includes(`Sitemap: ${SITE}/sitemap.xml`));
});

test('internal links and assets resolve to real files', () => {
  for (const f of pages) {
    const h = fs.readFileSync(f, 'utf8');
    for (const m of h.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
      const rel = m[1] === '/' ? 'index.html' : m[1].slice(1);
      assert.ok(fs.existsSync(path.join(DOCS, rel)), `${path.relative(DOCS, f)}: ${m[1]} exists`);
    }
  }
});
