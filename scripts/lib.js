'use strict';
// Shared rules for the registry. Zero dependencies on purpose.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DOMAINS_DIR = path.join(ROOT, 'domains');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));

const NAME_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/; // 3-32 chars
const GH_USER_RE = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/i;
const HOST_RE = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function checkName(name, cfg = config) {
  const errors = [];
  if (!NAME_RE.test(name)) {
    errors.push(`name "${name}" must be 3-32 characters: lowercase letters, digits and hyphens, not starting or ending with a hyphen`);
  }
  if (name.includes('--')) errors.push(`name "${name}" must not contain two hyphens in a row`);
  if (cfg.reserved.includes(name)) errors.push(`name "${name}" is reserved`);
  const hit = cfg.sensitiveWords.find((w) => name.includes(w));
  if (hit) errors.push(`name "${name}" contains "${hit}", which is blocked to prevent impersonation`);
  return errors;
}

function checkTarget(target, cfg = config) {
  const errors = [];
  if (typeof target !== 'string' || target !== target.toLowerCase()) {
    return ['CNAME target must be a lowercase hostname'];
  }
  if (!HOST_RE.test(target)) return [`CNAME target "${target}" is not a valid hostname`];
  const root = cfg.rootDomain;
  if (target === root || target.endsWith('.' + root)) {
    errors.push('CNAME target must not point back to this domain');
  }
  const allowed = cfg.allowedTargetSuffixes.some((s) => target === s || target.endsWith('.' + s));
  if (!allowed) {
    errors.push(`CNAME target "${target}" is not on an allowed host (${cfg.allowedTargetSuffixes.join(', ')})`);
  }
  return errors;
}

function checkEntry(name, entry, cfg = config) {
  const errors = checkName(name, cfg);
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return [...errors, 'file must contain a JSON object'];
  }
  const extra = Object.keys(entry).filter((k) => !['owner', 'record', 'description'].includes(k));
  if (extra.length) errors.push(`unknown field(s): ${extra.join(', ')}`);

  const gh = entry.owner && entry.owner.github;
  if (typeof gh !== 'string' || !GH_USER_RE.test(gh)) {
    errors.push('owner.github must be a valid GitHub username');
  } else if (cfg.blockedUsers.map((u) => u.toLowerCase()).includes(gh.toLowerCase())) {
    errors.push(`owner "${gh}" is blocked`);
  }

  const rec = entry.record;
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) {
    errors.push('record must be an object like {"CNAME": "yourname.github.io"}');
  } else {
    const keys = Object.keys(rec);
    if (keys.length !== 1 || keys[0] !== 'CNAME') errors.push('record must contain exactly one CNAME entry');
    else errors.push(...checkTarget(rec.CNAME, cfg));
  }

  if (entry.description !== undefined && (typeof entry.description !== 'string' || entry.description.length > 140)) {
    errors.push('description must be text of at most 140 characters');
  }
  return errors;
}

function checkUniqueness(list, cfg = config) {
  const errors = [];
  const counts = new Map();
  for (const { name, entry } of list) {
    const gh = entry && entry.owner && typeof entry.owner.github === 'string' ? entry.owner.github.toLowerCase() : null;
    if (!gh || cfg.maintainers.map((m) => m.toLowerCase()).includes(gh)) continue;
    counts.set(gh, [...(counts.get(gh) || []), name]);
  }
  for (const [gh, names] of counts) {
    if (names.length > cfg.maxPerUser) {
      errors.push(`owner "${gh}" has ${names.length} subdomains (${names.join(', ')}); the limit is ${cfg.maxPerUser}`);
    }
  }
  return errors;
}

function loadDomains(dir = DOMAINS_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((file) => {
      const name = file.slice(0, -5);
      try {
        return { name, file, entry: JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) };
      } catch (e) {
        return { name, file, entry: null, parseError: e.message };
      }
    });
}

module.exports = { config, ROOT, DOMAINS_DIR, checkName, checkTarget, checkEntry, checkUniqueness, loadDomains, GH_USER_RE };
