/* ============================================================
   SHOP PORTAL — what the "Shop" login sees.
   Sidebar: Dashboard · Daily Hisab · Shopon · Modina.
   - Dashboard reads (never writes) the Daily Hisab days and the
     Shopon/Modina balances.
   - Daily Hisab is the existing sheet (hisab_daily).
   - Shopon / Modina are the SM partner hisab, stored in this app's
     Firebase: sm_months (one doc per month) and sm_config/main.
   ============================================================ */
(function () {
  'use strict';
  var S = { page: 'dash', days: [], byDate: {}, sel: null, range: 14, loading: false, started: false, smReady: false };
  var TITLES = {
    dash: ['Dashboard', 'Daily hisab, Shopon and Modina at a glance'],
    daily: ['Daily Hisab', 'The shop sheet · saved to the cloud one day at a time'],
    shopon: ['Shopon', 'Money sent and payments received'],
    modina: ['Modina', 'Money sent and payments received']
  };
  function g(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function num(v) { var x = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(x) ? x : 0; }
  function fmt(n) { return (n < 0 ? '-' : '') + '৳' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
  function cmp(n) { var a = Math.abs(n), s = n < 0 ? '-' : ''; if (a >= 1e7) return s + (a / 1e7).toFixed(1).replace(/\.0$/, '') + 'Cr'; if (a >= 1e5) return s + (a / 1e5).toFixed(1).replace(/\.0$/, '') + 'L'; if (a >= 1e3) return s + (a / 1e3).toFixed(1).replace(/\.0$/, '') + 'k'; return s + Math.round(a); }
  function today() { var d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
  function addDays(d, n) { var p = d.split('-'), t = new Date(+p[0], +p[1] - 1, +p[2] + n); return new Date(t.getTime() - t.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
  function nice(d) { var p = d.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
  function dm(d) { var p = d.split('-'); return +p[2] + ' ' + new Date(+p[0], +p[1] - 1, 1).toLocaleDateString('en-GB', { month: 'short' }); }
  function wd(d) { var p = d.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-GB', { weekday: 'short' }); }
  function monLabel(ym) { var p = ym.split('-'); return new Date(+p[0], +p[1] - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); }
  window.shopToday = today;

  /* ---------- Daily Hisab figures (same formula as the sheet) ---------- */
  function sec(st, k) { var r = (st && st.sections && st.sections[k]) || []; return r.reduce(function (s, x) { return s + num(x && x.amt); }, 0); }
  function calc(st) {
    var acc = sec(st, 'account'), add = sec(st, 'add'), com = sec(st, 'commission'), cc = sec(st, 'cashCount'),
      sh = sec(st, 'shopon'), mo = sec(st, 'modina'), cost = sec(st, 'cost');
    var total = acc + cc, profit = total + sh + mo + cost - add;
    return { total: total, add: add, com: com, cc: cc, sh: sh, mo: mo, cost: cost, profit: profit, extra: profit - com,
      any: !!(acc || add || com || cc || sh || mo || cost) };
  }
  function dailyStore() { try { return window.__hisabCloud && window.__hisabCloud.storeFor('daily'); } catch (e) { return null; } }
  async function load() {
    var api = dailyStore(); if (!api || S.loading) return;
    S.loading = true;
    try {
      var l = await api.list('shophisab:'), out = [], map = {};
      for (var i = 0; i < l.keys.length; i++) {
        var k = l.keys[i], d = k.slice(10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
        var r = await api.get(k); if (!r || !r.value) continue;
        var st; try { st = typeof r.value === 'string' ? JSON.parse(r.value) : r.value; } catch (e) { continue; }
        var c = calc(st); if (!c.any) continue;
        var row = { date: d, c: c }; out.push(row); map[d] = row;
      }
      out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      S.days = out; S.byDate = map;
    } catch (e) { console.error('Shop dashboard load failed', e); }
    S.loading = false;
    render();
  }
  function selDate() {
    if (S.sel) return S.sel;
    var t = today(); if (S.byDate[t]) return t;
    var last = null; S.days.forEach(function (r) { if (r.date <= t) last = r.date; });
    return last || t;
  }
  function prevOf(d) { var p = null; S.days.forEach(function (r) { if (r.date < d) p = r; }); return p; }

  /* ---------- rendering ---------- */
  function chip(cur, prev, goodUp, pd) {
    if (prev == null) return '<span class="sp-mut">no earlier day</span>';
    var df = cur - prev; if (Math.abs(df) < 0.005) return '<span class="sp-chip">no change</span>';
    var up = df > 0, cls = goodUp === null ? '' : (up === goodUp ? 'up' : 'down');
    return '<span class="sp-chip ' + cls + '">' + (up ? '▲ ' : '▼ ') + cmp(Math.abs(df)) + '</span><span class="sp-mut">vs ' + dm(pd) + '</span>';
  }
  function kpi(cls, label, val, sub) {
    return '<div class="sp-kpi ' + cls + '"><div class="k"><i></i>' + label + '</div><div class="v" title="' + esc(fmt(val)) + '">' + (val < 0 ? '-' : '') + '৳' + Math.abs(val).toLocaleString('en-IN', { maximumFractionDigits: 0 }) + '</div><div class="d">' + sub + '</div></div>';
  }
  function render() {
    if (!g('spKpis')) return;
    var d = selDate(), row = S.byDate[d], pr = prevOf(d), c = row ? row.c : null, p = pr ? pr.c : null, pd = pr && pr.date;
    g('spDate').value = d;
    g('spDayLbl').textContent = nice(d) + (d === today() ? ' · today' : '');
    g('spAsOf').textContent = S.days.length ? S.days.length + ' saved days · last ' + nice(S.days[S.days.length - 1].date) : (S.loading ? 'Loading…' : 'No saved days yet');
    if (!c) {
      g('spKpis').innerHTML = '<div class="sp-empty">Nothing saved for ' + esc(nice(d)) + '. <button type="button" class="sp-link" onclick="shopOpenDay()">Open the Daily Hisab</button></div>';
    } else {
      g('spKpis').innerHTML =
        kpi('k-tot', 'Total', c.total, chip(c.total, p && p.total, true, pd)) +
        kpi(c.profit >= 0 ? 'k-in' : 'k-out', c.profit > 0 ? 'Profit' : c.profit < 0 ? 'Loss' : 'Break-even', c.profit, chip(c.profit, p && p.profit, true, pd)) +
        kpi('k-com', 'Commission', c.com, chip(c.com, p && p.com, true, pd)) +
        kpi(c.extra >= 0 ? 'k-in' : 'k-out', 'Extra', c.extra, chip(c.extra, p && p.extra, true, pd));
    }
    // month
    var ym = d.slice(0, 7), m = { com: 0, profit: 0, cost: 0, sh: 0, mo: 0, n: 0 };
    S.days.forEach(function (r) { if (r.date.slice(0, 7) === ym) { m.com += r.c.com; m.profit += r.c.profit; m.cost += r.c.cost; m.sh += r.c.sh; m.mo += r.c.mo; m.n++; } });
    g('spMonLbl').textContent = monLabel(ym) + ' · ' + m.n + ' saved day' + (m.n === 1 ? '' : 's');
    g('spKpisM').innerHTML =
      kpi('k-com', 'Commission', m.com, '<span class="sp-mut">avg ৳' + cmp(m.n ? m.com / m.n : 0) + ' / day</span>') +
      kpi(m.profit >= 0 ? 'k-in' : 'k-out', 'Profit', m.profit, '<span class="sp-mut">all saved days</span>') +
      kpi('k-out', 'Daily cost', m.cost, '<span class="sp-mut">avg ৳' + cmp(m.n ? m.cost / m.n : 0) + ' / day</span>') +
      kpi('k-tot', 'Shopon + Modina', m.sh + m.mo, '<span class="sp-mut">Shopon ৳' + cmp(m.sh) + ' · Modina ৳' + cmp(m.mo) + '</span>');
    // charts
    var win = []; for (var i = S.range - 1; i >= 0; i--) { var dd = addDays(d, -i); win.push({ date: dd, row: S.byDate[dd] }); }
    [].forEach.call(document.querySelectorAll('#spRng button'), function (b) { b.classList.toggle('on', +b.getAttribute('data-n') === S.range); });
    var W = Math.max(560, (g('spChartPC').clientWidth || 700) * 1.25);
    g('spChartPC').innerHTML = barChart(win, d, W, 300, [
      { k: 'profit', c: 'var(--nl-dep)', n: 'Profit' }, { k: 'com', c: 'var(--nl-lime2)', n: 'Commission' }], false);
    g('spChartSM').innerHTML = barChart(win, d, Math.max(560, (g('spChartSM').clientWidth || 900) * 1.25), 260, [
      { k: 'sh', c: '#2d6b4f', n: 'Shopon' }, { k: 'mo', c: '#8fb3d3', n: 'Modina' }, { k: 'cost', c: '#e9a36b', n: 'Daily cost' }], true);
    // recent
    var rec = S.days.slice(-10).reverse();
    g('spRecent').innerHTML = rec.length ? rec.map(function (r) {
      var c2 = r.c;
      return '<tr class="click' + (r.date === d ? ' on' : '') + '" onclick="shopOpenDay(\'' + r.date + '\')"><td>' + esc(nice(r.date)) + '</td><td class="n">' + fmt(c2.total) + '</td><td class="n">' + fmt(c2.add) + '</td><td class="n ' + (c2.profit < 0 ? 'neg' : 'pos') + '">' + fmt(c2.profit) + '</td><td class="n">' + fmt(c2.com) + '</td><td class="n ' + (c2.extra < 0 ? 'neg' : '') + '">' + fmt(c2.extra) + '</td><td class="n">' + fmt(c2.cost) + '</td></tr>';
    }).join('') : '<tr><td colspan="7" class="sp-mut" style="text-align:center;padding:22px">No saved days yet</td></tr>';
    renderPartners();
    var h = new Date().getHours();
    g('spGreet').textContent = (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
  }
  function niceTop(v) { if (v <= 0) return 1000; var p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
  function bar(x, y, w, h, r) { if (h <= 0) return ''; r = Math.min(r, w / 2, h); return 'M' + x + ' ' + (y + h) + 'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + (y + h) + 'Z'; }
  function barChart(win, selD, W, H, series, stacked) {
    var L = 54, R = 10, T = 18, B = 44, iw = W - L - R, ih = H - T - B, n = win.length, mx = 0, mn = 0;
    var has = win.some(function (x) { return x.row; });
    if (!has) return '<div class="sp-empty">No saved days in this range.</div>';
    win.forEach(function (x) {
      if (!x.row) return;
      if (stacked) { var s = 0; series.forEach(function (o) { s += Math.max(0, x.row.c[o.k]); }); mx = Math.max(mx, s); }
      else series.forEach(function (o) { mx = Math.max(mx, x.row.c[o.k]); mn = Math.min(mn, x.row.c[o.k]); });
    });
    var top = niceTop(mx), bot = mn < 0 ? -niceTop(-mn) : 0, rng = top - bot || 1, Y = function (v) { return T + ih * (top - v) / rng; };
    var gw = iw / n, bw = stacked ? Math.max(5, Math.min(30, gw * 0.5)) : Math.max(4, Math.min(22, gw * 0.3));
    var s = '<svg class="ch" viewBox="0 0 ' + W.toFixed(0) + ' ' + H + '" role="img">';
    for (var i = 0; i <= 4; i++) { var v = bot + rng * i / 4, y = Y(v); s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="' + (Math.abs(v) < 1e-9 ? '#dcdcd6' : '#efefeb') + '"/><text x="' + (L - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end">' + cmp(v) + '</text>'; }
    var step = Math.max(1, Math.ceil(n / Math.floor(iw / 56)));
    win.forEach(function (x, k) {
      var gx = L + gw * k, cx = gx + gw / 2, sel = x.date === selD;
      if (sel) s += '<rect x="' + gx.toFixed(1) + '" y="' + (T - 4) + '" width="' + gw.toFixed(1) + '" height="' + (ih + 4) + '" rx="8" fill="#1c1f1d" opacity=".045"/>';
      if (x.row) {
        if (stacked) {
          var base = Y(0);
          series.forEach(function (o, j) {
            var v = Math.max(0, x.row.c[o.k]); if (!v) return;
            var hh = base - Y(v), last = j === series.length - 1 || !series.slice(j + 1).some(function (q) { return x.row.c[q.k] > 0; });
            s += last ? '<path d="' + bar(cx - bw / 2, base - hh, bw, hh, 5) + '" fill="' + o.c + '"/>' : '<path d="M' + (cx - bw / 2) + ' ' + base + 'V' + (base - hh + 1) + 'H' + (cx + bw / 2) + 'V' + base + 'Z" fill="' + o.c + '"/>';
            base -= hh;
          });
        } else {
          series.forEach(function (o, j) {
            var v = x.row.c[o.k], xx = cx - (series.length * bw + (series.length - 1) * 3) / 2 + j * (bw + 3);
            if (v >= 0) s += '<path d="' + bar(xx, Y(v), bw, Y(0) - Y(v), 4) + '" fill="' + o.c + '"/>';
            else s += '<path d="M' + xx + ' ' + Y(0) + 'V' + Y(v) + 'H' + (xx + bw) + 'V' + Y(0) + 'Z" fill="#e58e7f"/>';
          });
        }
      }
      if (k % step === 0 || sel) {
        var fri = new Date(+x.date.slice(0, 4), +x.date.slice(5, 7) - 1, +x.date.slice(8, 10)).getDay() === 5;
        s += '<text x="' + cx.toFixed(1) + '" y="' + (H - 24) + '" text-anchor="middle"' + (sel ? ' style="font-weight:700;fill:#1c1f1d"' : '') + '>' + dm(x.date) + '</text><text x="' + cx.toFixed(1) + '" y="' + (H - 9) + '" text-anchor="middle" style="font-size:10px' + (fri ? ';fill:#c4632a' : '') + '">' + wd(x.date) + '</text>';
      }
    });
    win.forEach(function (x, k) {
      var tip = nice(x.date) + ' — ' + (x.row ? series.map(function (o) { return o.n + ' ' + fmt(x.row.c[o.k]); }).join(' · ') : 'Nothing saved');
      s += '<rect class="bkhit" data-tip="' + esc(tip) + '" x="' + (L + gw * k).toFixed(1) + '" y="0" width="' + gw.toFixed(1) + '" height="' + H + '" onclick="shopPick(\'' + x.date + '\')"/>';
    });
    return s + '</svg>';
  }

  /* ---------- partners (SM) ---------- */
  function smWin() { try { var f = g('smFrame'); return f && f.contentWindow; } catch (e) { return null; } }
  function smApi() { var w = smWin(); return w && w.__smApi; }
  function partnerName(which) {
    var a = smApi(), list = a ? a.partners() : [];
    var re = which === 'shopon' ? /^sh[aoue]+p[aoue]*n/i : /^mod[ie]na/i;
    for (var i = 0; i < list.length; i++) if (re.test(list[i])) return list[i];
    return which === 'shopon' ? 'Shapan' : 'Modina';
  }
  function balTxt(v) { return v > 0.005 ? { w: 'Due', c: 'neg', t: '-৳' + cmp(v) } : v < -0.005 ? { w: 'Advance', c: 'pos', t: '+৳' + cmp(-v) } : { w: 'Settled', c: '', t: '৳0' }; }
  function renderPartners() {
    var a = smApi(), box = g('spPartners');
    var err = window.__smErr;
    if (err) { box.innerHTML = '<div class="sp-empty">' + esc(err) + '</div>'; return; }
    if (!a || !a.loaded()) { box.innerHTML = '<div class="sp-empty">Loading partners…</div>'; return; }
    var html = '', ents = a.entries(), t0 = today(), ym = t0.slice(0, 7);
    ['shopon', 'modina'].forEach(function (k) {
      var p = partnerName(k), t = a.totals(p) || { due: 0, sent: 0, bank: 0, cnt: 0 }, b = balTxt(t.due), ms = 0, mr = 0;
      ents.forEach(function (e) { if (e.partner === p && e.date.slice(0, 7) === ym) { if (e.type === 'send') ms += +e.amount; else mr += +e.amount; } });
      html += '<button type="button" class="sp-pc" onclick="shopGo(\'' + k + '\')"><span class="sp-av big">' + (k === 'shopon' ? 'S' : 'M') + '</span><span class="sp-pcb"><b>' + (k === 'shopon' ? 'Shopon' : 'Modina') + '</b><small>This month: sent ৳' + cmp(ms) + ' · received ৳' + cmp(mr) + '</small></span><span class="sp-pcv ' + b.c + '"><b>' + b.t + '</b><small>' + b.w + '</small></span></button>';
      var side = g(k === 'shopon' ? 'spBalShopon' : 'spBalModina'); if (side) { side.textContent = b.w + ' ' + b.t; side.className = b.c; }
    });
    box.innerHTML = html;
  }
  window.__smBridge = {
    use: function (n) {
      if (n !== 'db' || typeof CLOUD_DOC === 'undefined' || !CLOUD_DOC) return Promise.reject(new Error('not available'));
      var months = CLOUD_DOC.collection('sm_months'), cfg = CLOUD_DOC.collection('sm_config');
      function wrapCol(c) {
        return { onSnapshot: function (next, err) { return c.onSnapshot(next, function (e) { window.__smErr = e && e.code === 'permission-denied' ? 'Shopon & Modina need a Firestore rule update (sm_months, sm_config).' : null; renderPartners(); if (err) err(e); }); }, doc: function (id) { return c.doc(id); } };
      }
      return Promise.resolve({
        collection: function (name) { return wrapCol(name === 'months' ? months : cfg); },
        doc: function (path) { var p = String(path).split('/'); return (p[0] === 'months' ? months : cfg).doc(p[1]); }
      });
    },
    changed: function () { window.__smErr = null; if (S.page === 'dash') renderPartners(); else renderPartners(); }
  };
  function startSm() {
    var f = g('smFrame'); if (!f || f.getAttribute('data-ready')) return;
    f.setAttribute('data-ready', '1');
    f.srcdoc = window.SM_SRC || '<p>SM missing</p>';
  }
  window.shopSm = function (act) {
    var w = smWin(); if (!w) return;
    try {
      if (act === 'add') w.openEntry(null, 'send');
      else if (act === 'excel') w.exportXlsx();
      else if (act === 'settings') w.document.getElementById('dlgMenu').showModal();
    } catch (e) { console.error(e); }
  };

  /* ---------- navigation ---------- */
  window.shopSide = function (open) { g('shopApp').classList.toggle('sp-open', !!open); };
  window.shopGo = function (page) {
    S.page = page;
    [].forEach.call(document.querySelectorAll('#spSide .sp-item'), function (b) { b.classList.toggle('on', b.getAttribute('data-sp') === page); });
    g('spTitle').textContent = TITLES[page][0]; g('spSub').textContent = TITLES[page][1];
    g('spViewDash').hidden = page !== 'dash';
    g('spViewDaily').hidden = page !== 'daily';
    g('spViewSm').hidden = page !== 'shopon' && page !== 'modina';
    g('spActsP').hidden = page !== 'shopon' && page !== 'modina';
    g('hisabDailyPill').hidden = page !== 'daily';
    shopSide(false);
    try { localStorage.setItem('mh_shop_page', page); } catch (e) {}
    if (page === 'daily' && window.initHisabFrame) window.initHisabFrame('daily');
    if (page === 'shopon' || page === 'modina') {
      startSm();
      var go = function () { var w = smWin(); if (w && typeof w.setProfile === 'function') { try { w.setProfile(partnerName(page)); } catch (e) {} } else setTimeout(go, 120); };
      go();
    }
    if (page === 'dash') { load(); if (window.nlReplay) window.nlReplay(g('spViewDash')); }
  };
  window.shopPick = function (d) { if (!d) return; S.sel = d; render(); };
  window.shopStep = function (n) {
    var d = selDate(), t = null;
    if (n < 0) S.days.forEach(function (r) { if (r.date < d) t = r.date; });
    else for (var i = 0; i < S.days.length; i++) if (S.days[i].date > d) { t = S.days[i].date; break; }
    if (t) shopPick(t);
  };
  window.shopRange = function (n) { S.range = n; render(); };
  window.shopOpenDay = function (d) {
    d = d || selDate(); S.sel = d;
    shopGo('daily');
    var tries = 0;
    (function setDay() {
      try {
        var w = g('hisabDailyFrame').contentWindow, p = w && w.document.getElementById('hisabDate');
        if (p && typeof w.loadForDate === 'function') { if (p.value !== d) { p.value = d; w.loadForDate(d); } return; }
      } catch (e) {}
      if (tries++ < 60) setTimeout(setDay, 150);
    })();
  };
  window.startShopApp = function () {
    if (!S.started) {
      S.started = true;
      startSm();
      var st = dailyStore(); if (st && st.onChange) st.onChange(function () { if (S.page === 'dash') load(); });
      setInterval(function () { if (S.page === 'dash' && !document.hidden) load(); }, 60000);
      addEventListener('resize', function () { if (S.page === 'dash') { clearTimeout(S.rt); S.rt = setTimeout(render, 200); } });
    }
    var p = 'dash'; try { p = localStorage.getItem('mh_shop_page') || 'dash'; } catch (e) {}
    if (!TITLES[p]) p = 'dash';
    shopGo(p);
  };
})();
