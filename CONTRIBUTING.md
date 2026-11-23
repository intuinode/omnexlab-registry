# Contributing

Thanks for helping. There are two kinds of contribution.

## Want a subdomain?

You don't need to contribute code. Use the request form at **https://omnexlab.site**; see the [guides](https://omnexlab.site/guides.html) first (add the name to your host before you request it).

## Improving the project

- **Ideas and bugs:** open an issue first for anything bigger than a small fix.
- **Pull requests:** run `npm test` (no dependencies to install). Keep it green and add tests for new behaviour.
- **Rules and wording:** the rules live in `config.json`; legal pages live in `docs/*.html`. See [AGENTS.md](AGENTS.md) for the conventions and the security rules (issue text is untrusted input).
- **Website:** it is the static `docs/` folder. Keep it free of cookies, trackers and third-party scripts. After adding or renaming a page, update `scripts/seo-apply.js` and run `node scripts/seo-apply.js`; `npm test` checks titles, descriptions, canonical URLs and the sitemap.

By contributing you agree that your contribution is released under the [MIT License](LICENSE).
