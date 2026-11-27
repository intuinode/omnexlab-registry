'use strict';
// Applies consistent SEO tags to every page in docs/ and regenerates docs/sitemap.xml.
// Edit the PAGES table below, then run:  node scripts/seo-apply.js
// (tests/seo.test.js checks the result, so a page can't silently lose its tags.)
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const SITE = 'https://omnexlab.site';
const IMG = `${SITE}/og.png`;
const IMG_ALT = 'omnexlab.site: free subdomains for your projects';

// title <= 60 chars, description 70-160 chars
const PAGES = {
  'index.html': { url: '/', title: 'Free Subdomain for Vercel & GitHub Pages | omnexlab.site', desc: 'Get a free yourname.omnexlab.site subdomain for your Vercel or GitHub Pages site. HTTPS included, no card. Request, change or cancel in minutes.', priority: '1.0' },
  'guides.html': { url: '/guides.html', title: 'Vercel & GitHub Pages Subdomain Guides | omnexlab.site', desc: 'Step-by-step guides to point a free omnexlab.site subdomain at your Vercel or GitHub Pages site, plus fixes for common DNS and HTTPS problems.', crumb: 'Guides', priority: '0.8' },
  'guides/vercel-subdomain.html': { url: '/guides/vercel-subdomain.html', title: 'Free Custom Subdomain for Vercel | omnexlab.site', desc: 'How to point a free yourname.omnexlab.site subdomain at your Vercel project: add the domain, request it, and fix Invalid Configuration warnings.', type: 'article', priority: '0.8' },
  'guides/github-pages-subdomain.html': { url: '/guides/github-pages-subdomain.html', title: 'Free Custom Subdomain for GitHub Pages | omnexlab.site', desc: 'How to use a free yourname.omnexlab.site subdomain as the custom domain of your GitHub Pages site, with HTTPS and no cost.', type: 'article', priority: '0.8' },
  'guides/resend-email.html': { url: '/guides/resend-email.html', title: 'Send Email with Resend on a Free Subdomain | omnexlab.site', desc: 'Set up Resend on your free omnexlab.site subdomain: add the domain, request the DNS records, verify, and send email with the Resend API.', type: 'article', priority: '0.7' },
  'manage.html': { url: '/manage.html', title: 'Change or Cancel Your Subdomain | omnexlab.site', desc: 'Change where your free omnexlab.site subdomain points, switch its traffic mode, or cancel it. Only the owner can make changes.', crumb: 'Manage', priority: '0.5' },
  'plans.html': { url: '/plans.html', title: 'Free Subdomain Plans and Sponsors | omnexlab.site', desc: 'omnexlab.site subdomains are free today. What free means, what may change, and how sponsorship works. Sponsors get no special treatment.', crumb: 'Plans', priority: '0.4' },
  'terms.html': { url: '/terms.html', title: 'Terms of Service | omnexlab.site', desc: 'The terms for using free omnexlab.site subdomains: what we provide, what you are responsible for, and when a subdomain can be removed.', crumb: 'Terms', priority: '0.3' },
  'privacy.html': { url: '/privacy.html', title: 'Privacy Policy | omnexlab.site', desc: 'What omnexlab.site collects, how traffic is processed through Cloudflare, who else sees it, and how to have your data removed.', crumb: 'Privacy', priority: '0.3' },
  'dmca.html': { url: '/dmca.html', title: 'DMCA and Abuse Reports | omnexlab.site', desc: 'Report phishing, malware, impersonation or copyright infringement on an omnexlab.site subdomain. Reports are reviewed within 48 hours.', crumb: 'DMCA and abuse', priority: '0.4' },
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function lastmod(rel) {
  try {
    const d = execFileSync('git', ['log', '-1', '--format=%cs', '--', `docs/${rel}`], { cwd: ROOT, encoding: 'utf8' }).trim();
    if (d) return d;
  } catch { /* not a git checkout */ }
  return new Date().toISOString().slice(0, 10);
}

function block(p) {
  const url = SITE + p.url;
  return [
    `<meta name="robots" content="index,follow,max-image-preview:large">`,
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:type" content="${p.type || 'website'}">`,
    `<meta property="og:site_name" content="omnexlab.site">`,
    `<meta property="og:locale" content="en_US">`,
    `<meta property="og:title" content="${esc(p.title)}">`,
    `<meta property="og:description" content="${esc(p.desc)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${IMG}">`,
    `<meta property="og:image:width" content="1280">`,
    `<meta property="og:image:height" content="640">`,
    `<meta property="og:image:alt" content="${esc(IMG_ALT)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(p.title)}">`,
    `<meta name="twitter:description" content="${esc(p.desc)}">`,
    `<meta name="twitter:image" content="${IMG}">`,
    `<meta name="twitter:image:alt" content="${esc(IMG_ALT)}">`,
    ...(p.url === '/' ? [`<link rel="alternate" type="text/plain" href="/llms.txt" title="Summary for AI assistants">`] : []),
  ].join('\n');
}

function breadcrumb(p) {
  return `<script type="application/ld+json">\n${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: p.crumb, item: SITE + p.url },
    ],
  }, null, 2)}\n</script>`;
}

for (const [rel, p] of Object.entries(PAGES)) {
  const file = path.join(DOCS, rel);
  let h = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

  h = h.replace(/<title>[^<]*<\/title>/, `<title>${esc(p.title)}</title>`);
  h = h.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(p.desc)}">`);
  // drop previously generated tags so the script is idempotent
  h = h.replace(/^<meta name="robots"[^\n]*\n/gm, '')
       .replace(/^<link rel="canonical"[^\n]*\n/gm, '')
       .replace(/^<link rel="alternate" type="text\/plain"[^\n]*\n/gm, '')
       .replace(/^<meta property="og:[^\n]*\n/gm, '')
       .replace(/^<meta name="twitter:[^\n]*\n/gm, '');
  // marker-free insertion right after the theme-color tag
  h = h.replace(/(<meta name="theme-color"[^\n]*\n)/, `$1${block(p)}\n`);

  // breadcrumbs for simple pages that have no structured data yet
  if (p.crumb && !/application\/ld\+json/.test(h)) h = h.replace('</head>', `${breadcrumb(p)}\n</head>`);

  fs.writeFileSync(file, h);
}

const urls = Object.entries(PAGES)
  .map(([rel, p]) => `  <url>\n    <loc>${SITE}${p.url}</loc>\n    <lastmod>${lastmod(rel)}</lastmod>\n    <priority>${p.priority}</priority>\n  </url>`)
  .join('\n');
fs.writeFileSync(path.join(DOCS, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);

console.log(`SEO tags applied to ${Object.keys(PAGES).length} pages; sitemap.xml regenerated.`);
module.exports = { PAGES };
