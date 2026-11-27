'use strict';
// Usage:
//   node scripts/validate.js --all   validate every file in domains/
//   node scripts/validate.js --pr    validate a pull request (needs BASE_SHA, PR_AUTHOR)
const { execFileSync } = require('node:child_process');
const { config, checkEntry, checkUniqueness, loadDomains, ROOT } = require('./lib');
const { check, hostKind, howToAttach } = require('./probe');

const errors = [];
const fail = (msg) => errors.push(msg);
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const isMaintainer = (u) => config.maintainers.map((m) => m.toLowerCase()).includes(String(u).toLowerCase());

function validateAll() {
  const list = loadDomains();
  for (const d of list) {
    if (d.parseError) fail(`${d.file}: invalid JSON (${d.parseError})`);
    else for (const e of checkEntry(d.name, d.entry)) fail(`${d.file}: ${e}`);
  }
  for (const e of checkUniqueness(list.filter((d) => d.entry))) fail(e);
  return list.length;
}

async function accountAgeDays(user) {
  const headers = { 'User-Agent': 'omnexlab-registry', Accept: 'application/vnd.github+json' };
  if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(user)}`, { headers });
  if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
  const { created_at } = await res.json();
  return (Date.now() - new Date(created_at).getTime()) / 86400000;
}

async function validatePr() {
  const base = process.env.BASE_SHA;
  const author = process.env.PR_AUTHOR;
  if (!base || !author) throw new Error('BASE_SHA and PR_AUTHOR are required in --pr mode');
  const maintainer = isMaintainer(author);

  const changes = git('diff', '--no-renames', '--name-status', base, 'HEAD')
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split('\t'));

  if (config.blockedUsers.map((u) => u.toLowerCase()).includes(author.toLowerCase())) {
    fail(`user "${author}" is blocked`);
  }

  if (!maintainer && changes.length && changes.some(([, f]) => !/^domains\/[a-z0-9-]+\.json$/.test(f))) {
    fail('pull requests may only add, change or delete files directly inside domains/');
  }
  if (!maintainer && changes.length > 1) fail('please change only one subdomain per pull request');

  for (const [status, file] of changes) {
    if (!/^domains\/[^/]+\.json$/.test(file)) continue;
    if (status !== 'A') {
      let before;
      try { before = JSON.parse(git('show', `${base}:${file}`)); } catch { before = null; }
      const prev = before && before.owner && before.owner.github;
      if (!maintainer && String(prev).toLowerCase() !== author.toLowerCase()) {
        fail(`${file}: you can only change or delete subdomains you own`);
      }
    }
    if (status !== 'D' && !maintainer) {
      const d = loadDomains().find((x) => `domains/${x.file}` === file);
      const owner = d && d.entry && d.entry.owner && d.entry.owner.github;
      if (String(owner).toLowerCase() !== author.toLowerCase()) {
        fail(`${file}: owner.github must be your own GitHub username ("${author}")`);
      }
    }
  }

  // The host must already have the domain attached, otherwise someone else could claim it.
  for (const [status, file] of changes) {
    if (status === 'D' || !/^domains\/[a-z0-9-]+\.json$/.test(file)) continue;
    const d = loadDomains().find((x) => `domains/${x.file}` === file);
    const target = d && d.entry && d.entry.record && d.entry.record.CNAME;
    if (!target || checkEntry(d.name, d.entry).length) continue;
    const host = `${d.name}.${config.rootDomain}`;
    const state = await check(target, host);
    if (state === 'unattached') {
      fail(`${file}: your host does not have ${host} attached yet. ${howToAttach(hostKind(target), host).replace(/[*`]/g, '')} Then re-run this check.`);
    }
  }

  // Email records need a maintainer review, so a pull request may not add or change them.
  for (const [status, file] of changes) {
    if (maintainer || status === 'D' || !/^domains\/[a-z0-9-]+\.json$/.test(file)) continue;
    const d = loadDomains().find((x) => `domains/${x.file}` === file);
    let before = null;
    if (status !== 'A') { try { before = JSON.parse(git('show', `${base}:${file}`)); } catch { before = null; } }
    const was = JSON.stringify((before && before.email) || null);
    const now = JSON.stringify((d && d.entry && d.entry.email) || null);
    if (was !== now) fail(`${file}: email records need approval. Use the email form instead of a pull request.`);
  }

  if (!maintainer && changes.some(([s]) => s !== 'D')) {
    try {
      const days = await accountAgeDays(author);
      if (days < config.minAccountAgeDays) {
        fail(`GitHub accounts must be at least ${config.minAccountAgeDays} days old (yours is ${Math.floor(days)} days)`);
      }
    } catch (e) {
      fail(`could not check your GitHub account age (${e.message}); re-run the check`);
    }
  }
}

(async () => {
  const pr = process.argv.includes('--pr');
  const n = validateAll();
  if (pr) await validatePr();
  if (errors.length) {
    for (const e of errors) console.log(`::error::${e}`);
    console.log(`\n${errors.length} problem(s) found.`);
    process.exitCode = 1; // let Node close open connections itself (process.exit can crash on Windows)
    return;
  }
  console.log(`OK: ${n} subdomain file(s) valid.`);
})().catch((e) => { console.log(`::error::${e.message}`); process.exitCode = 1; });
