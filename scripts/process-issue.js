'use strict';
// Turns a "subdomain request" issue form into a change in domains/.
// The issue body is untrusted text: it is only ever parsed as data and every value is validated
// with the same rules as pull requests before anything is written.
const fs = require('node:fs');
const path = require('node:path');
const { config, checkEntry, checkUniqueness, loadDomains, DOMAINS_DIR } = require('./lib');
const { check, hostKind, howToAttach } = require('./probe');

const FIELD_LABELS = {
  action: 'What do you want to do?',
  name: 'Subdomain name',
  target: 'Where your site lives',
  mode: 'Traffic mode',
};

const safe = (s) => String(s).replace(/[@`<>]/g, '').slice(0, 400);
const isMaintainer = (u) => config.maintainers.map((m) => m.toLowerCase()).includes(String(u).toLowerCase());
const formUrl = `https://github.com/intuinode/omnexlab-registry/issues/new?template=subdomain.yml`;

function parseIssue(body) {
  const fields = {};
  const parts = String(body || '').replace(/\r\n/g, '\n').split(/^### /m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf('\n');
    const heading = (nl === -1 ? part : part.slice(0, nl)).trim();
    let value = (nl === -1 ? '' : part.slice(nl + 1)).trim();
    if (value === '_No response_') value = '';
    for (const [key, label] of Object.entries(FIELD_LABELS)) {
      if (heading.startsWith(label)) fields[key] = value;
    }
  }
  return fields;
}

function normalizeTarget(t) {
  return String(t || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/?#].*$/, '').replace(/\.$/, '');
}

function actionOf(text) {
  const t = String(text || '').toLowerCase();
  if (t.includes('remove')) return 'remove';
  if (t.includes('change')) return 'update';
  return 'create';
}

// 'direct' = DNS only (HTTPS from the user's own host); 'proxy' = through Cloudflare; 'keep' = no change
function modeOf(text) {
  const t = String(text || '').toLowerCase();
  if (t.includes('direct')) return 'direct';
  if (t.includes('keep')) return 'keep';
  if (t.includes('cloudflare')) return 'proxy';
  return null;
}

const fail = (...problems) => ({
  ok: false,
  // Plain strings may echo user input, so they are sanitised. {raw} is text we composed ourselves.
  message:
    `### ❌ We couldn't apply your request\n\n` +
    `${problems.map((p) => `- ${p && p.raw ? p.raw : safe(p)}`).join('\n')}\n\n` +
    `**What now?** Fix the points above and [submit a new request](${formUrl}). ` +
    `Stuck? The [guides](https://omnexlab.site/guides.html) cover the common problems.`,
});

function decide({ fields, author, existing, ageDays }) {
  if (!fields || (!fields.name && !fields.action)) {
    return fail('This does not look like the request form. Please use the form link on https://omnexlab.site.');
  }
  const op = actionOf(fields.action);
  const name = String(fields.name || '').trim().toLowerCase();
  const target = normalizeTarget(fields.target);
  const maint = isMaintainer(author);
  if (!name) return fail('Please enter the subdomain name you want.');

  const cur = existing.find((d) => d.name === name && d.entry);
  const owns = cur && cur.entry.owner && String(cur.entry.owner.github).toLowerCase() === String(author).toLowerCase();

  if (op === 'remove') {
    if (!cur) return fail(`There is no subdomain called "${name}".`);
    if (!owns && !maint) return fail('Only the owner of a subdomain can remove it.');
    return {
      ok: true,
      op,
      name,
      message:
        `### \u{1F44B} Subdomain cancelled\n\n` +
        `\`${name}.${config.rootDomain}\` has been released. The DNS record disappears within a few minutes.\n\n` +
        `Your site itself is untouched, because we never hosted it. You can also remove the custom domain in your host.\n\n` +
        `Changed your mind? You can [request a subdomain](${formUrl}) again, but the name may be taken by then.`,
    };
  }

  if (!target) return fail('Please tell us where your site lives, for example myproject.vercel.app.');

  let entry;
  if (op === 'update') {
    if (!cur) return fail(`There is no subdomain called "${name}" to change.`);
    if (!owns && !maint) return fail('Only the owner of a subdomain can change it.');
    entry = { ...cur.entry, record: { CNAME: target } };
  } else {
    if (cur) return fail(`The name "${name}" is already taken. Please choose another.`);
    entry = { owner: { github: author }, record: { CNAME: target } };
  }
  const mode = modeOf(fields.mode);
  if (mode === 'direct') entry.proxied = false;
  else if (mode === 'proxy') delete entry.proxied;

  const errors = checkEntry(name, entry);
  if (op === 'create') {
    errors.push(...checkUniqueness([...existing.filter((d) => d.name !== name && d.entry), { name, entry }]));
    if (!maint && ageDays < config.minAccountAgeDays) {
      errors.push(`GitHub accounts must be at least ${config.minAccountAgeDays} days old (yours is ${Math.floor(ageDays)} days).`);
    }
  }
  if (errors.length) return fail(...errors);

  const host = `${name}.${config.rootDomain}`;
  return {
    ok: true,
    op,
    name,
    entry,
    message:
      `### ✅ ${op === 'update' ? 'Subdomain updated' : 'All set'}\n\n` +
      `| | |\n|---|---|\n` +
      `| **Address** | \`https://${host}\` |\n` +
      `| **Points to** | \`${target}\` |\n` +
      `| **Traffic** | ${entry.proxied === false ? 'Direct to your host (HTTPS from your host)' : 'Through Cloudflare (instant HTTPS)'} |\n` +
      `| **Status** | Going live now, usually within a minute |\n\n` +
      `**Next:** open your address in a minute. If it shows a certificate or 404 error, check the [guides](https://omnexlab.site/guides.html).` +
      `${entry.proxied === false ? ' With Direct mode your host issues the certificate, which can take a few minutes.' : ''}\n\n` +
      `> **Not for sensitive data.** Free shared subdomains are for portfolios, demos and side projects. Do not use them for logins, private data or payments. ` +
      `Through Cloudflare, HTTPS is decrypted at Cloudflare before it reaches your host; choose Direct mode or use your own domain for anything sensitive.\n\n` +
      `Need to change or cancel it later? Use the [manage page](https://omnexlab.site/manage.html).`,
  };
}

// Refuse to publish a name before the owner's host has it attached: until then anyone else could
// attach it to their own project and serve content on our domain (subdomain takeover).
async function attachGate(res) {
  const target = res.entry.record.CNAME;
  const host = `${res.name}.${config.rootDomain}`;
  const kind = hostKind(target);
  const state = await check(target, host);
  if (state === 'unattached') {
    return fail(
      { raw: `Your host does not have \`${host}\` attached yet, so we did not create it. ` +
        `Until it is attached, someone else could claim the name on that host. ${howToAttach(kind, host)}` },
      { raw: 'Then submit this form again.' }
    );
  }
  if (state === 'unverifiable') {
    res.message +=
      `\n\n> **Important:** we cannot automatically verify this type of host. Add \`${host}\` as a custom domain in your hosting dashboard **right now**. ` +
      `Until you do, someone else could claim the name there.`;
  }
  return res;
}

function apply(res) {
  const file = path.join(DOMAINS_DIR, `${res.name}.json`);
  if (res.op === 'remove') fs.unlinkSync(file);
  else {
    fs.mkdirSync(DOMAINS_DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(res.entry, null, 2) + '\n');
  }
}

async function accountAgeDays(user) {
  const headers = { 'User-Agent': 'omnexlab-registry', Accept: 'application/vnd.github+json' };
  if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(user)}`, { headers });
  if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
  const { created_at } = await res.json();
  return (Date.now() - new Date(created_at).getTime()) / 86400000;
}

async function main() {
  const emit = (k, v) => process.env.GITHUB_OUTPUT && fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`);
  let res;
  try {
    const author = process.env.ISSUE_AUTHOR;
    if (!author) throw new Error('ISSUE_AUTHOR missing');
    const fields = parseIssue(process.env.ISSUE_BODY);
    const ageDays = isMaintainer(author) ? Infinity : await accountAgeDays(author);
    res = decide({ fields, author, existing: loadDomains(), ageDays });
    if (res.ok && res.op !== 'remove') res = await attachGate(res);
    if (res.ok) apply(res);
  } catch (e) {
    console.error(e);
    res = { ok: false, message: `### ⚠️ Something went wrong\n\nWe hit an error while processing your request, so **nothing was changed**. The maintainer can see the failed run. Please try again later.` };
  }
  fs.writeFileSync(process.env.RESULT_FILE || 'result.md', res.message + '\n');
  emit('ok', res.ok);
  emit('done', 'true');
  console.log(res.ok ? `OK: ${res.op} ${res.name}` : 'Rejected');
}

module.exports = { parseIssue, decide, normalizeTarget, actionOf, modeOf };
if (require.main === module) main();
