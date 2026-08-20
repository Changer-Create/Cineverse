from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

# The frontend already routes TMDb through Supabase; this pass removes legacy credential scaffolding.
s=s.replace('                <input id="settingsTmdbKey" type="hidden" value="proxy">\n','')
s=s.replace('                <button id="settingsSaveTmdb" type="button" hidden>保存</button>\n','')
s=s.replace("settingsTmdbKey:$('settingsTmdbKey'),",'')
s=s.replace("settingsSaveTmdb:$('settingsSaveTmdb'),",'')
s=s.replace("if(els.settingsTmdbKey)els.settingsTmdbKey.value='proxy';",'')
s=s.replace("if(els.settingsSaveTmdb)els.settingsSaveTmdb.addEventListener('click',()=>{});",'')

# Drop any previously stored/imported browser credential from normalized settings.
s=s.replace("wallpaperDataUrl:'',tmdbKey:'',tmdbLanguage:'zh-CN'", "wallpaperDataUrl:'',tmdbLanguage:'zh-CN'")
s=s.replace("function normalizeSettings(v){return {...DEFAULT_SETTINGS,...(v||{})}}",
            "function normalizeSettings(v){const out={...DEFAULT_SETTINGS,...(v||{})};delete out.tmdbKey;return out}")
s=s.replace("brandLogoDataUrl:appState.settings.brandLogoDataUrl,tmdbKey:appState.settings.tmdbKey,tmdbLanguage:appState.settings.tmdbLanguage,",
            "brandLogoDataUrl:appState.settings.brandLogoDataUrl,tmdbLanguage:appState.settings.tmdbLanguage,")
s=s.replace("safeState.settings=normalizeSettings({...safeState.settings,tmdbKey:''});",
            "safeState.settings=normalizeSettings(safeState.settings);")

# Persist TMDb language automatically now that there is no separate save button.
needle="els.settingsTestTmdb.addEventListener('click',testTmdbConnection);els.settingsSelfTestTmdb.addEventListener('click',runTmdbSelfTest);"
if needle in s and "settingsTmdbLanguage.addEventListener" not in s:
    s=s.replace(needle,"els.settingsTmdbLanguage.addEventListener('change',()=>{appState.settings.tmdbLanguage=els.settingsTmdbLanguage.value||'zh-CN';save()});"+needle)

# Normalize wording for the live proxy service.
s=s.replace('代理服务已配置。可直接搜索、批量补全和更新电影雷达。','代理服务已配置。可直接搜索、批量补全和更新电影雷达。')

for forbidden in ['id="settingsTmdbKey"','settingsTmdbKey.value','settingsSaveTmdb:', 'api.themoviedb.org/3']:
    if forbidden in s:
        raise SystemExit(f'forbidden residue: {forbidden}')
if 'functions/v1/tmdb-proxy' not in s:
    raise SystemExit('proxy URL missing')

p.write_text(s,encoding='utf-8')
print('TMDb proxy cleanup applied')
