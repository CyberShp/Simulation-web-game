# 当前接管：EA 1.3 已发布并完成本环境验收

2026-10-05（北京时间），正式版本 `1.3.0-ea`，存档数据格式仍为 v5。GitHub Pages 发布提交 `bf743959ff0ae0c2f00aedd60de665053799a582`，任务 37228022086 成功，统一缓存标记 `ea-130-release-20261005`。原地址启动菜单已实际显示 EA 1.3；正式隔离入口公开试读旧参考档后，30 门人、40 建筑和双峰场景正常展示。详见 `EA-1.3-ACCEPTANCE.md` 和 `qa/acceptance-1.3/release.json`。

本轮已实现：`ea-scene-geometry.mjs` 固定地块地址、入口和路径碰撞；`ea-interactions.mjs` 到场后执行实际命令；`ea-life.mjs` 与社会模拟共享人物真实场景位置、活动及意愿理由；`ea-combat-geometry.mjs` 地区战场、障碍/视线、真实反馈事件；`ea-narrative.mjs` 章节对白、证据和选择回响；`ea-runtime.mjs` 后台恢复时钟、可见 rAF 诊断和失败资源重试。沿用用户认可的绘景与马善政毛笔字体。

最终自动证据：`qa/acceptance-1.3/unit-tests.tap` 264/264 通过，0 失败/跳过；独立跨系统 8 项通过；`independent-command-report.json` 生成于 2026-10-04T19:19:07.052Z，为版本 1.3、7/7 情景通过，完整通关使用 1125 次公开命令、31 次整档校验、55 游戏日，最终 30 门人／40 建筑／双峰。数字不能沿用 EA 1.2 的 1358 次操作。真正 48 个管理模板（6 状态 × 8 页）逐页检查独立内容与只读投影通过。

存档验收继续使用 `acceptance=qa-*` 隔离命名空间，不得覆盖玩家正式三档。旧档事件和战斗保持既有结果；场景坐标和对白记录持久化，不重发奖励。发布使用 `qa/package-pages-release.py`；本项目不用 Sites。

真实浏览器已覆盖桌面 1363×936 和移动视口 390×844、建筑选中/搬迁/拆除、到场交互、四地区战场、施法与胜利反馈、现场对白与新章自动展示、旧档和人物档案。截图与 `browser-observations.json` 已落盘。云浏览器 rAF 过于稀疏，未获得可信 FPS；朋友无人讲解试玩、iOS/Android 真机锁屏/强退/旋转/文件磁盘往返、长期平衡与内存趋势仍未执行。不要把移动视口或 Node 耗时写成真机和性能通过。

以下为历史检查点，当前状态以上段及 EA 1.3 验收记录为准。

## 历史交付：EA 1.1 开发、浏览器验收与仙府界面统一

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
# 当前版本：EA 1.2.0-ea（2026-10-05 北京时间）

本轮完整排查场景与八系统联动，新增 `dist/ea-scene-state.mjs` 为只读投影。正式院落加载 `dist/assets/ea-courtyard-empty.jpg`，原 courtyard 样机资产保留。实际设施、NPC 去向、总览和治理图不再由预建阶段图决定。新档三幕序章和动态下一步、主线分阶段地图开放、差事命令与 NPC 出行门槛、停用/损坏设施的主线门槛、探索道路移动、院内战斗 HUD 隔离已接入。

数据格式仍 v5，198 项测试通过，48 模板通过，正常命令通关仍为 1358 操作 / 22 整档校验 / 30 人 / 40 设施 / 双峰。详见 `docs/EA-1.2-ACCEPTANCE.md`。营造图是精确位置和邻接依据；院内按用途排布，不能宣称任意 3D 建筑体积碰撞。正式档位与 `acceptance=qa-*` 验收档位隔离。
