'use strict';
// Reputation signals for a hostname, used by the daily safety check (scripts/safety-monitor.js).
//
// Signals (all free):
//   - Google Safe Browsing v4 Lookup API  (optional: needs a free API key, set SAFE_BROWSING_API_KEY)
//   - Cloudflare security DNS (1.1.1.2) and Quad9: public resolvers that refuse to resolve hosts that
//     are on malware/phishing lists. No account needed. Compared against an unfiltered answer so a
//     host that simply does not exist is never mistaken for a blocked one.
//
// verdictOf() turns the signals into clean | mild | severe. Anything unclear is "clean": the check
// must never remove or warn a site because a lookup failed.

const http2 = require('node:http2');

const OPEN_DOH = 'https://cloudflare-dns.com/dns-query';
const FILTERED = [
  { name: 'Cloudflare security DNS', url: 'https://security.cloudflare-dns.com/dns-query' },
  { name: 'Quad9', url: 'https://dns.quad9.net/dns-query' },
];
const SEVERE_SB = ['MALWARE', 'SOCIAL_ENGINEERING'];
const ALL_SB = ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'];

// ---- DNS over HTTPS, wire format (so any standard resolver works) ----
function buildQuery(host) {
  const bytes = [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0]; // id 0, recursion desired, 1 question
  for (const label of host.split('.')) {
    bytes.push(label.length, ...Buffer.from(label, 'ascii'));
  }
  bytes.push(0, 0, 1, 0, 1); // end of name, type A, class IN
  return Buffer.from(bytes);
}

function skipName(buf, o) {
  for (;;) {
    const len = buf[o];
    if (len === 0) return o + 1;
    if ((len & 0xc0) === 0xc0) return o + 2;
    o += len + 1;
  }
}

function parseResponse(buf) {
  if (!buf || buf.length < 12) return null;
  const rcode = buf.readUInt16BE(2) & 0x0f;
  const qd = buf.readUInt16BE(4);
  const an = buf.readUInt16BE(6);
  let o = 12;
  for (let i = 0; i < qd; i++) o = skipName(buf, o) + 4;
  const addrs = [];
  for (let i = 0; i < an && o < buf.length; i++) {
    o = skipName(buf, o);
    const type = buf.readUInt16BE(o);
    const rdlen = buf.readUInt16BE(o + 8);
    if (type === 1 && rdlen === 4) addrs.push([...buf.subarray(o + 10, o + 14)].join('.'));
    o += 10 + rdlen;
  }
  return { rcode, addrs };
}

// DNS over HTTPS (RFC 8484) over HTTP/2. Some resolvers (Quad9) refuse HTTP/1.1, which is all
// Node's fetch speaks, so this uses the built-in http2 client. Never hangs: hard timeout, and
// every failure resolves to null ("could not tell").
function dohQuery(url, host, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let finished = false;
    let client;
    const finish = (value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try { client && client.destroy(); } catch { /* already closed */ }
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    try {
      const u = new URL(url);
      client = http2.connect(u.origin);
      client.on('error', () => finish(null));
      const req = client.request({ ':path': `${u.pathname}?dns=${buildQuery(host).toString('base64url')}`, accept: 'application/dns-message' });
      const chunks = [];
      let status = 0;
      req.on('response', (h) => { status = h[':status']; });
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => finish(status === 200 ? parseResponse(Buffer.concat(chunks)) : null));
      req.on('error', () => finish(null));
      req.end();
    } catch {
      finish(null);
    }
  });
}

// -> { "<resolver name>": true | false | null }   (null = could not tell)
async function dnsBlocks(host) {
  const open = await dohQuery(OPEN_DOH, host);
  const out = {};
  if (!open || open.rcode !== 0 || open.addrs.length === 0) {
    for (const f of FILTERED) out[f.name] = null; // the host does not resolve normally: nothing to compare against
    return out;
  }
  for (const f of FILTERED) {
    const r = await dohQuery(f.url, host);
    out[f.name] = !r ? null : r.rcode === 3 || r.addrs.includes('0.0.0.0');
  }
  return out;
}

// ---- Google Safe Browsing v4 (Lookup API) ----
function sbBody(hosts) {
  return {
    client: { clientId: 'omnexlab-registry', clientVersion: '1.0' },
    threatInfo: {
      threatTypes: ALL_SB,
      platformTypes: ['ANY_PLATFORM'],
      threatEntryTypes: ['URL'],
      threatEntries: hosts.map((h) => ({ url: `https://${h}/` })),
    },
  };
}

function sbParse(json) {
  const byHost = {};
  for (const m of (json && json.matches) || []) {
    try {
      const h = new URL(m.threat.url).hostname;
      (byHost[h] = byHost[h] || new Set()).add(m.threatType);
    } catch { /* ignore malformed entries */ }
  }
  return Object.fromEntries(Object.entries(byHost).map(([h, s]) => [h, [...s]]));
}

async function safeBrowsing(hosts, key) {
  if (!key || hosts.length === 0) return null; // not configured
  try {
    const res = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(sbBody(hosts)),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return undefined; // configured but the call failed: treated as "no information"
    return sbParse(await res.json());
  } catch {
    return undefined;
  }
}

// ---- decision ----
// severe: Safe Browsing says malware or phishing/social engineering, OR two independent DNS filters block it.
// mild:   Safe Browsing says unwanted/harmful software, OR exactly one DNS filter blocks it.
function verdictOf({ sb = null, dns = {} } = {}) {
  const types = Array.isArray(sb) ? sb : [];
  const severeSb = types.filter((t) => SEVERE_SB.includes(t));
  const mildSb = types.filter((t) => !SEVERE_SB.includes(t));
  const hits = Object.entries(dns).filter(([, v]) => v === true).map(([k]) => k);

  const severe = [];
  if (severeSb.length) severe.push(`Google Safe Browsing reports: ${severeSb.join(', ')}`);
  if (hits.length >= 2) severe.push(`${hits.length} independent security DNS filters block it (${hits.join(', ')})`);
  if (severe.length) return { level: 'severe', reasons: severe };

  const mild = [];
  if (mildSb.length) mild.push(`Google Safe Browsing reports: ${mildSb.join(', ')}`);
  if (hits.length === 1) mild.push(`one security DNS filter blocks it (${hits[0]})`);
  return { level: mild.length ? 'mild' : 'clean', reasons: mild };
}

// hosts: ["name.omnexlab.site", ...] -> { host: { level, reasons, signals } }
async function checkAll(hosts, { key } = {}) {
  const sbAll = await safeBrowsing(hosts, key);
  const out = {};
  for (const h of hosts) {
    const dns = await dnsBlocks(h);
    const sb = sbAll && typeof sbAll === 'object' ? sbAll[h] || [] : null;
    out[h] = { ...verdictOf({ sb, dns }), signals: { safeBrowsing: sbAll === null ? 'not configured' : sbAll === undefined ? 'error' : sb, dns } };
  }
  return out;
}

module.exports = { buildQuery, parseResponse, sbBody, sbParse, verdictOf, dnsBlocks, safeBrowsing, checkAll };
