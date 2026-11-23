'use strict';
// Detects "dangling" subdomains: a DNS name that points at a host which does not (yet / any more)
// have that domain attached to a project. Anyone could claim such a name on the host and serve
// their own content on our domain (subdomain takeover).
//
// How: connect to the CNAME target and send the custom hostname in the Host header. A host that
// knows the domain answers normally; one that does not gives a recognisable "not found" page.
// Only definite signatures count as "unattached"; anything unclear is never treated as one.
const https = require('node:https');

function probe(target, host, timeoutMs = 12000) {
  return new Promise((resolve) => {
    const req = https.request(
      {
        host: target,
        servername: target,
        port: 443,
        path: '/',
        method: 'GET',
        headers: { Host: host, 'User-Agent': 'omnexlab-registry-probe', Accept: 'text/html' },
        timeout: timeoutMs,
      },
      (res) => {
        let body = '';
        res.on('data', (d) => { if (body.length < 20000) body += d; });
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            server: String(res.headers.server || ''),
            vercelError: String(res.headers['x-vercel-error'] || ''),
            body,
          })
        );
      }
    );
    req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }); });
    req.on('error', (e) => resolve({ error: e.code || e.message }));
    req.end();
  });
}

function hostKind(target) {
  const t = String(target).toLowerCase();
  if (t === 'github.io' || t.endsWith('.github.io')) return 'github';
  if (t.endsWith('.vercel.app') || /(^|\.)vercel-dns(-[0-9]{3})?\.com$/.test(t)) return 'vercel';
  return null;
}

// -> 'attached' | 'unattached' | 'unknown' (probe failed) | 'unverifiable' (host type we cannot check)
function classify(target, r) {
  const kind = hostKind(target);
  if (!kind) return 'unverifiable';
  if (!r || r.error) return 'unknown';
  if (kind === 'github') {
    const gone = r.status === 404 && /github\.com/i.test(r.server) && /There isn.t a GitHub Pages site here/i.test(r.body || '');
    return gone ? 'unattached' : 'attached';
  }
  const gone = r.status === 404 && /^(DEPLOYMENT_NOT_FOUND|NOT_FOUND)$/.test(r.vercelError);
  return gone ? 'unattached' : 'attached';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Asks twice before declaring something unattached, so one odd response never causes an action.
async function check(target, host, { retryDelayMs = 4000 } = {}) {
  let state = classify(target, await probe(target, host));
  if (state === 'unattached') {
    await sleep(retryDelayMs);
    state = classify(target, await probe(target, host));
  }
  return state;
}

function howToAttach(kind, host) {
  if (kind === 'vercel') return `In Vercel open your project, then **Settings > Domains**, and add \`${host}\`. Vercel may say the DNS is not configured yet; that is fine.`;
  if (kind === 'github') return `In your GitHub repository open **Settings > Pages**, and put \`${host}\` in **Custom domain**.`;
  return `Add \`${host}\` as a custom domain in your hosting dashboard.`;
}

module.exports = { probe, classify, check, hostKind, howToAttach };
