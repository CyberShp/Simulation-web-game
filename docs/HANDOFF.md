# 模拟仙府开发接管状态

当前交付：EA 1.0.1《余烬立山》，完整实现与测试已进入 main，静态发布在 gh-pages 根目录。正式试玩地址：https://cybershp.github.io/Simulation-web-game/ 。EA测试入口保留 ea-preview/。这是 GitHub Pages 项目；早期 Sites 副本不作为本轮发布目标。

入口 dist/ea-game.mjs；统一版本号 dist/ea-data.mjs 的 GAME_VERSION。数据格式仍为 v5，保留 v1–v4 迁移。发布脚本 qa/prepare-release.py 对完整模块依赖加统一缓存版本参数，避免新旧脚本混用。

本轮 162/162 测试与 48 页模板通过。qa/ea-normal-play.mjs --reference 只使用正常玩家命令生成通关和双峰参考档；qa/ea-long-session.mjs 的六游戏小时结果不是数小时真人会话。实际证据和待验收项见 EA-ACCEPTANCE.md。

后续重点是真机后台/锁屏/强退/下载/触控、晚期战斗与密集画面、前30分钟无人讲解试玩、长期经济平衡；不得将未测项写成通过。既有同源存档会保留，测试入口和正式入口也共用同源三档，请勿覆盖玩家档位。
