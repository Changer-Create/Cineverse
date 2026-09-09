# A05 配置交接

前台正式地址统一为 `https://changer-create.github.io/Cineverse/`。公开运行配置由 `public-config-v1.js` 提供，包含正式回调地址、Supabase 项目地址/公开 publishable key，以及 TMDb 代理和管理台函数地址。该文件不存放服务端密钥。

页面加载顺序：
- `index.html` 先加载公共配置，再加载前台脚本。
- `admin.html` 和 `admin-console.html` 先加载公共配置，再初始化管理台逻辑。

上线前由运营者在 Supabase 核对：
1. Authentication → URL Configuration 的 Site URL 为 `https://changer-create.github.io/Cineverse/`。
2. Redirect URLs allow-list 包含该地址（如使用本地调试，再额外加入对应 localhost 地址）。
3. 本地/预览环境不要修改提交的正式地址；如需预览回调，应在独立配置分支中提供明确的环境配置，不从 URL 参数或用户输入推导回调地址。

本项不会发送真实注册邮件，也不会修改 Supabase 后台配置。
