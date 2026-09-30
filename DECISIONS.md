# 技术决策

## 2026-10-01 — TMDb 公众评分以统一缓存服务为准

- Decision: 首页、影视库、详情页复用 CineversePublicScoreService，数字／null 接口保留兼容，display 提供统一状态。
- Context: 首页首次渲染早于服务加载；已确认暂无评分被旧 info／radar 字段覆盖；存储异常可造成重复请求。
- Chosen approach: 缓存按媒体类型和 TMDb ID 分离，验证响应 ID、数值和投票数。success 保存 voteCount、fetchedAt、expiresAt，保持 7 天 TTL；empty 24 小时；error 保留最后成功值并退避 30 秒。存储不可写时以内存状态维持结果与退避。
- Future impact: 旧成功缓存兼容，无状态 null／0 缓存重试。旧 info 分数仅作为无缓存时的上次记录值，未经验证的 radar 快照不用于当前公共评分；不生成旧字段获取时间。评分更新不写入用户主数据或触发云同步。refresh 可显式绕过成功／暂无评分 TTL，但尊重错误退避。
