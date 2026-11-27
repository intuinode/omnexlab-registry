<div align="center">

<img src="docs/favicon.svg" width="72" height="72" alt="omnexlab logo">

# omnexlab.site: Free Subdomains for Vercel & GitHub Pages

**A free subdomain registry.** Get `yourname.omnexlab.site` as the custom domain for a site you host on Vercel or GitHub Pages. HTTPS included, no cost, no card.

[![Deploy DNS](https://github.com/intuinode/omnexlab-registry/actions/workflows/deploy.yml/badge.svg)](https://github.com/intuinode/omnexlab-registry/actions/workflows/deploy.yml)
[![Monitor](https://github.com/intuinode/omnexlab-registry/actions/workflows/monitor.yml/badge.svg)](https://github.com/intuinode/omnexlab-registry/actions/workflows/monitor.yml)

[**🌐 Get a subdomain**](https://omnexlab.site) &nbsp;·&nbsp; [📖 Guides](https://omnexlab.site/guides.html) &nbsp;·&nbsp; [🔁 Change or cancel](https://omnexlab.site/manage.html) &nbsp;·&nbsp; [🚩 Report abuse](https://omnexlab.site/dmca.html)

</div>

---

## What is omnexlab.site?

omnexlab.site is a **free subdomain registry** (a free custom-domain service). You request a name such as `sara.omnexlab.site`, and a bot creates a DNS `CNAME` record that points it at the website you already host elsewhere, for example on Vercel, GitHub Pages or Netlify. It is **DNS only**: we don't host, store or control your site, we aren't a domain registrar, and we don't run mail servers (email is only possible through your own Resend account).

**Best for:** portfolios, side projects, demos and hackathons, docs and landing pages, and learning how custom domains and HTTPS work.

## How it works

| | Step | |
|---|---|---|
| **1** | **Add the name to your host first.** Vercel: *Project → Settings → Domains*. GitHub Pages: *Settings → Pages → Custom domain*. A "DNS not configured" warning is fine. | 🛡️ prevents takeovers |
| **2** | **Request it** at **[omnexlab.site](https://omnexlab.site)**: fill in two boxes, press the button, then **Submit new issue** on GitHub. | ~30 seconds |
| **3** | **It goes live.** The bot checks your host has the name, creates the record and replies on your issue. | ~1 minute |

> 💡 Your GitHub username is taken from the issue. No fork, pull request or JSON file is needed.

**Step-by-step guides:** [free subdomain for Vercel](https://omnexlab.site/guides/vercel-subdomain.html) · [free subdomain for GitHub Pages](https://omnexlab.site/guides/github-pages-subdomain.html)

## Rules

- One subdomain per GitHub account; the account must be at least 30 days old.
- Names are 3-32 characters: lowercase letters, digits and hyphens. Reserved names and look-alikes of big brands (e.g. containing `paypal`, `google`, `login`, `secure`) are blocked.
- Only `CNAME` records, only to supported hosts (below).
- **Not allowed:** phishing, scams or fake login pages; malware, botnets or attacks on other systems; impersonation; illegal goods or content and sexually explicit content; copyright, trademark or privacy infringement; harassment, doxxing or hate; spam, link farms, open redirects or proxies; email outside the approved Resend add-on; reselling or handing out your subdomain; bulk or multi-account requests. Full list in the [Terms](https://omnexlab.site/terms.html#use).
- **We only provide DNS. We are not responsible for user sites.** We can remove any subdomain, or end the service, at any time and without notice.

## Supported hosts

| Host | Checked automatically | Notes |
|---|:---:|---|
| **Vercel** | ✅ | `project.vercel.app` or Vercel's CNAME target |
| **GitHub Pages** | ✅ | `username.github.io` |
| Netlify, Cloudflare Pages, GitLab Pages, Render, Fly.io, Firebase | ⚠️ | Accepted, but we can't verify them. **Attach the name in your host immediately.** |

## 🔒 Security notice: traffic modes

> **Do not use a free shared subdomain for sensitive logins, private data or payments.** Use your own domain for those.

| Mode | HTTPS | What it means |
|---|---|---|
| **Through Cloudflare** *(default)* | Instant | Visitors connect to Cloudflare, which **decrypts HTTPS under our Cloudflare account** and re-encrypts it to your host. Cloudflare and the operator could technically observe that traffic. |
| **Direct to my host** | From your host (can take a few minutes) | DNS only. Visitors connect straight to your host, so HTTPS terminates at your own host. Choose this for anything more sensitive than a public site. |

You pick the mode on the request form, and can change it any time on the [manage page](https://omnexlab.site/manage.html).

## 🛡️ How subdomain takeover is prevented

A name that points at a host which doesn't have it attached can be claimed by anyone on that host. So:

1. For Vercel and GitHub Pages the bot **checks the host before creating the record** and refuses if the name isn't attached.
2. A **daily job** probes every name and removes those whose host stopped serving them, then opens an issue to tell the owner.

## 🧯 Automated safety checks

Every day each subdomain's hostname is looked up on public threat lists (Google Safe Browsing where configured, plus the malware and phishing filters of Cloudflare's and Quad9's public DNS). Only hostnames are sent, never content.

- **Severe** (phishing or malware reported by Google, or blocked by two independent filters): the record is removed at once and the owner is told on GitHub.
- **Mild** (unwanted software, or a single filter): the owner gets a warning and 7 days to fix it; if it is still flagged the name is removed, and if it is clean again the warning is closed.

If you think a flag is wrong, email abuse@omnexlab.site.

## 📧 Email with Resend (optional, reviewed by hand)

Own a subdomain? You can send (and optionally receive) email from `mail.yourname.omnexlab.site` with your own [Resend](https://resend.com) account:

1. Add `mail.yourname.omnexlab.site` as a domain in Resend.
2. Submit the [email records form](https://github.com/intuinode/omnexlab-registry/issues/new?template=email.yml) with the values Resend shows.
3. A maintainer approves it, then press **Verify DNS Records** in Resend.

Only mail people asked for. No spam or marketing blasts. Your API key stays with you. [Full guide](https://omnexlab.site/guides/resend-email.html) · [Email rules](https://omnexlab.site/terms.html#email)

## 🔁 Change or cancel

Use the [manage page](https://omnexlab.site/manage.html) to point the name somewhere else, switch traffic mode, or release it. Only the owner can do this. Cancelling removes the record within minutes; the name may later be taken by someone else.

## FAQ

**Is it free?** Yes, today. Paid options and sponsorship may come later; sponsorship never buys influence. See [Plans & sponsors](https://omnexlab.site/plans.html).

**Do you host my site?** No. Your site stays on your own host and you are responsible for it.

**Why add the name to my host first?** So nobody else can claim it. The bot only creates the record once your host has the name.

**How long does it take?** About a minute after you submit.

**Can I have more than one?** One per GitHub account for now.

**Can I use it for email?** Only through the [Resend email add-on](https://omnexlab.site/guides/resend-email.html), which a maintainer approves by hand. It is for mail people asked for, never bulk marketing.

**Why was my request rejected?** The bot replies on your issue with the reason: the host doesn't have the name yet, the name is taken or reserved, the host isn't supported, or the account is too new. The [guides](https://omnexlab.site/guides.html) cover each case.

**How do I report abuse?** Use the [abuse and DMCA page](https://omnexlab.site/dmca.html) or email **abuse@omnexlab.site**. We aim to review every report and act within 48 hours.

## 🤖 For AI assistants and automation

Everything an assistant needs to **check**, **get** and **add** is published as plain files:

| Need | Resource |
|---|---|
| Overview for LLMs | [`llms.txt`](https://omnexlab.site/llms.txt) and [`llms-full.txt`](https://omnexlab.site/llms-full.txt) |
| **Check** if a name is taken | [`registry.json`](https://omnexlab.site/registry.json) (regenerated on every change) |
| **Get** the exact rules | [`rules.json`](https://omnexlab.site/rules.json): name pattern, reserved names, blocked words, supported hosts, limits, request format |
| **Add** a subdomain | Open a GitHub issue, as the user, with the body format in `rules.json` → `how.issueBodyFormat`, or give them the [prefilled form link](https://github.com/intuinode/omnexlab-registry/issues/new?template=subdomain.yml) |
| Working on this repo | [`AGENTS.md`](AGENTS.md) |

Assistants should tell users to add the name to their host first, never ask for tokens or passwords, and never submit for a user without their approval.

## 📜 Policies

[Terms](https://omnexlab.site/terms.html) · [Privacy](https://omnexlab.site/privacy.html) · [DMCA & abuse](https://omnexlab.site/dmca.html) · [Plans & sponsors](https://omnexlab.site/plans.html)
