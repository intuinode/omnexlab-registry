# domains/

One file per subdomain: `domains/<name>.json` becomes `<name>.omnexlab.site`.

```json
{
  "owner": { "github": "your-github-username" },
  "record": { "CNAME": "your-github-username.github.io" },
  "description": "Optional: what the site is (max 140 characters)"
}
```

Rules are in the [README](../README.md#rules). Only `.json` files here become DNS records.
