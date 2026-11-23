"""Changes made to the shop Daily Hisab sheet (the `daily` page inside the hisab script).

The sheet's HTML lives in the hisab script as a JavaScript string (SRC.daily). build.py calls
patch_hisab_js(), which decodes that string, applies the edits below and puts it back.
Each edit must match exactly once, so a change in the shop app is reported instead of silently skipped.
"""
import json

EDITS = [
    # Add works like Shopon and Modina: 50 rows, at least 22 rows in the box, one spare empty row
    # appears after the last entry once entries go past row 22.
    ("{key:'add',        label:'Add',            flow:'out',     placement:'ledger', col:2, note:true,  count:44, notePH:'Note', amtPH:'0', scrollRows:20},",
     "{key:'add',        label:'Add',            flow:'out',     placement:'ledger', col:2, note:true,  count:50, notePH:'Note', amtPH:'0', scrollRows:22},"),
    ("""    if(sec.key === 'add'){                       // Add (top) + Commission (below) together are as tall as Modina
      const mp = document.querySelector('.panel[data-section="modina"]'), cp = document.querySelector('.panel[data-section="commission"]');
      const rh = trs[0].offsetHeight, hh = (panel.querySelector('.panel-head') || {}).offsetHeight || 0;
      if(mp && cp && mp.offsetHeight > 0 && rh > 0){
        const gap = parseFloat(getComputedStyle(panel.parentElement).rowGap) || 0;
        sec.scrollRows = Math.max(5, Math.floor((mp.offsetHeight - cp.offsetHeight - gap - hh - 2) / rh));
      }
    }
""", ""),
    ("    const minRows = sec.key === 'add' ? 20 : sec.scrollRows;   // Add always holds 20 rows inside its scroll block\n",
     "    const minRows = sec.scrollRows;\n"),
    # ...but the Add box is only as tall as the room left above Commission, so Commission's bottom lines up
    # exactly with the bottom of Modina (and the other columns). Applies when Add and Modina share a row.
    ("""    wrap.style.maxHeight = (scrolling && rowH) ? (rowH * sec.scrollRows) + 'px' : '';
  });""",
     """    wrap.style.maxHeight = (scrolling && rowH) ? (rowH * sec.scrollRows) + 'px' : '';
    if(sec.key === 'add'){
      const mp = document.querySelector('.panel[data-section="modina"]'), cp = document.querySelector('.panel[data-section="commission"]');
      if(mp && cp && mp.offsetHeight > 0 && Math.abs(mp.getBoundingClientRect().top - panel.getBoundingClientRect().top) < 4){
        const gap = parseFloat(getComputedStyle(panel.parentElement).rowGap) || 0;
        const below = panel.getBoundingClientRect().bottom - wrap.getBoundingClientRect().bottom;
        const room = Math.floor(mp.getBoundingClientRect().bottom - gap - cp.offsetHeight - below - wrap.getBoundingClientRect().top);
        if(room > 60){ wrap.style.maxHeight = room + 'px'; wrap.classList.toggle('scrolling', wrap.scrollHeight > room + 1); }
      }
    }
  });"""),
]


def _find_string(js, key):
    """Return (start, end) of the JSON string literal that follows `key:` in js."""
    i = js.index(key + ':"') + len(key) + 1
    j = i + 1
    while True:
        c = js[j]
        if c == '\\':
            j += 2
            continue
        if c == '"':
            return i, j + 1
        j += 1


def patch_hisab_js(js, fail):
    i, j = _find_string(js, 'daily')
    src = json.loads(js[i:j])
    for old, new in EDITS:
        n = src.count(old)
        if n != 1:
            fail('daily patch: expected 1 match, found %d: %s' % (n, old.strip()[:70]))
        src = src.replace(old, new)
    enc = json.dumps(src).replace('</', '<\\/')
    return js[:i] + enc + js[j:]
