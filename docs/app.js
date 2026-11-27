/* omnexlab.site - client-side helpers. These checks only save a round trip; the bot is the real gate.
   Everything here is progressive enhancement: the site works without JavaScript. */
(function () {
  var REPO = 'https://github.com/intuinode/omnexlab-registry/issues/new';
  var ALLOWED = ['github.io','gitlab.io','netlify.app','vercel.app','vercel-dns.com','pages.dev','workers.dev','onrender.com','fly.dev','surge.sh','web.app','firebaseapp.com','codeberg.page','readthedocs.io'];
  var RESERVED = ['www','mail','email','smtp','imap','pop','pop3','ftp','ns','ns1','ns2','dns','admin','administrator','root','api','app','status','support','help','abuse','security','postmaster','webmaster','hostmaster','noreply','login','signin','signup','register','account','accounts','billing','pay','payment','payments','docs','blog','cdn','static','assets','git','github','autodiscover','autoconfig','registry','omnexlab','lab','labs','test','send','rsend'];
  var SENSITIVE = ['paypal','google','apple','icloud','microsoft','outlook','amazon','facebook','instagram','whatsapp','netflix','binance','coinbase','metamask','wellsfargo','bankofamerica','login','signin','secure','verify','official'];
  var $ = function (id) { return document.getElementById(id); };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    if (href) { btn.href = href; btn.setAttribute('aria-disabled', 'false'); btn.classList.add('ready'); }
    else { btn.href = '#'; btn.setAttribute('aria-disabled', 'true'); btn.classList.remove('ready'); }
  }
  function build(template, title, params) {
    var q = 'template=' + template + '&title=' + encodeURIComponent(title);
    Object.keys(params).forEach(function (k) { if (params[k]) q += '&' + k + '=' + encodeURIComponent(params[k]); });
    return REPO + '?' + q;
  }

  /* ----- forms ----- */
  if ($('name') && $('target') && $('go')) {            // create (home)
    var lastShown = '';
    var run = function () {
      var n = cleanName($('name').value), t = cleanTarget($('target').value);
      var p = nameProblem(n) || targetProblem(t);
      $('err').textContent = p;
      if ($('preview')) {
        var shown = n && !/[^a-z0-9-]/.test(n) ? n : 'yourname';
        if (shown !== lastShown) { $('preview').textContent = shown; $('preview').classList.remove('flash'); void $('preview').offsetWidth; $('preview').classList.add('flash'); lastShown = shown; }
      }
      setBtn($('go'), !p && n && t ? build('subdomain.yml', 'Subdomain request: ' + n, { name: n, target: t, mode: $('mode') ? $('mode').value : '' }) : '');
    };
    ['name', 'target', 'mode'].forEach(function (id) { if ($(id)) $(id).addEventListener('input', run); });
    run();
  }
  if ($('cname') && $('cancel-btn')) {                  // cancel (manage)
    var runC = function () {
      var n = cleanName($('cname').value), p = nameProblem(n);
      $('cerr').textContent = p;
      setBtn($('cancel-btn'), !p && n ? build('cancel.yml', 'Cancel subdomain: ' + n, { name: n }) : '');
    };
    $('cname').addEventListener('input', runC); runC();
  }
  if ($('hname') && $('htarget') && $('change-btn')) {  // change (manage)
    var runH = function () {
      var n = cleanName($('hname').value), t = cleanTarget($('htarget').value);
      var p = nameProblem(n) || targetProblem(t);
      $('herr').textContent = p;
      setBtn($('change-btn'), !p && n && t ? build('change.yml', 'Change subdomain: ' + n, { name: n, target: t, mode: $('hmode') ? $('hmode').value : '' }) : '');
    };
    ['hname', 'htarget', 'hmode'].forEach(function (id) { if ($(id)) $(id).addEventListener('input', runH); });
    runH();
  }

  /* ----- links that leave the site open in a new tab ----- */
  var links = document.querySelectorAll('a[href]');
  for (var i = 0; i < links.length; i++) {
    var a = links[i], h = a.getAttribute('href');
    if (/^https?:\/\//.test(h) && h.indexOf('https://omnexlab.site') !== 0) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  }

  /* ----- theme toggle (remembers the choice; falls back silently if storage is blocked) ----- */
  var root = document.documentElement;
  function stored() { try { return localStorage.getItem('theme'); } catch (e) { return null; } }
  function store(v) { try { localStorage.setItem('theme', v); } catch (e) {} }
  function systemDark() { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; }
  function current() { return root.getAttribute('data-theme') || (systemDark() ? 'dark' : 'light'); }
  if (stored() === 'light' || stored() === 'dark') root.setAttribute('data-theme', stored());
  var nav = document.querySelector('header.top nav');
  if (nav) {
    var wrapR = document.createElement('div'); wrapR.className = 'top-right';
    nav.parentNode.insertBefore(wrapR, nav); wrapR.appendChild(nav);
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'theme-toggle';
    var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
    var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
    var paint = function () { var d = current() === 'dark'; btn.innerHTML = d ? SUN : MOON; btn.setAttribute('aria-label', d ? 'Switch to light theme' : 'Switch to dark theme'); btn.title = btn.getAttribute('aria-label'); };
    btn.addEventListener('click', function () { var next = current() === 'dark' ? 'light' : 'dark'; root.setAttribute('data-theme', next); store(next); paint(); });
    wrapR.appendChild(btn); paint();
  }

  /* ----- scroll progress bar + header shadow ----- */
  var bar = document.createElement('div'); bar.className = 'progress'; bar.setAttribute('aria-hidden', 'true'); document.body.appendChild(bar);
  var header = document.querySelector('header.top'), ticking = false;
  function onScroll() {
    var h = document.documentElement, max = h.scrollHeight - h.clientHeight;
    bar.style.width = (max > 0 ? Math.min(100, (h.scrollTop / max) * 100) : 0) + '%';
    if (header) header.classList.toggle('scrolled', h.scrollTop > 8);
    ticking = false;
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  /* ----- reveal on scroll ----- */
  var items = document.querySelectorAll('main .tile, main .box, main .card:not(.glow), main section > h2, main details, main .callout, main table, main .toc');
  if (reduce || !('IntersectionObserver' in window)) {
    for (var r = 0; r < items.length; r++) items[r].classList.add('in');
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    var counter = {};
    for (var k = 0; k < items.length; k++) {
      var el = items[k], par = el.parentNode;
      var idx = par.__ri = (par.__ri || 0) + 1;
      el.classList.add('reveal'); el.style.setProperty('--i', Math.min(idx - 1, 6));
      io.observe(el);
    }
  }

  /* ----- live count of subdomains (from registry.json) ----- */
  var stat = $('stat-count');
  if (stat && window.fetch) {
    fetch('/registry.json', { cache: 'no-cache' }).then(function (res) { return res.ok ? res.json() : null; }).then(function (j) {
      if (!j || typeof j.count !== 'number') return;
      var box = $('stat-live'); if (box) box.hidden = false;
      var to = j.count;
      if (reduce || to < 2) { stat.textContent = to; return; }
      var start = null;
      (function step(ts) { if (start === null) start = ts; var p = Math.min(1, (ts - start) / 900); stat.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) window.requestAnimationFrame(step); })(performance.now());
    }).catch(function () {});
  }
})();
