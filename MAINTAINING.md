# Maintaining omnexlab.site

Operational notes for the maintainer. Not linked from the public README on purpose.

## How a request flows

Issue form (`.github/ISSUE_TEMPLATE`) → `Subdomain request` workflow → `scripts/process-issue.js` (validates, probes the host, writes `domains/NAME.json`, commits) → `Deploy DNS` workflow → `scripts/sync.js` writes Cloudflare DNS, then `scripts/build-public.js` refreshes `docs/registry.json` and `docs/rules.json`.

Developers can also send a pull request that edits `domains/`; `Validate` checks it with no secrets, and `Automerge` merges valid single-file requests.

## Workflows

| Workflow | When | What |
|---|---|---|
| `Subdomain request` | an issue is opened | Handles create, change and cancel from the forms (also API-created issues with the form headings) |
| `Validate` | pull requests | Tests, rules, ownership, host-attached check; no secrets |
| `Automerge` | after `Validate` | Merges valid single-file requests; never runs PR code |
| `Deploy DNS` | push to `main`, manual, daily | Tests, validates, syncs Cloudflare, refreshes public JSON |
| `Monitor dangling subdomains` | daily, manual | Removes names whose host no longer has them attached (two probes, max 3 removals per run) |

## Common tasks

- **Take something down:** delete `domains/NAME.json` (or add the user to `blockedUsers` in `config.json`) and push. DNS updates within minutes. In an emergency, delete the record in the Cloudflare dashboard.
- **Add your own name:** `node scripts/add.js myapp myapp.vercel.app`, then commit and push.
- **Switch a record to Direct (DNS only):** set `"proxied": false` in its file, or use the change form.
- **Local checks:** `npm test`, `npm run plan` (no dependencies).

## DNS records you manage by hand (Cloudflare)

| Records | Purpose |
|---|---|
| `A`/`AAAA` for the apex (GitHub Pages IPs), `CNAME www` | The landing page (comment `landing-page`) |
| `MX`, SPF, DKIM, DMARC, `_autodiscover` SRV | Spacemail (comment `spacemail`) |
| `CNAME name` | Managed by the registry (comment `omnexlab-registry`); do not edit by hand |

`scripts/sync.js` only touches CNAMEs carrying its own comment (or unlabelled CNAMEs that sit on a registry-managed name), so the records above are safe.

## Secrets and tokens

- Repository secrets: `CLOUDFLARE_API_TOKEN` (limited to DNS edit on this one zone) and `CLOUDFLARE_ZONE_ID`.
- Personal tokens used during setup live only in the git-ignored `.env`. Revoke or rotate them when setup is finished.

## Things worth doing yourself

- Create the `abuse@omnexlab.site` mailbox or alias (the legal pages publish it).
- **Do NOT verify omnexlab.site in GitHub (Settings > Pages > Add a domain).** Verification restricts the domain and its immediate subdomains to Pages sites owned by *your* account, which would stop every user from attaching `name.omnexlab.site` to their own GitHub Pages repo. Takeover protection comes from the attach-before-create check and the daily monitor instead.
- Add a jurisdiction to the Terms, and consider registering a DMCA designated agent with the US Copyright Office.
- The legal pages are plain-language templates, not legal advice. Have them reviewed.

## Attribution badge Worker (optional, currently on the demo host only)

`worker/badge.mjs` is a Cloudflare Worker that adds a small "Free subdomain by omnexlab.site" badge to HTML pages served through the Cloudflare proxy. It does nothing unless a route is attached.

```
export CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_ZONE_ID=...
node scripts/deploy-worker.js status                       # which routes exist
node scripts/deploy-worker.js route "name.omnexlab.site/*"  # turn it on for one host
node scripts/deploy-worker.js route "*.omnexlab.site/*"     # turn it on for every subdomain
node scripts/deploy-worker.js off                           # remove all routes: instant rollback
```

Known limits: it only affects proxied ("Through Cloudflare") subdomains, never Direct ones. The Workers free plan allows 100,000 requests a day across all sites; past that visitors get Cloudflare error 1027, so enable it for everyone only on a paid plan or after confirming the route's failure mode. Strict Content-Security-Policy on a user's site can leave the badge unstyled. Before enabling it for users, the Terms, Privacy page and README must say that the service adds the badge.
