from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

# 1) Desktop card grid: 8 columns, tighter cards.
s=s.replace('.library-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:13px}',
            '.library-grid{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:10px}')
s=s.replace('.lib-body{padding:12px 13px 13px}.lib-title{font-size:14px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lib-meta{font-size:10px;color:#8791ad;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.lib-body{padding:9px 10px 10px}.lib-title{font-size:12px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lib-meta{font-size:9px;color:#8791ad;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}')
s=s.replace('.lib-rating{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;font-size:11px}.lib-rating .score{color:var(--gold)}.lib-rating .radar-mark{color:#9d8cff;font-size:10px}',
            '.lib-rating{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:7px;font-size:10px}.lib-rating .score{color:var(--gold)}.lib-rating .radar-mark{color:#9d8cff;font-size:9px}')
s=s.replace('.lib-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:9px;min-height:22px}.lib-tag{font-size:9px;color:#aeb6cf;border:1px solid rgba(162,174,219,.14);background:rgba(255,255,255,.025);padding:3px 6px;border-radius:999px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
            '.lib-tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:6px;min-height:18px}.lib-tag{font-size:8px;color:#aeb6cf;border:1px solid rgba(162,174,219,.14);background:rgba(255,255,255,.025);padding:2px 5px;border-radius:999px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}')
s=s.replace('.lib-actions{display:flex;gap:6px;margin-top:10px}.lib-actions button{flex:1;height:30px;border-radius:9px;border:1px solid var(--line);background:rgba(13,25,55,.78);color:#bfc8df;font-size:10px}.lib-actions button:hover{border-color:rgba(159,124,255,.42);color:#fff}',
            '.lib-actions{display:flex;gap:5px;margin-top:7px}.lib-actions button{flex:1;height:27px;border-radius:8px;border:1px solid var(--line);background:rgba(13,25,55,.78);color:#bfc8df;font-size:9px}.lib-actions button:hover{border-color:rgba(159,124,255,.42);color:#fff}')

# Keep 8 columns on normal desktop widths; only reduce on genuinely narrower screens.
s=s.replace('@media (max-width:1500px){.filter-grid{grid-template-columns:minmax(210px,1.4fr) repeat(4,minmax(110px,1fr));}.library-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}',
            '@media (max-width:1500px){.filter-grid{grid-template-columns:minmax(210px,1.4fr) repeat(4,minmax(110px,1fr));}}')
s=s.replace('@media (max-width:1180px){.library-head{display:block}.library-summary{margin-top:16px;min-width:0;width:100%}.library-grid{grid-template-columns:repeat(3,minmax(0,1fr))}',
            '@media (max-width:1180px){.library-head{display:block}.library-summary{margin-top:16px;min-width:0;width:100%}.library-grid{grid-template-columns:repeat(4,minmax(0,1fr))}')

# 2) Fixed pagination: 64 items = 8 rows x 8 columns. Remove selector UI and old setting.
s=re.sub(r'\s*<label class="library-page-size">每页 <select id="libPageSize"><option value="30">30</option><option value="60">60</option><option value="100">100</option></select> 部</label>', '', s, count=1)
s=s.replace("libPageSize:$('libPageSize'),", '')
s=s.replace(',libraryPageSize:30};', '};')
s=s.replace("const libraryState={view:'card',multi:false,selected:new Set(),editingId:null,page:1,pageSize:[30,60,100].includes(Number(appState.settings.libraryPageSize))?Number(appState.settings.libraryPageSize):30,exclude:{year:false,director:false,country:false,tag:false,plan:false}};",
            "const libraryState={view:'card',multi:false,selected:new Set(),editingId:null,page:1,pageSize:64,exclude:{year:false,director:false,country:false,tag:false,plan:false}};")
s=s.replace('    els.libPageSize.value=String(libraryState.pageSize);\n', '')
s=re.sub(r"\n\s*els\.libPageSize\.addEventListener\('change',\(\)=>\{.*?renderLibrary\(\)\}\);", '', s, count=1)

# Remove any old persisted page-size preference during normalization if present.
if 'delete out.libraryPageSize;' not in s:
    s=s.replace('delete out.brandLogoDataUrl;return out}', 'delete out.brandLogoDataUrl;delete out.libraryPageSize;return out}')

# Final checks.
required=[
    'grid-template-columns:repeat(8,minmax(0,1fr))',
    "pageSize:64",
]
for token in required:
    if token not in s:
        raise SystemExit(f'missing required token: {token}')
for forbidden in ['id="libPageSize"', "libPageSize:$('libPageSize')", 'els.libPageSize.addEventListener', 'libraryPageSize:30']:
    if forbidden in s:
        raise SystemExit(f'old page-size control residue: {forbidden}')

p.write_text(s,encoding='utf-8')
print('library grid changed to 8 columns and fixed 64 items/page')
