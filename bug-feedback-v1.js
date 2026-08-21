(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const TABLE = 'bug_reports';
  const BUCKET = 'bug-report-screenshots';
  const BUILD = 'feedback-v1-20260822-0242';
  const LAST_SUBMIT_KEY = 'cineverse-feedback-last-submit-v1';
  const SUCCESS_TEXT = '已收到反馈，谢谢你帮助光影宇宙变得更好。';
  const MAX_SCREENSHOT = 4 * 1024 * 1024;
  const ALLOWED_SCREENSHOT_TYPES = new Set(['image/png','image/jpeg','image/webp']);
  const $ = id => document.getElementById(id);

  function toast(message, duration=4200) {
    const el = $('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), duration);
  }

  function friendlyError(error) {
    const text = String(error?.message || error || '提交失败');
    if (/Failed to fetch|NetworkError|Load failed/i.test(text)) return '网络连接失败，请稍后再试';
    if (/row-level security|permission denied|42501/i.test(text)) return '反馈服务权限校验失败，请稍后再试';
    if (/payload too large|maximum allowed size|exceeded/i.test(text)) return '截图文件过大，请选择 4MB 以内的图片';
    return text;
  }

  function injectStyles() {
    if ($('cineverseFeedbackStyle')) return;
    const style = document.createElement('style');
    style.id = 'cineverseFeedbackStyle';
    style.textContent = `
      #bugFeedbackBtn{font-size:15px}
      #cineverseFeedbackDialog{width:min(620px,calc(100vw - 28px));max-height:min(86vh,820px);border:1px solid rgba(161,179,255,.22);border-radius:22px;background:linear-gradient(155deg,rgba(11,23,52,.99),rgba(6,14,33,.995));color:#f6f3ff;padding:0;box-shadow:0 32px 90px rgba(0,0,0,.56);overflow:hidden}
      #cineverseFeedbackDialog::backdrop{background:rgba(2,6,17,.72);backdrop-filter:blur(7px)}
      .cv-feedback-head{padding:23px 24px 16px;border-bottom:1px solid rgba(161,179,255,.12);display:flex;justify-content:space-between;gap:16px}
      .cv-feedback-kicker{font-size:10px;color:#8995b4;letter-spacing:.15em}.cv-feedback-head h3{margin:7px 0 4px;font-size:22px}.cv-feedback-head p{margin:0;color:#929db9;font-size:12px;line-height:1.65}
      .cv-feedback-close{width:34px;height:34px;flex:0 0 auto;border-radius:10px;border:1px solid rgba(161,179,255,.15);background:rgba(255,255,255,.035);color:#cdd4e8}
      .cv-feedback-body{padding:18px 24px 24px;overflow:auto;max-height:calc(min(86vh,820px) - 88px)}
      .cv-feedback-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cv-feedback-field{display:grid;gap:6px}.cv-feedback-field.full{grid-column:1/-1}
      .cv-feedback-field label{font-size:11px;color:#9aa5c1}.cv-feedback-required{color:#ff9aae}
      .cv-feedback-input,.cv-feedback-select,.cv-feedback-textarea{width:100%;border:1px solid rgba(161,179,255,.17);border-radius:12px;background:rgba(6,15,36,.78);outline:0;color:#eef1fb;padding:10px 12px;font:inherit}
      .cv-feedback-input,.cv-feedback-select{height:42px}.cv-feedback-textarea{resize:vertical;min-height:92px;line-height:1.65}.cv-feedback-textarea.small{min-height:72px}
      .cv-feedback-input:focus,.cv-feedback-select:focus,.cv-feedback-textarea:focus{border-color:rgba(159,124,255,.52);box-shadow:0 0 0 3px rgba(159,124,255,.08)}
      .cv-feedback-upload{border:1px dashed rgba(161,179,255,.22);border-radius:13px;padding:12px;background:rgba(11,23,52,.42)}
      .cv-feedback-upload-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.cv-feedback-file{max-width:100%;color:#aeb8d1;font-size:11px}
      .cv-feedback-preview{display:none;margin-top:10px;max-width:180px;max-height:120px;border-radius:10px;border:1px solid rgba(161,179,255,.15);object-fit:cover}
      .cv-feedback-note{font-size:10px;line-height:1.65;color:#7f8aaa;margin-top:7px}
      .cv-feedback-diagnostics{margin-top:14px;padding:11px 12px;border-radius:12px;background:rgba(100,167,255,.06);border:1px solid rgba(100,167,255,.1);font-size:10px;line-height:1.65;color:#8f9ab7}
      .cv-feedback-check{display:flex;gap:8px;align-items:flex-start}.cv-feedback-check input{margin-top:3px}.cv-feedback-check strong{display:block;color:#bac4dc;font-size:11px;font-weight:500}.cv-feedback-check span{display:block;margin-top:2px}
      .cv-feedback-status{min-height:20px;margin-top:10px;font-size:11px;line-height:1.6;color:#8f9ab7}.cv-feedback-status.error{color:#ff9aae}.cv-feedback-status.success{color:#7fe0b4}
      .cv-feedback-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:16px}.cv-feedback-actions button{height:40px;padding:0 16px;border-radius:11px;border:1px solid rgba(161,179,255,.17);background:rgba(18,31,67,.75);color:#dce2f5}.cv-feedback-actions .primary{border-color:rgba(159,124,255,.35);background:linear-gradient(135deg,rgba(111,97,244,.82),rgba(91,75,204,.9));color:#fff;font-weight:600}.cv-feedback-actions button:disabled{opacity:.55;cursor:wait}
      .cv-feedback-honeypot{position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important}
      @media(max-width:680px){#bugFeedbackBtn{display:grid!important}#cineverseFeedbackDialog{width:calc(100vw - 18px);max-height:88vh}.cv-feedback-head,.cv-feedback-body{padding-left:17px;padding-right:17px}.cv-feedback-grid{grid-template-columns:1fr}.cv-feedback-field.full{grid-column:auto}.cv-feedback-actions{display:grid;grid-template-columns:1fr 1fr}.cv-feedback-actions button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function ensureButton() {
    if ($('bugFeedbackBtn')) return $('bugFeedbackBtn');
    const actions = document.querySelector('.top-actions');
    if (!actions) return null;
    const btn = document.createElement('button');
    btn.id = 'bugFeedbackBtn';
    btn.className = 'icon-btn';
    btn.type = 'button';
    btn.title = '问题反馈';
    btn.setAttribute('aria-label','问题反馈');
    btn.textContent = '🐞';
    const profile = actions.querySelector('.profile');
    actions.insertBefore(btn, profile || null);
    return btn;
  }

  function ensureDialog() {
    let dialog = $('cineverseFeedbackDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'cineverseFeedbackDialog';
    dialog.innerHTML = `
      <div class="cv-feedback-head">
        <div><div class="cv-feedback-kicker">CINEVERSE FEEDBACK</div><h3>问题反馈</h3><p>遇到异常、数据错误或界面问题，都可以从这里告诉我们。</p></div>
        <button class="cv-feedback-close" type="button" data-feedback-close aria-label="关闭">✕</button>
      </div>
      <div class="cv-feedback-body">
        <form id="cineverseFeedbackForm">
          <div class="cv-feedback-grid">
            <div class="cv-feedback-field">
              <label for="feedbackType">反馈类型</label>
              <select class="cv-feedback-select" id="feedbackType">
                <option value="bug">Bug / 功能异常</option>
                <option value="data">数据错误</option>
                <option value="ui">UI / 显示问题</option>
                <option value="function">功能建议</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div class="cv-feedback-field">
              <label for="feedbackContact">联系方式（可选）</label>
              <input class="cv-feedback-input" id="feedbackContact" maxlength="500" placeholder="邮箱 / 微信 / 其他">
            </div>
            <div class="cv-feedback-field full">
              <label for="feedbackDescription">问题描述 <span class="cv-feedback-required">*</span></label>
              <textarea class="cv-feedback-textarea" id="feedbackDescription" maxlength="5000" required placeholder="发生了什么？尽量描述你看到的现象。"></textarea>
            </div>
            <div class="cv-feedback-field full">
              <label for="feedbackSteps">复现步骤（可选）</label>
              <textarea class="cv-feedback-textarea small" id="feedbackSteps" maxlength="5000" placeholder="例如：进入影视库 → 点击某部影片 → 点击“已看”……"></textarea>
            </div>
            <div class="cv-feedback-field full">
              <label for="feedbackExpected">期望结果（可选）</label>
              <textarea class="cv-feedback-textarea small" id="feedbackExpected" maxlength="5000" placeholder="你原本期望发生什么？"></textarea>
            </div>
            <div class="cv-feedback-field full">
              <label>截图（可选）</label>
              <div class="cv-feedback-upload">
                <div class="cv-feedback-upload-row"><input class="cv-feedback-file" id="feedbackScreenshot" type="file" accept="image/png,image/jpeg,image/webp"></div>
                <img class="cv-feedback-preview" id="feedbackScreenshotPreview" alt="截图预览">
                <div class="cv-feedback-note" id="feedbackScreenshotNote">支持 PNG / JPG / WebP，最大 4MB。截图仅在登录光影账户后上传。</div>
              </div>
            </div>
          </div>
          <input class="cv-feedback-honeypot" id="feedbackWebsite" autocomplete="off" tabindex="-1" aria-hidden="true">
          <div class="cv-feedback-diagnostics">
            <label class="cv-feedback-check"><input id="feedbackDiagnostics" type="checkbox" checked><span><strong>自动附带诊断信息</strong><span>仅包含当前页面、浏览器、系统、屏幕尺寸、语言和反馈模块版本；不会上传影视收藏、评分或观看记录。</span></span></label>
          </div>
          <div class="cv-feedback-status" id="feedbackStatus"></div>
          <div class="cv-feedback-actions"><button type="button" data-feedback-close>取消</button><button class="primary" id="feedbackSubmit" type="submit">提交反馈</button></div>
        </form>
      </div>`;
    document.body.appendChild(dialog);
    return dialog;
  }

  function setStatus(text='', kind='') {
    const el = $('feedbackStatus');
    if (!el) return;
    el.textContent = text;
    el.className = `cv-feedback-status${kind ? ` ${kind}` : ''}`;
  }

  function getClient(waitMs=8000) {
    return new Promise((resolve,reject) => {
      const started = Date.now();
      const check = () => {
        const client = window.MovieCloudAccount?.client;
        if (client) return resolve(client);
        if (Date.now() - started >= waitMs) return reject(new Error('反馈服务暂未连接，请稍后重试'));
        setTimeout(check,100);
      };
      check();
    });
  }

  function diagnosticsPayload() {
    const screenInfo = window.screen ? `${window.screen.width}x${window.screen.height}@${window.devicePixelRatio || 1}` : '';
    const loader = [...document.scripts].map(s => s.src).find(src => /content-center\.js(?:\?|$)/.test(src)) || '';
    return {
      pathname: location.pathname,
      hash: location.hash,
      userAgent: navigator.userAgent || '',
      platform: navigator.userAgentData?.platform || navigator.platform || '',
      language: navigator.language || '',
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      screen: screenInfo,
      online: navigator.onLine,
      colorScheme: window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light',
      loader: loader.split('/').pop() || '',
      feedbackBuild: BUILD
    };
  }

  function resetForm() {
    const form = $('cineverseFeedbackForm');
    if (!form) return;
    form.reset();
    $('feedbackDiagnostics').checked = true;
    const preview = $('feedbackScreenshotPreview');
    if (preview?.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
    if (preview) {
      preview.removeAttribute('src');
      preview.style.display = 'none';
      delete preview.dataset.objectUrl;
    }
    setStatus('');
  }

  async function refreshScreenshotAvailability() {
    const input = $('feedbackScreenshot');
    const note = $('feedbackScreenshotNote');
    if (!input || !note) return;
    input.disabled = true;
    note.textContent = '正在确认截图上传权限…';
    try {
      const client = await getClient();
      const { data, error } = await client.auth.getUser();
      if (error && !/session/i.test(String(error.message || ''))) throw error;
      const loggedIn = Boolean(data?.user?.id);
      input.disabled = !loggedIn;
      note.textContent = loggedIn
        ? '支持 PNG / JPG / WebP，最大 4MB。'
        : '当前未登录光影账户；仍可提交反馈，登录后可附加截图。';
    } catch {
      input.disabled = true;
      note.textContent = '当前可提交文字反馈；截图上传暂不可用。';
    }
  }

  function openDialog() {
    const dialog = ensureDialog();
    if (!dialog.open) dialog.showModal();
    setStatus('');
    refreshScreenshotAvailability();
    setTimeout(() => $('feedbackDescription')?.focus(),40);
  }

  function closeDialog() {
    const dialog = $('cineverseFeedbackDialog');
    if (dialog?.open) dialog.close();
  }

  function extensionFor(file) {
    if (file.type === 'image/png') return 'png';
    if (file.type === 'image/webp') return 'webp';
    return 'jpg';
  }

  function newReportId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
    else for (let i=0;i<bytes.length;i++) bytes[i]=Math.floor(Math.random()*256);
    bytes[6]=(bytes[6]&0x0f)|0x40;
    bytes[8]=(bytes[8]&0x3f)|0x80;
    const hex=[...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }

  async function uploadScreenshot(client,user,reportId,file) {
    if (!file) return '';
    if (!user?.id) throw new Error('请先登录光影账户后再附加截图');
    if (!ALLOWED_SCREENSHOT_TYPES.has(file.type)) throw new Error('截图仅支持 PNG、JPG 或 WebP');
    if (file.size > MAX_SCREENSHOT) throw new Error('截图文件不能超过 4MB');
    const path = `${user.id}/${reportId}.${extensionFor(file)}`;
    const { error } = await client.storage.from(BUCKET).upload(path,file,{ contentType:file.type,upsert:false });
    if (error) throw error;
    return path;
  }

  async function cleanupScreenshot(client,path) {
    if (!path) return;
    try { await client.storage.from(BUCKET).remove([path]); } catch {}
  }

  async function submitFeedback(event) {
    event.preventDefault();
    const submit = $('feedbackSubmit');
    const description = $('feedbackDescription')?.value.trim() || '';
    if (description.length < 2) {
      setStatus('请先填写问题描述。','error');
      $('feedbackDescription')?.focus();
      return;
    }
    if (($('feedbackWebsite')?.value || '').trim()) return;

    const last = Number(localStorage.getItem(LAST_SUBMIT_KEY) || 0);
    if (Date.now() - last < 10000) {
      setStatus('提交得有点快，请稍等几秒再试。','error');
      return;
    }

    submit.disabled = true;
    submit.textContent = '正在提交…';
    setStatus('正在连接反馈服务…');

    let screenshotPath = '';
    try {
      const client = await getClient();
      const { data:userData, error:userError } = await client.auth.getUser();
      if (userError && !/session/i.test(String(userError.message || ''))) throw userError;
      const user = userData?.user || null;
      const file = $('feedbackScreenshot')?.files?.[0] || null;
      const reportId = newReportId();
      if (file) {
        setStatus('正在上传截图…');
        screenshotPath = await uploadScreenshot(client,user,reportId,file);
      }

      const includeDiagnostics = Boolean($('feedbackDiagnostics')?.checked);
      const d = includeDiagnostics ? diagnosticsPayload() : {};
      const payload = {
        id: reportId,
        user_id: user?.id || null,
        feedback_type: $('feedbackType')?.value || 'bug',
        description,
        reproduction_steps: $('feedbackSteps')?.value.trim() || null,
        expected_result: $('feedbackExpected')?.value.trim() || null,
        contact: $('feedbackContact')?.value.trim() || null,
        page_url: includeDiagnostics ? location.href.slice(0,2000) : null,
        page_hash: includeDiagnostics ? location.hash.slice(0,1000) : null,
        browser: includeDiagnostics ? String(navigator.userAgent || '').slice(0,1000) : null,
        platform: includeDiagnostics ? String(navigator.userAgentData?.platform || navigator.platform || '').slice(0,500) : null,
        viewport: includeDiagnostics ? `${window.innerWidth}x${window.innerHeight}` : null,
        app_version: includeDiagnostics ? BUILD : null,
        diagnostics: d,
        screenshot_path: screenshotPath || null,
        status: 'new'
      };

      setStatus('正在保存反馈…');
      const { error } = await client.from(TABLE).insert(payload);
      if (error) {
        await cleanupScreenshot(client,screenshotPath);
        screenshotPath = '';
        throw error;
      }

      localStorage.setItem(LAST_SUBMIT_KEY,String(Date.now()));
      setStatus(SUCCESS_TEXT,'success');
      toast(SUCCESS_TEXT,5200);
      setTimeout(() => {
        closeDialog();
        resetForm();
      },850);
    } catch (error) {
      if (screenshotPath) {
        try {
          const client = window.MovieCloudAccount?.client;
          if (client) await cleanupScreenshot(client,screenshotPath);
        } catch {}
      }
      setStatus(friendlyError(error),'error');
    } finally {
      submit.disabled = false;
      submit.textContent = '提交反馈';
    }
  }

  function bind() {
    document.addEventListener('click',event => {
      if (event.target.closest?.('#bugFeedbackBtn')) {
        event.preventDefault();
        openDialog();
        return;
      }
      if (event.target.closest?.('[data-feedback-close]')) {
        event.preventDefault();
        closeDialog();
      }
    });

    document.addEventListener('submit',event => {
      if (event.target?.id === 'cineverseFeedbackForm') submitFeedback(event);
    });

    document.addEventListener('change',event => {
      if (event.target?.id !== 'feedbackScreenshot') return;
      const file = event.target.files?.[0];
      const preview = $('feedbackScreenshotPreview');
      if (!preview) return;
      if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
      if (!file) {
        preview.removeAttribute('src');
        preview.style.display = 'none';
        delete preview.dataset.objectUrl;
        return;
      }
      if (!ALLOWED_SCREENSHOT_TYPES.has(file.type) || file.size > MAX_SCREENSHOT) {
        event.target.value = '';
        preview.removeAttribute('src');
        preview.style.display = 'none';
        delete preview.dataset.objectUrl;
        setStatus(!ALLOWED_SCREENSHOT_TYPES.has(file.type) ? '截图仅支持 PNG、JPG 或 WebP。' : '截图文件不能超过 4MB。','error');
        return;
      }
      const url = URL.createObjectURL(file);
      preview.dataset.objectUrl = url;
      preview.src = url;
      preview.style.display = 'block';
      setStatus('');
    });

    const dialog = ensureDialog();
    dialog.addEventListener('click',event => {
      if (event.target === dialog) closeDialog();
    });
    dialog.addEventListener('close',() => setStatus(''));
  }

  function init() {
    injectStyles();
    ensureButton();
    ensureDialog();
    bind();
    window.CineverseFeedback = { open:openDialog };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{ once:true });
  else init();
})();
