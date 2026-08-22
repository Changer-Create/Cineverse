# Cineverse 桌面版 Codex 移交说明

## 1. 交接目标

当前工作的长期目标不是简单地把 `index.html` 按行数拆开，而是在不破坏现有功能和本地数据兼容性的前提下，建立明确的 Store、Router、Domain、Page Controller、View 和 Storage 边界，最终让 `index.html` 只保留应用外壳与资源入口。

桌面版 Codex 接手后，应继续完成页面控制器、局部 DOM、局部事件和 Store 订阅的解耦；不要把 `app-main-v1.js` 再机械地复制成多个依赖全局变量的小文件。

## 2. 仓库与当前基线

- 仓库路径：`/workspace/Cineverse`
- 当前分支：`work`
- 本说明编写时基线提交：`c3dc6c2 完成 index 资源拆分`
- 应先运行 `git status --short`，确认工作区是否仍然干净。
- 本项目目前没有 `package.json` 驱动的正式测试套件，也没有仓库内持久化的 `tests/` 目录。
- 应继续遵守仓库外层或仓库内新出现的 `AGENTS.md`；开始工作前重新运行 `find .. -name AGENTS.md -print`。

## 3. 已完成的解耦工作

### 3.1 基础模块

| 文件 | 职责 |
|---|---|
| `app-constants-v1.js` | 默认设置、主题预设、首页空状态 |
| `app-core-utils-v1.js` | UUID、安全 JSON、列表拆分、转义、日期、CSV 等纯工具 |
| `app-state-storage-v1.js` | 状态标准化、旧数据迁移、持久化、备份恢复、轻量 Store |
| `app-domain-model-v1.js` | 影片、计划、观看记录和首页指标等纯领域查询 |
| `app-router-v1.js` | Hash 解析、页面显隐、导航高亮、页面 `enter` 回调 |
| `app-plan-model-v1.js` | 月份运算、旧计划状态兼容、计划统计 |
| `app-tmdb-client-v1.js` | TMDb 代理请求、搜索、详情/演职员 Bundle 和图片 URL |
| `app-library-model-v1.js` | 影视库筛选、排序和分页 |
| `app-detail-model-v1.js` | 想看、观看记录和孤立影片判断 |
| `verified-quotes-v1.js` | 已核验语录静态数据 |

这些模块通过 `window.Cineverse*` 暴露 API，是从旧式脚本向更清晰模块边界过渡的兼容方案；当前还没有切换到原生 ES Modules。

### 3.2 `index.html` 资源外置

- 原内联 CSS 已迁移到 `app-shell-v1.css`。
- 原内联主应用 IIFE 已迁移到 `app-main-v1.js`。
- `index.html` 已无内联 `<style>` 和内联主应用 `<script>`。
- `index.html` 当前约 639 行，`app-main-v1.js` 约 710 行，`app-shell-v1.css` 约 823 行。
- 脚本加载顺序位于 `index.html` 底部，不能随意重排；`app-main-v1.js` 必须在其依赖模块之后、`content-center-runtime-v1.js` 之前加载。

### 3.3 近期 UI 与行为修复

当前累计分支还包含以下既有调整，继续重构时必须回归验证：

- 影视库操作栏与筛选栏分离。
- 高级筛选默认折叠，筛选方案支持自定义命名。
- 状态筛选只保留“想看 / 看过 / 已计划”。
- 影视库删除改为局部状态事件，不再强制刷新页面。
- 桌面端主要页面使用模块内部滚动，首页和月度计划减少留白。
- 已删除强调色、玻璃透明度、环境效果和轻微动态等设置控件。
- 顶部 TMDb 搜索结果不再提供剧集“在看”按钮。

## 4. 当前尚未达到的验收标准

不要把当前状态描述为“解耦完成”。仍有以下明确缺口：

1. `index.html` 仍高于目标的 500 行，所有页面和 Dialog 模板仍集中在一个文件中。
2. `app-main-v1.js` 仍是 710 行的应用单体，超过单文件尽量低于 500 行的目标。
3. `app-main-v1.js` 顶部的 `els` 仍一次性缓存全站 DOM，而不是只缓存 App Shell。
4. `document` 级点击代理仍处理影视库、详情、计划、雷达等业务操作。
5. Router 页面定义只有 `element` 和 `enter`，尚未形成 `mount / enter / leave / destroy` 完整生命周期。
6. `renderAll()` 仍直接刷新多个页面，是当前最主要的渲染耦合点。
7. 应用虽然创建了 Store，但页面没有通过 selector 订阅并进行局部刷新。
8. `app-main-v1.js` 仍有直接读取 `localStorage` 的语录和存储统计逻辑。
9. `app-shell-v1.css` 只是从 HTML 原样外置，尚未拆为 tokens、shell、components 和 pages。
10. 仓库内没有正式单元测试或浏览器烟雾测试套件。

## 5. 推荐的后续实施顺序

### PR8：先建立持久化测试安全网

建议先提交真正位于仓库内的测试，而不是继续使用 `/tmp/prN-test.js`：

```text
tests/
  unit/
    state-storage.test.js
    router.test.js
    library-model.test.js
    detail-model.test.js
    plan-model.test.js
    tmdb-client.test.js
  smoke/
    routes.spec.js
    library.spec.js
    plan.spec.js
    settings.spec.js
```

至少覆盖：应用启动无错误、所有 Hash 路由、筛选、删除不刷新、计划增删、备份恢复及四套主题切换。

### PR9：拆设置、统计和已观看页面

这三个页面相对低耦合，适合作为页面控制器范式：

```text
pages/settings-page-v1.js
pages/stats-page-v1.js
pages/watched-page-v1.js
```

每个页面应：

- 只在自己的根节点内查询 DOM。
- 使用 `AbortController` 绑定并清理事件。
- 暴露 `mount / enter / leave / destroy`。
- 通过传入的 Store、Domain、View 依赖工作，不读取其他页面 DOM。
- 从全局 `els` 中删除对应节点。

### PR10：拆计划、雷达和匹配中心

- 将计划页面 Controller 与已经存在的 `CineversePlan` 模型连接。
- 把 TMDb 匹配策略、分季归并和候选判断从 `app-main-v1.js` 移到独立 Service；`app-tmdb-client-v1.js` 只负责网络，不应吸收 UI 或匹配策略。
- 每个长任务需要支持页面离开后的正确状态和取消行为。

### PR11：拆影视库和详情页

- 影视库页面读取控件后调用 `CineverseLibrary.filterMovies()`，但 DOM、分页按钮和事件应归页面 Controller 所有。
- 详情页继续使用 `CineverseDetail`，确认 Dialog 保留在 View/Controller 层。
- 删除全局业务点击代理，只保留导航级事件。
- 用 Store 订阅替代删除、收藏、记录变化后的 `renderAll()`。

### PR12：最后拆 HTML 与 CSS

页面控制器稳定后，再拆页面模板和样式：

```text
styles/
  tokens.css
  base.css
  shell.css
  components/
  pages/

templates/ 或原生 <template>
  home
  library
  detail
  plan
  watched
  stats
  settings
```

不要在页面 Controller 边界稳定前引入异步 HTML Fragment，以免造成初始化时序、选择器和内容中心脚本回归。

## 6. 必须保持的兼容约束

1. 不得更改现有 LocalStorage 主键和旧版迁移行为，除非同时提供明确 migration 和测试。
2. 不得把 TMDb 密钥写入代码；当前浏览器调用统一经过 Supabase TMDb Proxy。
3. 不得恢复删除影片后的整页刷新。
4. 不得让桌面版恢复为整个网页长页面滚动；长列表应在页面模块或控件内部滚动。
5. 移动端和紧凑窗口仍需保留自然滚动回退。
6. 不得重新加入已经删除的 UI 外观控件。
7. 不得在 imports 外包裹 `try/catch`。
8. `content-center-runtime-v1.js` 仍使用 `document.write()` 注入大量兼容脚本；改造它必须单独进行并覆盖加载顺序回归。

## 7. 推荐验证命令

```bash
git status --short
node --check app-main-v1.js
node --check app-state-storage-v1.js
node --check app-domain-model-v1.js
node --check app-router-v1.js
node --check app-plan-model-v1.js
node --check app-tmdb-client-v1.js
node --check app-library-model-v1.js
node --check app-detail-model-v1.js
git diff --check
```

浏览器烟雾检查建议启动：

```bash
python3 -m http.server 4173
```

然后至少检查：

```text
http://127.0.0.1:4173/index.html#home
http://127.0.0.1:4173/index.html#library
http://127.0.0.1:4173/index.html#match
http://127.0.0.1:4173/index.html#radar
http://127.0.0.1:4173/index.html#plan
http://127.0.0.1:4173/index.html#watched
http://127.0.0.1:4173/index.html#stats
http://127.0.0.1:4173/index.html#settings
```

## 8. 最终验收标准

- `index.html` 低于 500 行，理想情况下只保留 App Shell、页面挂载点和资源入口。
- 内联 JavaScript 和内联页面 CSS 均为 0。
- 单个 JS 文件尽量低于 500 行。
- 全局 DOM 缓存只包含 App Shell。
- 全局点击代理只处理导航级操作。
- 每个页面具有 `mount / enter / leave / destroy` 生命周期。
- Domain 不访问 DOM，View 不直接访问 LocalStorage。
- Store 更新不直接调用具体页面渲染函数。
- 仓库内测试覆盖全部主路由和关键数据操作。
- 原有 LocalStorage 数据可以无损加载和继续保存。

## 9. 接手时建议首先执行的审计

```bash
wc -l index.html app-main-v1.js app-shell-v1.css
rg -n 'const els=|function renderAll|document.addEventListener\(.click' app-main-v1.js
rg -n 'localStorage|sessionStorage' app-*.js
rg -n 'renderAll\(|renderLibrary\(|renderPlanPage\(' app-main-v1.js
find . -maxdepth 3 -type f \( -path './tests/*' -o -name '*.test.js' -o -name '*.spec.js' \) -print
```

这些结果可以作为桌面版 Codex 接手后的真实基线，避免把“资源外置完成”误判为“页面解耦完成”。
