#!/usr/bin/env python3
"""Builds hisab-app/index.html from the main app (../index.html).

The new app has two logins and its OWN Firebase project:
  * Bank  -> the full Bank portal (dashboard, DBBL Daily Hisab, remittance, forms)
  * Shop  -> only the shop "Daily Hisab" sheet

The bank portal and the hisab sheets are copied unchanged out of ../index.html,
so improvements made there can be brought over by running this script again:

    python3 build.py path/to/shop-app/index.html

(default source: ../index.html). The shop app's file is only READ, never changed. Edit the Firebase config in
hisab-app/config.js (not in the generated index.html).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'index.html')
if not os.path.exists(SRC):
    sys.exit('build: shop app index.html not found: ' + SRC + '\nusage: python3 build.py path/to/shop-app/index.html')
OUT = os.path.join(HERE, 'index.html')

src = open(SRC, encoding='utf-8').read()


def between(start, end, include_end=True, frm=0):
    """Return src[start ... end] (both markers must exist exactly once after frm)."""
    i = src.find(start, frm)
    if i < 0:
        sys.exit('build: marker not found: ' + start[:70])
    j = src.find(end, i + len(start))
    if j < 0:
        sys.exit('build: end marker not found: ' + end[:70])
    return src[i:j + (len(end) if include_end else 0)]


def block(tag, ident):
    m = re.search(r'<%s id="%s">.*?</%s>' % (tag, re.escape(ident), tag), src, re.S)
    if not m:
        sys.exit('build: missing <%s id="%s">' % (tag, ident))
    return m.group(0)


def script_containing(text):
    for m in re.finditer(r'<script>(.*?)</script>', src, re.S):
        if text in m.group(1):
            return m.group(0)
    sys.exit('build: no script contains ' + text[:60])


# ---- styles (copied as-is) ----
main_css = between('<style>\n', '</style><style id="hisabPagesCss">', include_end=False) + '</style>'
styles = [main_css] + [block('style', i) for i in
          ['hisabPagesCss', 'bankLoginCss', 'sutonnyCss', 'bankNavCss', 'bankAppCss', 'bankThemeCss']]

# ---- markup ----
boot = between('<div id="bootOverlay"', '</div>\n</div>')
login = between('<div id="loginScreen">', '<!-- ===================== BANK PORTAL', include_end=False)
bank = between('<div id="bankApp"', '\n<script>\n/* ====', include_end=False)

# login screen: this app has its own (src/login.html), same ids and handlers
login = open(os.path.join(HERE, 'src', 'login.html'), encoding='utf-8').read()

# new look: the default "ocean" colour theme is teal here
bank = bank.replace('#0a2f6b 55%,#082756 55%', '#1f4a37 55%,#16352a 55%').replace('>Ocean Blue<', '>Forest Green<')

# ---- scripts (copied as-is) ----
bijoy = block('script', 'bijoyLib')
bank_js_start = src.find('<script>\n/* ============================================================\n   BANK PORTAL — what the')
bank_js_end_marker = 'Bank portal: sidebar list/sublist navigation'
k = src.find(bank_js_end_marker, bank_js_start)
bank_js = src[bank_js_start:src.find('</script>', k) + len('</script>')]
if bank_js_start < 0 or k < 0:
    sys.exit('build: bank portal scripts not found')
hisab_js = script_containing('HISAB PAGES — "DBBL Daily Hisab" and "Daily Hisab"')
bank_theme_js = block('script', 'bankThemeJs')

# The shop Daily Hisab used to live inside the shop's Daily Cash page; here it is its own page.
# Inside both hisab sheets: bigger Excel-like cell text, minimal heads/account names (src/sheet-text.css)
# and columns that widen to fit their longest number (src/sheet-fit.js)
_sheet_css = open(os.path.join(HERE, 'src', 'sheet-text.css'), encoding='utf-8').read()
_mark = '<head><script>/* HISAB-CLOUD-BRIDGE'
if hisab_js.count(_mark) != 2:
    sys.exit('build: hisab sheet <head> marker not found twice')
_sheet_js = open(os.path.join(HERE, 'src', 'sheet-fit.js'), encoding='utf-8').read()
def _js_str(x):
    return json.dumps(x)[1:-1].replace('</', '<\\/')
hisab_js = hisab_js.replace(_mark, '<head><style id=\\"sheetText\\">' + _js_str(_sheet_css) + '</style><script id=\\"sheetFit\\">' + _js_str(_sheet_js) + '<\\/script><script>/* HISAB-CLOUD-BRIDGE')
# Daily Hisab code edits (src/daily_patches.py): Add scrolls exactly like Shopon and Modina
sys.path.insert(0, os.path.join(HERE, 'src'))
from daily_patches import patch_hisab_js
import dbbl_patches
hisab_js = patch_hisab_js(hisab_js, lambda m: sys.exit('build: ' + m))
# DBBL Daily Hisab edits (src/dbbl_patches.py): one clean top row with a ⋮ menu, Pin in its own scroll box
hisab_js = dbbl_patches.patch_hisab_js(hisab_js, lambda m: sys.exit('build: ' + m))
hisab_js = hisab_js.replace("if(id==='daily'){openDailyCash();cashTab('hisab');return}",
                            "if(id==='daily'){initFrame(id);return}")

for piece, name in [(bank_js, 'bank'), (hisab_js, 'hisab')]:
    if 'SALES_COL' in piece or 'startCloudSync' in piece:
        sys.exit('build: %s code unexpectedly touches shop sales' % name)

glue_css = open(os.path.join(HERE, 'src', 'app.css'), encoding='utf-8').read()
glue_html = open(os.path.join(HERE, 'src', 'shop.html'), encoding='utf-8').read()
glue_js = open(os.path.join(HERE, 'src', 'app.js'), encoding='utf-8').read()
theme_css = open(os.path.join(HERE, 'src', 'theme.css'), encoding='utf-8').read()
shop_js = open(os.path.join(HERE, 'src', 'shop.js'), encoding='utf-8').read()

# Shopon / Modina: the SM partner hisab (src/sm.html, a copy of date-app/hisab/index.html),
# shown in an iframe with src/sm-embed.html added at the top of its <head>.
sm_src = open(os.path.join(HERE, 'src', 'sm.html'), encoding='utf-8').read()
sm_embed = open(os.path.join(HERE, 'src', 'sm-embed.html'), encoding='utf-8').read()
if '<head>' not in sm_src:
    sys.exit('build: src/sm.html has no <head>')
sm_src = sm_src.replace('<head>', '<head>\n' + sm_embed, 1)
sm_js = '<script id="smSrc">window.SM_SRC=' + json.dumps(sm_src).replace('</', '<\\/') + ';</script>'

html = '\n'.join([
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    '<title>Mohammadia Hisab</title>',
    '<meta name="theme-color" content="#1f4a37">',
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap" rel="stylesheet">',
    '<link rel="manifest" href="manifest.webmanifest">',
    '<link rel="icon" href="icon-192.png">',
    '<link rel="apple-touch-icon" href="icon-192.png">',
    '<!-- GENERATED by hisab-app/build.py from ../index.html — do not edit by hand -->',
    *styles,
    '<style id="hisabAppCss">', glue_css, '</style>',
    '<style id="newLookCss">', theme_css, '</style>',
    '</head>',
    '<body class="booting">',
    boot,
    login,
    bank,
    glue_html,
    '<script src="https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js"></script>',
    '<script src="https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore-compat.js"></script>',
    '<script src="https://www.gstatic.com/firebasejs/10.13.0/firebase-auth-compat.js"></script>',
    '<script src="config.js"></script>',
    '<script>', glue_js, '</script>',
    bijoy,
    bank_js,
    hisab_js,
    sm_js,
    '<script id="shopJs">', shop_js, '</script>',
    bank_theme_js,
    '<script>startHisabApp();</script>',
    '</body>',
    '</html>',
    '',
])
open(OUT, 'w', encoding='utf-8').write(html)
print('wrote %s (%d KB)' % (OUT, len(html.encode('utf-8')) // 1024))
