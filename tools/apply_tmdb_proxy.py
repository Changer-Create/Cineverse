from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

def sub_once(pattern, repl, label, flags=0):
    global s
    s2,n=re.subn(pattern,repl,s,count=1,flags=flags)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 replacement, got {n}')
    s=s2

# Settings card: public test service, no credential input.
sub_once(
    r'<section class="settings-card">\s*<div class="settings-card-head"><h3>TMDb · 影视资料补全</h3></div>.*?</section>',
    '''<section class="settings-card">
              <div class="settings-card-head"><h3>TMDb · 影视资料服务</h3></div>
              <div class="settings-card-body">
                <div class="setting-row"><div class="setting-copy"><b>TMDb 资料服务</b><span>当前测试版已通过安全代理连接 TMDb，朋友无需填写 API Key。</span></div><div class="setting-control"><span class="douban-chip">● 已配置</span></div></div>
                <div class="setting-row"><div class="setting-copy"><b>资料语言</b></div><div class="setting-control"><select id="settingsTmdbLanguage"><option value="zh-CN">简体中文</option><option value="en-US">English</option><option value="ja-JP">日本語</option><option value="fr-FR">Français</option></select></div></div>
                <div id="settingsTmdbStatus" class="tmdb-status ok">代理服务已配置。可直接搜索、批量补全和更新电影雷达。</div>
                <div class="settings-actions"><button id="settingsTestTmdb" type="button">测试连接</button><button id="settingsSelfTestTmdb" type="button">运行完整自检</button></div>
              </div>
            </section>''',
    'TMDb settings card', re.S)

# Remove stale DOM refs for the old credential controls.
s=s.replace("settingsTmdbKey:$('settingsTmdbKey'),",'')
s=s.replace("settingsSaveTmdb:$('settingsSaveTmdb'),",'')

# Never retain/import the old browser credential.
s=s.replace("wallpaperDataUrl:'',tmdbKey:'',tmdbLanguage:'zh-CN'", "wallpaperDataUrl:'',tmdbLanguage:'zh-CN'")
sub_once(r'function normalizeSettings\(v\)\{return \{\.\.\.DEFAULT_SETTINGS,\.\.\.\(v\|\|\{\}\)\}\}',
         "function normalizeSettings(v){const out={...DEFAULT_SETTINGS,...(v||{})};delete out.tmdbKey;return out}",
         'normalizeSettings')
s=s.replace('// Public test build: TMDb credentials are never hard-coded; each browser stores its own key locally.',
            '// Public test build: TMDb requests go through a Supabase Edge Function; no client credential is stored.')

# Replace direct TMDb access with the Supabase proxy.
sub_once(
    r"  function tmdbCredential\(\)\{.*?\}\n  async function tmdbFetch\(path,params=\{\}\)\{.*?\}\n  function tmdbImage",
    '''  const TMDB_PROXY_URL='https://bjjralybdcuczwllxbvo.supabase.co/functions/v1/tmdb-proxy';
  function tmdbCredential(){return TMDB_PROXY_URL}
  async function tmdbFetch(path,params={}){const res=await fetch(TMDB_PROXY_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path,params})});let body=null;try{body=await res.json()}catch{}if(!res.ok)throw new Error(body?.message||body?.status_message||body?.error||`TMDb Proxy HTTP ${res.status}`);return body}
  function tmdbImage''',
    'tmdb fetch', re.S)

# Search should only read language, never a key field.
s=s.replace("appState.settings.tmdbKey=els.settingsTmdbKey?.value.trim()||appState.settings.tmdbKey;appState.settings.tmdbLanguage=els.settingsTmdbLanguage?.value||appState.settings.tmdbLanguage||'zh-CN';",
            "appState.settings.tmdbLanguage=els.settingsTmdbLanguage?.value||appState.settings.tmdbLanguage||'zh-CN';")

# Settings rendering no longer references the removed input.
s=s.replace("els.settingsTmdbKey.value=st.tmdbKey||'';",'')

# Douban auto-completion should run whenever enabled; proxy provides the credential.
s=s.replace("if(appState.settings.doubanAutoTmdb&&String(appState.settings.tmdbKey||'').trim()){setTimeout(()=>runBatchTmdbCompletion(true),500)}",
            "if(appState.settings.doubanAutoTmdb){setTimeout(()=>runBatchTmdbCompletion(true),500)}")

# Connection test: no key required.
sub_once(
    r"  async function testTmdbConnection\(\)\{.*?\}\n\n  async function runTmdbSelfTest\(\)\{\s*const key=els\.settingsTmdbKey\.value\.trim\(\);\s*if\(!key\)\{.*?\}\s*appState\.settings\.tmdbKey=key;appState\.settings\.tmdbLanguage=els\.settingsTmdbLanguage\.value\|\|'zh-CN';",
    '''  async function testTmdbConnection(){appState.settings.tmdbLanguage=els.settingsTmdbLanguage.value||'zh-CN';save();els.settingsTmdbStatus.className='tmdb-status';els.settingsTmdbStatus.textContent='正在通过安全代理连接 TMDb…';try{await tmdbFetch('/configuration');els.settingsTmdbStatus.className='tmdb-status ok';els.settingsTmdbStatus.textContent='连接成功。当前测试版可直接搜索、批量补全并更新电影雷达。'}catch(err){els.settingsTmdbStatus.className='tmdb-status bad';els.settingsTmdbStatus.textContent=`连接失败：${err.message||'代理或 TMDb 服务异常'}。`}}

  async function runTmdbSelfTest(){
    appState.settings.tmdbLanguage=els.settingsTmdbLanguage.value||'zh-CN';save();''',
    'connection test/selftest header', re.S)

# Remove dead save-key listener and persist language immediately.
s=s.replace("if(els.settingsSaveTmdb)els.settingsSaveTmdb.addEventListener('click',()=>{});els.settingsTestTmdb.addEventListener('click',testTmdbConnection);els.settingsSelfTestTmdb.addEventListener('click',runTmdbSelfTest);",
            "els.settingsTmdbLanguage.addEventListener('change',()=>{appState.settings.tmdbLanguage=els.settingsTmdbLanguage.value||'zh-CN';save()});els.settingsTestTmdb.addEventListener('click',testTmdbConnection);els.settingsSelfTestTmdb.addEventListener('click',runTmdbSelfTest);")

# Appearance reset should not carry obsolete credential data forward.
s=s.replace("brandLogoDataUrl:appState.settings.brandLogoDataUrl,tmdbKey:appState.settings.tmdbKey,tmdbLanguage:appState.settings.tmdbLanguage,",
            "brandLogoDataUrl:appState.settings.brandLogoDataUrl,tmdbLanguage:appState.settings.tmdbLanguage,")

# Backup remains explicitly credential-free but no longer needs to synthesize tmdbKey.
s=s.replace("safeState.settings=normalizeSettings({...safeState.settings,tmdbKey:''});", "safeState.settings=normalizeSettings(safeState.settings);")

# Sanity checks.
for forbidden in ['TMDb API Key / Read Access Token','id="settingsTmdbKey"','settingsTmdbKey.value','api.themoviedb.org/3']:
    if forbidden in s:
        raise SystemExit(f'forbidden residue: {forbidden}')
if 'TMDB_PROXY_URL' not in s or 'functions/v1/tmdb-proxy' not in s:
    raise SystemExit('proxy URL missing')

p.write_text(s,encoding='utf-8')
print('TMDb proxy migration applied')
