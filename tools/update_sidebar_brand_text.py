from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

# Sidebar brand layout: text only.
s=s.replace('.brand{display:flex;align-items:center;gap:12px;padding:0 8px 22px}',
            '.brand{display:block;padding:0 8px 22px}')
s=re.sub(r'\n\s*\.brand-mark\{.*?\}\n\s*\.brand-mark\.has-image\{[^}]*\}', '', s, count=1, flags=re.S)
s=re.sub(r'\n\s*\.v2\{[^}]*\}', '', s, count=1)

# Remove icon and V2 badge from sidebar markup.
s=re.sub(r'\s*<div class="brand-mark" id="sidebarBrandMark">.*?</div>\s*', '', s, count=1, flags=re.S)
s=re.sub(r'\s*<span class="v2">V2</span>\s*', '', s, count=1)

# Update visible fixed copy.
s=s.replace('id="sidebarBrandTitle">影视收藏夹</h1>', 'id="sidebarBrandTitle">光影宇宙</h1>')
s=s.replace('id="sidebarBrandSubtitle">你的光影宇宙</small>', 'id="sidebarBrandSubtitle">定制化影视收藏夹</small>')

# Remove sidebar brand icon DOM ref if present.
s=s.replace("sidebarBrandMark:$('sidebarBrandMark'),", '')

# Update fixed brand application logic.
s=s.replace("if(els.sidebarBrandTitle)els.sidebarBrandTitle.textContent='影视收藏夹';",
            "if(els.sidebarBrandTitle)els.sidebarBrandTitle.textContent='光影宇宙';")
s=s.replace("if(els.sidebarBrandSubtitle){els.sidebarBrandSubtitle.textContent='你的光影宇宙';els.sidebarBrandSubtitle.classList.remove('hidden')}",
            "if(els.sidebarBrandSubtitle){els.sidebarBrandSubtitle.textContent='定制化影视收藏夹';els.sidebarBrandSubtitle.classList.remove('hidden')}")
s=re.sub(r"\n\s*if\(els\.sidebarBrandMark\)\{.*?\}", '', s, count=1)
s=s.replace("document.title='影视收藏夹 V2';", "document.title='光影宇宙';")

# Fallback for static title tag.
s=s.replace('<title>影视收藏夹 V2</title>', '<title>光影宇宙</title>')

# Checks.
for forbidden in ['id="sidebarBrandMark"', '<span class="v2">V2</span>', "textContent='影视收藏夹'", "textContent='你的光影宇宙'"]:
    if forbidden in s:
        raise SystemExit(f'old sidebar brand residue: {forbidden}')
for required in ['id="sidebarBrandTitle">光影宇宙</h1>', 'id="sidebarBrandSubtitle">定制化影视收藏夹</small>', "document.title='光影宇宙';"]:
    if required not in s:
        raise SystemExit(f'missing expected brand update: {required}')

p.write_text(s, encoding='utf-8')
print('sidebar brand updated')
