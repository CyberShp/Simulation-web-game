# SR-XF-010 · 位置库存、搬运与公私账本

来源：DB-2026-10-05 v1.2；需求版本：1.0；建档日期：2026-10-06。

| 字段 | 值 |
| --- | --- |
| 范围 / 模块 | 前期必需 / 经营 |
| 优先级 / 计划 | P0 / I1 |
| 设计 / 开发 | ready / in_progress |
| 验收 / 发布 | in_progress / not_released_for_this_sr |
| 责任人 / 复核人 | Codex/economy_people / Codex/root（集成） |

## 来源、依赖与范围

纳入云岫前期，按依赖推进。

决策来源：U-63, U-93, R-25, U-94。这是继承的U项和作者实施默认；具体新增名称/数值不得伪装成用户逐项批准。

规格：[05-RUNTIME-CONTRACTS.md](../../../docs/design/05-RUNTIME-CONTRACTS.md)、[07-ECONOMY-ORGANIZATION.md](../../../docs/design/07-ECONOMY-ORGANIZATION.md)、[14-EARLY-GAME-DETAILED-DESIGN.md](../../../docs/design/14-EARLY-GAME-DETAILED-DESIGN.md)。

依赖：[SR-XF-002](SR-XF-002.md)、[SR-XF-003](SR-XF-003.md)、[SR-XF-009](SR-XF-009.md)。

关联既有验收：ECON-02, ECON-03；本SR的AC细化这些目标，不代表旧版本已经通过。

## 现状与设计缺口

已有公库/个人赠药及共享工作单预留的局部事实。

D01/D02 已复核；r20 局部实现公库、掌门私物和商人库存的五数只读汇总。完整 ECON-02/03、跨订单取消后的产权恢复、所有中断工单状态及目标设备仍待验收。

现状是适用旧能力的基线，不表示该SR完整目标已通过。

## 必须补齐的设计交付物

1. stockpile位置、容量、拥有者/保管者和资源最小单位表。
2. 取料、携带、在途、交付、损失与归还的运输状态机及批量。
3. 与施工/生产预约接口、公私账本、取消与迁建中的库存恢复。

## 需求行为

SR-XF-010-REQ-01：总量、可用、预留、在途可解释；同一材料/物品不出现在两处可用库存。

SR-XF-010-REQ-02：搬运需要可达路线和实际到场，工地未收料不能虚假使用。

SR-XF-010-REQ-03：共有和个人财物权限分开，入宗不自动没收或复制装备。


## 验收标准

| ID | 情景 / 操作 | 必须看到的结果 | 状态 |
| --- | --- | --- | --- |
| SR-XF-010-AC-01 | 从仓库搬料到工地 | 库存与在途逐段守恒，到场交付后才供合法工序使用。 | passed |
| SR-XF-010-AC-02 | 路断/搬运者受伤后取消与重载 | 材料留在有记录位置或走明确恢复事务，不丢失不重复返还。 | passed |
| SR-XF-010-AC-03 | 赠予、借用和公库竞争 | 权限与所有权正确，一份预留不能被第二订单消费。 | passed |

SR-XF-010-AC-01证据：qa/ea-sr-010-construction-logistics-public-acceptance.mjs；qa/ea-sr-building-change-public-acceptance.mjs；dist/ea-sr-spatial.mjs；dist/ea-sr-economy.mjs；docs/design/STATUS.md

SR-XF-010-AC-02证据：qa/ea-sr-010-transport-interrupt-public-acceptance.mjs；qa/ea-sr-010-construction-logistics-public-acceptance.mjs；dist/ea-sr-economy.mjs；docs/design/STATUS.md

SR-XF-010-AC-03证据：qa/ea-sr-010-property-public-acceptance.mjs；qa/ea-sr-growth-acceptance.mjs；dist/ea-sr-economy.mjs；dist/ea-sr-equipment.mjs；docs/design/STATUS.md


2026-10-08 M2 工地物流缺口复现：正常公开疗伤后在世界步200营造灵草田，下单同刻公库木65→40、石45→35，有逻辑材料预约但无工地位置库存或搬运批次；前后精确存读档在 /tmp/immortal-m2-sr010-gap。SR010-AC01 保持 not_run，待补材料实际到场/逐段守恒并复核现有营造与旧档。
2026-10-08 M2 AC01：正常公开灵草田档在主屋预留、掌门携料、工地交付、安装和完工各阶段木石数量守恒；交付前进度0，取消后材料实际返仓才一次退款，旧无材料流在建档保留原结算。定向7/7、空间34/34、相关场景UI10/10、升级/迁建/拆除公开回归4/4；独立只读复核施工条真实阶段/百分比。隔离桌面浏览器另确认建成和在途取消返仓。受伤/断路仅故障注入，AC02/03和整项仍未完成。
2026-10-08 M2 AC03：公开命令来源的赠药与入宗、同所有者私仓搬运、远程赠物绕行拒绝；隔离医疗触发后内部只取公药一剂，公开命令不可伪造。原借剑由借物人实际走到主屋公库，抵达后 30 世界步完成同一实例归还；公库末 40 木只准一单预约。各阶段精确存读，权限专项6/6、装备成长回归45/45；医药伤势为标注的注入，网页真机未验，整项 D/I/V/R 不关闭。
2026-10-08 r22 相邻物权复验：公库百工单预留/取货/取消/返院保留公共权限，只有玩家明确划拨才转掌门私物；位置库存4/4、产权6/6根复跑。SR010完整I/V/R与目标设备仍待。

## 开发任务

| 任务 | 工作 | 状态 | 前置 | 责任人 |
| --- | --- | --- | --- | --- |
| SR-XF-010-D01 | 设计补齐：交付：stockpile位置、容量、拥有者/保管者和资源最小单位表。；取料、携带、在途、交付、损失与归还的运输状态机及批量。；与施工/生产预约接口、公私账本、取消与迁建中的库存恢复。；填实必需参数并标记U/R/T来源。 | done | 无 | Codex/economy_people |
| SR-XF-010-D02 | 契约与内容审阅：审阅位置库存、搬运与公私账本与依赖契约（SR-XF-002、SR-XF-003、SR-XF-009）的字段、时序、失败及恢复；逐项核对本SR的REQ/AC。 | done | SR-XF-010-D01 | Codex/root |
| SR-XF-010-I01 | 开发与集成：在经营模块实现位置库存、搬运与公私账本；交付SR-XF-010-REQ-01至REQ-03，接入相关数据、行为、素材、UI和恢复，提交关联SR。 | in_progress | SR-XF-010-D02 | 待分配 |
| SR-XF-010-V01 | 验收与兼容：执行SR-XF-010-AC-01至AC-03及ECON-02、ECON-03；登记实际结果、兼容和设备证据边界。 | todo | SR-XF-010-I01 | 待分配 |
| SR-XF-010-R01 | 发布与关闭：完成所需源码/运行时发布核对、交接和未覆盖说明；本轮用户不要求上传QA过程产物。 | todo | SR-XF-010-V01 | 待分配 |

SR-XF-010-D01证据：docs/requirements/design/SR-XF-007-011-019-026-027.md；docs/design/05-RUNTIME-CONTRACTS.md；dist/ea-sr-economy.mjs；dist/ea-sr-spatial.mjs；dist/ea-sr-equipment.mjs

SR-XF-010-D02证据：docs/requirements/design/SR-XF-007-011-019-026-027.md；qa/ea-sr-010-study-budget-contract-acceptance.mjs；qa/ea-sr-010-construction-logistics-public-acceptance.mjs；dist/ea-sr-economy.mjs

SR-XF-010-I01证据：dist/ea-sr-economy.mjs；qa/ea-sr-economy-acceptance.mjs；2026-10-08 r20: qa/ea-sr-010-inventory-summary-acceptance.mjs 4/4, adjacent SR010 25/25, market-order 7/7, UI 17/17; local Chromium isolated import showed public/private/merchant five-number cards; source f8b8912244d05a7c101d5dc8b81dc2502d41d5d4 and Pages 098cc0511096de37b5da79cf01cceb65e68e7727 built, all 162 packaged text blobs matched

SR-XF-010-V01证据：dist/ea-sr-economy.mjs；qa/ea-sr-economy-acceptance.mjs

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
- dist/ea-sr-economy.mjs
- qa/ea-sr-economy-acceptance.mjs
- qa/ea-sr-010-construction-logistics-public-acceptance.mjs
- qa/ea-sr-building-change-public-acceptance.mjs
- dist/ea-sr-spatial.mjs
- docs/design/STATUS.md
- qa/ea-sr-010-property-public-acceptance.mjs
- qa/ea-sr-growth-acceptance.mjs
- dist/ea-sr-equipment.mjs
- qa/ea-sr-010-study-budget-contract-acceptance.mjs

- 2026-10-06：由v1.2设计缺口审计建立SR；新增内容和参数遵循作者默认，不冒充用户逐项确认。
- 2026-10-06：用户授权目标模式、多agent并行开发与验收；启动D01，按现有契约展开模块设计，未将建档或局部实现标作交付。
- 2026-10-07：M1 正常成长链定位掌门实物搬运完成后路线已清而 action 仍为 walk，下一正式命令被存档校验拒绝；结束/取消搬运只在本人物持有对应活动时复位残留行走。经济定向52/52通过，独立只读复核另查取料前和携带中取消4/4及精确存读。此为局部稳定性修复，AC及整项状态不提升。
- 2026-10-08：2026-10-08 M2 工地物流缺口复现：正常公开疗伤后在世界步200营造灵草田，下单同刻公库木65→40、石45→35，有逻辑材料预约但无工地位置库存或搬运批次；前后精确存读档在 /tmp/immortal-m2-sr010-gap。SR010-AC01 保持 not_run，待补材料实际到场/逐段守恒并复核现有营造与旧档。
- 2026-10-08：新施工材料流按主屋预留、携带、工地、安装分段守恒，取消实物返仓后退款一次，兼容旧在建档；独立复核 AC01 正常公开链和界面后记 passed，AC02/03 保留。
- 2026-10-08：M2 第八批：公开赠药、同所有者搬运、跨所有者私财拒绝、内部自主取公药、实际步行归还原借剑及公库末批竞争按 AC03 原文复验；公开权限 6/6，装备成长 45/45，精确存读通过。AC03 passed；完整 D/I/V/R 与网页真机仍待。
- 2026-10-08：SR010-D01 仓位/容量/归属与最小计量、搬运状态和失败恢复、施工四处守恒、生产/迁建及公私权限已写入当前设计小节，根 Agent 对照原 D01 交付项与当前配置独立审阅，记 D01 done。D02 跨规格差异另行处理，设计整体仍 draft。
- 2026-10-08：独立跨规格复核完成：道韵预算与运输边界、施工取消返料、仓位归属位置校验和公库容量结算已统一；旧档保留原值与在途单。
- 2026-10-08：r20 ships read-only five-number inventory summaries by public, master-private and merchant ownership; full ECON-02/03 and cancellation property paths remain open

本文件由[registry.json](../registry.json)派生；更新台账后执行 `python qa/sr-manager.py refresh`，不单独修改此派生页。
