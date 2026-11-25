"""Changes made to the DBBL Daily Hisab sheet (the `dbbl` page inside the hisab script).

Like daily_patches.py: build.py decodes SRC.dbbl, applies these edits (each must match exactly once)
and puts it back.
"""
import json

from daily_patches import _find_string

TOP_OLD = """<div class="app" id="app">
<div class="wrap">

  <header>
    <div>
      <h1>Daily Cash Hisab</h1>
      <div class="sub">Cash &amp; bank reconciliation ledger</div>
    </div>
    <div class="datebar">
      <label for="hisabDate">Date</label>
      <input type="date" id="hisabDate">
      <span class="lock-badge" id="lockBadge">🔒 Read-only — past entry</span>
    </div>
  </header>
</div>

<div class="pulse-bar" id="pulseBar">
  <div class="pulse-inner">
    <div class="pulse-item"><span class="pk">Commission</span><span class="pv" id="pulseCommission">0.00</span></div>
    <div class="pulse-item"><span class="pk">Expected Cash</span><span class="pv" id="pulseExpected">0.00</span></div>
    <div class="pulse-item"><span class="pk">Counted</span><span class="pv" id="pulseCounted">0.00</span></div>
    <span class="pulse-badge" id="pulseBadge">Cash Level</span>
    <span class="save-status" id="saveStatus"></span>
  </div>
</div>

<div class="wrap">
  <div class="actions">
    <button class="act primary" id="saveBtn">Save</button>
    <button class="act" id="newBtn">Clear Day</button>
    <button class="act" id="backupBtn">⬇ Backup (Download)</button>
    <button class="act" id="restoreBtn">⬆ Restore (Upload)</button>
    <input type="file" id="restoreFile" accept="application/json" style="display:none;">
  </div>
"""

# One clean row on top: title · ‹ date › · small totals · Cash Level · Clear Day · ⋮ (Save, Backup, Restore)
TOP_NEW = """<div class="app dbbl" id="app">
<div class="pulse-bar tb" id="pulseBar">
  <div class="tb-inner">
    <h1 class="tb-title">DBBL Daily Hisab</h1>
    <div class="tb-date">
      <button type="button" class="tb-ic" id="dayPrev" aria-label="Previous day" title="Previous day"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>
      <input type="date" id="hisabDate" aria-label="Date">
      <button type="button" class="tb-ic" id="dayNext" aria-label="Next day" title="Next day"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>
    </div>
    <span class="lock-badge" id="lockBadge">🔒 Read-only — past entry</span>
    <div class="tb-stats">
      <div class="pulse-item"><span class="pk">Commission</span><span class="pv" id="pulseCommission">0.00</span></div>
      <div class="pulse-item"><span class="pk">Expected Cash</span><span class="pv" id="pulseExpected">0.00</span></div>
      <div class="pulse-item"><span class="pk">Counted</span><span class="pv" id="pulseCounted">0.00</span></div>
    </div>
    <span class="pulse-badge" id="pulseBadge">Cash Level</span>
    <span class="tb-gap"></span>
    <span class="save-status" id="saveStatus"></span>
    <span class="tb-cloud" id="cloudPill" hidden></span>
    <button class="act tb-clear" id="newBtn">Clear Day</button>
    <div class="tb-menu" id="tbMenu">
      <button type="button" class="tb-ic tb-dots" id="menuBtn" aria-haspopup="true" aria-expanded="false" aria-label="More actions" title="More"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg></button>
      <div class="tb-pop" id="menuPop" role="menu" hidden>
        <button class="act tb-item" id="saveBtn" role="menuitem"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/></svg>Save</button>
        <button class="act tb-item" id="backupBtn" role="menuitem"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>Backup (Download)</button>
        <button class="act tb-item" id="restoreBtn" role="menuitem"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V9M7 14l5-5 5 5M5 4h14"/></svg>Restore (Upload)</button>
      </div>
      <input type="file" id="restoreFile" accept="application/json" style="display:none;">
    </div>
  </div>
</div>

<div class="wrap">
"""

PIN_OLD = """    <table class="ledger pin-tbl"><thead><tr><th style="width:28px"></th><th class="l" style="width:28%">Pin No.</th><th style="width:24%">Amount</th><th style="width:22%">Incent.</th><th>Total</th></tr></thead><tbody>${p}</tbody></table>`;"""
# Pin rows live in their own scroll box, so the Pin column ends on the same line as the others
PIN_NEW = """    <div class="ledger-scroll pin-scroll"><table class="ledger pin-tbl"><thead><tr><th style="width:28px"></th><th class="l" style="width:28%">Pin No.</th><th style="width:24%">Amount</th><th style="width:22%">Incent.</th><th>Total</th></tr></thead><tbody>${p}</tbody></table></div>`;"""

EDITS = [(TOP_OLD, TOP_NEW), (PIN_OLD, PIN_NEW)]


def patch_hisab_js(js, fail):
    i, j = _find_string(js, 'dbbl')
    src = json.loads(js[i:j])
    for old, new in EDITS:
        n = src.count(old)
        if n != 1:
            fail('dbbl patch: expected 1 match, found %d: %s' % (n, old.strip()[:70]))
        src = src.replace(old, new)
    enc = json.dumps(src).replace('</', '<\\/')
    return js[:i] + enc + js[j:]
