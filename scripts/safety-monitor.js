'use strict';
// Daily safety check of every subdomain against public threat lists (see scripts/reputation.js).
//
//   severe -> the DNS entry is removed at once and the owner is told how to restore it.
//   mild   -> the owner gets a warning issue with a 7 day grace period; if the site is still flagged
//             after that, it is removed. If it becomes clean, the warning is closed.
//   clean / lookup failed -> nothing happens.
//
//   node scripts/safety-monitor.js --dry-run     print what it sees, change nothing
//   node scripts/safety-monitor.js               act (writes GITHUB_OUTPUT removed=N)
const fs = require('node:fs');
const path = require('node:path');
const { config, loadDomains, DOMAINS_DIR, GH_USER_RE } = require('./lib');
const { checkAll } = require('./reputation');

const DRY = process.argv.includes('--dry-run');
const GRACE_DAYS = Number(process.env.GRACE_DAYS ?? 7); // days a mild warning stays open before removal
const MAX_REMOVALS = 3; // safety brake: many at once usually means a feed problem, not many bad sites
const REPO = process.env.GITHUB_REPOSITORY;
const TOKEN = process.env.GH_TOKEN;

async function gh(method, p, body) {
  const res = await fetch(`https://api.github.com${p}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'omnexlab-registry' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`GitHub ${method} ${p}: HTTP ${res.status}`);
  return res.status === 204 ? null : res.json();
}

const mention = (d) => {
  const o = d.entry.owner && d.entry.owner.github;
  return typeof o === 'string' && GH_USER_RE.test(o) ? `@${o} ` : '';
};
const bullets = (v) => v.reasons.map((r) => `- ${r}`).join('\n');
const FORM = () => `https://github.com/${REPO}/issues/new?template=subdomain.yml`;

async function findWarning(host) {
  const q = encodeURIComponent(`repo:${REPO} is:issue is:open label:safety-warning in:title "${host}"`);
  const r = await gh('GET', `/search/issues?q=${q}`);
  return (r.items || []).find((i) => i.title.includes(host)) || null;
}

async function openIssue(title, body, label) {
  await gh('POST', `/repos/${REPO}/issues`, { title, body, labels: [label] });
}

(async () => {
  const domains = loadDomains().filter((d) => d.entry && d.entry.record);
  const hosts = domains.map((d) => `${d.name}.${config.rootDomain}`);
  const results = await checkAll(hosts, { key: process.env.SAFE_BROWSING_API_KEY });

  const severe = [], mild = [], clean = [];
  domains.forEach((d, i) => {
    const host = hosts[i], v = results[host];
    const sb = v.signals.safeBrowsing;
    console.log(`${host.padEnd(36)} ${v.level.padEnd(7)} safe-browsing: ${Array.isArray(sb) ? (sb.length ? sb.join(',') : 'ok') : sb} | dns: ${Object.entries(v.signals.dns).map(([k, x]) => `${k.split(' ')[0]}=${x === null ? '?' : x ? 'BLOCKED' : 'ok'}`).join(' ')}`);
    (v.level === 'severe' ? severe : v.level === 'mild' ? mild : clean).push({ d, host, v });
  });

  if (severe.length > MAX_REMOVALS && process.env.FORCE !== '1') {
    console.error(`${severe.length} sites look severe at once; refusing to act (possible feed problem). Set FORCE=1 to override.`);
    process.exit(1);
  }
  let removed = 0;
  if (!DRY) {
    const remove = async ({ d, host, v }, why) => {
      fs.unlinkSync(path.join(DOMAINS_DIR, d.file));
      removed++;
      await openIssue(
        `${host} was removed (flagged as harmful)`,
        `${mention(d)}\`${host}\` was removed because ${why}:\n\n${bullets(v)}\n\n` +
          `Visitors are protected first. **To restore it:** clean up the site, make sure it is no longer flagged ` +
          `(for Google, request a review in Search Console), then [submit the form again](${FORM()}). ` +
          `If you believe this is a mistake, email abuse@omnexlab.site with the name and we will look at it.`,
        'safety'
      );
    };

    for (const s of severe) await remove(s, 'it was flagged by threat-intelligence sources as dangerous to visitors');

    for (const m of mild) {
      const warn = await findWarning(m.host);
      if (!warn) {
        await openIssue(
          `Warning: ${m.host} was flagged by a safety check`,
          `${mention(m.d)}\`${m.host}\` was flagged by an automated safety check:\n\n${bullets(m.v)}\n\n` +
            `This is a **warning, not a removal**. Please check the site (a compromised page or a bad dependency is the usual cause) and fix it. ` +
            `If it is still flagged after **${GRACE_DAYS} days** the name will be removed to protect visitors. ` +
            `If this is a false alarm, email abuse@omnexlab.site and we will review it.`,
          'safety-warning'
        );
      } else if ((Date.now() - new Date(warn.created_at).getTime()) / 86400000 >= GRACE_DAYS) {
        await remove(m, `it was still flagged ${GRACE_DAYS} days after the warning`);
        await gh('PATCH', `/repos/${REPO}/issues/${warn.number}`, { state: 'closed', state_reason: 'completed' });
      }
    }

    for (const c of clean) {
      const warn = await findWarning(c.host);
      if (warn) {
        await gh('POST', `/repos/${REPO}/issues/${warn.number}/comments`, { body: 'The safety check no longer flags this site. Thank you, closing the warning.' });
        await gh('PATCH', `/repos/${REPO}/issues/${warn.number}`, { state: 'closed', state_reason: 'completed' });
      }
    }
  }

  console.log(`${severe.length} severe, ${mild.length} mild, ${clean.length} clean${DRY ? ' (dry run, nothing changed)' : `; ${removed} removed`}`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `removed=${removed}\n`);
})().catch((e) => { console.error(e); process.exit(1); });
