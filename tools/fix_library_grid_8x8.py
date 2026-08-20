from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

# 1) 影视库卡片视图：桌面端固定 6 列，适度收紧卡片。
s=s.replace('.library-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:13px}',
            '.library-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:11px}')
s=s.replace('.library-grid{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:10px}',
            '.library-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:11px}')

s=s.replace('.lib-body{padding:12px 13px 13px}.lib-title{font-size:14px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lib-meta{font-size:10px;color:#8791ad;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.lib-body{padding:10px 11px 11px}.lib-title{font-size:13px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lib-meta{font-size:10px;color:#8791ad;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}')
s=s.replace('.lib-body{padding:9px 10px 10px}.lib-title{font-size:12px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lib-meta{font-size:9px;color:#8791ad;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.lib-body{padding:10px 11px 11px}.lib-title{font-size:13px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lib-meta{font-size:10px;color:#8791ad;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}')

# 宽屏维持 6 列；较窄屏再降列数。
s=s.replace('@media (max-width:1500px){.filter-grid{grid-template-columns:minmax(210px,1.4fr) repeat(4,minmax(110px,1fr));}.library-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}',
            '@media (max-width:1500px){.filter-grid{grid-template-columns:minmax(210px,1.4fr) repeat(4,minmax(110px,1fr));}}')
s=s.replace('@media (max-width:1180px){.library-head{display:block}.library-summary{margin-top:16px;min-width:0;width:100%}.library-grid{grid-template-columns:repeat(3,minmax(0,1fr))}',
            '@media (max-width:1180px){.library-head{display:block}.library-summary{margin-top:16px;min-width:0;width:100%}.library-grid{grid-template-columns:repeat(4,minmax(0,1fr))}')

# 2) 每页固定 36 部（6 列 x 6 行），彻底移除“每页数量”选择器。
s=re.sub(r'\s*<label class="library-page-size">每页 <select id="libPageSize">.*?</select> 部</label>', '', s, count=1, flags=re.S)
s=s.replace("libPageSize:$('libPageSize'),", '')
s=s.replace(',libraryPageSize:30};', '};')
s=s.replace(',libraryPageSize:64};', '};')
s=s.replace("const libraryState={view:'card',multi:false,selected:new Set(),editingId:null,page:1,pageSize:[30,60,100].includes(Number(appState.settings.libraryPageSize))?Number(appState.settings.libraryPageSize):30,exclude:{year:false,director:false,country:false,tag:false,plan:false}};",
            "const libraryState={view:'card',multi:false,selected:new Set(),editingId:null,page:1,pageSize:36,exclude:{year:false,director:false,country:false,tag:false,plan:false}};")
s=s.replace("const libraryState={view:'card',multi:false,selected:new Set(),editingId:null,page:1,pageSize:64,exclude:{year:false,director:false,country:false,tag:false,plan:false}};",
            "const libraryState={view:'card',multi:false,selected:new Set(),editingId:null,page:1,pageSize:36,exclude:{year:false,director:false,country:false,tag:false,plan:false}};")
s=s.replace('    els.libPageSize.value=String(libraryState.pageSize);\n', '')
s=re.sub(r"\n\s*els\.libPageSize\.addEventListener\('change',\(\)=>\{.*?renderLibrary\(\)\}\);", '', s, count=1)

# 旧浏览器中的分页偏好不再使用。
if 'function normalizeSettings(v){' in s and 'delete out.libraryPageSize;' not in s:
    s=s.replace('return out}', 'delete out.libraryPageSize;return out}', 1)

# 校验。
required=['grid-template-columns:repeat(6,minmax(0,1fr))', 'pageSize:36']
for token in required:
    if token not in s:
        raise SystemExit(f'missing required token: {token}')
for forbidden in ['id="libPageSize"', "libPageSize:$('libPageSize')", 'els.libPageSize.addEventListener', 'pageSize:64']:
    if forbidden in s:
        raise SystemExit(f'old page-size residue: {forbidden}')

p.write_text(s,encoding='utf-8')
print('library grid changed to 6 columns and fixed 36 items/page')
