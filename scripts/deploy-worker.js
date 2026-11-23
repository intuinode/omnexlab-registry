'use strict';
// Deploys worker/badge.mjs to Cloudflare and manages which hostnames it runs on.
// Nothing is injected anywhere until a route exists.
//   node scripts/deploy-worker.js deploy                     upload the script (no routes added)
//   node scripts/deploy-worker.js route "demo.omnexlab.site/*"   attach it to one pattern
//   node scripts/deploy-worker.js unroute "demo.omnexlab.site/*" detach one pattern
//   node scripts/deploy-worker.js status                     show the script and its routes
//   node scripts/deploy-worker.js off                        remove ALL routes (instant rollback)
// Needs CLOUDFLARE_API_TOKEN (Workers Scripts + Workers Routes edit), CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_ZONE_ID.
const fs = require('node:fs');
const path = require('node:path');

const NAME = 'omnexlab-badge';
const { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: ACCOUNT, CLOUDFLARE_ZONE_ID: ZONE } = process.env;
const API = 'https://api.cloudflare.com/client/v4';

async function cf(method, p, body, isForm) {
  const res = await fetch(API + p, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const j = await res.json();
  if (!j.success) throw new Error(`Cloudflare ${method} ${p}: ${JSON.stringify(j.errors)}`);
  return j.result;
}

async function listRoutes() {
  return (await cf('GET', `/zones/${ZONE}/workers/routes`)).filter((r) => r.script === NAME);
}

(async () => {
  if (!TOKEN || !ACCOUNT || !ZONE) throw new Error('CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_ZONE_ID are required');
  const [cmd, arg] = process.argv.slice(2);

  if (cmd === 'deploy') {
    const code = fs.readFileSync(path.join(__dirname, '..', 'worker', 'badge.mjs'), 'utf8');
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ main_module: 'badge.mjs', compatibility_date: '2026-11-01' })], { type: 'application/json' }));
    form.append('badge.mjs', new Blob([code], { type: 'application/javascript+module' }), 'badge.mjs');
    await cf('PUT', `/accounts/${ACCOUNT}/workers/scripts/${NAME}`, form, true);
    console.log(`deployed ${NAME} (no routes yet, so it changes nothing)`);
  } else if (cmd === 'route') {
    if (!arg) throw new Error('pattern required');
    if ((await listRoutes()).some((r) => r.pattern === arg)) return console.log('route already exists');
    await cf('POST', `/zones/${ZONE}/workers/routes`, { pattern: arg, script: NAME });
    console.log(`attached to ${arg}`);
  } else if (cmd === 'unroute') {
    const r = (await listRoutes()).find((x) => x.pattern === arg);
    if (!r) return console.log('no such route');
    await cf('DELETE', `/zones/${ZONE}/workers/routes/${r.id}`);
    console.log(`detached from ${arg}`);
  } else if (cmd === 'off') {
    for (const r of await listRoutes()) await cf('DELETE', `/zones/${ZONE}/workers/routes/${r.id}`);
    console.log('all routes removed: the badge is off everywhere');
  } else if (cmd === 'status') {
    const routes = await listRoutes();
    console.log(routes.length ? routes.map((r) => `route: ${r.pattern}`).join('\n') : 'no routes: the badge is off everywhere');
  } else {
    console.log('commands: deploy | route <pattern> | unroute <pattern> | status | off');
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
