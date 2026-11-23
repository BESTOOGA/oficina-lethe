from pathlib import Path
from base64 import b64encode

root = Path(__file__).resolve().parents[1]
dist = root / "dist"
html = (dist / "index.html").read_text("utf-8")
style = (dist / "style.css").read_text("utf-8")
html = html.replace('<link rel="stylesheet" href="style.css">', f'<style>{style}</style>')
image = b64encode((dist / "hero.webp").read_bytes()).decode("ascii")
html = html.replace('src="hero.webp"', f'src="data:image/webp;base64,{image}"')
for name in ("catalog.js", "skins.js", "export.js", "zip.js", "bosses.js", "app.js"):
    script = (dist / name).read_text("utf-8")
    assert "</script" not in script.lower()
    html = html.replace(f'<script src="{name}"></script>', f'<script>{script}</script>')
(root / "Oficina Lethe.html").write_text(html, encoding="utf-8")

