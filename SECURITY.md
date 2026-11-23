# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Report it privately through GitHub: **[Report a vulnerability](https://github.com/intuinode/omnexlab-registry/security/advisories/new)**.
You can also email **abuse@omnexlab.site** with "Security" in the subject.

Helpful details: what you found, how to reproduce it, and what it could affect. We will acknowledge your report, look into it, and tell you what we decide.

## What is in scope

- The bot and scripts in this repository (request handling, validation, DNS sync, takeover protection).
- The website at https://omnexlab.site.
- Ways to take over, hijack or impersonate a subdomain you do not own, or to bypass the rules (name checks, ownership checks, the attach-before-create check).

## Not in scope

- Content on user sites. Those are run by their owners and hosts; report abuse at <https://omnexlab.site/dmca.html>.
- Reports that only say a free shared subdomain should not be used for sensitive data. That is documented behaviour.
