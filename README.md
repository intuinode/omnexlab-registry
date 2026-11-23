<div align="center">

<img src="docs/favicon.svg" width="72" height="72" alt="omnexlab logo">

# omnexlab.site

**Free subdomains for your projects.** Get `yourname.omnexlab.site` for your Vercel or GitHub Pages site, with HTTPS included.

[![Deploy DNS](https://github.com/intuinode/omnexlab-registry/actions/workflows/deploy.yml/badge.svg)](https://github.com/intuinode/omnexlab-registry/actions/workflows/deploy.yml)
[![Monitor](https://github.com/intuinode/omnexlab-registry/actions/workflows/monitor.yml/badge.svg)](https://github.com/intuinode/omnexlab-registry/actions/workflows/monitor.yml)

[**🌐 Get a subdomain**](https://omnexlab.site) &nbsp;·&nbsp; [📖 Guides](https://omnexlab.site/guides.html) &nbsp;·&nbsp; [🔁 Change or cancel](https://omnexlab.site/manage.html) &nbsp;·&nbsp; [🚩 Report abuse](https://omnexlab.site/dmca.html)

</div>

---

## ✨ Get yours in 3 steps

| | Step | |
|---|---|---|
| **1** | **Add the name to your host first.** In Vercel: *Project → Settings → Domains*. In GitHub Pages: *Settings → Pages → Custom domain*. A "DNS not configured" warning is fine. | 🛡️ prevents takeovers |
| **2** | **Request it** on **[omnexlab.site](https://omnexlab.site)**. Fill in two boxes and press the button, then **Submit new issue** on GitHub. | ~30 seconds |
| **3** | **It goes live.** A bot checks that your host has the name, creates the record and replies on your issue. | ~1 minute |

> 💡 Your GitHub username is picked up automatically from the issue. No forks, pull requests or JSON needed.

## 🧰 Supported hosts

| Host | Automatic check | Notes |
|---|:---:|---|
| **Vercel** | ✅ | `project.vercel.app` or Vercel's CNAME |
| **GitHub Pages** | ✅ | `username.github.io` |
| Netlify, Cloudflare Pages, GitLab Pages, Render, Fly.io, Firebase | ⚠️ | Accepted, but we can't verify them. **Attach the name in your host immediately.** |

## 🔁 Change or cancel

Use the [manage page](https://omnexlab.site/manage.html) to point the name somewhere else or release it. Only the owner can do this.

## 📏 Rules in brief

- One subdomain per GitHub account, and the account must be at least 30 days old.
- Names: 3-32 letters, digits or hyphens. Reserved names and look-alikes of big brands are blocked.
- Only `CNAME` records, only to the supported hosts above.
- **No** phishing, malware, impersonation, spam, illegal content, or email on subdomains.
- **We only provide DNS. We do not host or control your site and are not responsible for it.**
- We can remove any subdomain, or end the service, at any time and without notice.

📜 Full text: [Terms](https://omnexlab.site/terms.html) · [Privacy](https://omnexlab.site/privacy.html) · [DMCA & abuse](https://omnexlab.site/dmca.html) · [Plans & sponsors](https://omnexlab.site/plans.html)

## 🚩 Report abuse or copyright infringement

Use the [abuse and DMCA page](https://omnexlab.site/dmca.html) or email **abuse@omnexlab.site**. We review every report and aim to act within **48 hours**.

## 🛡️ How we prevent subdomain takeover

A name that points at a host which doesn't have it attached can be claimed by anyone on that host. So:

1. For Vercel and GitHub Pages the bot **checks the host before creating the record**, and refuses if the name isn't attached.
2. A **daily job** probes every name and removes those whose host stopped serving them, then opens an issue to tell the owner.

## 💚 Plans and sponsors

Free today. Paid options and sponsorship may come later; sponsorship never buys influence or special treatment. Details: [Plans & sponsors](https://omnexlab.site/plans.html).

---

<details>
<summary><strong>🔧 For the maintainer</strong></summary>

<br>

- **Flow:** the issue forms (`.github/ISSUE_TEMPLATE`) → `Subdomain request` workflow → `scripts/process-issue.js` (validates, probes the host, commits) → `Deploy DNS` → `scripts/sync.js` writes Cloudflare DNS.
- `scripts/validate.js` checks entries and pull requests; `Validate` runs on pull requests with no secrets, and `Automerge` merges valid single-file pull requests.
- `Monitor dangling subdomains` runs daily: it probes every target with the custom hostname and removes entries whose host reports the domain as unattached (two probes, definite signatures only, at most 3 removals per run). Signatures for GitHub Pages and Vercel live in `scripts/probe.js`.
- **Takedown:** delete the file in `domains/` (or add the user to `blockedUsers` in `config.json`) and push. DNS updates in minutes. In an emergency, delete the record in the Cloudflare dashboard.
- All records are created **proxied** (instant HTTPS from Cloudflare's certificate; SSL mode *Full*). A maintainer can set `"proxied": false` on an entry, for example for Vercel's own protection.
- Add your own name quickly: `node scripts/add.js myapp myapp.vercel.app`, then commit and push.
- Local checks: `npm test` and `npm run plan` (no dependencies to install).
- The website is the static `docs/` folder, published with GitHub Pages. The legal pages there are plain-language templates, not legal advice; have them reviewed before relying on them.

</details>
