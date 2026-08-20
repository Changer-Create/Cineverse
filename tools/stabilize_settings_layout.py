from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')
marker = '/* ===== Stable settings named grid ===== */'
if marker in s:
    print('stable settings layout already applied')
    raise SystemExit(0)

cards = {
    '个人资料 · 你的影视名片': 'settings-card-profile',
    'TMDb · 影视资料服务': 'settings-card-tmdb',
    '外观 · 星空主题': 'settings-card-appearance',
    '豆瓣片单 · 本地导入': 'settings-card-douban',
    '数据 · 导入与导出': 'settings-card-data',
}

for title, cls in cards.items():
    old = f'<section class="settings-card">\n              <div class="settings-card-head"><h3>{title}</h3>'
    new = f'<section class="settings-card {cls}">\n              <div class="settings-card-head"><h3>{title}</h3>'
    if old not in s:
        raise SystemExit(f'card anchor not found: {title}')
    s = s.replace(old, new, 1)

css = r'''

  /* ===== Stable settings named grid ===== */
  .settings-layout{
    display:grid!important;
    grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
    grid-template-areas:
      "profile tmdb"
      "appearance douban"
      "data data"!important;
    gap:18px 20px!important;
    align-items:stretch!important;
    width:100%;
  }
  .settings-layout>.settings-stack{display:contents!important}
  .settings-card-profile{grid-area:profile!important}
  .settings-card-tmdb{grid-area:tmdb!important}
  .settings-card-appearance{grid-area:appearance!important}
  .settings-card-douban{grid-area:douban!important}
  .settings-card-data{grid-area:data!important}
  .settings-layout .settings-card{
    min-width:0;
    height:100%;
    display:flex;
    flex-direction:column;
  }
  .settings-layout .settings-card-head{
    min-height:58px;
    flex:0 0 auto;
  }
  .settings-layout .settings-card-body{
    flex:1 1 auto;
    min-height:0;
  }
  .settings-card-profile .profile-fields,
  .settings-card-tmdb .settings-card-body{
    height:100%;
  }
  .settings-card-profile .profile-fields{
    display:flex;
    flex-direction:column;
  }
  .settings-card-profile .profile-fields>.settings-actions:last-child,
  .settings-card-tmdb .settings-card-body>.settings-actions:last-child{
    margin-top:auto;
  }

  @media(max-width:980px){
    .settings-layout{
      grid-template-columns:1fr!important;
      grid-template-areas:
        "profile"
        "tmdb"
        "appearance"
        "douban"
        "data"!important;
      gap:16px!important;
    }
    .settings-layout .settings-card{height:auto!important}
  }
'''

# Put the final layout override at the end of the stylesheet so later page work cannot
# accidentally outrank the old nth-child placement rules.
if '</style>' not in s:
    raise SystemExit('style closing tag not found')
s = s.replace('</style>', css + '\n</style>', 1)

for token in [marker, 'settings-card-profile', 'settings-card-tmdb', 'settings-card-appearance', 'settings-card-douban', 'settings-card-data', '"profile tmdb"', '"appearance douban"', '"data data"']:
    if token not in s:
        raise SystemExit('missing token: ' + token)

p.write_text(s, encoding='utf-8')
print('stable named settings grid applied')
