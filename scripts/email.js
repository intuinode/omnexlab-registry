'use strict';
// The Resend email add-on. A user may only publish the DNS records Resend asks for, and only under
// mail.<name>.<root>, so the website CNAME on <name> is never in the way and nothing free-form can
// be created. Pure functions: no network, no file access.
const crypto = require('node:crypto');

const REGIONS = '(us-east-1|eu-west-1|sa-east-1|ap-northeast-1)';
const SENDING_MX = new RegExp(`^feedback-smtp\\.${REGIONS}\\.amazonses\\.com$`);
const RECEIVING_MX = new RegExp(`^(receive(-[a-z0-9]+)?\\.forge\\.rmta\\.net|inbound-smtp\\.${REGIONS}\\.amazonaws\\.com)$`);
// Targets of the CNAME records newer Resend domains show. Only provider-owned domains.
const CNAME_SUFFIXES = ['rmta.net', 'resend-dns.com', 'resend.com', 'amazonses.com'];
const HOST_RE = /^(?=.{4,253}$)(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?\.)+[a-z]{2,63}$/;
const SPF = 'v=spf1 include:amazonses.com ~all';
const DMARC = 'v=DMARC1; p=quarantine; adkim=r; aspf=r';
const MAIL_LABEL = 'mail';

const cleanHost = (v) => String(v || '').trim().toLowerCase().replace(/\.$/, '');
const cleanDkim = (v) => String(v || '').replace(/["'\s`]/g, '');

function checkDkim(dkim) {
  if (typeof dkim !== 'string' || !/^p=[A-Za-z0-9+/]{100,800}={0,2}$/.test(dkim)) {
    return ['DKIM value must be the whole TXT value Resend shows for resend._domainkey, starting with p='];
  }
  try {
    const key = crypto.createPublicKey({ key: Buffer.from(dkim.slice(2), 'base64'), format: 'der', type: 'spki' });
    if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails.modulusLength < 1024) return ['DKIM key must be an RSA key of at least 1024 bits'];
  } catch {
    return ['DKIM value is not a readable public key. Copy it again from Resend without cutting anything off'];
  }
  return [];
}

function checkCnameTarget(label, t) {
  if (typeof t !== 'string' || !HOST_RE.test(t) || !CNAME_SUFFIXES.some((s) => t.endsWith('.' + s))) {
    return [`the "${label}" CNAME target must be the Resend host shown in your dashboard (ending in ${CNAME_SUFFIXES.join(', ')})`];
  }
  return [];
}

// Validates the "email" object stored in domains/<name>.json
function checkEmail(email) {
  if (!email || typeof email !== 'object' || Array.isArray(email)) return ['email must be an object'];
  const errors = [];
  const extra = Object.keys(email).filter((k) => !['provider', 'dkim', 'sendingMx', 'sendingCname', 'receivingMx'].includes(k));
  if (extra.length) errors.push(`unknown email field(s): ${extra.join(', ')}`);
  if (email.provider !== 'resend') errors.push('only the "resend" email provider is supported');
  errors.push(...checkDkim(email.dkim));

  const hasMx = email.sendingMx !== undefined;
  const hasCname = email.sendingCname !== undefined;
  if (hasMx === hasCname) errors.push('give exactly one kind of sending record: the MX value, or the CNAME target(s)');
  if (hasMx && !SENDING_MX.test(String(email.sendingMx))) errors.push('the sending MX value must look like feedback-smtp.us-east-1.amazonses.com (copy it from Resend)');
  if (hasCname) {
    const c = email.sendingCname;
    if (!c || typeof c !== 'object' || Object.keys(c).some((k) => !['send', 'rsend'].includes(k))) errors.push('sendingCname may only contain "send" and "rsend"');
    else {
      errors.push(...checkCnameTarget('send', c.send));
      if (c.rsend !== undefined) errors.push(...checkCnameTarget('rsend', c.rsend));
    }
  }
  if (email.receivingMx !== undefined && !RECEIVING_MX.test(String(email.receivingMx))) {
    errors.push('the receiving MX value must be the one Resend shows (receive*.forge.rmta.net or inbound-smtp.<region>.amazonaws.com)');
  }
  return errors;
}

// The exact DNS records for one subdomain's email setup. Mail records are never proxied.
function emailRecords(name, email, root) {
  const base = `${MAIL_LABEL}.${name}.${root}`;
  const out = [
    { type: 'TXT', name: `resend._domainkey.${base}`, content: email.dkim },
    { type: 'TXT', name: `_dmarc.${base}`, content: DMARC },
  ];
  if (email.sendingMx) {
    out.push({ type: 'MX', name: `send.${base}`, content: email.sendingMx, priority: 10 });
    out.push({ type: 'TXT', name: `send.${base}`, content: SPF });
  }
  if (email.sendingCname) {
    out.push({ type: 'CNAME', name: `send.${base}`, content: email.sendingCname.send, proxied: false });
    if (email.sendingCname.rsend) out.push({ type: 'CNAME', name: `rsend.${base}`, content: email.sendingCname.rsend, proxied: false });
  }
  if (email.receivingMx) out.push({ type: 'MX', name: base, content: email.receivingMx, priority: 10 });
  return out;
}

// Builds the stored object from raw form values.
function emailFromFields(f) {
  const email = { provider: 'resend', dkim: cleanDkim(f.dkim) };
  const mx = cleanHost(f.sendingMx);
  const send = cleanHost(f.send);
  const rsend = cleanHost(f.rsend);
  const rx = cleanHost(f.receivingMx);
  if (mx) email.sendingMx = mx;
  if (send || rsend) email.sendingCname = { send, ...(rsend ? { rsend } : {}) };
  if (rx) email.receivingMx = rx;
  return email;
}

const fingerprint = (name, email) => crypto.createHash('sha256').update(JSON.stringify([name, email])).digest('hex').slice(0, 20);

module.exports = { checkEmail, emailRecords, emailFromFields, fingerprint, cleanDkim, MAIL_LABEL, SPF, DMARC };
