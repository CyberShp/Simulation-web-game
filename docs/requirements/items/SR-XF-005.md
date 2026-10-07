# SR-XF-005 · 自由选址、施工与入口安全

来源：DB-2026-10-05 v1.2；需求版本：1.0；建档日期：2026-10-06。

| 字段 | 值 |
| --- | --- |
| 范围 / 模块 | 前期必需 / 营造 |
| 优先级 / 计划 | P0 / I1 |
| 设计 / 开发 | ready / in_progress |
| 验收 / 发布 | in_progress / not_released_for_this_sr |
| 责任人 / 复核人 | Codex/space_construction / Codex/root（集成） |

## 来源、依赖与范围

纳入云岫前期，按依赖推进。

决策来源：U-63, U-93, R-25, U-94, U-96, U-97, R-27, U-98, U-99, R-28, U-100, R-29, R-30。这是继承的U项和作者实施默认；具体新增名称/数值不得伪装成用户逐项批准。

规格：[03-SPATIAL-ART.md](../../../docs/design/03-SPATIAL-ART.md)、[05-RUNTIME-CONTRACTS.md](../../../docs/design/05-RUNTIME-CONTRACTS.md)、[07-ECONOMY-ORGANIZATION.md](../../../docs/design/07-ECONOMY-ORGANIZATION.md)、[18-SPATIAL-CONTINUITY-IMPLEMENTATION.md](../../../docs/design/18-SPATIAL-CONTINUITY-IMPLEMENTATION.md)、[06-OPENING-ACCEPTANCE.md](../../../docs/design/06-OPENING-ACCEPTANCE.md)。

依赖：[SR-XF-003](SR-XF-003.md)、[SR-XF-004](SR-XF-004.md)。

关联既有验收：BUILD-01, BUILD-02, BUILD-03, OPEN-05；本SR的AC细化这些目标，不代表旧版本已经通过。

## 现状与设计缺口

自由选址、材料预留和到场施工沿用单位格事务。本批推荐营造确认按返回的transform与选中建筑类型显示镜头及反馈；建筑卡读取真实可用容量和工位状态。推荐营造说明使用稳定布局，指针离开画布后确认按钮仍可点击。

正常营造及暂停/取消/存读已有局部复验；完整鼠标与iPad触控选址、预览、确认、施工安全仍须结合实际网页流程验收。

现状是适用旧能力的基线，不表示该SR完整目标已通过。

## 必须补齐的设计交付物

1. 可建地形、水面/陡坡/剧情保护区规则与入口连通条件。
2. 鼠标与触控的选址、预览、支持朝向、确认、取消流程。
3. 施工材料预留、分阶段投入、到场贡献和安全完工状态图。

## 需求行为

SR-XF-005-REQ-01：默认画面不显示永久地块框，规划只显示当前预览和必要辅助。

SR-XF-005-REQ-02：确认前不扣费；一次确认生成一个工作单；未完工不提前提供容量。

SR-XF-005-REQ-03：放置和完工均检查通行/人物安全，不强行挪走门人或来客。


## 验收标准

| ID | 情景 / 操作 | 必须看到的结果 | 状态 |
| --- | --- | --- | --- |
| SR-XF-005-AC-01 | 在任意合法空地放置并施工 | 可完成自由选址；到场后才贡献，完成后场景与容量一致。 | passed |
| SR-XF-005-AC-02 | 阻挡入口或人物占位后确认 | 具名/具体现象提示，费用和人物位置不变；等待后可合法继续。 | passed |
| SR-XF-005-AC-03 | 反复确认、取消、存读档和暂停 | 任务/材料至多登记一次，暂停不推进，取消按已发生投入结算。 | passed |

SR-XF-005-AC-01证据：qa/ea-sr-integration-acceptance.mjs；docs/requirements/IMPLEMENTATION-2026-10-06.md；qa/ea-courtyard-life-acceptance.mjs

SR-XF-005-AC-02证据：qa/ea-sr-spatial-acceptance.mjs；docs/requirements/IMPLEMENTATION-2026-10-06.md

SR-XF-005-AC-03证据：qa/ea-sr-spatial-acceptance.mjs；docs/requirements/IMPLEMENTATION-2026-10-06.md；qa/ea-courtyard-life-acceptance.mjs

2026-10-07本地小院批次：成人家具/单位格/空间定向检查48/48（8/6/34），正常公开命令接受/拒绝邀请两路完成营造、产出搬运、研习、到床休息与迁建取消/续建；分别60命令/36次精确存读和61命令/37次精确存读。六身份卧姿与预约前提2/2，生产Canvas卧姿加载/只读/身体点选/缺图回退4/4，已读图。旧v5完成档40建筑30门人保留资源、时间和return结局，全部入口可达，二次存读一致。各SR仅登记适用子情景；完整AC、真机触摸/FPS和真人首次体验状态分别保留。 浏览器DPR1鼠标在1366×900、1180×820、820×1180点选床上掌门通过；正常推荐营造经Enter和鼠标确认、实际施工落成。一次动态模块加载失败经页面重载恢复同档，原因待定位。I/V证据为沿既有可用契约实施的本批子范围；完整D01/D02及I/V关闭门槛保持原状态。

2026-10-07 M0/M1 接续批：独立 qa-m1-freebuild-20261007 新档鼠标链：疗伤前营造命令拒绝；疗伤后主屋占地拒绝且资源不扣；非推荐空地灵草田从110/65/45扣到80/40/35，实际到场施工、建成显示4工作位；第二座非推荐伐木场从80/40/35扣到55/20/27，建成显示2工作位；两座均从正式保存档重新加载，设施总数3、资源和暂停时间保留。首次链发现自由营造返回 transform 被误读为顶层 x/y，引发镜头 NaN/Canvas 错误；已修并用第二次链复验。AC原有 passed 保留，触控/入口封堵/人物占位等完整矩阵未因此新增通过声明。

## 开发任务

| 任务 | 工作 | 状态 | 前置 | 责任人 |
| --- | --- | --- | --- | --- |
| SR-XF-005-D01 | 设计补齐：交付：可建地形、水面/陡坡/剧情保护区规则与入口连通条件。；鼠标与触控的选址、预览、支持朝向、确认、取消流程。；施工材料预留、分阶段投入、到场贡献和安全完工状态图。；填实必需参数并标记U/R/T来源。 | done | 无 | Codex/root |
| SR-XF-005-D02 | 契约与内容审阅：审阅自由选址、施工与入口安全与依赖契约（SR-XF-003、SR-XF-004）的字段、时序、失败及恢复；逐项核对本SR的REQ/AC。 | done | SR-XF-005-D01 | Codex/sr010_contract_validation |
| SR-XF-005-I01 | 开发与集成：在营造模块实现自由选址、施工与入口安全；交付SR-XF-005-REQ-01至REQ-03，接入相关数据、行为、素材、UI和恢复，提交关联SR。 | todo | SR-XF-005-D02 | Codex/courtyard-integration |
| SR-XF-005-V01 | 验收与兼容：执行SR-XF-005-AC-01至AC-03及BUILD-01、BUILD-02、BUILD-03、OPEN-05；登记实际结果、兼容和设备证据边界。 | todo | SR-XF-005-I01 | Codex/courtyard-acceptance |
| SR-XF-005-R01 | 发布与关闭：完成所需源码/运行时发布核对、交接和未覆盖说明；本轮用户不要求上传QA过程产物。 | todo | SR-XF-005-V01 | 待分配 |

SR-XF-005-D01证据：docs/requirements/design/SR-XF-003-006.md

SR-XF-005-D02证据：docs/requirements/design/SR-XF-003-006.md

SR-XF-005-I01证据：dist/ea-game.mjs；dist/ea-ui.mjs；docs/design/STATUS.md；dist/ea.css；dist/ea-courtyard-renderer.mjs

SR-XF-005-V01证据：qa/ea-courtyard-life-acceptance.mjs；tests/ea-scene-ui.test.mjs；docs/design/STATUS.md

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
- dist/ea-game.mjs
- dist/ea-ui.mjs
- qa/ea-courtyard-life-acceptance.mjs
- tests/ea-scene-ui.test.mjs
- docs/CODEX-HANDOFF.md
- dist/ea.css
- dist/ea-courtyard-renderer.mjs

- 2026-10-06：由v1.2设计缺口审计建立SR；新增内容和参数遵循作者默认，不冒充用户逐项确认。
- 2026-10-06：用户授权目标模式、多agent并行开发与验收；启动D01，按现有契约展开模块设计，未将建档或局部实现标作交付。
- 2026-10-06：U-96/U-97将经营成长和同场可交互美术置于优先；按R-27消费已有米制/单时钟/存档契约实现局部模块，D/I/V/R完整门槛仍未关闭。本轮验证及发布待主集成回填，不更改旧AC事实。
- 2026-10-06：回填主集成/独立验收确认的本轮组件和正常公开命令旧档结果；保留浏览器不可用、床体过短、混合画风的视觉缺口；闭屋后墙及两类田地已修复，并经最终Canvas快照静态读图复核。上述局部通过不提升SR整体状态，gh-pages可试玩开发版已成功部署，本轮源码main待确认；完整SR门槛仍未通过。
- 2026-10-06：U-98改常态通用方格布局并暂缓院内铺路；沿用0.5米营造格、旧位置/工位/身份及导航，地面点选同源吸附。空间34、正常旧档9、grid6、UI/输入13均通过（生产Canvas/组件非browser），整项SR不关闭，发布证据单独登记。
- 2026-10-06：U-99将细网格更正为建筑单位格；R-28作者默认2米/格，一级伐木采石2×2、主屋4×4，导航仍0.5米连续移动。整格预制件、显示、摆放、冲突、工位与旧档一次映射共同调整；局部验证和发布分别登记，不关闭整项SR。
- 2026-10-07：U-100固定2.5D、旧云岫人物/建筑资源接回正式U-99主线；R-29山院扩96米，旧64档先校验仅登记extentVersion。人物6/6、扩图9/9、单位格6/6与正常公开链局部通过，真实网页/发布另记STATUS；完整SR保持in_progress，不冒称全动画或全体验完成。
- 2026-10-07：成人家具与现场交互本地批次：自由选址、材料预留和到场施工沿用单位格事务。本批推荐营造确认按返回的transform与选中建筑类型显示镜头及反馈；建筑卡读取真实可用容量和工位状态。 已登记适用实现与独立复验证据，整体开发/验收保持in_progress，AC状态沿用已有范围。 推荐营造按钮的指针离开布局变化已修复并由实际鼠标复验。
- 2026-10-07：M0/M1 接续批完成局部设计、修复和独立复核；具体通过范围与缺口见 acceptance_notes 和 STATUS。整项 D/I/V/R 及 AC 状态保持原门槛。
- 2026-10-08：M1 第十批独立补验现有 SR005 三条 passed AC 对当前代码仍适用：正常来源档桌面鼠标完成拒绝、自由选址、一次预留、暂停、取消、到场完工及两阶段重载；Chromium 合成触控点按/拖拽/双指不误建，相关输入空间 47/47。真 iPadOS、人物占位和部分投入取消的逐项浏览器场景未覆盖，整项 D/I/V/R 保持原状态。
- 2026-10-08：SR005 选址、预览确认、双施工位、材料事务、取消与存读设计已补齐；仅关闭设计任务。
- 2026-10-08：独立复核 SR005-D01 与 SR003/004/010 接缝通过；I/V/R 和真机验收继续。

本文件由[registry.json](../registry.json)派生；更新台账后执行 `python qa/sr-manager.py refresh`，不单独修改此派生页。
