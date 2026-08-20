(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const SUPABASE_URL = 'https://bjjralybdcuczwllxbvo.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_QiJNdLR-qykVqPkPrmePFg_x5wW7Owu';
  const PUBLIC_APP_URL = 'https://cj956151388-png.github.io/movie-collection/';
  let signupClient = null;

  const friendlyError = error => {
    const message = String(error?.message || error || '注册失败');
    if (/User already registered/i.test(message)) return '这个邮箱已经注册，可以直接登录';
    if (/Password should be at least/i.test(message)) return '密码至少需要 6 位';
    if (/rate limit/i.test(message)) return '操作太频繁，请稍后再试';
    if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return '网络连接失败，请稍后重试';
    return message;
  };

  function getClient() {
    if (signupClient) return signupClient;
    if (!window.supabase?.createClient) return null;
    signupClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    return signupClient;
  }

  async function waitClient(timeout = 5000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const c = getClient();
      if (c) return c;
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    throw new Error('Supabase SDK 未加载');
  }

  document.addEventListener('submit', async event => {
    const form = event.target?.closest?.('#movieAuthForm');
    if (!form || form.dataset.mode !== 'signup') return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const email = document.getElementById('movieAuthEmail')?.value?.trim() || '';
    const password = document.getElementById('movieAuthPassword')?.value || '';
    const button = document.getElementById('movieAuthSubmit');
    const status = document.getElementById('movieAuthStatus');

    if (!email || password.length < 6) {
      if (status) {
        status.textContent = !email ? '请输入邮箱' : '密码至少需要 6 位';
        status.classList.add('error');
      }
      return;
    }

    if (button) button.disabled = true;
    if (status) {
      status.textContent = '正在创建账户…';
      status.classList.remove('error');
    }

    try {
      const client = await waitClient();
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: PUBLIC_APP_URL },
      });
      if (error) throw error;

      if (data?.session) {
        if (status) status.textContent = '账户已创建，正在进入光影宇宙…';
        location.replace(PUBLIC_APP_URL);
        return;
      }

      if (status) {
        status.textContent = '验证邮件已发送。请点击邮件中的链接，验证后会返回光影宇宙。';
        status.classList.remove('error');
      }
    } catch (error) {
      if (status) {
        status.textContent = friendlyError(error);
        status.classList.add('error');
      }
    } finally {
      if (button) button.disabled = false;
    }
  }, true);
})();
