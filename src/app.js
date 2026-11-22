/* ============================================================
   MOHAMMADIA HISAB — glue for the two-login app.
   Bank login  → the Bank portal (copied from the shop app, unchanged)
   Shop login  → the shop Daily Hisab sheet only
   Uses its OWN Firebase project (config.js). No sales, stock or
   POS data exists here, so nothing reads the shop app's data.
   ============================================================ */
var CFG = window.HISAB_FIREBASE_CONFIG || {};
var ROLE_EMAILS = window.HISAB_ROLE_EMAILS || {};
var CONFIG_OK = !!CFG.apiKey && !/PASTE/.test(JSON.stringify(CFG));
// The shop app is served from this address. Device storage is shared per address,
// so this app must live on its own address to keep the two apps' data apart.
var SHOP_APP_HOSTS = ['muhammadiafinance-sudo.github.io'];
var SAME_ORIGIN_AS_SHOP = SHOP_APP_HOSTS.indexOf(location.hostname) >= 0;

var fsdb = null, fbAuth = null, CLOUD_DOC = null;
if (CONFIG_OK && !SAME_ORIGIN_AS_SHOP) {
  firebase.initializeApp(CFG);
  fsdb = firebase.firestore();
  try { fsdb.settings({ experimentalAutoDetectLongPolling: true }); } catch (e) {}
  try { fsdb.enablePersistence({ synchronizeTabs: true }).catch(function () {}); } catch (e) {}
  fbAuth = firebase.auth();
  // Same layout as the shop app, so the copied hisab code works unchanged.
  CLOUD_DOC = fsdb.collection('mohammadia_library').doc('main_db');
}

var currentRole = null;          // 'admin' (Shop) | 'employee' (Bank) | null
var loginRoleChoice = 'employee';

function $(id) { return document.getElementById(id); }
function roleOfUser(u) { var e = String((u && u.email) || '').toLowerCase(); return ROLE_EMAILS[e] || null; }
function emailForRole(r) { return Object.keys(ROLE_EMAILS).find(function (k) { return ROLE_EMAILS[k] === r; }); }
function hideBootOverlay() {
  var o = $('bootOverlay'); if (!o) return;
  o.classList.add('hide');
  setTimeout(function () { o.style.display = 'none'; }, 280);
}
// The Daily Hisab "back" button asks the host to close its page; here it is the whole app.
function closeActionModal() {}

function authErrorText(e) {
  var c = (e && e.code) || '';
  if (c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found' || c === 'auth/invalid-login-credentials') return 'Incorrect password. Please try again.';
  if (c === 'auth/too-many-requests') return 'Too many wrong attempts. Please wait a few minutes and try again.';
  if (c === 'auth/network-request-failed') return 'No internet connection. Please check your network and try again.';
  if (c === 'auth/user-disabled') return 'This account has been disabled in Firebase.';
  if (c === 'auth/operation-not-allowed') return 'Email/Password sign-in is not enabled in Firebase Authentication.';
  if (c === 'app/no-role') return 'This account is not allowed to use this app.';
  if (c === 'app/no-account') return 'This login is not set up yet (see config.js).';
  return 'Login failed' + (c ? ' (' + c + ')' : '') + '. Please try again.';
}

function selectLoginRole(role) {
  loginRoleChoice = role;
  var a = $('roleBtnAdmin'), b = $('roleBtnEmployee');
  a.classList.toggle('active', role === 'admin'); b.classList.toggle('active', role === 'employee');
  a.setAttribute('aria-selected', role === 'admin' ? 'true' : 'false');
  b.setAttribute('aria-selected', role === 'employee' ? 'true' : 'false');
  var rd = $('bkRoleDesc'); if (rd) rd.textContent = role === 'admin' ? 'Daily Hisab.' : 'DBBL daily hisab & bank dashboard.';
  $('loginError').classList.remove('show');
}

function showLoginError(msg) {
  var le = $('loginError');
  le.textContent = msg; le.classList.remove('show'); void le.offsetWidth; le.classList.add('show');
}

async function forgotPassword() {
  var btn = $('forgotBtn'), msg = $('forgotMsg');
  var email = emailForRole(loginRoleChoice);
  if (!fbAuth || !email) return;
  var show = function (txt, ok) { msg.style.display = 'block'; msg.textContent = txt; msg.style.background = ok ? '#e6f4ea' : '#fce8e6'; msg.style.color = ok ? '#188038' : '#b42318'; };
  var label = loginRoleChoice === 'admin' ? 'Shop' : 'Bank';
  if (!confirm('Send a password reset link for the ' + label + ' account to its email inbox?')) return;
  btn.disabled = true;
  try {
    await fbAuth.sendPasswordResetEmail(email);
    show('Link sent. Open the email (check Spam too), tap the link and set a new password.', true);
    var n = 60, iv = setInterval(function () { n--; btn.textContent = n > 0 ? 'Resend in ' + n + 's' : 'Forgot password?'; if (n <= 0) { clearInterval(iv); btn.disabled = false; } }, 1000);
  } catch (e) {
    var c = (e && e.code) || '';
    show(c === 'auth/too-many-requests' ? 'Too many requests. Please wait a few minutes.' : c === 'auth/network-request-failed' ? 'No internet connection.' : 'Could not send the email' + (c ? ' (' + c + ')' : '') + '.', false);
    btn.disabled = false;
  }
}

function toggleLoginPw() {
  var inp = $('loginPassword');
  inp.type = inp.type === 'password' ? 'text' : 'password';
  $('pwToggleBtn').textContent = inp.type === 'password' ? '👁️' : '🙈';
}

async function doLogin() {
  var pwEl = $('loginPassword'), pw = pwEl.value;
  if (!pw) { showLoginError('Please enter a password.'); return; }
  if (!fbAuth) return;
  $('loginBtnText').textContent = 'Signing in...';
  $('loginSpinner').classList.add('show');
  $('loginBtn').disabled = true;
  try {
    var email = emailForRole(loginRoleChoice);
    if (!email) throw { code: 'app/no-account' };
    var cred = await fbAuth.signInWithEmailAndPassword(email, pw);
    var role = roleOfUser(cred.user);
    if (!role) { await fbAuth.signOut(); throw { code: 'app/no-role' }; }
    pwEl.value = '';
    $('loginError').classList.remove('show');
    enterApp(role, true);
  } catch (e) {
    console.error('Login failed:', e);
    showLoginError(authErrorText(e));
    pwEl.value = ''; pwEl.focus();
  }
  $('loginBtnText').textContent = 'Sign In';
  $('loginSpinner').classList.remove('show');
  $('loginBtn').disabled = false;
}

function showShopHisab() {
  document.body.classList.remove('booting');
  $('shopApp').classList.add('show');
  hideBootOverlay();
  if (window.startShopApp) window.startShopApp();               // dashboard · Daily Hisab · Shopon · Modina
}

function enterApp(role, animate) {
  currentRole = role;
  document.body.classList.toggle('role-employee', role === 'employee');
  document.body.classList.toggle('role-admin', role === 'admin');
  var ls = $('loginScreen');
  var go = function () {
    ls.style.display = 'none';
    if (role === 'employee') window.showBankApp(); else showShopHisab();
  };
  if (animate) { ls.classList.add('leaving'); setTimeout(go, 320); } else go();
}

function doLogout() {
  if (!confirm('Log out of the current session?')) return;
  var done = function () { location.reload(); };
  if (fbAuth) fbAuth.signOut().then(done, done); else done();
}

function setupNotice(title, html) {
  var n = $('setupNotice');
  n.innerHTML = '<div class="box"><h2></h2><div class="t"></div></div>';
  n.querySelector('h2').textContent = title;
  n.querySelector('.t').innerHTML = html;
  n.classList.add('show');
  document.body.classList.remove('booting');
  hideBootOverlay();
}

async function startHisabApp() {
  selectLoginRole('employee');
  if (SAME_ORIGIN_AS_SHOP) {
    setupNotice('Open this app from its own address',
      'This page is on the same web address as the shop app, so the two apps would mix data saved on this device. ' +
      'Open Mohammadia Hisab from its own address instead (see <b>hisab-app/README.md</b>).');
    return;
  }
  if (!CONFIG_OK) {
    setupNotice('Firebase is not set up yet',
      'Put the new Firebase project\'s config into <b>config.js</b> (next to this page), then reload. ' +
      'Steps are in <b>hisab-app/README.md</b>.');
    return;
  }
  var user = null;
  try { user = await new Promise(function (res) { var un = fbAuth.onAuthStateChanged(function (u) { un(); res(u); }); }); } catch (e) {}
  var role = user ? roleOfUser(user) : null;
  if (user && !role) { try { await fbAuth.signOut(); } catch (e) {} user = null; }
  if (user && role) { enterApp(role, false); return; }
  document.body.classList.remove('booting');
  hideBootOverlay();
  $('loginPassword').focus();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}

/* ============================================================
   MOTION — staggered entrances, chart bar indexes, line drawing
   and a dark chart tooltip. Only sets classes / CSS variables;
   all animation runs in CSS on transform + opacity.
   ============================================================ */
(function () {
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CARD = '.bkk,.bkp,.bkday,.bkoops,.fm-card,.rm-card,.rm-item,.bkd-one,.bk-greet,.bksec,.sp-kpi,.sp-card,.sp-pc,.sp-ctl,.sp-greet,.sp-sec';
  var lastRun = new WeakMap();

  function stagger(list, cap) {
    var k = 0;
    list.forEach(function (el) {
      el.classList.remove('nl-in');
      el.style.setProperty('--i', Math.min(k++, cap || 14));
    });
    if (list.length) void list[0].offsetWidth;            // one reflow per batch, not per element
    list.forEach(function (el) { el.classList.add('nl-in'); });
  }
  function prepChart(svg) {
    var bars = 0, dots = 0, lv = 0;
    [].forEach.call(svg.querySelectorAll('path'), function (p) {
      var f = p.getAttribute('fill');
      if (f === 'none') { try { p.style.setProperty('--len', Math.ceil(p.getTotalLength()) + 1); } catch (e) {} }
      else if (f && f.indexOf('url') !== 0) p.style.setProperty('--i', Math.floor(bars++ / 2));
    });
    [].forEach.call(svg.querySelectorAll('circle'), function (c) { c.style.setProperty('--i', dots++); });
    [].forEach.call(svg.querySelectorAll('text.lv'), function (t) { t.style.setProperty('--i', lv++); });
  }
  function handle(nodes) {
    var cards = [], rows = [], now = Date.now();
    nodes.forEach(function (n) {
      if (n.nodeType !== 1) return;
      var p = n.parentNode;
      if (p && now - (lastRun.get(p) || 0) < 700) return;  // fast re-renders (typing, live sync) stay still
      if (p) lastRun.set(p, now);
      if (n.matches('svg.ch')) prepChart(n);
      [].forEach.call(n.querySelectorAll('svg.ch'), prepChart);
      if (n.matches(CARD)) cards.push(n);
      [].push.apply(cards, n.querySelectorAll(CARD));
      if (n.matches('tbody tr')) rows.push(n);
      [].push.apply(rows, n.querySelectorAll('tbody tr'));
    });
    if (cards.length) stagger(cards, 14);
    if (rows.length) stagger(rows.slice(0, 24), 24);
  }

  function animateView(view) {
    if (!view || reduce) return;
    stagger([].slice.call(view.querySelectorAll(CARD)).filter(function (el) { return el.offsetParent; }), 14);
    [].forEach.call(view.querySelectorAll('svg.ch'), prepChart);   // re-shown views replay their CSS animations
  }

  window.nlReplay = animateView;
  function init() {
    var app = document.getElementById('bankApp'), shop = document.getElementById('shopApp');
    if (reduce || !window.MutationObserver) return;
    var queue = [], raf = 0;
    var mo = new MutationObserver(function (muts) {
      muts.forEach(function (m) { [].push.apply(queue, m.addedNodes); });
      if (!raf) raf = requestAnimationFrame(function () { raf = 0; var q = queue; queue = []; handle(q); });
    });
    if (shop) { mo.observe(shop, { childList: true, subtree: true }); initTip(shop); }
    if (!app) return;
    mo.observe(app, { childList: true, subtree: true });

    // replay the entrance whenever a section is opened from the sidebar
    var orig = window.bankTab;
    if (typeof orig === 'function') window.bankTab = function () {
      var r = orig.apply(this, arguments);
      requestAnimationFrame(function () {
        var v = [].filter.call(app.querySelectorAll('.bk-view'), function (x) { return x.style.display !== 'none'; })[0];
        animateView(v);
      });
      return r;
    };
    var show = window.showBankApp;
    if (typeof show === 'function') window.showBankApp = function () {
      var r = show.apply(this, arguments);
      requestAnimationFrame(function () { animateView(document.getElementById('bkViewDash')); });
      return r;
    };
    initTip(app);
  }

  // dark tooltip for the chart hit areas (replaces the browser's plain title box)
  var tip = null;
  function initTip(app) {
    if (!tip) { tip = document.createElement('div'); tip.id = 'nlTip'; tip.setAttribute('aria-hidden', 'true'); document.body.appendChild(tip); }
    var cur = null, x = 0, y = 0, raf = 0;
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function build(text) {
      var i = text.indexOf(' — '), head = i > 0 ? text.slice(0, i) : '', body = i > 0 ? text.slice(i + 3) : text;
      var html = head ? '<div class="h">' + esc(head) + '</div>' : '';
      body.split(' · ').forEach(function (part) {
        var m = part.match(/^(.*?)\s+([-+]?৳?[\d.,]+[kKmM]?%?)$/), cls = /deposit|profit|shopon/i.test(part) ? 't-dep' : /withdraw|cost/i.test(part) ? 't-wd' : /commission/i.test(part) ? 't-com' : /modina/i.test(part) ? 't-mod' : '';
        html += m ? '<div class="r ' + cls + '"><span><i></i>' + esc(m[1]) + '</span><b>' + esc(m[2]) + '</b></div>'
                  : '<div class="r"><span>' + esc(part) + '</span></div>';
      });
      return html;
    }
    function place() {
      raf = 0;
      var w = tip.offsetWidth, h = tip.offsetHeight, px = x + 16, py = y - h - 12;
      if (px + w > innerWidth - 8) px = x - w - 16;
      if (py < 8) py = y + 18;
      tip.style.transform = 'translate3d(' + Math.round(px) + 'px,' + Math.round(py) + 'px,0)';
    }
    app.addEventListener('pointerover', function (e) {
      var t = e.target.closest && e.target.closest('svg.ch .bkhit');
      if (!t) return;
      var ti = t.querySelector('title');
      if (ti) { t.setAttribute('data-tip', ti.textContent); ti.remove(); }
      var txt = t.getAttribute('data-tip'); if (!txt) return;
      if (cur !== t) { cur = t; tip.innerHTML = build(txt); }
      tip.classList.add('show');
    });
    app.addEventListener('pointermove', function (e) {
      if (!cur) return; x = e.clientX; y = e.clientY;
      if (!raf) raf = requestAnimationFrame(place);
    }, { passive: true });
    function hide() { cur = null; tip.classList.remove('show'); }
    app.addEventListener('pointerout', function (e) { if (cur && (!e.relatedTarget || !cur.contains(e.relatedTarget))) hide(); });
    app.addEventListener('scroll', hide, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else setTimeout(init, 0);
})();
