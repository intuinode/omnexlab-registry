'use strict';
// Makes Cloudflare DNS match domains/*.json: one CNAME per subdomain, plus the mail records of any
// approved Resend email setup.
// Only touches records carrying the comment "omnexlab-registry" (and unlabelled CNAMEs sitting on a
// registry name). Records made by hand (website, your own mail) are left alone.
//   node scripts/sync.js --dry-run     show the plan (works without credentials)
//   node scripts/sync.js               apply it (needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID)
const { config, checkEntry, loadDomains } = require('./lib');
const { emailRecords } = require('./email');

const MARK = 'omnexlab-registry';
const API = 'https://api.cloudflare.com/client/v4';

function desiredRecords(list, cfg = config) {
  const blocked = cfg.blockedUsers.map((u) => u.toLowerCase());
  const out = [];
  for (const d of list) {
    if (!d.entry || checkEntry(d.name, d.entry, cfg).length) {
      console.log(`skip   ${d.name} (invalid)`);
      continue;
    }
    if (blocked.includes(d.entry.owner.github.toLowerCase())) continue;
    // proxied (default true): visitors get HTTPS instantly from Cloudflare's wildcard certificate
    out.push({ type: 'CNAME', name: `${d.name}.${cfg.rootDomain}`, content: d.entry.record.CNAME, proxied: d.entry.proxied !== false });
    if (d.entry.email && cfg.email && cfg.email.enabled) out.push(...emailRecords(d.name, d.entry.email, cfg.rootDomain));
  }
  return out;
}

// Cloudflare may return TXT content quoted and split into several strings
const normalize = (c) => String(c).replace(/^"([\s\S]*)"$/, '$1').replace(/"\s+"/g, '').replace(/\.$/, '');
// A CNAME is identified by its name alone; other types can have several values on one name
const keyOf = (r) => (r.type === 'CNAME' ? `CNAME ${r.name}` : `${r.type} ${r.name} ${normalize(r.content)}`);

function plan(desired, all) {
  const wanted = new Map(desired.map((r) => [keyOf(r), r]));
  const have = new Map();
  for (const r of all) {
    const k = keyOf(r);
    if (r.comment === MARK || (r.type === 'CNAME' && wanted.has(k))) have.set(k, r);
  }
  const creates = [];
  const updates = [];
  for (const [k, w] of wanted) {
    const r = have.get(k);
    if (!r) creates.push(w);
    else if (w.type === 'CNAME') {
      if (r.content !== w.content || r.proxied !== w.proxied || r.comment !== MARK) updates.push({ id: r.id, ...w });
    } else if (w.priority !== undefined && r.priority !== w.priority) updates.push({ id: r.id, ...w });
  }
  const managed = all.filter((r) => r.comment === MARK);
  const deletes = managed.filter((r) => !wanted.has(keyOf(r)));
  return { creates, updates, deletes, managed: managed.length };
}

async function main() {
  const DRY = process.argv.includes('--dry-run');
  const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
  const ZONE = process.env.CLOUDFLARE_ZONE_ID;

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

  const desired = desiredRecords(loadDomains());
  let all = [];
  if (TOKEN && ZONE) {
    for (let page = 1; ; page++) {
      const j = await cf('GET', `/zones/${ZONE}/dns_records?per_page=100&page=${page}`);
      all.push(...j.result);
      if (page >= (j.result_info.total_pages || 1)) break;
    }
  } else if (!DRY) throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID are required');

  const { creates, updates, deletes, managed } = plan(desired, all);
  const show = (r) => `${r.type.padEnd(5)} ${r.name} -> ${String(r.content).slice(0, 60)}${r.type === 'CNAME' ? ` (proxied=${r.proxied})` : ''}`;
  console.log(`plan: ${creates.length} create, ${updates.length} update, ${deletes.length} delete`);
  deletes.forEach((d) => console.log(`delete ${d.type.padEnd(5)} ${d.name}`));
  updates.forEach((u) => console.log(`update ${show(u)}`));
  creates.forEach((c) => console.log(`create ${show(c)}`));

  // Safety brake: never mass-delete because of a bug. (One email setup is up to six records.)
  if (deletes.length > Math.max(12, managed / 2) && process.env.FORCE !== '1') {
    throw new Error(`refusing to delete ${deletes.length} of ${managed} records; set FORCE=1 to override`);
  }
  if (DRY) return console.log('dry run: nothing changed');

  const body = (r) => ({
    type: r.type,
    name: r.name,
    content: r.content,
    ttl: 1,
    comment: MARK,
    ...(r.type === 'CNAME' ? { proxied: r.proxied } : {}),
    ...(r.priority !== undefined ? { priority: r.priority } : {}),
  });
  // Deletes first: Cloudflare refuses a CNAME on a name that still has other records.
  for (const d of deletes) await cf('DELETE', `/zones/${ZONE}/dns_records/${d.id}`);
  for (const u of updates) await cf('PATCH', `/zones/${ZONE}/dns_records/${u.id}`, body(u));
  for (const c of creates) await cf('POST', `/zones/${ZONE}/dns_records`, body(c));
  console.log('sync complete');
}

module.exports = { desiredRecords, plan, normalize, MARK };
if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
