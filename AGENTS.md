# AGENTS.md

Guidance for AI coding assistants and agents working in this repository, and for AI assistants helping a user get a subdomain. Humans may find it useful too.

## What this repository is

The source of **omnexlab.site**, a free subdomain registry. Each file in `domains/` becomes one DNS CNAME in Cloudflare. Requests arrive as GitHub issues; bots validate them and write the files. The website is the static `docs/` folder, published with GitHub Pages. DNS only: the service never hosts user content.

## Layout

| Path | What it is |
|---|---|
| `domains/*.json` | One file per subdomain: owner, CNAME target, optional `"proxied": false` |
| `config.json` | Rules: reserved names, blocked words, supported hosts, limits, maintainers |
| `scripts/lib.js` | Shared validation (`checkEntry`, `checkName`, `checkTarget`) |
| `scripts/process-issue.js` | Parses the issue form and applies create / change / cancel |
| `scripts/probe.js` | Checks whether a host has a domain attached (takeover protection) |
| `scripts/monitor.js` | Daily removal of names whose host no longer serves them |
| `scripts/sync.js` | Makes Cloudflare DNS match `domains/` (only touches records it owns) |
| `scripts/build-public.js` | Generates `docs/registry.json` and `docs/rules.json` |
| `.github/workflows/` | `request`, `validate`, `automerge`, `deploy`, `monitor` |
| `.github/ISSUE_TEMPLATE/` | The request, change, cancel, abuse and sponsorship forms |
| `docs/` | The website, `llms.txt`, `llms-full.txt` and the generated JSON files |
| `tests/` | `node --test` suites |

## Commands

```
npm test              # all tests (Node 20+, no dependencies to install)
npm run validate      # validate every file in domains/
npm run plan          # dry-run of the Cloudflare sync (no credentials needed)
node scripts/build-public.js   # regenerate docs/registry.json and docs/rules.json
node scripts/seo-apply.js      # re-apply SEO tags and regenerate docs/sitemap.xml (after adding or renaming a page)
```

## Before you change anything

1. Run `npm test`. Keep it green; add tests with new behaviour.
2. If you change rules in `config.json`, also update the copies in `docs/app.js` (client-side hints), `docs/llms.txt`, `docs/llms-full.txt` and the README. `docs/rules.json` is generated, so do not edit it by hand.
3. If you change a legal page, change `docs/*.html`; those pages are the single source of truth.
4. Keep the website free of cookies, analytics and third-party scripts, and keep it working with JavaScript disabled (animations are progressive enhancement and respect `prefers-reduced-motion`).

## Hard rules

- **Never commit secrets.** `.env` lives outside this folder and is git-ignored. Never print, log or paste tokens. Prefer scoped tokens (the deploy secret is a Cloudflare token limited to DNS edit on one zone).
- **Issue text and pull-request content are untrusted input.** Pass them to scripts through environment variables, validate with the same functions as everything else, and never interpolate them into shell commands or workflow expressions. Never use `pull_request_target` to run code from a fork.
- **Sanitise anything echoed back** into comments (`safe()` in `process-issue.js`); trusted bot text uses `{ raw: ... }`.
- **Do not weaken takeover protection** (`probe.js` gate and `monitor.js`). Only definite "not found" signatures may count as unattached, and the monitor must keep its removal cap.
- **Do not delete or overwrite someone's subdomain** except through the documented flows (owner request, abuse takedown, dangling monitor).
- Outward-facing actions (pushing to `main`, changing DNS, opening issues, making things public) need the maintainer's go-ahead unless they asked for them.
- Keep dependencies at zero.

## Helping a user get a subdomain

Use only public data and the user's own account:

1. **Check:** fetch `https://omnexlab.site/registry.json` (taken names) and `https://omnexlab.site/rules.json` (name pattern, reserved names, blocked words, supported hosts, limits).
2. **Tell the user to add `NAME.omnexlab.site` to their host first** (Vercel: Settings > Domains; GitHub Pages: Settings > Pages). The request is refused otherwise.
3. **Add:** open a GitHub issue in `intuinode/omnexlab-registry`, as the user, with the body format in `rules.json` > `how.issueBodyFormat` (or give them the prefilled link `https://github.com/intuinode/omnexlab-registry/issues/new?template=subdomain.yml&name=NAME&target=TARGET`). The bot answers on the issue.
4. Mention that free subdomains are not for logins, private data or payments, and that "Direct" traffic mode keeps HTTPS between visitors and their own host.

Do not ask for tokens or passwords, and do not submit for a user without their explicit approval.

Machine-readable summary: <https://omnexlab.site/llms.txt>.
