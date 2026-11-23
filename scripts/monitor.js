'use strict';
// Daily check for dangling subdomains. If a host says it no longer has our domain attached, the
// name is already broken for visitors AND open to takeover, so the DNS entry is removed at once and
// the owner is told how to restore it.
//   node scripts/monitor.js            remove dangling entries (writes GITHUB_OUTPUT removed=N)
//   node scripts/monitor.js --dry-run  only report
const fs = require('node:fs');
const path = require('node:path');
const { config, loadDomains, DOMAINS_DIR, GH_USER_RE } = require('./lib');
const { check, hostKind, howToAttach } = require('./probe');

const DRY = process.argv.includes('--dry-run');
const MAX_REMOVALS = 3; // safety brake: many at once usually means an outage, not real abandonment

async function openIssue(d) {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN;
  if (!repo || !token) return;
  const host = `${d.name}.${config.rootDomain}`;
  const owner = d.entry.owner && d.entry.owner.github;
  const mention = typeof owner === 'string' && GH_USER_RE.test(owner) ? `@${owner} ` : '';
  const body =
    `${mention}\`${host}\` was removed because your host no longer has this domain attached ` +
    `(\`${d.entry.record.CNAME}\` answered that it does not know \`${host}\`). ` +
    `An unattached name can be claimed by someone else, so we take it down to protect you.\n\n` +
    `**To restore it:** ${howToAttach(hostKind(d.entry.record.CNAME), host)} Then ` +
    `[submit the form again](https://github.com/${repo}/issues/new?template=subdomain.yml).`;
  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'omnexlab-registry' },
    body: JSON.stringify({ title: `${host} was removed (not attached to its host)`, body, labels: ['dangling'] }),
  });
  if (!res.ok) console.error(`could not open issue for ${host}: HTTP ${res.status}`);
}

(async () => {
  const dangling = [];
  for (const d of loadDomains()) {
    if (!d.entry || !d.entry.record) continue;
    const host = `${d.name}.${config.rootDomain}`;
    const state = await check(d.entry.record.CNAME, host);
    console.log(`${host.padEnd(36)} ${state}`);
    if (state === 'unattached') dangling.push(d);
  }

  if (dangling.length > MAX_REMOVALS && process.env.FORCE !== '1') {
    console.error(`${dangling.length} entries look dangling at once; refusing to act (possible host outage). Set FORCE=1 to override.`);
    process.exit(1);
  }
  if (!DRY) {
    for (const d of dangling) {
      fs.unlinkSync(path.join(DOMAINS_DIR, d.file));
      await openIssue(d);
    }
  }
  console.log(`${dangling.length} dangling${DRY ? ' (dry run)' : ' removed'}`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `removed=${DRY ? 0 : dangling.length}\n`);
})().catch((e) => { console.error(e); process.exit(1); });
