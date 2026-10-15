"""Плоская копия сайта для загрузки через веб-интерфейс GitHub (без подпапок)."""
import shutil, pathlib, sys
src = pathlib.Path(__file__).parent / 'docs'; out = pathlib.Path(sys.argv[1])
if out.exists(): shutil.rmtree(out)
out.mkdir(parents=True)
for p in src.rglob('*'):
    if p.is_file(): shutil.copy(p, out / p.name)
for name in ['index.html', 'manifest.webmanifest', 'sw.js', 'backend.js']:
    f = out / name; s = f.read_text()
    s = s.replace('icons/', '').replace('splash/', '')
    f.write_text(s)
(out / '.nojekyll').write_text('')
print(sorted(x.name for x in out.iterdir()))
