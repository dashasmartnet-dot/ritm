"""Собирает web/index.html из исходников приложения (ritm-app) для своего сайта."""
import re, sys, pathlib
SRC = pathlib.Path(sys.argv[1]); OUT = pathlib.Path(__file__).parent / 'docs' / 'index.html'
css = (SRC/'css.part').read_text(); extra = (SRC/'extra.css').read_text(); body = (SRC/'body.part').read_text()
design = (SRC/'design.css').read_text() if (SRC/'design.css').exists() else ''
REPL = [
  ('Разбор голосом сейчас недоступен — разреши приложению доступ к Claude.', 'Помощник ИИ сейчас недоступен. Попробуй через минуту.'),
  ('Ассистент сейчас недоступен — войди в аккаунт.', 'Ассистент сейчас недоступен. Проверь интернет и попробуй ещё раз.'),
  ('Нужно заново войти в Claude.', 'Нужно заново войти: открой Профиль → Выйти и войди по коду.'),
  ("'Календарь сейчас недоступен.'", "'Google Календарь подключим следующим шагом.'"),
  ("(cap.mcp?'подключён':'недоступен')", "(cap.mcp?'подключён':'скоро')"),
  ('<li>Открой эту страницу в Safari и войди в Claude, если попросит.</li>', '<li>Открой сайт Ритма в Safari.</li>'),
  ('на телефоне и компьютере одни и те же дела.</p></section>', 'на телефоне и компьютере одни и те же дела.</p><button class="btn" data-act="sign-out">Выйти из аккаунта</button></section>'),
]
for a, b in REPL:
    n = body.count(a)
    assert n >= 1, a
    body = body.replace(a, b)
body = re.sub(r'claude\.ai → Настройки → Коннекторы', 'Профиль → Подключения', body)
body = body.replace('в claude.ai', '').replace(' claude.ai', '')
SPL = [(1320,2868,440,956,3),(1206,2622,402,874,3),(1290,2796,430,932,3),(1179,2556,393,852,3),(1284,2778,428,926,3),(1170,2532,390,844,3),(1125,2436,375,812,3),(1242,2688,414,896,3),(828,1792,414,896,2),(1080,2340,360,780,3),(750,1334,375,667,2),(640,1136,320,568,2)]
splash = '\n'.join(f'<link rel="apple-touch-startup-image" media="screen and (device-width: {w}px) and (device-height: {h}px) and (-webkit-device-pixel-ratio: {r}) and (orientation: portrait)" href="splash/splash-{pw}x{ph}.png">' for pw,ph,w,h,r in SPL)
import time
BUILD = time.strftime('%Y%m%d%H%M%S')
head = f'''<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Ритм</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; media-src 'self' blob:; base-uri 'none'; form-action 'self'">
<meta name="referrer" content="no-referrer">
<meta name="description" content="Ритм — умный ассистент твоего дня: дела, календарь, привычки и голос.">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Ритм">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="theme-color" content="#F7EFE8">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/icon-180.png">
{splash}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Manrope:wght@400;500;600;700;800&display=swap">
<script>window.RITM_BUILD='{BUILD}';</script>
<script src="supabase.js?v={BUILD}"></script>
<script src="config.js?v={BUILD}"></script>
<script src="backend.js?v={BUILD}"></script>
'''
pwa_css = '<style>html,body{margin:0}body{padding-top:env(safe-area-inset-top,0px);-webkit-tap-highlight-color:transparent;overscroll-behavior-y:none}</style>\n'
html = head + css + '\n' + extra + '\n' + ('<style>\n'+design+'\n</style>\n' if design else '') + pwa_css + '</head>\n<body>\n' + body + '\n</body>\n</html>\n'
low = html.replace('window.claude', '').lower()
assert 'claude' not in low, [m.start() for m in re.finditer('claude', low)][:5]
OUT.write_text(html)
(OUT.parent / 'version.txt').write_text(BUILD)
print('ok', len(html))
