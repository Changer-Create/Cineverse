from pathlib import Path

# Trigger: apply shared two-column alignment.
p = Path('index.html')
s = p.read_text(encoding='utf-8')

marker = '/* ===== Settings aligned 2x2 grid ===== */'
if marker in s:
    print('settings alignment already applied')
    raise SystemExit(0)

css = r'''

  /* ===== Settings aligned 2x2 grid ===== */
  .settings-layout{
    display:grid;
    grid-template-columns:minmax(0,1fr) minmax(0,1fr);
    gap:16px 20px;
    align-items:stretch;
    width:100%;
  }
  .settings-layout>.settings-stack{display:contents}
  .settings-layout>.settings-stack:first-child>.settings-card:nth-child(1){grid-column:1;grid-row:1}
  .settings-layout>.settings-stack:nth-child(2)>.settings-card:nth-child(1){grid-column:2;grid-row:1}
  .settings-layout>.settings-stack:first-child>.settings-card:nth-child(2){grid-column:1;grid-row:2}
  .settings-layout>.settings-stack:nth-child(2)>.settings-card:nth-child(2){grid-column:2;grid-row:2}
  .settings-layout>.settings-stack:nth-child(2)>.settings-card:nth-child(n+3){grid-column:1/-1}
  .settings-layout .settings-card{height:100%;display:flex;flex-direction:column;min-width:0}
  .settings-layout .settings-card-head{min-height:60px;padding:16px 18px;flex:0 0 auto}
  .settings-layout .settings-card-body{flex:1;min-height:0}
  .settings-layout .settings-card-body>.settings-actions{margin-top:auto}
  .settings-layout .profile-editor{height:100%;align-items:stretch}
  .settings-layout .profile-fields{height:100%;display:flex;flex-direction:column;gap:10px}
  .settings-layout .profile-fields>.settings-actions:last-child{margin-top:auto}
  .settings-layout .tmdb-status{min-height:46px;display:flex;align-items:center}

  @media(max-width:980px){
    .settings-layout{grid-template-columns:1fr;gap:16px}
    .settings-layout>.settings-stack{display:contents}
    .settings-layout>.settings-stack:first-child>.settings-card:nth-child(1){grid-column:1;grid-row:1}
    .settings-layout>.settings-stack:nth-child(2)>.settings-card:nth-child(1){grid-column:1;grid-row:2}
    .settings-layout>.settings-stack:first-child>.settings-card:nth-child(2){grid-column:1;grid-row:3}
    .settings-layout>.settings-stack:nth-child(2)>.settings-card:nth-child(2){grid-column:1;grid-row:4}
    .settings-layout>.settings-stack:nth-child(2)>.settings-card:nth-child(n+3){grid-column:1;grid-row:auto}
    .settings-layout .settings-card{height:auto}
  }
'''

anchor = '\n\n  /* Batch TMDb completion */'
if anchor not in s:
    raise SystemExit('settings CSS insertion anchor not found')
s = s.replace(anchor, css + anchor, 1)

for token in [
    '个人资料 · 你的影视名片',
    'TMDb · 影视资料服务',
    '外观 · 星空主题',
    '豆瓣片单 · 本地导入',
    '数据 · 导入与导出',
]:
    if token not in s:
        raise SystemExit(f'missing settings card: {token}')

p.write_text(s, encoding='utf-8')
print('settings page aligned to shared 2x2 grid')
