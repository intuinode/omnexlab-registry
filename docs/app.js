/* omnexlab.site - client-side helpers. These checks only save a round trip; the bot is the real gate. */
(function () {
  var REPO = 'https://github.com/intuinode/omnexlab-registry/issues/new';
  var ALLOWED = ['github.io','gitlab.io','netlify.app','vercel.app','vercel-dns.com','pages.dev','workers.dev','onrender.com','fly.dev','surge.sh','web.app','firebaseapp.com','codeberg.page','readthedocs.io'];
  var RESERVED = ['www','mail','email','smtp','imap','pop','pop3','ftp','ns','ns1','ns2','dns','admin','administrator','root','api','app','status','support','help','abuse','security','postmaster','webmaster','hostmaster','noreply','login','signin','signup','register','account','accounts','billing','pay','payment','payments','docs','blog','cdn','static','assets','git','github','autodiscover','autoconfig','registry','omnexlab','lab','labs'];
  var SENSITIVE = ['paypal','google','apple','icloud','microsoft','outlook','amazon','facebook','instagram','whatsapp','netflix','binance','coinbase','metamask','wellsfargo','bankofamerica','login','signin','secure','verify','official'];
  var $ = function (id) { return document.getElementById(id); };

  function cleanName(v) { return String(v || '').trim().toLowerCase(); }
  function cleanTarget(v) { return String(v || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '').replace(/\.$/, ''); }

  function nameProblem(n) {
    if (!n) return '';
    if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(n) || n.indexOf('--') > -1) return 'Name: 3-32 letters, digits or hyphens, not starting or ending with a hyphen.';
    if (RESERVED.indexOf(n) > -1) return 'That name is reserved.';
    for (var i = 0; i < SENSITIVE.length; i++) if (n.indexOf(SENSITIVE[i]) > -1) return 'Names containing "' + SENSITIVE[i] + '" are blocked to prevent impersonation.';
    return '';
  }
  function targetProblem(t) {
    if (!t) return '';
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(t)) return 'Enter just the address of your site, like myproject.vercel.app.';
    var ok = ALLOWED.some(function (s) { return t === s || t.slice(-(s.length + 1)) === '.' + s; }) || /^[a-z0-9]+\.vercel-dns-[0-9]{3}\.com$/.test(t);
    return ok ? '' : 'Supported hosts: ' + ALLOWED.join(', ') + '.';
  }
  function setBtn(btn, href) {
    if (!btn) return;
    if (href) { btn.href = href; btn.setAttribute('aria-disabled', 'false'); }
    else { btn.href = '#'; btn.setAttribute('aria-disabled', 'true'); }
  }
  function build(template, title, params) {
    var q = 'template=' + template + '&title=' + encodeURIComponent(title);
    Object.keys(params).forEach(function (k) { q += '&' + k + '=' + encodeURIComponent(params[k]); });
    return REPO + '?' + q;
  }

  // Create form (home page)
  if ($('name') && $('target') && $('go')) {
    var run = function () {
      var n = cleanName($('name').value), t = cleanTarget($('target').value);
      var p = nameProblem(n) || targetProblem(t);
      $('err').textContent = p;
      if ($('preview')) $('preview').textContent = n && !/[^a-z0-9-]/.test(n) ? n : 'yourname';
      setBtn($('go'), !p && n && t ? build('subdomain.yml', 'Subdomain request: ' + n, { name: n, target: t }) : '');
    };
    $('name').addEventListener('input', run); $('target').addEventListener('input', run); run();
  }

  // Cancel form (manage page)
  if ($('cname') && $('cancel-btn')) {
    var runC = function () {
      var n = cleanName($('cname').value), p = nameProblem(n);
      $('cerr').textContent = p;
      setBtn($('cancel-btn'), !p && n ? build('cancel.yml', 'Cancel subdomain: ' + n, { name: n }) : '');
    };
    $('cname').addEventListener('input', runC); runC();
  }

  // Change form (manage page)
  if ($('hname') && $('htarget') && $('change-btn')) {
    var runH = function () {
      var n = cleanName($('hname').value), t = cleanTarget($('htarget').value);
      var p = nameProblem(n) || targetProblem(t);
      $('herr').textContent = p;
      setBtn($('change-btn'),!p && n && t ? build('change.yml', 'Change subdomain: ' + n, { name: n, target: t }) : '');
    };
    $('hname').addEventListener('input', runH); $('htarget').addEventListener('input', runH); runH();
  }

  // Every link that leaves the site opens in a new tab.
  var links = document.querySelectorAll('a[href]');
  for (var i = 0; i < links.length; i++) {
    var a = links[i], h = a.getAttribute('href');
    if (/^https?:\/\//.test(h) && h.indexOf('https://omnexlab.site') !== 0) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  }
})();
