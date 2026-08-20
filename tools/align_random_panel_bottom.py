from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')
marker='/* ===== Random panel bottom alignment ===== */'
if marker in s:
    print('already applied')
    raise SystemExit(0)

css=r'''

  /* ===== Random panel bottom alignment ===== */
  .home-top-grid>.random-panel .random-content{
    align-items:stretch;
  }
  .home-top-grid>.random-panel .random-poster{
    align-self:end;
  }
  .home-top-grid>.random-panel .random-content>div:last-child{
    display:flex;
    flex-direction:column;
  }
  .home-top-grid>.random-panel .random-actions{
    margin-top:auto;
    justify-content:center;
    align-items:flex-end;
    width:100%;
  }
'''

anchor='\n\n  /* ===== Settings aligned 2x2 grid ===== */'
if anchor not in s:
    raise SystemExit('CSS anchor not found')
s=s.replace(anchor,css+anchor,1)

for token in [marker,'align-items:stretch','align-self:end','justify-content:center']:
    if token not in s:
        raise SystemExit('missing '+token)

p.write_text(s,encoding='utf-8')
print('random panel bottom alignment applied')
