'use strict';
// Makes Cloudflare DNS match domains/*.json.
// Only touches CNAME records carrying the comment "omnexlab-registry"; everything else is left alone.
//   node scripts/sync.js --dry-run     show the plan (works without credentials)
//   node scripts/sync.js               apply it (needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID)
const { config, checkEntry, loadDomains } = require('./lib');

const MARK = 'omnexlab-registry';
const DRY = process.argv.includes('--dry-run');
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ZONE = process.env.CLOUDFLARE_ZONE_ID;
const API = 'https://api.cloudflare.com/client/v4';

async function cf(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.success) throw new Error(`Cloudflare ${method} ${path}: ${JSON.stringify(json.errors)}`);
  return json;
}

async function existingRecords() {
  if (!TOKEN || !ZONE) {
    if (DRY) return [];
    throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID are required');
  }
  const out = [];
  for (let page = 1; ; page++) {
    const j = await cf('GET', `/zones/${ZONE}/dns_records?type=CNAME&per_page=100&page=${page}`);
    out.push(...j.result);
    if (page >= (j.result_info.total_pages || 1)) break;
  }
  return out;
}

(async () => {
  const blocked = config.blockedUsers.map((u) => u.toLowerCase());
  const desired = new Map();
  for (const d of loadDomains()) {
    if (!d.entry || checkEntry(d.name, d.entry).length) {
      console.log(`skip   ${d.name} (invalid)`);
      continue;
    }
    if (blocked.includes(d.entry.owner.github.toLowerCase())) continue;
    desired.set(`${d.name}.${config.rootDomain}`, {
      content: d.entry.record.CNAME,
      proxied: d.entry.proxied !== false, // default on: instant HTTPS from Cloudflare's certificate
    });
  }

  const all = await existingRecords();
  // Records we own (and may delete) carry our comment. An unlabelled CNAME that sits on a name
  // the registry wants (e.g. added by hand in the dashboard) is adopted and labelled, never deleted.
  const existing = all.filter((r) => r.comment === MARK);
  const have = new Map(all.filter((r) => r.comment === MARK || desired.has(r.name)).map((r) => [r.name, r]));
  const creates = [], updates = [], deletes = [];
  for (const [name, { content, proxied }] of desired) {
    const r = have.get(name);
    if (!r) creates.push({ name, content, proxied });
    else if (r.content !== content || r.proxied !== proxied || r.comment !== MARK) updates.push({ id: r.id, name, content, proxied });
  }
  for (const r of existing) if (!desired.has(r.name)) deletes.push(r);

  console.log(`plan: ${creates.length} create, ${updates.length} update, ${deletes.length} delete`);
  creates.forEach((c) => console.log(`create ${c.name} -> ${c.content} (proxied=${c.proxied})`));
  updates.forEach((u) => console.log(`update ${u.name} -> ${u.content} (proxied=${u.proxied})`));
  deletes.forEach((d) => console.log(`delete ${d.name}`));

  // Safety brake: never mass-delete because of a bug.
  if (deletes.length > Math.max(5, existing.length / 2) && process.env.FORCE !== '1') {
    throw new Error(`refusing to delete ${deletes.length} of ${existing.length} records; set FORCE=1 to override`);
  }
  if (DRY) return console.log('dry run: nothing changed');

  // proxied (default true): traffic goes through Cloudflare, so visitors get HTTPS instantly from
  // Cloudflare's wildcard certificate instead of waiting for each host to issue one.
  const base = { type: 'CNAME', ttl: 1, comment: MARK };
  for (const c of creates) await cf('POST', `/zones/${ZONE}/dns_records`, { ...base, name: c.name, content: c.content, proxied: c.proxied });
  for (const u of updates) await cf('PATCH', `/zones/${ZONE}/dns_records/${u.id}`, { content: u.content, proxied: u.proxied, comment: MARK });
  for (const d of deletes) await cf('DELETE', `/zones/${ZONE}/dns_records/${d.id}`);
  console.log('sync complete');
})().catch((e) => { console.error(e.message); process.exit(1); });
