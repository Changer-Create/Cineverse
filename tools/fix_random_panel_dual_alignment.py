from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')
marker='/* ===== Random panel dual-edge alignment ===== */'
if marker in s:
    print('already applied')
    raise SystemExit(0)

css=r'''

  /* ===== Random panel dual-edge alignment ===== */
  .home-top-grid>.random-panel .random-content{
    align-items:stretch;
  }
  .home-top-grid>.random-panel .random-poster{
    align-self:stretch;
    height:100%;
    min-height:100%;
    max-height:100%;
  }
  .home-top-grid>.random-panel .random-poster img{
    width:100%;
    height:100%;
    object-fit:cover;
    object-position:center;
  }
  .home-top-grid>.random-panel .random-content>div:last-child{
    height:100%;
    min-height:100%;
    max-height:100%;
    display:flex;
    flex-direction:column;
  }
  .home-top-grid>.random-panel .random-actions{
    margin-top:auto;
    justify-content:center;
    align-items:flex-end;
    width:100%;
    flex:0 0 auto;
  }

  @media(max-width:680px){
    .home-top-grid>.random-panel .random-poster{
      height:100%;
      min-height:100%;
      max-height:100%;
    }
  }
'''

anchor='\n\n  /* ===== Settings aligned 2x2 grid ===== */'
if anchor not in s:
    raise SystemExit('CSS anchor not found')
s=s.replace(anchor,css+anchor,1)

for token in [marker,'align-self:stretch','height:100%','justify-content:center','object-fit:cover']:
    if token not in s:
        raise SystemExit('missing '+token)

p.write_text(s,encoding='utf-8')
print('random panel dual-edge alignment applied')
