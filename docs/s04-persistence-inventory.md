# S04 persistence inventory

基线：main `2fa89df12953c76fb4da0bd1ed6bf4333381d0a0`。本清单只记录会改变 `movie-collection-v2` 或其同步状态的实际入口；主题、引语、sessionStorage 和评分缓存不列为状态写入阻塞项。

## 已确认的 movie-collection-v2 写入入口

| 文件/函数 | 触发操作 | Gateway | 持久化通知 | 无 Gateway 回退 |
| --- | --- | --- | --- | --- |
| `app-state-storage-v1.js / persist` | Store replace/update 的规范化持久化 | 是，Gateway 最终调用 store | Store replace 通知订阅者；主应用持久化到 localStorage | 这是底层唯一直接持久化实现 |
| `app-main-v1.js / startup normalize` | 启动规范化 | 是 | `stateGateway.replace(...)` | 不可达：主应用先创建 Gateway |
| `app-main-v1.js / save` | 普通应用状态保存 | 是 | `stateGateway.replace(...)` | 不可达：主应用先创建 Gateway |
| `rating-sync-v3.js / normalizeZeroRatings` | 评分兼容迁移 | 是 | Gateway replace；同时标记 cloud dirty | 仅在独立加载脚本且没有 Gateway 时可达 |
| `watch-record-edit-v1.js / writeState` | 添加/编辑/删除观看记录 | 是 | Gateway replace；同时标记 cloud dirty | 仅在独立加载脚本且没有 Gateway 时可达 |
| `status-model-v3.js / saveState` | 状态切换 | 是 | Gateway replace；同时标记 cloud dirty | 仅在独立加载脚本且没有 Gateway 时可达 |
| `library-card-system-v1.js / saveState` | 加入/删除影视库、计划写入 | 是 | Gateway replace；同时标记 cloud dirty | 仅在独立加载脚本且没有 Gateway 时可达 |
| `radar-20.js / writeState` | 雷达兼容回写 | 是 | Gateway replace；正式生成使用 Gateway update | 仅在独立加载脚本且没有 Gateway 时可达 |
| `radar-experience-v3.js / writeState` | 雷达收藏/资料补全 | 是 | Gateway replace | 仅在独立加载脚本且没有 Gateway 时可达 |
| `cloud-auth-v5.js / applyPendingCloud` | 应用云端待处理整库 | 是（主应用） | Gateway replace，`contextReplace:true` | 仅在独立加载脚本且没有 Gateway 时可达 |
| `app-state-storage-v1.js / StateActions.restoreAll` | 整库恢复 | 是 | Gateway replace，`contextReplace:true` | 无；调用者必须提供 Gateway |

## 非阻塞的 localStorage 写入

以下写入不改变 `movie-collection-v2`，不属于 S04 的 Storage hook 删除阻塞项：引语最近项、主题设置、站点品牌配置、评分缓存、过滤方案、导航顺序、公共配置及 admin/session 数据。

## 兼容回退结论

主应用入口先创建 `CineverseStateGateway`，再加载可写入状态的功能模块；因此上述模块的无 Gateway 分支在正式主应用路径不可达。它们仍可能在独立 HTML、旧嵌入页面或测试夹具中可达。当前没有足够证据证明这些运行环境不受支持，所以本批不删除回退，也不删除 Storage hook。

## pending 生命周期核对

`cloud-auth-v5.js` 当前生命周期保持不变：

1. 暂存：`stageCloudData` 按 `userId` 写入 pending，并设置待应用/冲突标记。
2. 待应用：`restorePendingCloud` 在账号上下文建立时恢复对应账号的 pending。
3. 冲突：本地编辑时 `queueUpload` 将 pending 标记为 conflict，停止自动覆盖。
4. 应用：`applyPendingCloud` 通过 Gateway 整库替换并标记 `contextReplace`，随后刷新。
5. 清理：`clearPendingCloud` 只清理目标账号 pending，并在上下文仍有效时清理 UI 标记。
6. 换号/退出：R01 上下文代次使旧任务的 pending、baseline、dirty 和错误回写失效。
7. 刷新：`syncBeforeReload` 等待当前账号最终同步；有 pending 或冲突时返回失败，不自动应用。

## 本批实际结论

S01–S03 已经把主应用内可确认的状态写入迁移到 Gateway/Actions；剩余直接写入是兼容回退或非业务缓存。删除 Storage hook 仍需单独验证独立加载页面和测试夹具，并应在所有回退入口拥有统一的持久化通知接口后另开一批处理。
