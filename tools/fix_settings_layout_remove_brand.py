from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

# 1) Force a clean two-column settings layout on desktop.
s=s.replace(
    '.settings-layout{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;align-items:start}',
    '.settings-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px;align-items:start;width:100%}'
)
# Make sure no older three-column override survives.
s=re.sub(r'\.settings-layout\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\);([^}]*)\}',
         r'.settings-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);\1}',s)
# Keep responsive single-column behavior.
s=s.replace('@media(max-width:1180px){.settings-layout{grid-template-columns:1fr}',
            '@media(max-width:980px){.settings-layout{grid-template-columns:1fr}')

# 2) Remove the entire collection-brand customization card.
pat=r'\n\s*<section class="settings-card">\s*<div class="settings-card-head"><h3>收藏夹品牌 · 左侧导航</h3></div>.*?</section>\s*\n'
s,n=re.subn(pat,'\n',s,count=1,flags=re.S)
if n!=1:
    raise SystemExit(f'brand card removal failed: {n}')

# Remove now-unused brand settings preview CSS.
s=re.sub(r'\s*\.brand-setting-preview\{[^}]*\}\.brand-setting-preview \.brand-mark\{[^}]*\}\.brand-setting-preview b\{[^}]*\}\.brand-setting-preview span\{[^}]*\}', '', s, count=1)

# 3) Brand is now fixed, not user-configurable.
s=s.replace("brandTitle:'影视收藏夹',brandSubtitle:'你的光影宇宙',brandLogoDataUrl:'',",'')

# normalizeSettings should discard old saved/imported brand overrides.
old="function normalizeSettings(v){const out={...DEFAULT_SETTINGS,...(v||{})};delete out.tmdbKey;return out}"
new="function normalizeSettings(v){const out={...DEFAULT_SETTINGS,...(v||{})};delete out.tmdbKey;delete out.brandTitle;delete out.brandSubtitle;delete out.brandLogoDataUrl;return out}"
if old in s:
    s=s.replace(old,new)
elif 'function normalizeSettings(v){return {...DEFAULT_SETTINGS,...(v||{})}}' in s:
    s=s.replace('function normalizeSettings(v){return {...DEFAULT_SETTINGS,...(v||{})}}',new)
else:
    # tolerate already-custom normalization while ensuring the fields are removed
    s=re.sub(r'function normalizeSettings\(v\)\{(.*?)return out\}',
             lambda m: 'function normalizeSettings(v){'+m.group(1)+"delete out.brandTitle;delete out.brandSubtitle;delete out.brandLogoDataUrl;return out}",
             s,count=1,flags=re.S)

# Remove brand-setting DOM refs, keep fixed sidebar refs.
for frag in [
    "settingsBrandTitle:$('settingsBrandTitle'),",
    "settingsBrandSubtitle:$('settingsBrandSubtitle'),",
    "settingsBrandLogoFile:$('settingsBrandLogoFile'),",
    "settingsBrandLogoClear:$('settingsBrandLogoClear'),",
    "settingsBrandLogoPreview:$('settingsBrandLogoPreview'),",
    "settingsBrandPreviewTitle:$('settingsBrandPreviewTitle'),",
    "settingsBrandPreviewSubtitle:$('settingsBrandPreviewSubtitle'),",
    "settingsSaveBrand:$('settingsSaveBrand'),",
]:
    s=s.replace(frag,'')

# Replace configurable brand application with a fixed brand.
s,n=re.subn(
    r'  function applyBrand\(\)\{.*?\n  \}\n  function updateBrandSettingsUI\(\)\{.*?\}\n  function saveBrandFromControls\(\)\{.*?\}\n',
    "  function applyBrand(){\n    if(els.sidebarBrandTitle)els.sidebarBrandTitle.textContent='影视收藏夹';\n    if(els.sidebarBrandSubtitle){els.sidebarBrandSubtitle.textContent='你的光影宇宙';els.sidebarBrandSubtitle.classList.remove('hidden')}\n    if(els.sidebarBrandMark){els.sidebarBrandMark.classList.remove('has-image');els.sidebarBrandMark.style.backgroundImage='';els.sidebarBrandMark.textContent='◉'}\n    document.title='影视收藏夹 V2';\n  }\n",
    s,count=1,flags=re.S)
if n!=1:
    raise SystemExit(f'brand JS function cleanup failed: {n}')

# renderSettings no longer needs brand-settings UI sync.
s=s.replace('updateProfileSettingsUI();updateBrandSettingsUI();','updateProfileSettingsUI();')
s=s.replace('updateBrandSettingsUI();','')

# Image cropper is profile-only now.
s=s.replace("imageCropState.outputSize=target==='brand'?256:320;",'imageCropState.outputSize=320;')
s=s.replace("els.imageCropTitle.textContent=target==='brand'?'裁切品牌图标':'裁切个人头像';","els.imageCropTitle.textContent='裁切个人头像';")
# Replace the brand/profile branch in crop apply with profile only.
s=re.sub(
    r"if\(s\.target==='brand'\)\{appState\.settings=normalizeSettings\(\{\.\.\.appState\.settings,brandLogoDataUrl:data\}\);save\(\);applyBrand\(\);.*?\}else\{appState\.settings=normalizeSettings\(\{\.\.\.appState\.settings,profileAvatarDataUrl:data\}\);save\(\);applyProfile\(\);updateProfileSettingsUI\(\);toastMsg\('头像已裁切并保存 ✦'\)\}",
    "appState.settings=normalizeSettings({...appState.settings,profileAvatarDataUrl:data});save();applyProfile();updateProfileSettingsUI();toastMsg('头像已裁切并保存 ✦')",
    s,count=1,flags=re.S)

# Remove brand listeners.
s=re.sub(r"\n\s*if\(els\.settingsSaveBrand\).*?toastMsg\('已恢复默认品牌图标'\)\}\);",'',s,count=1,flags=re.S)

# Appearance reset should not preserve removed brand settings.
s=s.replace('brandTitle:appState.settings.brandTitle,brandSubtitle:appState.settings.brandSubtitle,brandLogoDataUrl:appState.settings.brandLogoDataUrl,','')

# Final safety checks.
for forbidden in [
    '收藏夹品牌 · 左侧导航','settingsBrandTitle','settingsBrandSubtitle','settingsBrandLogoFile',
    'settingsBrandLogoClear','settingsBrandLogoPreview','settingsSaveBrand','updateBrandSettingsUI','saveBrandFromControls'
]:
    if forbidden in s:
        raise SystemExit(f'brand customization residue: {forbidden}')
if 'grid-template-columns:minmax(0,1fr) minmax(0,1fr)' not in s:
    raise SystemExit('two-column settings layout missing')
if "sidebarBrandTitle.textContent='影视收藏夹'" not in s:
    raise SystemExit('fixed brand application missing')

p.write_text(s,encoding='utf-8')
print('settings layout cleanup applied')
