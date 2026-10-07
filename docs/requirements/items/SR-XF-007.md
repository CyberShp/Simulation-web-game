# SR-XF-007 · 稳定人物外观、肖像与活动动作

来源：DB-2026-10-05 v1.2；需求版本：1.0；建档日期：2026-10-06。

| 字段 | 值 |
| --- | --- |
| 范围 / 模块 | 前期必需 / 人物 |
| 优先级 / 计划 | P0 / I1 |
| 设计 / 开发 | draft / in_progress |
| 验收 / 发布 | in_progress / not_released_for_this_sr |
| 责任人 / 复核人 | Codex/economy_people / Codex/root（集成） |

## 来源、依赖与范围

纳入云岫前期，按依赖推进。

决策来源：U-63, U-93, R-25, U-94, U-96, U-97, R-27, U-100, R-29, R-30。这是继承的U项和作者实施默认；具体新增名称/数值不得伪装成用户逐项批准。

规格：[01-CHARACTERS.md](../../../docs/design/01-CHARACTERS.md)、[02-EQUIPMENT-ARTS.md](../../../docs/design/02-EQUIPMENT-ARTS.md)、[03-SPATIAL-ART.md](../../../docs/design/03-SPATIAL-ART.md)、[14-EARLY-GAME-DETAILED-DESIGN.md](../../../docs/design/14-EARLY-GAME-DETAILED-DESIGN.md)、[06-OPENING-ACCEPTANCE.md](../../../docs/design/06-OPENING-ACCEPTANCE.md)。

依赖：[SR-XF-002](SR-XF-002.md)、[SR-XF-004](SR-XF-004.md)。

关联既有验收：OPEN-02, ACT-01；本SR的AC细化这些目标，不代表旧版本已经通过。

## 现状与设计缺口

沿用六列云岫人物及稳定spriteIndex/外观配方；真实床位休憩、书案研习和满包等候已按同一身份与身体活动投影静态姿态，缺图保留基础同身份人物和点选。

疗伤/劳动/斗法及等待/研习/休憩的完整连续动作与三人以上真人辨识体验仍待补齐和验收；当前静态姿态及回退不代表完整动画完成。

现状是适用旧能力的基线，不表示该SR完整目标已通过。

## 必须补齐的设计交付物

1. 关键人物配方及普通人物可组合体型/脸/发型/主色/服饰目录。
2. 站立、行走、采集、种植、研习、休息、疗伤、施法、受击动作与工具对应表。
3. 肖像/山院/战斗的同身份映射，装备挂点和缺帧回退规则。

## 需求行为

SR-XF-007-REQ-01：角色重载、入宗、换衣和切场景不重掷身份外观。

SR-XF-007-REQ-02：活动状态、姿态与随身工具对应，途中不能显示正在执行劳动。

SR-XF-007-REQ-03：远景不破坏人类尺度；近景可区分至少三名人物。


## 验收标准

| ID | 情景 / 操作 | 必须看到的结果 | 状态 |
| --- | --- | --- | --- |
| SR-XF-007-AC-01 | 三名以上同场角色指定点选 | 可凭外观和肖像对应身份，能说出当前活动。 | not_run |
| SR-XF-007-AC-02 | 换装备和切到战斗再返回 | 身份特征稳定，武器/法器外观与实际实例对应。 | passed |
| SR-XF-007-AC-03 | 等待、睡眠和研习切换 | 动作/工具/标签与权威状态一致，回退不冒充完整动作。 | passed |

SR-XF-007-AC-02证据：qa/ea-person-equipment-battle-acceptance.mjs；qa/ea-person-equipment-art-acceptance.mjs；dist/ea-life.mjs；dist/ea-ui.mjs；docs/design/STATUS.md

SR-XF-007-AC-03证据：qa/ea-person-activity-switch-acceptance.mjs；tests/ea-scene-ui.test.mjs；qa/ea-courtyard-rest-render-acceptance.mjs；docs/design/STATUS.md

2026-10-07本地小院批次：成人家具/单位格/空间定向检查48/48（8/6/34），正常公开命令接受/拒绝邀请两路完成营造、产出搬运、研习、到床休息与迁建取消/续建；分别60命令/36次精确存读和61命令/37次精确存读。六身份卧姿与预约前提2/2，生产Canvas卧姿加载/只读/身体点选/缺图回退4/4，已读图。旧v5完成档40建筑30门人保留资源、时间和return结局，全部入口可达，二次存读一致。各SR仅登记适用子情景；完整AC、真机触摸/FPS和真人首次体验状态分别保留。 浏览器DPR1鼠标在1366×900、1180×820、820×1180点选床上掌门通过；正常推荐营造经Enter和鼠标确认、实际施工落成。一次动态模块加载失败经页面重载恢复同档，原因待定位。I/V证据为沿既有可用契约实施的本批子范围；完整D01/D02及I/V关闭门槛保持原状态。 2026-10-07活动事实局部修正：采集/补种因受伤、离位、低精力暂停时阶段记paused，画面为等候，不推进；自然采集第四批包裹满也暂停且不扣来源。定向测试覆盖伤势、低精力、包裹满、存读与恢复3/3，离位未逐项注入验收。人物投影asset限定为身份基础云岫画稿，卧床只列sceneAssetCandidate；实际床几何、脚点与加载由渲染决定，完整动作标记false。人物与卧姿11/11、空间34/34、经济52/52通过；三人辨识、全套动作、触屏及整项AC仍未通过。

2026-10-07 M1 首批人物画稿：沿既有六身份图集新增各自等待立姿与持书研习坐姿；沿权威活动与原 personId 选图，缺图回退原身份画稿。定向资产/人物/卧姿/界面 21/21；六身份静态图集已读图。疗伤、劳动、施法、受击和战斗连续动作、三人真人辨识及换装往返仍未验，AC 与 D/I/V/R 保持原状态。
独立只读复核已确认首批三项房屋接缝修复：显示与点选同阶段、迁建旧址不误显升级、错尺寸图集回退；定向重跑 22/22，仍不等于完整 AC。
2026-10-07 独立浏览器仅内存试读五人正常档：暂停同一第62日场景，画布分别点选程问舟、温南星、林长风三名门人，侧卡身份与休憩/候位等当前活动一致，主屋床位列表列出实际预约者。此为指定点选与事实标签子范围；尚无真人盲辨外观/肖像，也未核对三人全动作和换装实战，因此AC01–03均保持not_run。
2026-10-07 M1 第七批研习子情景：sr-cultivation 订单执行时取真实身体活动/书案/进度驱动姿态、掌门状态及详情，旧休憩字段不再覆盖；到位前显示前往研习位置。公开命令 + 精确存读的生产 Canvas 及桌面浏览器画面/点选通过，scene UI 9/9。等待、睡眠、专用完整动作和回退矩阵未由本批覆盖，AC03 仍 not_run，整项 SR007 不提升。
2026-10-08 M1 第十批：AC02 由独立只读复核按原文通过。五份公开命令来源档精确存读，同一掌门换衣、真实制作装备法器、实战及返院；生产画布和隔离桌面浏览器核对身份与实际实例挂点，战斗活动提示按真实状态显示。战场远景法器细节需结合生产画布与状态；真机/真人及整项仍未关闭。

## 开发任务

| 任务 | 工作 | 状态 | 前置 | 责任人 |
| --- | --- | --- | --- | --- |
| SR-XF-007-D01 | 设计补齐：交付：关键人物配方及普通人物可组合体型/脸/发型/主色/服饰目录。；站立、行走、采集、种植、研习、休息、疗伤、施法、受击动作与工具对应表。；肖像/山院/战斗的同身份映射，装备挂点和缺帧回退规则。；填实必需参数并标记U/R/T来源。 | in_progress | 无 | Codex/economy_people |
| SR-XF-007-D02 | 契约与内容审阅：审阅稳定人物外观、肖像与活动动作与依赖契约（SR-XF-002、SR-XF-004）的字段、时序、失败及恢复；逐项核对本SR的REQ/AC。 | todo | SR-XF-007-D01 | 待分配 |
| SR-XF-007-I01 | 开发与集成：在人物模块实现稳定人物外观、肖像与活动动作；交付SR-XF-007-REQ-01至REQ-03，接入相关数据、行为、素材、UI和恢复，提交关联SR。 | todo | SR-XF-007-D02 | Codex/courtyard-integration |
| SR-XF-007-V01 | 验收与兼容：执行SR-XF-007-AC-01至AC-03及OPEN-02、ACT-01；登记实际结果、兼容和设备证据边界。 | todo | SR-XF-007-I01 | Codex/courtyard-acceptance |
| SR-XF-007-R01 | 发布与关闭：完成所需源码/运行时发布核对、交接和未覆盖说明；本轮用户不要求上传QA过程产物。 | todo | SR-XF-007-V01 | 待分配 |

SR-XF-007-I01证据：dist/ea-character-art.mjs；dist/ea-courtyard-renderer.mjs；dist/assets/estate-v1/characters-rest-v1.png；docs/design/STATUS.md；asset-manifest.json；dist/ea-sr-persons.mjs；dist/ea-sr-economy.mjs；tests/ea-activity-truth.test.mjs；qa/ea-sr-economy-acceptance.mjs；qa/ea-sr-spatial-acceptance.mjs；dist/ea-sr-equipment.mjs；qa/ea-sr-integration-acceptance.mjs；qa/ea-person-equipment-battle-acceptance.mjs；qa/ea-person-equipment-art-acceptance.mjs

SR-XF-007-V01证据：qa/ea-courtyard-rest-render-acceptance.mjs；tests/ea-rest-pose.test.mjs；qa/ea-courtyard-life-acceptance.mjs；docs/design/STATUS.md；dist/ea-sr-persons.mjs；dist/ea-sr-economy.mjs；tests/ea-activity-truth.test.mjs；qa/ea-sr-economy-acceptance.mjs；qa/ea-sr-spatial-acceptance.mjs；dist/ea-sr-equipment.mjs；qa/ea-sr-integration-acceptance.mjs；qa/ea-person-equipment-battle-acceptance.mjs；qa/ea-person-equipment-art-acceptance.mjs

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

- docs/requirements/design/SR-XF-007-011-019-026-027.md
- docs/requirements/IMPLEMENTATION-2026-10-06.md
- docs/design/03-SPATIAL-ART.md
- docs/design/STATUS.md
- dist/ea-character-art.mjs
- dist/ea-courtyard-renderer.mjs
- dist/assets/estate-v1/characters-rest-v1.png
- qa/ea-courtyard-rest-render-acceptance.mjs
- tests/ea-rest-pose.test.mjs
- qa/ea-courtyard-life-acceptance.mjs
- docs/CODEX-HANDOFF.md
- asset-manifest.json
- dist/ea-sr-persons.mjs
- dist/ea-sr-economy.mjs
- tests/ea-activity-truth.test.mjs
- qa/ea-sr-economy-acceptance.mjs
- qa/ea-sr-spatial-acceptance.mjs
- dist/assets/estate-v1/characters-wait-study-v1.png
- tests/ea-house-activity-art.test.mjs
- dist/ea-sr-equipment.mjs
- qa/ea-sr-integration-acceptance.mjs
- qa/ea-indoor-activities-acceptance.mjs
- dist/ea-life.mjs
- tests/ea-scene-ui.test.mjs
- qa/ea-person-activity-switch-acceptance.mjs
- qa/ea-person-equipment-battle-acceptance.mjs
- qa/ea-person-equipment-art-acceptance.mjs
- dist/ea-ui.mjs

- 2026-10-06：由v1.2设计缺口审计建立SR；新增内容和参数遵循作者默认，不冒充用户逐项确认。
- 2026-10-06：用户授权目标模式、多agent并行开发与验收；启动D01，按现有契约展开模块设计，未将建档或局部实现标作交付。
- 2026-10-06：U-96/U-97将经营成长和同场可交互美术置于优先；按R-27消费已有米制/单时钟/存档契约实现局部模块，D/I/V/R完整门槛仍未关闭。本轮验证及发布待主集成回填，不更改旧AC事实。
- 2026-10-06：回填主集成/独立验收确认的本轮组件和正常公开命令旧档结果；保留浏览器不可用、床体过短、混合画风的视觉缺口；闭屋后墙及两类田地已修复，并经最终Canvas快照静态读图复核。上述局部通过不提升SR整体状态，gh-pages可试玩开发版已成功部署，本轮源码main待确认；完整SR门槛仍未通过。
- 2026-10-07：U-100固定2.5D、旧云岫人物/建筑资源接回正式U-99主线；R-29山院扩96米，旧64档先校验仅登记extentVersion。人物6/6、扩图9/9、单位格6/6与正常公开链局部通过，真实网页/发布另记STATUS；完整SR保持in_progress，不冒称全动画或全体验完成。
- 2026-10-07：成人家具与现场交互本地批次：沿用六列云岫人物及稳定spriteIndex/外观配方。本批新增同六身份的真实静态仰卧素材；只有到床执行且持有对应预约时投影到床面，掉图保留同身份床边人物和点选。 已登记适用实现与独立复验证据，整体开发/验收保持in_progress，AC状态沿用已有范围。
- 2026-10-07：2026-10-07活动事实局部修正：采集/补种因受伤、离位、低精力暂停时阶段记paused，画面为等候，不推进；自然采集第四批包裹满也暂停且不扣来源。定向测试覆盖伤势、低精力、包裹满、存读与恢复3/3，离位未逐项注入验收。人物投影asset限定为身份基础云岫画稿，卧床只列sceneAssetCandidate；实际床几何、脚点与加载由渲染决定，完整动作标记false。人物与卧姿11/11、空间34/34、经济52/52通过；三人辨识、全套动作、触屏及整项AC仍未通过。
- 2026-10-07：M1 战斗共同身体或房屋/人物画稿首批局部实现与独立验收；整项原门槛未关闭。
- 2026-10-07：M1 换装子链：山院、山外与战斗绘制统一按同一有效装备实例过滤定义、槽位、耐久及归属/借用；肖像同步使用该挂点，法器与配饰按真实定义显示不同形状。新档公开借剑同行返院10命令、5次精确存读至470世界步，身份与实例稳定；独立只读复核、空间34/34和画稿12/12通过。完整自然实战、浏览器视觉、真人辨识与专用动作仍待验，AC02及整项状态不提升。
- 2026-10-07：M1 第七批修复实际研习与旧休憩字段冲突、到位前地点误述，并以公开命令和浏览器核对研习姿态/标签子范围；AC03 仍待完整动作/回退验收。
- 2026-10-08：M1 第九批按原文通过 SR-XF-007-AC-03：同一掌门公开命令依次休憩、研习、满包等候，34/22/3660、37/23/3833、43/24/4416 三态各自精确存读；桌面浏览器画布点选、活动图集缺失回退及生产 Canvas 独立只读复核通过，定向 25/25。只证实静态姿态、工具、标签和回退真实；AC01/02、完整连续动作、真机/真人与整项 D/I/V/R 均未关闭。
- 2026-10-08：M1 第十批 SR-XF-007-AC-02 独立复核通过：同一掌门以正式公开命令换衣、制作并装备护持小印、真实实战、结算返院，五阶段精确存读，装备实例与身份稳定；生产 Canvas 及隔离桌面浏览器复验。实战活动提示修正为临敌交锋。战场远景法器细节须结合来源档和生产画布核对；AC01、完整连续动作、真机/真人及整项 D/I/V/R 仍未关闭。

本文件由[registry.json](../registry.json)派生；更新台账后执行 `python qa/sr-manager.py refresh`，不单独修改此派生页。
