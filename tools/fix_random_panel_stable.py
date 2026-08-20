from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')
marker='/* ===== Stable random movie panel ===== */'
if marker in s:
    print('already applied')
    raise SystemExit(0)

css=r'''

  /* ===== Stable random movie panel ===== */
  .home-top-grid>.random-panel{
    height:286px;
    min-height:286px;
    max-height:286px;
    align-self:start;
  }
  .random-content{
    grid-template-columns:118px minmax(0,1fr);
    gap:16px;
    margin-top:10px;
    align-items:start;
    height:177px;
    min-height:177px;
    max-height:177px;
  }
  .random-poster{
    width:118px;
    height:177px;
    min-width:118px;
    min-height:177px;
    max-width:118px;
    max-height:177px;
    align-self:start;
  }
  .random-poster img{
    width:100%;
    height:100%;
    object-fit:cover;
    object-position:center;
  }
  .random-content>div:last-child{
    height:177px;
    min-height:177px;
    max-height:177px;
    min-width:0;
    display:flex;
    flex-direction:column;
    align-items:stretch;
  }
  .random-title{
    line-height:1.25;
    min-height:28px;
    max-height:55px;
    overflow:hidden;
    display:-webkit-box;
    -webkit-box-orient:vertical;
    -webkit-line-clamp:2;
  }
  .random-meta{
    min-height:18px;
    max-height:18px;
    line-height:18px;
    margin-top:4px;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  .random-quote{
    margin:8px 0 8px;
    line-height:1.65;
    height:59px;
    min-height:59px;
    max-height:59px;
    overflow:hidden;
    display:-webkit-box;
    -webkit-box-orient:vertical;
    -webkit-line-clamp:3;
  }
  .random-actions{
    margin-top:auto;
    min-height:36px;
    align-items:flex-end;
  }
  @media(max-width:680px){
    .home-top-grid>.random-panel{height:272px;min-height:272px;max-height:272px}
    .random-content{grid-template-columns:94px minmax(0,1fr);height:141px;min-height:141px;max-height:141px}
    .random-poster{width:94px;height:141px;min-width:94px;min-height:141px;max-width:94px;max-height:141px}
    .random-content>div:last-child{height:141px;min-height:141px;max-height:141px}
    .random-quote{height:39px;min-height:39px;max-height:39px;-webkit-line-clamp:2;margin:6px 0}
  }
'''

anchor='\n\n  /* ===== Settings aligned 2x2 grid ===== */'
if anchor not in s:
    anchor='\n\n  /* Batch TMDb completion */'
if anchor not in s:
    raise SystemExit('CSS anchor not found')
s=s.replace(anchor,css+anchor,1)

for token in [marker,'height:286px','object-fit:cover','-webkit-line-clamp:3','align-items:start']:
    if token not in s:
        raise SystemExit('missing '+token)

p.write_text(s,encoding='utf-8')
print('stable random panel applied')
