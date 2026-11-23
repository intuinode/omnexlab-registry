'use strict';
// Maintainer shortcut: node scripts/add.js <name> <target-host> [github-username]
// Example:         node scripts/add.js myapp myapp.vercel.app intuinode
// Creates domains/<name>.json after checking it against the same rules the pull-request check uses.
const fs = require('node:fs');
const path = require('node:path');
const { config, checkEntry, DOMAINS_DIR } = require('./lib');

const [name, target, owner = config.maintainers[0]] = process.argv.slice(2);
if (!name || !target) {
  console.log('Usage: node scripts/add.js <name> <target-host> [github-username]');
  process.exit(1);
}
const entry = { owner: { github: owner }, record: { CNAME: target.toLowerCase().replace(/\.$/, '') } };
const errors = checkEntry(name, entry);
if (errors.length) {
  errors.forEach((e) => console.error('x ' + e));
  process.exit(1);
}
fs.mkdirSync(DOMAINS_DIR, { recursive: true });
const file = path.join(DOMAINS_DIR, `${name}.json`);
if (fs.existsSync(file)) {
  console.error(`x ${name}.json already exists`);
  process.exit(1);
}
fs.writeFileSync(file, JSON.stringify(entry, null, 2) + '\n');
console.log(`Created domains/${name}.json  ->  ${name}.${config.rootDomain}  ->  ${entry.record.CNAME}`);
console.log('\nNext:');
console.log(`  1. In your host, add the custom domain ${name}.${config.rootDomain} (Vercel: Project > Settings > Domains).`);
console.log('  2. git add domains && git commit -m "Add ' + name + '" && git push   (DNS goes live in about a minute)');
