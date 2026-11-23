// omnexlab.site attribution badge: a Cloudflare Worker that adds a small
// "Free subdomain by omnexlab.site" badge to HTML pages served through the Cloudflare proxy.
//
// It only runs on routes you attach it to (see scripts/deploy-worker.js), so it does nothing
// until enabled. It never touches non-HTML responses, iframes, scripts, downloads or errors,
// and it fails safe: any problem passes the original response through unchanged.

const SKIP_HOSTS = ['omnexlab.site', 'www.omnexlab.site'];

const BADGE =
  '<!-- Free subdomain by omnexlab.site -->' +
  '<a data-omnexlab-badge href="https://omnexlab.site/?ref=badge" target="_blank" rel="noopener" ' +
  'style="position:fixed;right:12px;bottom:12px;z-index:2147483647;display:inline-block;padding:6px 12px;' +
  'border-radius:999px;background:#121826;color:#e8ecf4;font:600 12px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;' +
  'text-decoration:none;border:1px solid rgba(255,255,255,.18);box-shadow:0 2px 10px rgba(0,0,0,.25)">' +
  'Free subdomain by omnexlab.site</a>';

// Should this response get the badge?
export function shouldInject(request, response) {
  const url = new URL(request.url);
  if (SKIP_HOSTS.includes(url.hostname)) return false; // never our own website
  if (request.method !== 'GET') return false;
  const dest = request.headers.get('sec-fetch-dest'); // iframes, images, scripts... are not "document"
  if (dest && dest !== 'document') return false;
  if (response.status !== 200) return false;
  if (!/text\/html/i.test(response.headers.get('content-type') || '')) return false;
  if (/attachment/i.test(response.headers.get('content-disposition') || '')) return false;
  return true;
}

export default {
  async fetch(request) {
    const upstream = await fetch(request);
    try {
      if (!shouldInject(request, upstream)) return upstream;
      let found = false; // the owner already links to omnexlab.site, so do not add a second one
      return new HTMLRewriter()
        .on('a[href*="omnexlab.site"]', { element() { found = true; } })
        .on('body', {
          element(el) {
            el.onEndTag((end) => { if (!found) end.before(BADGE, { html: true }); });
          },
        })
        .transform(upstream);
    } catch {
      return upstream;
    }
  },
};
