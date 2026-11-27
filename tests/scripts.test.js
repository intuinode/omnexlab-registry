'use strict';
// Guards the command-line scripts the workflows run: they must parse, and the pull-request validator
// must actually work end to end (it runs in a throwaway git repository).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');

test('every script parses', () => {
  for (const f of fs.readdirSync(path.join(ROOT, 'scripts')).filter((x) => x.endsWith('.js'))) {
    const r = spawnSync(process.execPath, ['--check', path.join(ROOT, 'scripts', f)], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${f}: ${r.stderr.split('\n').slice(0, 6).join('\n')}`);
  }
});

test('the registry in this repository validates', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'validate.js'), '--all'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('a pull request cannot add email records', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'registry-'));
  try {
    fs.cpSync(path.join(ROOT, 'scripts'), path.join(dir, 'scripts'), { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'config.json'), path.join(dir, 'config.json'));
    fs.mkdirSync(path.join(dir, 'domains'));
    const file = path.join(dir, 'domains', 'bobs-app.json');
    const entry = { owner: { github: 'bob' }, record: { CNAME: 'bob.netlify.app' } };
    const git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...a], { cwd: dir, encoding: 'utf8' });
    fs.writeFileSync(file, JSON.stringify(entry));
    git('init', '-q');
    git('add', '-A');
    git('commit', '-qm', 'base');
    const base = git('rev-parse', 'HEAD').trim();
    const key = crypto.generateKeyPairSync('rsa', { modulusLength: 1024, publicKeyEncoding: { type: 'spki', format: 'der' }, privateKeyEncoding: { type: 'pkcs8', format: 'der' } }).publicKey.toString('base64');
    fs.writeFileSync(file, JSON.stringify({ ...entry, email: { provider: 'resend', dkim: 'p=' + key, sendingMx: 'feedback-smtp.us-east-1.amazonses.com' } }));
    git('add', '-A');
    git('commit', '-qm', 'sneak in email');
    // an unreachable proxy-free API call may fail offline; only the email rule is asserted here
    const r = spawnSync(process.execPath, [path.join(dir, 'scripts', 'validate.js'), '--pr'], { encoding: 'utf8', env: { ...process.env, BASE_SHA: base, PR_AUTHOR: 'bob', GH_TOKEN: '' }, timeout: 60000 });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /email records need approval/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
