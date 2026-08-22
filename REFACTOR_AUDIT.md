# Cineverse 仓库静态审计与渐进式重构计划

> 审计日期：2026-08-21；范围：当前分支的全部受版本控制文件。本次只增加审计文档，不改动任何产品运行时行为。

## 1. 执行摘要

当前产品是一个「大型内联单页 + 按顺序注入的功能模块」架构：`index.html` 约 433 KB，只直接引入 `content-center.js`；后者用 `document.write` 转入 `content-center-runtime-v1.js`，再一次性写入用户端所需的 44 个 CSS/JS 资源。加载顺序仍是需要回归测试保护的兼容契约，但初次审计识别的全局 monkey patch 和隔离 stub 已经收口。

建议不立即删除文件或改用 bundler，而是先固化行为基线和资源清单，再以「一次一条链」的方式收口。

## 2. 审计方法与限制

- 遍历 Git 跟踪文件，检查 HTML 直接引用、JS 动态引用、文件名反向引用、同名版本文件和最近 15 个提交的文件变化。
- 搜索对 `Storage.prototype`、`JSON.stringify`、`MutationObserver` 和 `window.fetch` 的全局替换，并检查重叠的全局事件监听。
- 初次审计对 61 个顶层 `.js` 文件执行了 `node --check`；现行检查命令会覆盖 Git 跟踪的所有 `.js` 文件，包括 `scripts/` 和 `test/`。
- 初次审计时仓库没有 `package.json`、测试目录、CI 配置或浏览器测试基础设施；现已加入零依赖 Node 检查与回归测试，但真实浏览器 E2E 和 CI 仍待建立。

## 3. 运行时与资源清单

### 3.1 已确认的入口

| 入口 | 加载方式 | 观察 |
| --- | --- | --- |
| `index.html` | 内联应用后引入 `content-center.js` | 生产主入口，业务、样式和数据近乎全部内联。 |
| `admin-console.html` | 先引入 `content-center.js`，后引入 `admin-data.js` | 与用户端共用整条运行时，只在 runtime 中通过 pathname 分支加载管理员模块。 |
| `admin.html` | 纯内联登录页 | 不进入 content runtime；成功后跳转管理台或视觉编辑模式。 |

`content-center-runtime-v1.js` 的声明式清单当前共有 3 个样式文件和 45 个脚本，每项均包含 `id`、`targets` 和 `dependsOn`。用户端路径加载 3 个样式和 42 个脚本；管理台仅加载 2 个样式和 18 个共享/管理脚本，不再下载内部明确跳过管理页的用户端模块。共享的 `cineverse-config.js` 在所有服务消费者之前加载。`visual-copy-editor.js` 不在该静态清单中，但会由 `content-center-core.js` 在视觉编辑模式动态加载，然后再加载 `visual-copy-editor-core.js`；两者不是废弃文件。

### 3.2 未被当前入口加载的候选文件

> 进展：在建立运行时清单、资源存在性和替代模块回归检查后，下表的候选文件已按独立提交全部删除。表格保留初次审计结论，便于追溯删除依据；其中云同步候选均为未装载补丁，现行语义由 `cloud-auth-v5.js` 与 `cloud-pending-volatile-v1.js` 承担。

| 类别 | 文件 | 建议 |
| --- | --- | --- |
| 旧版本，已有活跃后继 | `cloud-auth.js`、`global-tmdb-search-v1.js`、`radar-experience-v2.js`、`rating-sync-v2.js` | 先用产物清单和冒烟测试证明不可达，再单独提交删除；Git 历史作为回滚手段。 |
| 隔离/回滚残留 | `library-filter-experience-v2.js`、`library-display-experience-v1.js` | 两者现为几乎空的 quarantine stub，历史显示曾因冲突被停用；应在新筛选基线通过后删除，不应恢复加载。 |
| 旧筛选链 | `library-filter-experience-v1.js`、`library-filter-controls-v3.js` | 已由 `library-filter-system-v1.js` 收口；对比筛选、排序、键盘操作后再删除。 |
| 云同步补丁残留 | `cloud-auth-redirect-fix.js`、`cloud-local-edit-baseline-guard-v1.js`、`cloud-local-edit-baseline-guard-v2.js`、`cloud-pending-memory.js` | 当前未装载，但涉及数据一致性；需先将预期语义转换成测试，不可直接删。 |
| 历史快照 | `index(20260820-023858).html` | 约 420 KB 且没有仓库内引用；移入 release artifact/历史标签或删除，避免被静态主机意外公开为第二入口。 |

## 4. 发现与风险分级

### P0：先建立保护网，暂不重构

1. **自动化保护网（已建立基础）。** 初次审计时仓库为零测试、零 CI，与连续「重构 → hotfix → rollback → quarantine → 重新收口」的提交链相互印证。现已加入语法、资源清单、边界契约和安全回归测试，并由 CI 执行 `npm run check`；真实浏览器 E2E 仍是剩余的 P0 缺口。
2. **多层持久化补丁（已收口）。** 初次审计时 `global-config-sync.js`、`home-month-insight-v2.js`、`cloud-pending-volatile-v1.js` 和 `cloud-auth-v5.js` 都包装 `Storage.prototype`，使语义依赖脚本顺序。现已改为显式的应用保存事件、云同步通知、页签内待处理数据 store 和全局配置持久化 API；生产 JavaScript 不再修改 `Storage.prototype`。
3. **全局序列化副作用（已收口）。** 初次审计时 `rating-sync-v3.js` 直接替换 `JSON.stringify`；现已改为由应用 `save()` 边界显式调用 `MovieRatingSync.syncState`，不再影响无关业务或第三方 SDK。
4. **浏览器原语替换（已收口）。** 初次审计时 `content-observer-shield.js` 替换 `window.MutationObserver`，`tmdb-alias-match.js` 替换 `window.fetch`。现已分别改为显式 `MovieMutationObserver` 和 `MovieTmdbAliasMatch.enrich` 边界，不再改写浏览器全局原语；回归测试会阻止全局替换被重新引入。

### P1：高回归/冲突风险

1. **加载器是单点故障。** `content-center.js` 每次用 `Date.now()` 绕过 runtime 缓存，runtime 却为子资源混用无版本 URL 和手写时间戳。发布时可能出现 HTML/runtime/子脚本版本错配，也无法证明缓存是否命中。
2. **`document.write` 限制了启动时机。** 加载器只能在文档解析期安全运行；未来一旦改成 `defer`、动态导入或延迟启动，就可能清空已解析页面。
3. **管理台与用户端过度共享（已部分收口）。** 运行时现会按 `targets` 排除内部明确拒绝管理路径的用户端模块，管理端资源数从 47 降至 20。内容中心、品牌、导航、引语和 TMDb 别名等确有管理用途的共享模块仍保留；后续需由真实浏览器管理回归决定是否进一步拆分。
4. **过时注释与隔离文件（已清理）。** 会误导恢复的 `library-filter-experience-v2.js` 等 quarantine stub 已删除，回归测试同时锁定其替代者 `library-filter-system-v1.js` 必须保留在运行时清单中。

### P2：重复逻辑与维护成本

1. **并行完整版本（已清理）。** `cloud-auth.js`、`global-tmdb-search-v1.js`、`radar-experience-v2.js` 和 `rating-sync-v2.js` 已在替代模块清单测试建立后删除，不再在当前树中保留完整副本。
2. **多套筛选交互（已收口）。** 旧 experience、controls 和 quarantine display 实现已删除，运行时仅保留 `library-filter-system-v1.js`，并通过废弃模块回归测试防止旧路径被恢复。
3. **格式化和工具函数散落。** 多个功能各自实现 DOM ready boot、escape/clone、storage parse、日期与评分归一化、hashchange 后重试渲染。在没有测试前不建议贸然抽公共工具，但应先建立重复清单与语义对照表。
4. **README 运维信息（已建立基础）。** README 现已包含入口、本地运行、检查命令和 CI 说明；数据模型、发布原子性与回滚手册仍需在加载器收口时补全。

## 5. 缺失的测试与建议优先级

| 优先级 | 测试类型 | 最小覆盖 |
| --- | --- | --- |
| P0 | 主入口浏览器冒烟 | 首页启动无 console/page error；导航到首页、影视库、计划、统计、设置；刷新后状态不丢失。 |
| P0 | 持久化契约 | 对每个被包装的 storage key 验证 get/set/remove、无限递归、事件次数、离线待传、登录/退出与基线合并。 |
| P0 | 筛选与排序回归 | 关键字、状态、类型、年份、评分、计划、组合条件、清空、无结果、分页与键盘操作。 |
| P1 | 评分/状态数据模型 | 旧数据迁移、评分写入与序列化、想看/看过切换、统计联动，并确保无关对象的 `JSON.stringify` 结果不变。 |
| P1 | 详情、雷达、TMDb | hash 路由前进/后退、返回上下文、别名匹配只作用于预期请求、搜索正常/空/错误/重试。 |
| P1 | 管理与内容编辑 | 未登录重定向、会话失效、文案编辑预览/保存/恢复、全局配置的跨页同步。 |
| P2 | 视觉与响应式 | 关键页面在手机、桌面、大屏的截图对比；主题和季节背景组合。 |
| P2 | 数据库迁移 | 新建空库可执行 migration；反馈的插入、读取权限与必填字段符合预期。 |

## 6. 第一轮治理状态（完成）

第一轮治理已在 `work` 分支完成：声明式运行时清单、主要全局补丁隔离、确认废弃文件删除、
集中配置、安全渲染边界、匿名存储 fixture、导入事务回滚、HTML/语法/运行时引用检查和 CI
均已有自动化保护。`npm run check` 是当前统一的无网络检查入口。

受当前容器环境限制，第一轮没有宣称真实浏览器 E2E 已通过：容器不存在 Chromium、Chrome、
Firefox、Playwright 或 Selenium。发布前必须执行 `BROWSER_SMOKE.md`，记录浏览器版本、控制台
错误、404 和关键页面截图。部署访问日志与预发观察窗也仍属于发布责任，而不是仓库静态测试。

### 完成度对照

- **阶段 0：部分完成。** README、CI、静态检查、匿名 localStorage fixture 已完成；真实浏览器冒烟与截图改由发布清单阻断。
- **阶段 1：完成本轮范围。** 清单已具备 `id`、`src`、`targets`、`dependsOn` 并受顺序测试保护；build-id/hash 统一留给发布系统后续项目。
- **阶段 2：完成本轮范围。** `fetch`、`MutationObserver`、`JSON.stringify`、Storage 全局替换已移除，调用方改用显式边界；统一 repository adapter 留作第二轮。
- **阶段 3：完成仓库侧工作。** 已删除确认的旧实现与历史入口，并以 `check:references` 阻止悬空或回流引用；部署日志验证仍需在发布环境进行。
- **阶段 4：未开始。** `index.html` 的垂直功能拆分和可能的 ES modules/bundler 迁移属于第二轮，不纳入第一轮完成定义。

## 7. 后续阶段参考

### 阶段 0：冻结基线（历史计划）

1. 补全 README：入口、本地静态服务器命令、浏览器支持、配置/密钥来源、发布与回滚。
2. 引入最小 Playwright（或团队现有 E2E 栈），先只实现 P0 主入口和管理重定向冒烟。
3. 将 `node --check` 、静态资源存在性检查、重复 HTML id 检查纳入 CI；动态模板字符不当作静态 id 误报。
4. 记录一组代表性 localStorage fixture 作为金丝雀数据，严禁测试修改生产数据。

**退出条件：** 无 JS 页面错误，P0 冒烟在 CI 稳定通过，并存档当前关键页面截图。

### 阶段 1：让加载链可观测（历史计划）

1. 把 runtime 中的长字符串提取为带 `id`、`src`、`targets`、`dependsOn` 和版本的声明式清单；第一步仍按原顺序同步写入，不改加载时机。
2. 为每个模块记录启动成功/跳过/异常，允许测试断言用户端和管理端的实际清单。
3. 将所有缓存键改为由内容 hash 或单一 build id 生成，不再混用无版本、手写时间戳与每次随机值。该变更需单独验证发布原子性。

**退出条件：** 原顺序与新清单顺序完全相同，两个入口的加载快照受测试保护。

### 阶段 2：隔离副作用（历史计划）

1. 先为 `fetch`、`MutationObserver`、`JSON.stringify` 和 Storage 包装写 characterization tests，记录参数、返回值、异常和事件顺序。
2. 将 TMDb 别名处理收缩到专用 request client，而不是全局 `fetch`；先保留兼容开关可即时回退。
3. 将评分正规化移到明确的 repository/serializer 边界，移除全局 `JSON.stringify` 替换。
4. 将多层 Storage 包装合并为单一 storage adapter，内部用明确中间件顺序：数据模型 → 本地持久化 → 待传队列 → 同步通知 → 洞察刷新。
5. 将 observer shield 限定到产品自己的 observer factory；不修改浏览器全局构造器。

**退出条件：** 金丝雀 fixture 的序列化结果、事件顺序和线上/离线同步结果与基线一致。

### 阶段 3：删除确认不可达代码（历史计划）

1. 根据声明式清单、E2E 覆盖和部署访问日志对 3.2 的候选文件做最终可达性复核。
2. 先删除 quarantine stub 和确认的旧版本，再删除数据一致性补丁残留；不与新功能或格式化混在同一 PR。
3. 移除历史 HTML 快照，在 Git tag/release notes 中保留其来源提交。

**退出条件：** 全文引用检查为零，全套测试通过，预发环境一个完整观察窗内无 404 或新 JS 异常。

### 阶段 4：拆分入口与大文件（第二轮）

1. 先将管理端与用户端清单分开，确保管理端不执行用户端顶层副作用。
2. 再按垂直功能从 `index.html` 提取 CSS 与 JS；每次只提取一个功能，保留 DOM、storage key、事件名与加载顺序。
3. 最后才评估 ES modules/bundler；把「模块化」与「业务改写」分开。

## 8. PR 拆分和安全规则

- 每个 PR 只解决一个全局补丁、一条功能链或一类废弃文件；禁止「删旧版 + 改业务 + 换加载器」同时发生。
- 每次修改都需列出：加载顺序 diff、全局对象 diff、storage fixture diff、console error diff 和截图 diff。
- 使用可在运行时关闭的兼容开关做短期双轨验证；验证完成后必须在后续 PR 删除开关和旧路径，避免再形成补丁链。
- 任何涉及同步、评分或状态迁移的 PR，都必须提供向前兼容、回滚和损坏数据恢复方案。

## 9. 第一轮退出结论

第一轮仓库治理完成。进入第二轮前，应先在带浏览器的环境执行 `BROWSER_SMOKE.md` 并保留证据；
第二轮首个 PR 只应建立统一 persistence/repository adapter 的 characterization tests，不应同时拆分
`index.html` 或改变数据格式。大文件拆分继续遵循一次一个垂直功能、保持 DOM、storage key、事件名
和加载顺序不变的规则。
