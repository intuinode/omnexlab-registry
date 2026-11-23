'use strict';
// Generates the machine-readable files that people, scripts and AI assistants can read:
//   docs/registry.json  which names are taken (to CHECK availability)
//   docs/rules.json     the exact rules and limits (to GET the rules)
// Output is deterministic (no timestamps) so a file only changes when the registry really changes.
const fs = require('node:fs');
const path = require('node:path');
const { config, loadDomains, ROOT } = require('./lib');

const SITE = `https://${config.rootDomain}`;
const REPO = 'https://github.com/intuinode/omnexlab-registry';

function build() {
  const subdomains = loadDomains()
    .filter((d) => d.entry && d.entry.record)
    .map((d) => ({
      name: d.name,
      host: `${d.name}.${config.rootDomain}`,
      target: d.entry.record.CNAME,
      trafficMode: d.entry.proxied === false ? 'direct' : 'cloudflare',
    }));

  const registry = {
    description: `Subdomains currently registered under ${config.rootDomain}. A name not listed here and not reserved (see rules.json) may be available.`,
    rootDomain: config.rootDomain,
    count: subdomains.length,
    subdomains,
  };

  const rules = {
    description: `Rules for requesting a free subdomain of ${config.rootDomain}. The server-side checks are the source of truth; these are published so tools can pre-check a request.`,
    rootDomain: config.rootDomain,
    record: { type: 'CNAME', note: 'Only a CNAME to a supported host is allowed.' },
    name: {
      minLength: 3,
      maxLength: 32,
      pattern: '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$',
      notes: ['lowercase letters, digits and hyphens', 'no two hyphens in a row', 'must not start or end with a hyphen'],
    },
    reservedNames: config.reserved,
    blockedWords: config.sensitiveWords,
    blockedWordsNote: 'Names containing any of these words are refused to prevent impersonation.',
    supportedHosts: {
      suffixes: config.allowedTargetSuffixes,
      patterns: config.allowedTargetPatterns || [],
      automaticallyVerified: ['github.io', 'vercel.app', 'vercel-dns.com', 'vercel-dns-NNN.com'],
      note: 'For verified hosts the name must already be attached to the project at the host before requesting; otherwise the request is refused. Other hosts are accepted but cannot be verified, so attach the name there immediately.',
    },
    limits: { subdomainsPerGitHubAccount: config.maxPerUser, minimumGitHubAccountAgeDays: config.minAccountAgeDays },
    trafficModes: [
      { id: 'cloudflare', default: true, description: 'Through Cloudflare: instant HTTPS. HTTPS is decrypted at Cloudflare before reaching your host.' },
      { id: 'direct', default: false, description: 'Direct to your host (DNS only): HTTPS terminates at your own host. Choose this for anything sensitive.' },
    ],
    notAllowed: ['phishing or scams', 'malware', 'impersonation', 'illegal or infringing content', 'email on subdomains'],
    notForSensitiveUse: 'Do not use free shared subdomains for logins, private data or payments.',
    how: {
      checkAvailability: `${SITE}/registry.json`,
      requestForm: `${REPO}/issues/new?template=subdomain.yml`,
      changeForm: `${REPO}/issues/new?template=change.yml`,
      cancelForm: `${REPO}/issues/new?template=cancel.yml`,
      issueBodyFormat: [
        '### What do you want to do?',
        '',
        'Create a new subdomain',
        '',
        '### Subdomain name',
        '',
        '<name>',
        '',
        '### Where your site lives (address only)',
        '',
        '<host address, e.g. myproject.vercel.app>',
        '',
        '### Traffic mode',
        '',
        'Through Cloudflare (instant HTTPS, recommended for public sites)',
      ].join('\n'),
      note: 'The requester is the GitHub account that opens the issue. Add the name to your host first.',
    },
    documentation: { llms: `${SITE}/llms.txt`, llmsFull: `${SITE}/llms-full.txt`, guides: `${SITE}/guides.html`, terms: `${SITE}/terms.html`, privacy: `${SITE}/privacy.html`, abuse: `${SITE}/dmca.html` },
    contact: 'abuse@omnexlab.site',
  };

  return { registry, rules };
}

function write(outDir = path.join(ROOT, 'docs')) {
  const { registry, rules } = build();
  fs.writeFileSync(path.join(outDir, 'registry.json'), JSON.stringify(registry, null, 2) + '\n');
  fs.writeFileSync(path.join(outDir, 'rules.json'), JSON.stringify(rules, null, 2) + '\n');
  return { registry, rules };
}

module.exports = { build, write };
if (require.main === module) {
  const { registry } = write();
  console.log(`wrote docs/registry.json (${registry.count} subdomains) and docs/rules.json`);
}
