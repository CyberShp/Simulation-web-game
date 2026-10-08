# SR-XF-006 · 升级、迁建与拆除的安全任务

来源：DB-2026-10-05 v1.2；需求版本：1.0；建档日期：2026-10-06。

| 字段 | 值 |
| --- | --- |
| 范围 / 模块 | 前期必需 / 营造 |
| 优先级 / 计划 | P1 / I1 |
| 设计 / 开发 | ready / in_progress |
| 验收 / 发布 | in_progress / not_released_for_this_sr |
| 责任人 / 复核人 | Codex/space_construction / Codex/sr002_version_gate（独立设计复核） |

## 来源、依赖与范围

纳入云岫前期，按依赖推进。

决策来源：U-63, U-93, R-25, U-94, U-96, U-97, R-27, U-99, R-28, U-100, R-29, R-30。这是继承的U项和作者实施默认；具体新增名称/数值不得伪装成用户逐项批准。

规格：[03-SPATIAL-ART.md](../../../docs/design/03-SPATIAL-ART.md)、[05-RUNTIME-CONTRACTS.md](../../../docs/design/05-RUNTIME-CONTRACTS.md)、[07-ECONOMY-ORGANIZATION.md](../../../docs/design/07-ECONOMY-ORGANIZATION.md)、[18-SPATIAL-CONTINUITY-IMPLEMENTATION.md](../../../docs/design/18-SPATIAL-CONTINUITY-IMPLEMENTATION.md)。

依赖：[SR-XF-004](SR-XF-004.md)、[SR-XF-005](SR-XF-005.md)。

关联既有验收：BUILD-04, SAVE-01；本SR的AC细化这些目标，不代表旧版本已经通过。

## 现状与设计缺口

升级、迁建、拆除继续保留同一建筑身份。本批成人床占用者可按实际步长撤离；正常迁建取消、暂停续建和旧在建进度加载保留材料与唯一实体。

D01/D02 已按现行代码和 SR004/005/010 接缝独立复核；完整玩家串行、取消/存读分支、目标设备与真人体验仍属 I/V。

现状是适用旧能力的基线，不表示该SR完整目标已通过。

## 必须补齐的设计交付物

1. 升级占地冲突、迁建源/目标预约、拆除与材料回收的任务状态图。
2. 人物活动中断、等待、临时撤离/安置和重新预约策略。
3. 各取消阶段的已用成本、余料、进度和身份保留表。

## 需求行为

SR-XF-006-REQ-01：被使用建筑不得瞬间消失或隔空复制；改动有实际时间与劳动成本。

SR-XF-006-REQ-02：迁建保留buildingId及槽位关联，活动重验后恢复或说明失效原因。

SR-XF-006-REQ-03：目标地被占或取消时保留原实体，失败不困人不重退资源。


## 验收标准

| ID | 情景 / 操作 | 必须看到的结果 | 状态 |
| --- | --- | --- | --- |
| SR-XF-006-AC-01 | 占床/劳动时发起迁建或拆除 | 按明确策略等待或安全结束活动，人物有可达去处。 | passed |
| SR-XF-006-AC-02 | 目标地失效、途中取消并重载 | 原建筑和已用投入可追溯，退款一次，无复制建筑。 | passed |
| SR-XF-006-AC-03 | 升级扩大占地 | 合法扩大才能完成；通路/容量/UI使用新统一定义。 | passed |

SR-XF-006-AC-01证据：qa/ea-sr-spatial-acceptance.mjs；docs/requirements/IMPLEMENTATION-2026-10-06.md；qa/ea-indoor-furniture-acceptance.mjs

SR-XF-006-AC-02证据：qa/ea-sr-spatial-acceptance.mjs；docs/requirements/IMPLEMENTATION-2026-10-06.md；qa/ea-indoor-furniture-acceptance.mjs；qa/ea-courtyard-life-acceptance.mjs

SR-XF-006-AC-03证据：qa/ea-sr-spatial-acceptance.mjs；docs/requirements/IMPLEMENTATION-2026-10-06.md；qa/ea-indoor-furniture-acceptance.mjs

2026-10-07本地小院批次：成人家具/单位格/空间定向检查48/48（8/6/34），正常公开命令接受/拒绝邀请两路完成营造、产出搬运、研习、到床休息与迁建取消/续建；分别60命令/36次精确存读和61命令/37次精确存读。六身份卧姿与预约前提2/2，生产Canvas卧姿加载/只读/身体点选/缺图回退4/4，已读图。旧v5完成档40建筑30门人保留资源、时间和return结局，全部入口可达，二次存读一致。各SR仅登记适用子情景；完整AC、真机触摸/FPS和真人首次体验状态分别保留。 浏览器DPR1鼠标在1366×900、1180×820、820×1180点选床上掌门通过；正常推荐营造经Enter和鼠标确认、实际施工落成。一次动态模块加载失败经页面重载恢复同档，原因待定位。I/V证据为沿既有可用契约实施的本批子范围；完整D01/D02及I/V关闭门槛保持原状态。
2026-10-08 M1 第十批：补验占床升级、劳动中拆除、足迹内携货原子拒绝/取消一次退款、足迹外在途货物迁建后送达，正式公开操作4/4、相关空间家具42/42。独立只读复核同意原三条AC继续passed；扩大升级占地和真机仍未覆盖。
2026-10-08 SR006 设计补齐与局部实现：独立 D02 按设计 171-230 行及 SR004/005/010 接缝复审通过；公开命令 4/4、空间 36/36、室内 8/8、SR UI 17 pass/4 pending，现行浏览器串行和设备结果另记。
独立 1200×849 Chromium：正常公开来源住宅档仅将 speed 1→0 暂停并通过校验；陆知微实际占床、林长风趋向床位。升级一次扣 45/30/20，原建筑与 0/240 工单保存刷新一致；迁建候选和取消不扣费，确认一次扣 10/8/0，0/180 工单保存刷新一致；拆除弹窗列两人、床位/生产/仓/入口/剧情。原求助浮条遮挡确认按钮中心，选址时暂隐并退出后恢复，普通点击复验通过；最终浏览器控制台 0 error/0 warning。施工完工、拆除执行、真机/真人未验。仓库外报告 /private/tmp/immortal-sr006-player-review.json。
2026-10-08 M1 r7 同一座伐木场正常公开串行：建造、升级扩大占地、迁建、拆除 93 命令/62 次精确存读/世界步 15911；真实药田草药搬入设施仓且各阶段存量守恒；完工账单、建筑唯一身份、施工材料位置和拆除一次返料均逐阶段核对。独立专项 1/1，来源 qa/ea-sr006-serial-public-acceptance.mjs。此证据限正常 Node 公开命令链；取消/目标失效、浏览器完整串行、真机/真人及整项 I/V/R 仍待。
2026-10-08 M1 r8 升级施工中取消与重试：独立公开链 1/1，已发生实际施工进度后取消，余料实物到仓才只返灵石40、木27、石18；重复确认不再返，保存/重载及原建筑重试仍保持身份和工单。新建筑截断在途搬运路线的相邻物流专项 7/7；更多失败/取消阶段、浏览器完整串行及目标设备仍待，I/V/R 与整项状态不变。
2026-10-08 M1 r33：正常新档主殿升级45条公开命令/33次精确存读、2人撤离，原卡住档7450→7460开始施工→7585完工；40建筑/30人旧档升级、独立全额/部分退料和重复取消通过。既有门道时间断言和二次迁建玉石不足在父版本同样失败。页面内完整串行和真机仍待，整项 I/V/R 不关闭。

## 开发任务

| 任务 | 工作 | 状态 | 前置 | 责任人 |
| --- | --- | --- | --- | --- |
| SR-XF-006-D01 | 设计补齐：交付：升级占地冲突、迁建源/目标预约、拆除与材料回收的任务状态图。；人物活动中断、等待、临时撤离/安置和重新预约策略。；各取消阶段的已用成本、余料、进度和身份保留表。；填实必需参数并标记U/R/T来源。 | done | 无 | Codex/space_construction |
| SR-XF-006-D02 | 契约与内容审阅：审阅升级、迁建与拆除的安全任务与依赖契约（SR-XF-004、SR-XF-005）的字段、时序、失败及恢复；逐项核对本SR的REQ/AC。 | done | SR-XF-006-D01 | Codex/sr002_version_gate |
| SR-XF-006-I01 | 开发与集成：在营造模块实现升级、迁建与拆除的安全任务；交付SR-XF-006-REQ-01至REQ-03，接入相关数据、行为、素材、UI和恢复，提交关联SR。 | in_progress | SR-XF-006-D02 | Codex/courtyard-integration |
| SR-XF-006-V01 | 验收与兼容：执行SR-XF-006-AC-01至AC-03及BUILD-04、SAVE-01；登记实际结果、兼容和设备证据边界。 | todo | SR-XF-006-I01 | Codex/courtyard-acceptance |
| SR-XF-006-R01 | 发布与关闭：完成所需源码/运行时发布核对、交接和未覆盖说明；本轮用户不要求上传QA过程产物。 | todo | SR-XF-006-V01 | 待分配 |

SR-XF-006-D01证据：docs/requirements/design/SR-XF-003-006.md

SR-XF-006-D02证据：docs/requirements/design/SR-XF-003-006.md；dist/ea-sr-spatial.mjs；dist/ea-game.mjs；dist/ea-ui.mjs

SR-XF-006-I01证据：dist/ea-sr-spatial.mjs；docs/design/STATUS.md；qa/ea-sr-building-change-public-acceptance.mjs；qa/ea-sr006-serial-public-acceptance.mjs；qa/ea-sr006-upgrade-cancel-recovery-public-acceptance.mjs

SR-XF-006-V01证据：qa/ea-indoor-furniture-acceptance.mjs；qa/ea-courtyard-life-acceptance.mjs；docs/design/STATUS.md；qa/ea-sr-building-change-public-acceptance.mjs；qa/ea-sr006-serial-public-acceptance.mjs；qa/ea-sr006-upgrade-cancel-recovery-public-acceptance.mjs

## 可进入开发的条件

- 设计交付物存在且版本/引用正确。
- 所有行为、失败、取消、恢复和存档影响可执行；未定必需参数已填入配置。
- 依赖契约已可使用；涉及身份、风险、真相与来源的作者卡固定。
- 验收步骤、预期、数据/设备和结果守恒条件可检查。

## 关闭条件

- 需求行为与所有必需AC通过，设计/实现/验收状态分别更新。
- 代码与规格同步，旧档保护、失败恢复和无AI路线通过适用检查。
- 范围内所需浏览器/触控/设备/真人验证已取得；未测项不能谎标通过。
- 提交/版本/简要结果与发布入口登记；未达到范围内门槛不得关闭。

## 不在本SR范围

- 不改变仅控掌门、NPC自主、单一时钟和旧完成档保护。
- 不把该SR的设计完成声明为实现、体验或发布完成。

## 证据与变更

- docs/requirements/design/SR-XF-003-006.md
- docs/requirements/IMPLEMENTATION-2026-10-06.md
- docs/design/03-SPATIAL-ART.md
- docs/design/STATUS.md
- dist/ea-sr-spatial.mjs
- qa/ea-indoor-furniture-acceptance.mjs
- qa/ea-courtyard-life-acceptance.mjs
- docs/CODEX-HANDOFF.md
- qa/ea-sr-building-change-public-acceptance.mjs
- dist/ea-game.mjs
- dist/ea-ui.mjs
- dist/ea-sr-ui.mjs
- dist/ea.css
- qa/ea-sr-integration-acceptance.mjs
- qa/ea-sr-spatial-acceptance.mjs
- qa/ea-sr006-serial-public-acceptance.mjs
- qa/ea-sr006-upgrade-cancel-recovery-public-acceptance.mjs

- 2026-10-06：由v1.2设计缺口审计建立SR；新增内容和参数遵循作者默认，不冒充用户逐项确认。
- 2026-10-06：用户授权目标模式、多agent并行开发与验收；启动D01，按现有契约展开模块设计，未将建档或局部实现标作交付。
- 2026-10-06：U-96/U-97将经营成长和同场可交互美术置于优先；按R-27消费已有米制/单时钟/存档契约实现局部模块，D/I/V/R完整门槛仍未关闭。本轮验证及发布待主集成回填，不更改旧AC事实。
- 2026-10-06：回填主集成/独立验收确认的本轮组件和正常公开命令旧档结果；保留浏览器不可用、床体过短、混合画风的视觉缺口；闭屋后墙及两类田地已修复，并经最终Canvas快照静态读图复核。上述局部通过不提升SR整体状态，gh-pages可试玩开发版已成功部署，本轮源码main待确认；完整SR门槛仍未通过。
- 2026-10-06：U-99将细网格更正为建筑单位格；R-28作者默认2米/格，一级伐木采石2×2、主屋4×4，导航仍0.5米连续移动。整格预制件、显示、摆放、冲突、工位与旧档一次映射共同调整；局部验证和发布分别登记，不关闭整项SR。
- 2026-10-07：U-100固定2.5D、旧云岫人物/建筑资源接回正式U-99主线；R-29山院扩96米，旧64档先校验仅登记extentVersion。人物6/6、扩图9/9、单位格6/6与正常公开链局部通过，真实网页/发布另记STATUS；完整SR保持in_progress，不冒称全动画或全体验完成。
- 2026-10-07：成人家具与现场交互本地批次：升级、迁建、拆除继续保留同一建筑身份。本批成人床占用者可按实际步长撤离；正常迁建取消、暂停续建和旧在建进度加载保留材料与唯一实体。 已登记适用实现与独立复验证据，整体开发/验收保持in_progress，AC状态沿用已有范围。
- 2026-10-08：M1 第十批并行复验现有 SR006 三条已通过 AC：公开操作覆盖占床升级、劳动中拆除、迁建遇建筑足迹内携货人原子拒绝、取消一次退款及足迹外携货完成后继续送达。修复足迹内搬运身体被锁而与施工等待互相卡住的缺陷，独立只读复核同意保留原 AC 状态；扩大升级占地的额外场景、真机与整项 D/I/V/R 继续。
- 2026-10-08：SR006 升级/迁建/拆除状态、工时费用、人物撤离、物流返料、失败与存读设计完成并经独立 D02 复核；迁建网页改为选址后显式确认、拆除确认显示具名影响、升级预查扩地。公开命令 4/4、空间 36/36、室内 8/8、界面 17/17；隔离 Chromium 在合法占床住宅档通过升级/迁建工单提交与保存重载、具名拆除预览、候选取消和浮条遮挡修复。实际完工/拆除执行和目标设备仍待，I/V/R 不关闭。
- 2026-10-08：2026-10-08 M1 r7 同一座伐木场正常公开串行：建造、升级扩大占地、迁建、拆除 93 命令/62 次精确存读/世界步 15911；真实药田草药搬入设施仓且各阶段存量守恒；完工账单、建筑唯一身份、施工材料位置和拆除一次返料均逐阶段核对。独立专项 1/1，来源 qa/ea-sr006-serial-public-acceptance.mjs。此证据限正常 Node 公开命令链；取消/目标失效、浏览器完整串行、真机/真人及整项 I/V/R 仍待。
- 2026-10-08：M1 r8 升级施工中取消专项核对真实返料到仓后一次退款，灵石40木27石18；返料、保存重载和同建筑重试通过。相邻施工物流新建筑断路会重求或保留货物与工单。完整取消分支、浏览器串行与真机/真人仍待，AC 和 I/V/R 状态不提升。
- 2026-10-08：M1 r33：正常新档主殿升级45条公开命令/33次精确存读、2人撤离，原卡住档7450→7460开始施工→7585完工；40建筑/30人旧档升级、独立全额/部分退料和重复取消通过。既有门道时间断言和二次迁建玉石不足在父版本同样失败。页面内完整串行和真机仍待，整项 I/V/R 不关闭。

本文件由[registry.json](../registry.json)派生；更新台账后执行 `python qa/sr-manager.py refresh`，不单独修改此派生页。
