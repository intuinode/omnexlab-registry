# omnexlab.site: free subdomains

Get a free `yourname.omnexlab.site` for your project, portfolio or demo. It is a DNS-only registry: you keep hosting your site wherever you like (GitHub Pages, Netlify, Vercel, Cloudflare Pages and similar), and we point the name at it.

## Easiest way (about 2 minutes, no Git knowledge needed)

1. Go to **https://omnexlab.site**, fill in the three boxes and press the button.
2. On the GitHub page that opens, press **Propose new file**, then **Create pull request**.
3. A bot approves valid requests in about a minute.
4. Tell your host about the name. For **Vercel**: Project > Settings > Domains > add `yourname.omnexlab.site`. For Netlify: Domain management > Add a domain. For GitHub Pages: Settings > Pages > Custom domain.

HTTPS works immediately for visitors, because traffic goes through Cloudflare.

## The manual way

1. **Host your site** somewhere that supports custom domains (for example Vercel or GitHub Pages).
2. **Fork this repo** and add one file, `domains/yourname.json`:

   ```json
   {
     "owner": { "github": "your-github-username" },
     "record": { "CNAME": "your-github-username.github.io" },
     "description": "My portfolio"
   }
   ```

3. **Open a pull request.** Checks run automatically. If everything is valid it is merged by a bot and the record goes live within a few minutes.
4. **Tell your host about the name.** For GitHub Pages: repository Settings > Pages > Custom domain > `yourname.omnexlab.site`. HTTPS is provided by your host.

To change where it points, edit your file. To give the name up, delete your file. Both work through a pull request.

## Rules

- One subdomain per GitHub account.
- Your GitHub account must be at least 30 days old, and `owner.github` must be you.
- Names: 3-32 characters, lowercase letters, digits and hyphens. Reserved names and names containing big-brand or "login/secure/verify" words are blocked to stop impersonation.
- Only a `CNAME` record is supported, and only to these hosts: github.io, gitlab.io, netlify.app, vercel.app, vercel-dns.com, pages.dev, workers.dev, onrender.com, fly.dev, surge.sh, web.app, firebaseapp.com, codeberg.page, readthedocs.io.
- No email on subdomains.
- No phishing, malware, impersonation, spam, illegal content or anything else forbidden by the [Terms](TERMS.md). Names can be removed without notice.

## Policies

[Terms](TERMS.md) | [Privacy](PRIVACY.md) | [Abuse and takedowns](ABUSE.md)

## For the maintainer

- `scripts/validate.js` checks entries and pull requests; `scripts/sync.js` makes Cloudflare DNS match `domains/`.
- `Validate` runs on pull requests with no secrets. `Automerge` merges valid single-file pull requests. `Deploy DNS` runs on every merge to `main`, on demand, and daily.
- **Takedown:** delete the file in `domains/` (or add the user to `blockedUsers` in `config.json`) and merge. DNS updates in minutes. For an emergency, delete the record directly in the Cloudflare dashboard.
- Run `npm test` and `npm run plan` locally (no dependencies to install).
- Add your own subdomain quickly: `node scripts/add.js myapp myapp.vercel.app`, then commit and push.
- All records are created with the Cloudflare proxy on, and the zone's SSL mode is **Full**. The sync script also flips any record that drifted back to proxied.
- The legal pages are plain-language templates, not legal advice. Have them reviewed before relying on them.
