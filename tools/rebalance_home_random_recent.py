from pathlib import Path

# Trigger: rebalance the home random pick and recent watched modules.
p=Path('index.html')
s=p.read_text(encoding='utf-8')
marker='/* ===== Home random/recent rebalance ===== */'
if marker in s:
    print('already applied')
    raise SystemExit(0)

css=r'''

  /* ===== Home random/recent rebalance ===== */
  .home-top-grid{
    grid-template-columns:minmax(300px,.72fr) minmax(560px,1.48fr);
    gap:16px;
    align-items:stretch;
  }
  .home-top-grid>#watched,
  .home-top-grid>.random-panel{
    height:342px;
    min-height:342px;
    max-height:342px;
  }

  /* Recent watched becomes a compact supporting list. */
  .home-top-grid>#watched{display:flex;flex-direction:column}
  .home-top-grid>#watched .panel-head{padding:15px 15px 7px;flex:0 0 auto}
  .home-top-grid>#watched .recent-grid{
    flex:1;
    min-height:0;
    display:grid;
    grid-template-columns:1fr;
    grid-template-rows:repeat(4,minmax(0,1fr));
    gap:6px;
    padding:6px 12px 12px;
    align-content:stretch;
  }
  .home-top-grid>#watched .recent{
    grid-template-columns:42px minmax(0,1fr);
    gap:9px;
    align-items:center;
    min-height:0;
    padding:5px 8px;
    border-radius:11px;
  }
  .home-top-grid>#watched .mini-poster{
    width:42px;
    height:58px;
    border-radius:8px;
  }
  .home-top-grid>#watched .recent .t{
    font-size:11px;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  .home-top-grid>#watched .recent .d{font-size:9px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .home-top-grid>#watched .recent .r{font-size:10px;margin-top:3px}

  /* Random choice is the main feature: more room, stable box, full synopsis. */
  .home-top-grid>.random-panel{
    padding:18px 20px;
    align-self:stretch;
  }
  .home-top-grid>.random-panel>.stat-note{margin-top:2px!important}
  .home-top-grid>.random-panel .constellation{right:20px;top:14px}
  .home-top-grid>.random-panel .random-content{
    grid-template-columns:136px minmax(0,1fr);
    gap:18px;
    margin-top:12px;
    height:232px;
    min-height:232px;
    max-height:232px;
    align-items:start;
  }
  .home-top-grid>.random-panel .random-poster{
    width:136px;
    height:204px;
    min-width:136px;
    min-height:204px;
    max-width:136px;
    max-height:204px;
    align-self:start;
  }
  .home-top-grid>.random-panel .random-content>div:last-child{
    height:232px;
    min-height:232px;
    max-height:232px;
  }
  .home-top-grid>.random-panel .random-title{
    font-size:23px;
    line-height:1.22;
    min-height:28px;
    max-height:56px;
  }
  .home-top-grid>.random-panel .random-meta{
    min-height:18px;
    max-height:18px;
    line-height:18px;
    margin-top:3px;
  }
  .home-top-grid>.random-panel .random-quote{
    display:block;
    flex:1 1 auto;
    height:auto;
    min-height:0;
    max-height:none;
    margin:8px 2px 8px 0;
    padding-right:6px;
    overflow-y:auto;
    overflow-x:hidden;
    line-height:1.62;
    font-size:12px;
    -webkit-line-clamp:unset;
    -webkit-box-orient:unset;
    scrollbar-width:thin;
    scrollbar-color:rgba(159,124,255,.45) transparent;
  }
  .home-top-grid>.random-panel .random-quote::-webkit-scrollbar{width:4px}
  .home-top-grid>.random-panel .random-quote::-webkit-scrollbar-thumb{background:rgba(159,124,255,.38);border-radius:999px}
  .home-top-grid>.random-panel .random-actions{
    margin-top:auto;
    min-height:36px;
    flex:0 0 auto;
  }

  @media(max-width:1180px){
    .home-top-grid{grid-template-columns:minmax(260px,.68fr) minmax(480px,1.32fr)}
  }
  @media(max-width:980px){
    .home-top-grid{grid-template-columns:1fr}
    .home-top-grid>#watched,
    .home-top-grid>.random-panel{height:auto;min-height:0;max-height:none}
    .home-top-grid>#watched .recent-grid{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:auto;padding:8px 14px 14px}
    .home-top-grid>.random-panel .random-content{height:232px;min-height:232px;max-height:232px}
  }
  @media(max-width:680px){
    .home-top-grid>#watched .recent-grid{grid-template-columns:1fr}
    .home-top-grid>.random-panel{padding:16px}
    .home-top-grid>.random-panel .random-content{grid-template-columns:98px minmax(0,1fr);gap:12px;height:182px;min-height:182px;max-height:182px}
    .home-top-grid>.random-panel .random-poster{width:98px;height:147px;min-width:98px;min-height:147px;max-width:98px;max-height:147px}
    .home-top-grid>.random-panel .random-content>div:last-child{height:182px;min-height:182px;max-height:182px}
    .home-top-grid>.random-panel .random-title{font-size:18px;max-height:44px}
    .home-top-grid>.random-panel .random-quote{font-size:10px;line-height:1.5;margin:5px 0}
  }
'''

anchor='\n\n  /* ===== Stable random movie panel ===== */'
if anchor not in s:
    anchor='\n\n  /* ===== Settings aligned 2x2 grid ===== */'
if anchor not in s:
    raise SystemExit('CSS anchor not found')
settings_anchor='\n\n  /* ===== Settings aligned 2x2 grid ===== */'
if settings_anchor in s:
    s=s.replace(settings_anchor,css+settings_anchor,1)
else:
    s=s.replace(anchor,css+anchor,1)

for token in [marker,'grid-template-columns:minmax(300px,.72fr) minmax(560px,1.48fr)','height:342px','grid-template-rows:repeat(4,minmax(0,1fr))','overflow-y:auto']:
    if token not in s:
        raise SystemExit('missing '+token)

p.write_text(s,encoding='utf-8')
print('home random/recent layout rebalanced')
