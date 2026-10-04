## 最新交付：EA 1.1 开发、浏览器验收与仙府界面统一

当前版本 1.1.0-ea；正式入口已更新： https://cybershp.github.io/Simulation-web-game/ 。完整范围为 10 组 35 画面，见 EA-PROTOTYPE-MANIFEST.json、EA-PROTOTYPE-INTEGRATION.md、EA-1.1-ACCEPTANCE.md。
189 项自动测试、48 个模板、1358 个正常玩家操作通过；桌面浏览器与 320/390 窄屏已检查。真实手机设备、文件下载磁盘往返及长期实机性能仍未测。
用户追加字体要求已执行：标题、导航和主操作本地嵌入马善政毛笔楷书；正文保持可读。
用户追加界面要求已执行：存档、恢复、导入、确认、设置与人物弹窗采用统一仙府纸卷/青玉风格。窄屏战斗取景、遮挡、反馈和营造键盘行走问题已修复。
验收 URL 使用 acceptance=qa-*，档位、锁和偏好独立；导入后的「验收试读」仅在这个模式出现，不写本机。不覆盖用户正式三档与旧存档。此项目使用 GitHub Pages，不是 Sites 发布目标。

以下为历史检查点（以本段及 EA-1.1-ACCEPTANCE.md 为准）。

# 模拟仙府开发接管状态

当前交付：EA 1.0.1《余烬立山》，完整实现与测试已进入 main，静态发布在 gh-pages 根目录。正式试玩地址：https://cybershp.github.io/Simulation-web-game/ 。EA测试入口保留 ea-preview/。这是 GitHub Pages 项目；早期 Sites 副本不作为本轮发布目标。

入口 dist/ea-game.mjs；统一版本号 dist/ea-data.mjs 的 GAME_VERSION。数据格式仍为 v5，保留 v1–v4 迁移。发布脚本 qa/prepare-release.py 对完整模块依赖加统一缓存版本参数，避免新旧脚本混用。

本轮 162/162 测试与 48 页模板通过。qa/ea-normal-play.mjs --reference 只使用正常玩家命令生成通关和双峰参考档；qa/ea-long-session.mjs 的六游戏小时结果不是数小时真人会话。实际证据和待验收项见 EA-ACCEPTANCE.md。

后续重点是真机后台/锁屏/强退/下载/触控、晚期战斗与密集画面、前30分钟无人讲解试玩、长期经济平衡；不得将未测项写成通过。既有同源存档会保留，测试入口和正式入口也共用同源三档，请勿覆盖玩家档位。


2026-10-04 新增独立 terrain-lab/ 可玩山院，入口 dist/terrain-lab/app.mjs，共享导航 dist/ea-navigation.mjs。正式根目录 EA 与三档存档不变；样机单独使用 xianfu-terrain-lab-v1。全仓 182 / 182 测试通过，新增 20 项；自动报告 qa/terrain-lab-acceptance-report.json；验收及边界 docs/TERRAIN-LAB-ACCEPTANCE.md。角色是模块化二维绘制，不能称为随机 3D 模型已完成。单层桥面可以通行，桥下水面不可走；后续素材须按相同导航/遮挡规范复验。

2026-10-04 courtyard-1.3：用户否定 terrain-lab 视觉后，按其参考图新增 dist/yunxiu-courtyard/。六名预渲染角色、SVG 图标、绘景坐标寻路、局部前景遮挡、生产升级及独立存档已实现。验收见 YUNXIU-COURTYARD-ACCEPTANCE.md 和 qa/yunxiu-acceptance-report.json。新的视觉交付是 yunxiu-courtyard/，不要把 terrain-lab 当成用户接受的画面。该场景与完整 EA 分离；下一步应维持参考画面并逐步接入原 EA 状态和系统，而不是重新降级美术。
