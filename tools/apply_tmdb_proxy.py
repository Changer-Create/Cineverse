from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

def sub1(pattern,repl,label,flags=0):
    global s
    s2,n=re.subn(pattern,repl,s,count=1,flags=flags)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 match, got {n}')
    s=s2

# 1) Settings card: remove visible credential input and present managed proxy service.
sub1(
    r'''<section class="settings-card">\s*<div class="settings-card-head"><h3>TMDb · 影视资料补全</h3></div>\s*<div class="settings-card-body">\s*<div class="setting-row"><div class="setting-copy"><b>TMDb API Key / Read Access Token</b><span>.*?</span></div><div class="setting-control"><input id="settingsTmdbKey"[^>]*></div></div>\s*<div class="setting-row"><div class="setting-copy"><b>资料语言</b></div><div class="setting-control"><select id="settingsTmdbLanguage">(.*?)</select></div></div>\s*<div id="settingsTmdbStatus" class="tmdb-status">.*?</div>\s*<div class="settings-actions"><button class="primary" id="settingsSaveTmdb"[^>]*>.*?</button><button id="settingsTestTmdb"[^>]*>测试连接</button><button id="settingsSelfTestTmdb"[^>]*>运行完整自检</button></div>\s*</div>\s*</section>''',
    r'''<section class="settings-card">
              <div class="settings-card-head"><h3>TMDb · 影视资料服务</h3></div>
              <div class="settings-card-body">
                <input id="settingsTmdbKey" type="hidden" value="proxy">
                <button id="settingsSaveTmdb" type="button" hidden>保存</button>
                <div class="setting-row"><div class="setting-copy"><b>测试版资料服务</b><span>已通过服务端代理连接 TMDb，无需在浏览器填写 API Key。</span></div><div class="setting-control"><span class="douban-chip">● 已配置</span></div></div>
                <div class="setting-row"><div class="setting-copy"><b>资料语言</b></div><div class="setting-control"><select id="settingsTmdbLanguage">\1</select></div></div>
                <div id="settingsTmdbStatus" class="tmdb-status">等待测试服务状态。</div>
                <div class="settings-actions"><button id="settingsTestTmdb" type="button">测试连接</button><button id="settingsSelfTestTmdb" type="button">运行完整自检</button></div>
              </div>
            </section>''',
    'settings tmdb card',re.S)

# 2) Replace direct credential and direct TMDb fetch with Supabase proxy.
sub1(
    r'''  function tmdbCredential\(\)\{.*?\}\n  async function tmdbFetch\(path,params=\{\}\)\{.*?\}\n  function tmdbImage''',
    '''  const TMDB_PROXY_URL='https://bjjralybdcuczwllxbvo.supabase.co/functions/v1/tmdb-proxy';\n  function tmdbCredential(){return 'proxy'}\n  async function tmdbFetch(path,params={}){\n    const res=await fetch(TMDB_PROXY_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path,params})});\n    let body=null;try{body=await res.json()}catch{}\n    if(!res.ok)throw new Error(body?.message||body?.error||`TMDb 代理 HTTP ${res.status}`);\n    return body;\n  }\n  function tmdbImage''',
    'tmdb fetch',re.S)

# 3) Search modal should no longer read browser credential input.
s=s.replace("appState.settings.tmdbKey=els.settingsTmdbKey?.value.trim()||appState.settings.tmdbKey;appState.settings.tmdbLanguage=els.settingsTmdbLanguage?.value||appState.settings.tmdbLanguage||'zh-CN';","appState.settings.tmdbLanguage=els.settingsTmdbLanguage?.value||appState.settings.tmdbLanguage||'zh-CN';")

# 4) Settings rendering keeps hidden compatibility field as proxy sentinel.
s=s.replace("els.settingsTmdbKey.value=st.tmdbKey||'';els.settingsTmdbLanguage.value=st.tmdbLanguage||'zh-CN';","if(els.settingsTmdbKey)els.settingsTmdbKey.value='proxy';els.settingsTmdbLanguage.value=st.tmdbLanguage||'zh-CN';")

# 5) Douban auto-completion no longer depends on local key existence.
s=s.replace("if(appState.settings.doubanAutoTmdb&&String(appState.settings.tmdbKey||'').trim()){setTimeout(()=>runBatchTmdbCompletion(true),500)}","if(appState.settings.doubanAutoTmdb){setTimeout(()=>runBatchTmdbCompletion(true),500)}")

# 6) Test connection function no longer requires local credential.
sub1(
    r'''  async function testTmdbConnection\(\)\{.*?\}\n\n  async function runTmdbSelfTest\(\)\{''',
    '''  async function testTmdbConnection(){appState.settings.tmdbLanguage=els.settingsTmdbLanguage.value||'zh-CN';els.settingsTmdbStatus.className='tmdb-status';els.settingsTmdbStatus.textContent='正在连接 TMDb 资料服务…';try{await tmdbFetch('/configuration');els.settingsTmdbStatus.className='tmdb-status ok';els.settingsTmdbStatus.textContent='连接成功。TMDb 资料服务已可直接用于搜索、批量补全和电影雷达。'}catch(err){els.settingsTmdbStatus.className='tmdb-status bad';els.settingsTmdbStatus.textContent=`连接失败：${err.message||'代理服务异常'}。`}}\n\n  async function runTmdbSelfTest(){''',
    'test connection',re.S)

# 7) Remove credential precheck at start of self-test.
s=s.replace("    const key=els.settingsTmdbKey.value.trim();\n    if(!key){els.settingsTmdbStatus.className='tmdb-status bad';els.settingsTmdbStatus.textContent='自检未开始：请先输入 TMDb API Key 或 Read Access Token。';return}\n    appState.settings.tmdbKey=key;appState.settings.tmdbLanguage=els.settingsTmdbLanguage.value||'zh-CN';","    appState.settings.tmdbLanguage=els.settingsTmdbLanguage.value||'zh-CN';")

# 8) Hide legacy save action but preserve compatibility listener safely.
s=s.replace("els.settingsSaveTmdb.addEventListener('click',()=>{appState.settings.tmdbKey=els.settingsTmdbKey.value.trim();appState.settings.tmdbLanguage=els.settingsTmdbLanguage.value;save();toastMsg('TMDb 设置已保存到本地，可在添加影视时直接搜索')});els.settingsTestTmdb.addEventListener('click',testTmdbConnection);","if(els.settingsSaveTmdb)els.settingsSaveTmdb.addEventListener('click',()=>{});els.settingsTestTmdb.addEventListener('click',testTmdbConnection);")

p.write_text(s,encoding='utf-8')
print('tmdb proxy frontend applied')
