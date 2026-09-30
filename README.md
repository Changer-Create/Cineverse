# movie-collection

本地优先的电影与剧集收藏应用。

开发验证：`npm ci`、`npm run check`、`npm test`。浏览器回归需先执行 `npx playwright install chromium`，然后运行 `npm run test:browser`；仅验证公众评分可运行 `npm run test:public-score`。测试使用 mock TMDb 响应，不访问用户数据。

评分测试的截图与网络记录默认输出到系统临时目录 `cineverse-public-score`；可用 `SCORE_ARTIFACTS` 指定目录。`PLAYWRIGHT_CHANNEL=msedge` 可使用已安装的 Edge。设置 `SCORE_BASELINE_REF` 可对同一隔离样本复现旧版本，不修改工作区。

维护文档：[CHANGELOG.md](CHANGELOG.md)、[DECISIONS.md](DECISIONS.md)。
