# SR-XF-002 · 共同实体、动作与内容定义契约补齐

来源：DB-2026-10-05 v1.2；需求版本：1.0；建档日期：2026-10-06。

| 字段 | 值 |
| --- | --- |
| 范围 / 模块 | 前期必需 / 底层 |
| 优先级 / 计划 | P0 / I1 |
| 设计 / 开发 | ready / in_progress |
| 验收 / 发布 | in_progress / not_released_for_this_sr |
| 责任人 / 复核人 | Codex/contracts_save / Codex/sr010_contract_validation（独立设计审阅） |

## 来源、依赖与范围

纳入云岫前期，按依赖推进。

决策来源：U-63, U-93, R-25, U-94。这是继承的U项和作者实施默认；具体新增名称/数值不得伪装成用户逐项批准。

规格：[01-CHARACTERS.md](../../../docs/design/01-CHARACTERS.md)、[02-EQUIPMENT-ARTS.md](../../../docs/design/02-EQUIPMENT-ARTS.md)、[05-RUNTIME-CONTRACTS.md](../../../docs/design/05-RUNTIME-CONTRACTS.md)、[08-LIVING-WORLD.md](../../../docs/design/08-LIVING-WORLD.md)、[09-INTRIGUE-OPPORTUNITIES.md](../../../docs/design/09-INTRIGUE-OPPORTUNITIES.md)、[10-CRISES-RESCUE-DEATH.md](../../../docs/design/10-CRISES-RESCUE-DEATH.md)、[12-CONTENT-AUTHORING.md](../../../docs/design/12-CONTENT-AUTHORING.md)、[06-OPENING-ACCEPTANCE.md](../../../docs/design/06-OPENING-ACCEPTANCE.md)。

依赖：[SR-XF-001](SR-XF-001.md)。

关联既有验收：PERSIST-03, CHAIN-02；本SR的AC细化这些目标，不代表旧版本已经通过。

## 现状与设计缺口

已有schema 6、人物/设施/预约和共享工作单的首轮实现。

目标主表、跨领域字段与内容验证仍未完整落实。

现状是适用旧能力的基线，不表示该SR完整目标已通过。

## 必须补齐的设计交付物

1. 对persons/items/scenes/routes/claims/crises及活动的必填、空值、范围与引用编制契约表。
2. 补齐命令前置、结果事务、错误码、世界步效果优先层和知识投影接口。
3. 定义作者卡到运行内容的编译/校验输入，以及各模块版本兼容矩阵。

## 需求行为

SR-XF-002-REQ-01：生活、战斗、旅行和危机引用同一人物与物品，不另建时钟或生命值。

SR-XF-002-REQ-02：读取UI和渲染不得修改事实；过期命令、重复提交及无效引用给出稳定拒绝原因。

SR-XF-002-REQ-03：新字段接入包含保存、加载和旧数据兼容策略。


## 验收标准

| ID | 情景 / 操作 | 必须看到的结果 | 状态 |
| --- | --- | --- | --- |
| SR-XF-002-AC-01 | 同一人物从山院进入旅行与战斗 | 身份、身体、物品和时间连续，原地点不保留第二个活动身体。 | passed |
| SR-XF-002-AC-02 | 重复提交与只读查询 | 结果事务至多一次，查询前后权威状态一致。 | passed |
| SR-XF-002-AC-03 | 导入引用缺失或版本未知的定义 | 校验定位到具体ID/字段，停止激活并保留原状态，不生成占位奖励。 | passed |

SR-XF-002-AC-01证据：qa/ea-sr-integration-acceptance.mjs；docs/design/STATUS.md；tests/ea-sr-combat-body.test.mjs；dist/ea-sr-story.mjs；dist/ea-sr-runtime.mjs

SR-XF-002-AC-02证据：qa/ea-sr-contracts-acceptance.mjs；docs/requirements/IMPLEMENTATION-2026-10-06.md

SR-XF-002-AC-03证据：qa/ea-sr-contracts-acceptance.mjs；docs/requirements/IMPLEMENTATION-2026-10-06.md

2026-10-07 M0/M1 接续批：D01 补了当前 schema6 主人物山院、旅行、斗法、返院的实际字段/失败/存读映射。共同契约 Node 19/19 复验。另以 qa/ea-sr-integration-acceptance.mjs 的新档正常公开命令链验证疗伤、发现地点、出发、在途、抵达、返院和5次精确 JSON 存读：4命令、世界步至561，person:master 人物记录始终唯一，一件随身继承剑实例 ID/归属/位置与外观配方保留；此为 AC01 的旅行子范围。独立审阅确认斗法同链身份/装备/伤势尚未核验，且 combat.player 仍有独立 hp、缺持久 personId。故 D01/D02 和 AC01 均未关闭，AC02/03 沿用既有通过证据。

2026-10-07 M1 战斗共同身体批：SR 会话持久引用同一掌门/具名参战者；战斗 HP 从人物伤势投影，受击/携药治疗立即写回伤势，胜败撤只释放身体而不重复记伤。同 tick 致胜一击后又遭契约致命反噬时按最终身体事实判败、无胜利奖励。独立只读复核重跑战斗及旧回归 30/30；新增组件测试 8/8 覆盖会话、存读、旧活跃形状迁移与坏引用拒绝。新档正常旅行子链已通过，但未到实战返院；旧活跃档只用合成历史形状，浏览器实战未验，故 AC01、D/I/V/R 均保持原状态。
2026-10-07 正常新档公开操作链从已完成五人匠人档继续，完成第9/10/11境并在世界步474439保存；后续世界步483700的晶石采购因商人现货6、补货来源0被正式命令拒绝。真实来源/远方采集和成本尚待核对，尚未进入同档实战返院；AC01与完整D/I/V/R保持原状态。

2026-10-07 M1 第五批：从 /tmp/immortal-m1-well-realm11-earned.json（seed 618033、有来源山院第11境有效存档）继续，以公开命令到第12境、调查、三场实战及三名固定责任人死亡结算，并分别完成 return/rebuild 结局和重复访问。SR002-AC01 同一链逐点存读档保存在仓库外 /tmp/immortal-m1-sr002-ac01-audit/：出发前/在途世界步698140，抵达698340，首战698952，受伤战斗699701，返程在途699980，返院700505。独立只读复核18个阶段档精确重载不变：唯一 person:master、单一身体活动、铁剑 item:sr-equipment:1 与法袍 item:sr-equipment:5 的归属/槽位连续；受伤档人物伤势23.5602与战场HP 146/191投影一致，时钟单调。319条公开命令、80次精确存读，两个结局均至世界步703301。真实浏览器用同源首战档验证可导入、实战界面、保存和刷新续玩；AC01按其公开命令/运行时要求登记 passed。该长链从有来源的正常存档续跑，另一次独立新档采购路径至第7境时耗尽当前可用原料，未据其判定玩法死锁。完整SR002的 D/I/V/R、触控/实机与发布门槛继续保持原状态。

2026-10-08 M1 设计批：D01 字段级共同实体/命令事务/世界步/知识投影/作者卡编译及主子版本兼容矩阵补齐；D02 独立复核 PASS。现行兼容字段不一致可能使旧离宗历史人获得院内脚点，版本组合门禁和知识送达时刻仍属 I01 代码缺口；D01/D02 完成不提升 I/V/R、旧档全兼容或浏览器验收。

2026-10-08 M1 旧离宗窄项：合法 v5 离宗历史升级后保留身份/原因/记忆、时钟/资源/RNG和源文，不再凭缺字段生成活跃生命周期或院内脚点；世界场景不画该人，传话发起与伪造进行中传话存档均拒绝。独立专项 3/3、共同契约 24/24、世界相关 21/21，源档精确存读。外观/日程/生命史仍由旧兼容路径合成，版本组合及逐人送达时刻仍属 I01；I/V/R 不提升。

## 开发任务

| 任务 | 工作 | 状态 | 前置 | 责任人 |
| --- | --- | --- | --- | --- |
| SR-XF-002-D01 | 设计补齐：交付：对persons/items/scenes/routes/claims/crises及活动的必填、空值、范围与引用编制契约表。；补齐命令前置、结果事务、错误码、世界步效果优先层和知识投影接口。；定义作者卡到运行内容的编译/校验输入，以及各模块版本兼容矩阵。；填实必需参数并标记U/R/T来源。 | done | 无 | Codex/root |
| SR-XF-002-D02 | 契约与内容审阅：审阅共同实体、动作与内容定义契约补齐与依赖契约（SR-XF-001）的字段、时序、失败及恢复；逐项核对本SR的REQ/AC。 | done | SR-XF-002-D01 | Codex/sr010_contract_validation |
| SR-XF-002-I01 | 开发与集成：在底层模块实现共同实体、动作与内容定义契约补齐；交付SR-XF-002-REQ-01至REQ-03，接入相关数据、行为、素材、UI和恢复，提交关联SR。 | todo | SR-XF-002-D02 | 待分配 |
| SR-XF-002-V01 | 验收与兼容：执行SR-XF-002-AC-01至AC-03及PERSIST-03、CHAIN-02；登记实际结果、兼容和设备证据边界。 | todo | SR-XF-002-I01 | 待分配 |
| SR-XF-002-R01 | 发布与关闭：完成所需源码/运行时发布核对、交接和未覆盖说明；本轮用户不要求上传QA过程产物。 | todo | SR-XF-002-V01 | 待分配 |

SR-XF-002-D01证据：docs/requirements/design/SR-XF-002-030.md；docs/requirements/design/SR-XF-002-030.md

SR-XF-002-D02证据：docs/requirements/design/SR-XF-002-030.md

SR-XF-002-V01证据：qa/ea-sr-contracts-acceptance.mjs；docs/design/STATUS.md；qa/ea-sr-integration-acceptance.mjs

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

- docs/requirements/design/SR-XF-002-030.md
- docs/requirements/IMPLEMENTATION-2026-10-06.md
- dist/ea-campaign.mjs
- dist/ea-sr-combat.mjs
- dist/ea-opening-sim.mjs
- tests/ea-sr-combat-body.test.mjs
- qa/ea-sr-combat-release-acceptance.mjs
- docs/design/STATUS.md
- qa/ea-sr-integration-acceptance.mjs

- 2026-10-06：由v1.2设计缺口审计建立SR；新增内容和参数遵循作者默认，不冒充用户逐项确认。
- 2026-10-06：用户授权目标模式、多agent并行开发与验收；启动D01，按现有契约展开模块设计，未将建档或局部实现标作交付。
- 2026-10-07：M0/M1 接续批完成局部设计、修复和独立复核；具体通过范围与缺口见 acceptance_notes 和 STATUS。整项 D/I/V/R 及 AC 状态保持原门槛。
- 2026-10-07：M1 战斗共同身体或房屋/人物画稿首批局部实现与独立验收；整项原门槛未关闭。
- 2026-10-07：M1 正常筑基资源子链：由有来源匠人档公开营造采石场，实产并搬运青石；补足五名门人后世界步439776正式建灵泉。独立只读复核核对两笔石料交付和65造价，并从该档公开邀请、生产、搬运6晶到公库，三次精确存读通过。完整山院→旅行→实战→返院尚未完成，AC01与D/I/V/R不提升。
- 2026-10-07：M1 第五批以有来源的正常公开命令链逐点验收山院、在途、抵达、受伤战斗与返院；独立复核确认 SR002-AC01 passed，整项门槛继续。
- 2026-10-08：字段级契约、命令事务与知识投影、作者卡编译及版本矩阵已补齐；I01代码差距单列
- 2026-10-08：独立逐段核对旧离宗例外、主子版本矩阵、条件模块与I01接缝，结论PASS
- 2026-10-08：SR002 D01/D02 设计与独立审阅完成；将历史离宗人兼容、版本门禁及知识送达时刻列入 I01，不宣称实现。
- 2026-10-08：2026-10-08 M1 旧离宗窄项：合法 v5 离宗历史升级后保留身份/原因/记忆、时钟/资源/RNG和源文，不再凭缺字段生成活跃生命周期或院内脚点；世界场景不画该人，传话发起与伪造进行中传话存档均拒绝。独立专项 3/3、共同契约 24/24、世界相关 21/21，源档精确存读。外观/日程/生命史仍由旧兼容路径合成，版本组合及逐人送达时刻仍属 I01；I/V/R 不提升。

本文件由[registry.json](../registry.json)派生；更新台账后执行 `python qa/sr-manager.py refresh`，不单独修改此派生页。
