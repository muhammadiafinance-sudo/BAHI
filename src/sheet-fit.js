/* Fits every column of the hisab sheets to its longest number, so amounts are always shown in full.
   Each table gets --amtw (widest amount) and --notew (widest name); CSS turns them into minimum widths. */
(function () {
  var cv = document.createElement('canvas').getContext('2d'), raf = 0, last = new WeakMap();
  function width(list) {
    if (!list.length) return 0;
    var cs = getComputedStyle(list[0]); cv.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    var w = 0, i, v;
    for (i = 0; i < list.length; i++) { v = list[i].value; if (v) w = Math.max(w, cv.measureText(v).width); }
    var pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 10;
    return w ? Math.ceil(w + pad) : 0;
  }
  function fit() {
    raf = 0;
    // column fitting is for the shop Daily Hisab (the sheet with the Account list); other sheets keep their layout
    var on = !!document.querySelector('#ledgerGrid .panel[data-section="account"]');
    document.documentElement.classList.toggle('sf-fit', on);
    var tables = on ? document.querySelectorAll('table.ledger') : [];
    for (var t = 0; t < tables.length; t++) {
      var tb = tables[t];
      var a = width(tb.querySelectorAll('.amount-input')), n = width(tb.querySelectorAll('.note-input'));
      var key = a + '|' + n;
      if (last.get(tb) === key) continue;
      last.set(tb, key);
      tb.style.setProperty('--amtw', a ? a + 'px' : '0px');
      tb.style.setProperty('--notew', n ? n + 'px' : '0px');
      // the table claims the room it needs, so its grid column grows instead of squeezing the numbers
      var row = tb.rows[0], need = 0;
      if (row) for (var c = 0; c < row.cells.length; c++) {
        var td = row.cells[c];
        need += td.querySelector('.amount-input') ? Math.max(a, 84) : td.classList.contains('note-cell') ? Math.max(n, 90) : td.classList.contains('num') ? 0 : 90;
      }
      tb.style.minWidth = need ? need + 'px' : '';
    }
    if (on) fitGrids();
    shrinkToFit(document.querySelectorAll('.ot-v,#pulseCommission,#pulseTotal,#pulseProfit'));
  }
  // each grid column is at least as wide as the widest table in it; the grid scrolls sideways if it must
  var gridKey = new WeakMap();
  function fitGrids() {
    var grids = document.querySelectorAll('.ledger-grid');
    for (var g = 0; g < grids.length; g++) {
      var gr = grids[g], items = gr.children, mins = [];
      for (var i = 0; i < items.length; i++) {
        var m = 0, ts = items[i].querySelectorAll('table.ledger');
        for (var k = 0; k < ts.length; k++) m = Math.max(m, parseFloat(ts[k].style.minWidth) || 0);
        mins.push(Math.ceil(m + 4));
      }
      var key = mins.join(',') + '|' + innerWidth;
      if (gridKey.get(gr) === key) continue;
      gridKey.set(gr, key);
      gr.style.gridTemplateColumns = '';
      var n = getComputedStyle(gr).gridTemplateColumns.split(' ').filter(Boolean).length || 1, need = [];
      for (i = 0; i < n; i++) need[i] = 0;
      for (i = 0; i < mins.length; i++) need[i % n] = Math.max(need[i % n], mins[i]);
      gr.style.gridTemplateColumns = need.map(function (x) { return 'minmax(' + x + 'px,1fr)'; }).join(' ');
    }
  }
  // long totals: make the text smaller instead of cutting it off with "…"
  function shrinkToFit(els) {
    for (var i = 0; i < els.length; i++) {
      var el = els[i], base = el.__fs || (el.__fs = parseFloat(getComputedStyle(el).fontSize));
      if (!el.clientWidth) continue;
      el.style.fontSize = base + 'px';
      el.style.textOverflow = 'clip';
      var fs = base;
      var box = el.parentElement, room = function () {
        var b = box.getBoundingClientRect(), cs = getComputedStyle(box);
        return b.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth);
      };
      while ((el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().left + el.scrollWidth > room() + 1) && fs > 11) { fs -= 1; el.style.fontSize = fs + 'px'; }
    }
  }
  function soon() { if (!raf) raf = requestAnimationFrame(fit); }
  function wrap(name) {
    var f = window[name]; if (typeof f !== 'function' || f.__fit) return;
    var w = function () { var r = f.apply(this, arguments); if (r && typeof r.then === 'function') r.then(soon, soon); else soon(); return r; };
    w.__fit = true; window[name] = w;
  }
  document.addEventListener('input', soon, true);
  document.addEventListener('change', soon, true);
  // The mouse wheel scrolls the whole page, even with the cursor over the Add / Shopon / Modina / Cost boxes.
  // Alt + wheel scrolls inside a box; typing, arrow keys and touch still move inside it as before.
  addEventListener('wheel', function (e) {
    if (e.altKey || e.ctrlKey || !e.deltaY || !e.target.closest) return;
    var box = e.target.closest('.ledger-scroll');
    if (!box) return;
    e.preventDefault();
    var k = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? innerHeight : 1;
    (document.scrollingElement || document.documentElement).scrollBy(0, e.deltaY * k);
  }, { passive: false });
  addEventListener('wheel', function (e) {
    if (!e.altKey || !e.target.closest) return;
    var box = e.target.closest('.ledger-scroll');
    if (!box) return;
    e.preventDefault();
    box.scrollTop += (e.deltaY || e.deltaX) * (e.deltaMode === 1 ? 40 : 1);
  }, { passive: false });
  // DBBL top row: ‹ › change the day; ⋮ opens Save / Backup / Restore
  function stepDay(n) {
    var i = document.getElementById('hisabDate'); if (!i || !i.value || i.disabled) return;
    var p = i.value.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2] + n);
    i.value = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    i.dispatchEvent(new Event('change', { bubbles: true }));
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('#dayPrev,#dayNext,#menuBtn,.tb-item') : null;
    var pop = document.getElementById('menuPop'), btn = document.getElementById('menuBtn');
    if (t && t.id === 'dayPrev') return stepDay(-1);
    if (t && t.id === 'dayNext') return stepDay(1);
    if (t && t.id === 'menuBtn') { var open = pop.hidden; pop.hidden = !open; btn.setAttribute('aria-expanded', open ? 'true' : 'false'); return; }
    if (pop && !pop.hidden && (!e.target.closest('#tbMenu') || (t && t.classList.contains('tb-item')))) { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
  });
  document.addEventListener('keydown', function (e) {
    var pop = document.getElementById('menuPop');
    if (e.key === 'Escape' && pop && !pop.hidden) { pop.hidden = true; document.getElementById('menuBtn').focus(); }
  });
  addEventListener('resize', soon);
  addEventListener('load', function () {
    ['loadForDate', 'applyState', 'recalc'].forEach(wrap);
    soon();
    setInterval(soon, 2000);   // cheap safety net for values set without an event
  });
})();
