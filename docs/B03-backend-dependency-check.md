# B03 后端条件提交：资料依赖核对

状态：未完成（资料依赖未满足）

本文件只记录 B03 的核对结果和待确认接口，不实施数据库、RLS、函数或线上配置变更。

## 已核对的仓库事实

- `supabase/migrations/` 目前只有 `20260821184503_create_bug_feedback.sql`。
- 该迁移只定义 `public.bug_reports` 和反馈截图存储策略，没有 `user_data`、`global_site_config` 的建表、索引、RLS 或版本字段。
- `cloud-auth-v5.js` 直接读写 `user_data` 的 `user_id`、`data_json`、`updated_at`，当前写入使用无条件 `upsert(..., { onConflict: 'user_id' })`。
- 当前前端只有本地 baseline/fingerprint 和时间戳判断，没有服务端原子 expected-revision 条件提交。
- `global-config-sync.js` 依赖 `global_site_config` 和 `adminGlobalConfigUrl`；仓库中没有对应 Edge Function 源码、迁移或部署配置。
- `admin-auth.js` 依赖 `adminAuthUrl`；仓库中没有该认证函数源码或管理员角色/RLS 定义。
- 仓库没有可确认的隔离测试项目、项目 ref、数据库 schema 导出、RLS 快照、函数部署清单或回滚说明。

## B03 需要补齐的资料

1. 脱敏后的 `user_data`、`global_site_config` 真实 schema、约束、索引和现有迁移历史。
2. 两张表的 RLS policy、GRANT/Data API 暴露设置，以及管理员身份/角色来源。
3. 当前生产中的同步、管理员认证、全局配置、TMDb proxy Edge Function 源码和部署配置。
4. 与生产隔离的 Supabase 测试项目或本地复现环境，包含可执行的种子数据和测试账号。
5. 备份/恢复、回滚和旧前端兼容窗口；确认旧版无条件 upsert 何时被禁止。
6. 当前服务端返回错误格式、日志位置、速率限制和幂等约定。

## 条件提交接口草案（待真实后端定义确认）

以下只是供后端资料确认的草案，不代表已实现或已批准：

```http
POST /functions/v1/user-data-commit
Authorization: Bearer <user session>
Content-Type: application/json
```

```json
{
  "data": { "movies": [] },
  "expectedRevision": 12,
  "requestId": "client-generated-id"
}
```

成功：

```json
{
  "ok": true,
  "revision": 13,
  "updatedAt": "2026-09-09T00:00:00.000Z"
}
```

版本冲突：

```json
{
  "ok": false,
  "error": "revision_conflict",
  "revision": 14,
  "updatedAt": "2026-09-09T00:01:00.000Z"
}
```

待确认的安全边界：

- `userId` 必须来自已验证会话，不接受请求体中的所有者字段。
- 条件检查和写入必须在同一事务/原子更新中完成。
- 普通用户只能提交自己的记录；管理员配置走独立函数和独立授权。
- 重复 `requestId`、首条记录竞争、超时重试和冲突响应需要服务端明确语义。
- 在旧版无条件 upsert 仍可执行前，不能宣称跨设备竞争已解决。

## 本 PR 不做的事

- 不创建 `user_data` 或 `global_site_config` 表。
- 不新增或修改 RLS、函数、Storage、管理员权限。
- 不修改前端同步协议，不伪造后端响应，不执行生产迁移。
- 不把当前时间戳 upsert 包装成“原子版本更新”。

## 后续依赖

取得上述真实资料和隔离测试环境后，下一步才可：

1. 固化脱敏迁移与函数源码；
2. 在测试环境验证两个客户端同 revision 仅一个成功；
3. 接入客户端 expectedRevision 和可识别冲突处理；
4. 验证旧前端兼容窗口、回滚和备份恢复；
5. 再按授权单独执行生产迁移与权限收口。
