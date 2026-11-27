'use strict';
// Handles the "email records" issue form in two stages.
//   --check  when the issue is opened or edited: validate and wait for a maintainer. Removal requests
//            from the owner are applied immediately (removing mail records is always safe).
//   --apply  when a maintainer adds the "email-approved" label: re-validate and write the records.
// The bot's review comment carries a fingerprint of what was reviewed, so an issue edited after the
// review cannot be approved by accident. Issue text is untrusted and only ever parsed as data.
const fs = require('node:fs');
const path = require('node:path');
const { config, checkEntry, loadDomains, DOMAINS_DIR } = require('./lib');
const { checkEmail, emailRecords, emailFromFields, fingerprint, MAIL_LABEL } = require('./email');

const FIELDS = {
  action: 'What do you want to do?',
  name: 'Email subdomain',
  dkim: 'DKIM value',
  sendingMx: 'Sending MX value',
  send: 'send CNAME target',
  rsend: 'rsend CNAME target',
  receivingMx: 'Receiving MX value',
  use: 'What will you send',
  agree: 'Email rules',
};
const safe = (s) => String(s).replace(/[@`<>]/g, '').slice(0, 300);
const isMaintainer = (u) => config.maintainers.map((m) => m.toLowerCase()).includes(String(u).toLowerCase());
const MARKER = (fp) => `<!-- email-review:${fp} -->`;

function parseEmailIssue(body) {
  const out = {};
  for (const part of String(body || '').replace(/\r\n/g, '\n').split(/^### /m).slice(1)) {
    const nl = part.indexOf('\n');
    const heading = (nl === -1 ? part : part.slice(0, nl)).trim();
    let value = (nl === -1 ? '' : part.slice(nl + 1)).trim();
    if (value === '_No response_') value = '';
    for (const [key, label] of Object.entries(FIELDS)) if (heading.startsWith(label)) out[key] = value;
  }
  return out;
}

const rejected = (...problems) => ({
  ok: false,
  message: `### ❌ We couldn't accept this email request\n\n${problems.map((p) => `- ${safe(p)}`).join('\n')}\n\nEdit the issue to fix it (it is checked again automatically). The [email guide](https://omnexlab.site/guides/resend-email.html) shows where each value comes from.`,
});

// Shared by both stages. -> { ok, op, name, entry?, fp, message }
function decideEmail({ fields, author, existing, ageDays, settings = config.email }) {
  if (!settings || !settings.enabled) return rejected('The email add-on is switched off at the moment.');
  const name = String(fields.name || '').trim().toLowerCase().replace(new RegExp(`\\.${config.rootDomain.replace('.', '\\.')}$`), '').replace(/^mail\./, '');
  if (!name) return rejected('Tell us which subdomain this is for.');
  const cur = existing.find((d) => d.name === name && d.entry);
  if (!cur) return rejected(`There is no subdomain called "${name}". Request the subdomain first.`);
  const owns = String(cur.entry.owner.github).toLowerCase() === String(author).toLowerCase();
  if (!owns) return rejected('Only the owner of the subdomain can change its email records.');
  const domain = `${MAIL_LABEL}.${name}.${config.rootDomain}`;

  if (/remove/i.test(fields.action || '')) {
    if (!cur.entry.email) return rejected(`${domain} has no email records to remove.`);
    const entry = { ...cur.entry };
    delete entry.email;
    return { ok: true, op: 'remove', name, entry, message: `### \u{1F44B} Email records removed\n\nThe mail records for \`${domain}\` are being deleted. Your website subdomain is unchanged. Also remove the domain in your Resend dashboard.` };
  }

  const problems = [];
  if (!/\[x\]/i.test(fields.agree || '')) problems.push('You need to tick the box agreeing to the email rules.');
  if (String(fields.use || '').trim().length < 20) problems.push('Describe what you will send and to whom (at least a sentence).');
  if (!isMaintainer(author) && ageDays < settings.minAccountAgeDays) problems.push(`The email add-on needs a GitHub account at least ${settings.minAccountAgeDays} days old (yours is ${Math.floor(ageDays)}).`);
  const email = emailFromFields(fields);
  problems.push(...checkEmail(email));
  const entry = { ...cur.entry, email };
  if (problems.length === 0) problems.push(...checkEntry(name, entry));
  if (problems.length) return rejected(...problems);

  const fp = fingerprint(name, email);
  const rows = emailRecords(name, email, config.rootDomain)
    .map((r) => `| ${r.type} | \`${r.name}\` | \`${r.content.length > 60 ? r.content.slice(0, 57) + '...' : r.content}\` |`)
    .join('\n');
  return { ok: true, op: 'set', name, entry, fp, domain, table: `| Type | Name | Value |\n|---|---|---|\n${rows}` };
}

const waitingMessage = (r) =>
  `### ⏳ Looks good, waiting for approval\n\nIn Resend, the domain must be **\`${r.domain}\`**. These records will be created:\n\n${r.table}\n\nA maintainer reviews every email request by hand. Editing this issue restarts the review.\n\n${MARKER(r.fp)}`;

async function gh(p) {
  const res = await fetch(`https://api.github.com${p}`, { headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'omnexlab-registry' } });
  if (!res.ok) throw new Error(`GitHub ${p}: HTTP ${res.status}`);
  return res.json();
}

function write(name, entry) {
  fs.writeFileSync(path.join(DOMAINS_DIR, `${name}.json`), JSON.stringify(entry, null, 2) + '\n');
}

async function main() {
  const stage = process.argv.includes('--apply') ? 'apply' : 'check';
  const emit = (k, v) => process.env.GITHUB_OUTPUT && fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`);
  let result = { message: 'Nothing to do for this request.', changed: false, close: false };
  try {
    const author = process.env.ISSUE_AUTHOR;
    const fields = parseEmailIssue(process.env.ISSUE_BODY);
    let ageDays = Infinity;
    if (!isMaintainer(author)) ageDays = (Date.now() - new Date((await gh(`/users/${encodeURIComponent(author)}`)).created_at).getTime()) / 86400000;
    const r = decideEmail({ fields, author, existing: loadDomains(), ageDays });

    if (stage === 'apply') {
      if (!isMaintainer(process.env.APPROVER)) throw new Error('only a maintainer can approve');
      if (!r.ok) result = { message: r.message, changed: false, close: false };
      else if (r.op === 'set') {
        const comments = await gh(`/repos/${process.env.GITHUB_REPOSITORY}/issues/${Number(process.env.ISSUE_NUMBER)}/comments?per_page=100`);
        const reviewed = comments.filter((c) => c.user.login === 'github-actions[bot]').map((c) => (c.body.match(/<!-- email-review:([0-9a-f]{20}) -->/) || [])[1]).filter(Boolean).pop();
        if (reviewed !== r.fp) {
          result = { message: `### ⚠️ Not applied\n\nThe request changed after it was reviewed (or was never reviewed). Edit the issue so it is checked again, then add the approval label again.`, changed: false, close: false };
        } else {
          write(r.name, r.entry);
          result = { message: `### ✅ Email records approved\n\nCreating the records for \`${r.domain}\` now. In a few minutes press **Verify DNS Records** in Resend. Verification can take longer.\n\nKeep your Resend API key secret and never put it in an issue. Misuse (spam or unsolicited mail) removes the subdomain.`, changed: true, close: true };
        }
      }
    } else if (r.ok && r.op === 'remove') {
      write(r.name, r.entry);
      result = { message: r.message, changed: true, close: true };
    } else {
      result = { message: r.ok ? waitingMessage(r) : r.message, changed: false, close: false };
    }
  } catch (e) {
    console.error(e);
    result = { message: '### ⚠️ Something went wrong\n\nNothing was changed. The maintainer can see the failed run.', changed: false, close: false };
  }
  fs.writeFileSync(process.env.RESULT_FILE || 'email-result.md', result.message + '\n');
  emit('changed', result.changed);
  emit('close', result.close);
  console.log(result.changed ? 'changed' : 'no change');
}

module.exports = { parseEmailIssue, decideEmail, waitingMessage };
if (require.main === module) main();
