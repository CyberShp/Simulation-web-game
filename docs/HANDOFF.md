## 最新开发检查点：EA 1.1 原型全集接入（尚在验收）

最新用户要求：EA全部玩法开发及验收，并且生成的原型图全部接入。完整清单为10组35画面，见 EA-PROTOTYPE-MANIFEST.json 与 EA-PROTOTYPE-INTEGRATION.md。
正式EA根入口暂未替换。浏览器验收目录ea-preview使用acceptance=1隔离存档；现有庭院1.3继续可玩。不要覆盖用户正式世界档。
新ea-courtyard-renderer接正式SIM与8页UI，7地标走路纳入存档，9地域/最终决战使用原型派生背景，山门显示四阶段。正在修复浏览器检查发现的布局问题并继续验收。禁止将纯逻辑或模板测试标注为已完成实际浏览器验收。

# 模拟仙府开发接管状态

当前交付：EA 1.0.1《余烬立山》，完整实现与测试已进入 main，静态发布在 gh-pages 根目录。正式试玩地址：https://cybershp.github.io/Simulation-web-game/ 。EA测试入口保留 ea-preview/。这是 GitHub Pages 项目；早期 Sites 副本不作为本轮发布目标。

入口 dist/ea-game.mjs；统一版本号 dist/ea-data.mjs 的 GAME_VERSION。数据格式仍为 v5，保留 v1–v4 迁移。发布脚本 qa/prepare-release.py 对完整模块依赖加统一缓存版本参数，避免新旧脚本混用。

本轮 162/162 测试与 48 页模板通过。qa/ea-normal-play.mjs --reference 只使用正常玩家命令生成通关和双峰参考档；qa/ea-long-session.mjs 的六游戏小时结果不是数小时真人会话。实际证据和待验收项见 EA-ACCEPTANCE.md。

后续重点是真机后台/锁屏/强退/下载/触控、晚期战斗与密集画面、前30分钟无人讲解试玩、长期经济平衡；不得将未测项写成通过。既有同源存档会保留，测试入口和正式入口也共用同源三档，请勿覆盖玩家档位。


2026-10-04 新增独立 terrain-lab/ 可玩山院，入口 dist/terrain-lab/app.mjs，共享导航 dist/ea-navigation.mjs。正式根目录 EA 与三档存档不变；样机单独使用 xianfu-terrain-lab-v1。全仓 182 / 182 测试通过，新增 20 项；自动报告 qa/terrain-lab-acceptance-report.json；验收及边界 docs/TERRAIN-LAB-ACCEPTANCE.md。角色是模块化二维绘制，不能称为随机 3D 模型已完成。单层桥面可以通行，桥下水面不可走；后续素材须按相同导航/遮挡规范复验。

2026-10-04 courtyard-1.3：用户否定 terrain-lab 视觉后，按其参考图新增 dist/yunxiu-courtyard/。六名预渲染角色、SVG 图标、绘景坐标寻路、局部前景遮挡、生产升级及独立存档已实现。验收见 YUNXIU-COURTYARD-ACCEPTANCE.md 和 qa/yunxiu-acceptance-report.json。新的视觉交付是 yunxiu-courtyard/，不要把 terrain-lab 当成用户接受的画面。该场景与完整 EA 分离；下一步应维持参考画面并逐步接入原 EA 状态和系统，而不是重新降级美术。
