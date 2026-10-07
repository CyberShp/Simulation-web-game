# Codex 接手指南 · 2026-10-07

## 任务与交付边界

用户要求把当前进度、设计及实现推送远端，交给 Codex 继续。本文是导航和接续检查点；详细规则与权威任务状态仍归各设计文档和 SR 台账，不另建第二套台账。本次仅交接文档，不新增功能、不重发游戏。

仓库：`CyberShp/Simulation-web-game`。从远端 **main** 接手，不从独立 3D 演示或旧 `yunxiu-courtyard` 原型重新开发。源码在 `dist/`，`gh-pages` 是独立发布产物分支；项目不是 Sites。

## 版本检查点

| 项目 | 已核实基点 |
| --- | --- |
| 设计 | DB-2026-10-05 v1.2；最新方向 U-100，单位格 U-99/R-28，扩容 R-29 |
| 运行时 | EA 1.6.0-dev / schema 6 |
| 当前游戏源码提交 | `eb5cca59b226c49c184a2082bcdda5ebd64de3fb` |
| 本次交接前 main | `0781fd30026504804059282b932464348128a655`，包含发布及网页检查记录；本次文档提交为其后继 |
| 已部署 gh-pages | `809d5bb8aecfbfc2a4681fd706e6597ed62297b3` |
| 部署任务 | `37541344563`，completed/success |
| 缓存标记 | `ea-160-yunxiu-2d-20261007-r1` |

[正式开发版](https://cybershp.github.io/Simulation-web-game/?v=ea-160-yunxiu-2d-20261007-r1)。接手时重新核对分支头；以上是检查点，不要覆盖后续其他人的提交。

## 必读与权威来源

1. 根目录 `AGENTS.md`。
2. `docs/design/README.md`、`00-BASELINE.md`、`DECISIONS.md`、`STATUS.md`。
3. `docs/design/05-RUNTIME-CONTRACTS.md`、`06-OPENING-ACCEPTANCE.md`、`14-EARLY-GAME-DETAILED-DESIGN.md`，再按任务读对应分系统规格。
4. `docs/requirements/README.md`、`BACKLOG.md`、`registry.json` 和对应 `items/SR-XF-xxx.md`。
5. `docs/HANDOFF.md` 最新段；更早段落仅是各版本历史证据，不把其中“当前”误作最新。

修改台账后运行 `python3 qa/sr-manager.py refresh`；不要只改派生 Markdown。U 是用户确认，R/T 是作者默认或可调参数，不能混淆。未答的神道王朝所在地/宗门安排保留未定，不继续主动追问或阻塞前期。

## 已实现与真实进度

- 正式主线此前已通过正常公开命令贯通开局经营、伤匠装备、筑基三层、固定三人复仇、双结局和返院继续经营；不需要重做开局，也不能据此宣称所有系统完整验收。
- 固定正交 2.5D，沿用原 12 类独立建筑外观及 6 列精细人物图集。人物身份、spriteIndex、配色和外观配方稳定，地图/肖像/斗法同源。新增草地与透明竹松山石沿用旧画风。
- 山院 64×64 → 96×96 米，面积 2.25 倍。营造单位格 2 米，48×48 格；导航精度 0.5 米，人物连续移动。伐木场/采石场 2×2 格，主屋 4×4 格，不恢复铺路。
- 同 schema 6 增加 `spatial.extentVersion='courtyard-96-1'`。未标记旧档先按 64 米校验再登记扩容；非法位置或未知版本拒绝。保留人物/建筑坐标、身份、物资、工序、时钟与 RNG。
- 台账：40 SR / 200 子任务 / 120 AC。开发 8 implemented、32 in_progress；整项验收仅管理 SR001 passed。AC 为 18 passed、101 not_run、1 blocked。不要换算成“游戏完成百分比”。

## 必须保持的契约

仅直接控制掌门，NPC 自主；所有玩法共用同一持久实体、身份、空间和模拟时钟。关闭/后台不推进，渲染与只读 UI 不发奖励、不推进生产。迁移不能重抽人物或静默清空旧档；正常流程验收不能注入资源、位置或境界冒充实际游玩。

UI、路径、占地、工位、命中与投影使用同源事实；新可见障碍必须与碰撞一致。只针对 iPadOS、Windows、macOS 网页尺寸适配，网页视口不等于实机。

## 关键代码与美术位置

- 启动与主循环：`dist/ea-game.mjs`、`ea-opening-sim.mjs`、`ea-sr-runtime.mjs`。
- 空间/导航/存档范围：`dist/ea-sr-spatial.mjs`、`ea-scene-geometry.mjs`、`ea-building-grid.mjs`。
- 场景/人物/UI：`dist/ea-courtyard-renderer.mjs`、`ea-character-art.mjs`、`ea-ui.mjs`。
- 地形与资产注册：`dist/ea-estate-ground-art.mjs`、`ea-estate-assets.mjs`、`asset-manifest.json`。
- 原人物：`dist/yunxiu-courtyard/assets/characters.webp`；原远景：`dist/assets/map.webp`；建筑和本轮草地/植被：`dist/assets/estate-v1/`。

## 已有证据与复验

上一实现轮：人物/扩图/单位格/UI/输入 60/60，空间 34/34，打包 1/1，共 95 项局部自动检查。正常新开局接受/拒绝邀请分别完成 33 个公开命令、22 次精确存读；这些与注资组件夹具分开记录。发布树 160 个文本文件和 7 张 WebP 与本地逐项相同。

真实网页检查：1363×936，独立验收存档恢复、人物实际走出主屋、素材加载、缩放、拖动、暂停和主屋详情点选。没有测真实 iPad 触屏、目标设备 FPS 或完整玩家首次体验。完整旧档测试使用仓库既有 `qa/ea-reference-world.json`，不要恢复对缺失历史 dump 的依赖。

仓库根目录可执行：

```bash
python3 qa/sr-manager.py validate
python3 -m http.server 8080 --directory dist
```

另一个终端执行最近改动的定向检查（Node 需支持 `node:test`；Canvas 测试需能解析 `@napi-rs/canvas`，纯浏览器运行不依赖该测试包）：

```bash
node --test tests/ea-character-atlas.test.mjs tests/ea-scene-ui.test.mjs tests/ea-narrative-ui.test.mjs tests/map-input.test.mjs qa/ea-building-grid-acceptance.mjs qa/ea-estate-extent-acceptance.mjs
node --test qa/ea-sr-spatial-acceptance.mjs
node --test tests/ea-release-package.test.mjs
```

依赖缺失应明确报环境阻塞，不跳过后宣称通过。浏览器使用 `?acceptance=qa-codex-handoff` 等独立验收空间，不能覆盖正式三个档位。测试日志/截图/新测试存档留在仓库外，不提交。

## 已知差距及下一步

1. **完整小院：SR003–007/029。** 优先收口营造、工位、室内、遮挡与实际交互；旧建筑屋外精细，室内仍有代码绘制风格差异。现有床体不足成人躺卧，不能缩人塞床；完整坐卧、劳动、斗法动作素材未齐。地形仍偏重复草地与边缘植被，旧水面形状规则，不能称最终美术验收完成。
2. **自主经营：SR008–011。** 围绕真实供给、搬运、预约和工作位做连续正常经营验收，补齐短缺、堵路、暂停/重载和设施变化后的恢复。
3. **人物成长：SR012–014/018。** 三路装备与修行成长分别完成正常公开链，不以单条路径贯通代表三路全部完成。
4. **危机与分支：SR023/024。** 救援、母子篇完整分支与持续后果仍需逐项验证。
5. **兼容与体验：SR030–032。** 旧档、真实触屏/设备性能和真人首次体验；组件通过不能替代这些证据。

以上是优先顺序，不取消其余已授权 40 项 SR。逐项读 AC、实现、复验、回填，不为了关闭状态删减验收要求。

## 发布与交接规则

只推送必要源码、美术、设计/进度文档和可复用测试。用户明确不要上传验收截图、过程日志、测试存档与临时产物。普通 Git 推送若阻塞，可用 GitHub API 创建 blob/tree/commit，并使用 `expected_sha` + `force:false` 更新分支；冲突先重新读取，不能强推覆盖。

运行时变更经验证后再发布 `gh-pages`；`qa/package-pages-release.py --tag <新缓存标记> --output <仓库外路径>` 只打包文本，不自动上传新增二进制美术。根入口和 `ea-preview/` 一起核对，记录部署成功及真实网页结果。仅改本文等文档不重发 Pages。完成后更新 STATUS、HANDOFF 和对应 SR 证据。
