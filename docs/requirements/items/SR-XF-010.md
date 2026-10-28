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

决策来源：U-63, U-93, R-25, U-94, U-105, R-32, U-120, U-123, U-124, U-149, R-49, U-150, R-50, U-151, R-43, U-163, R-52, T-18, U-166, R-54, T-21, U-170。这是继承的U项和作者实施默认；具体新增名称/数值不得伪装成用户逐项批准。

规格：[05-RUNTIME-CONTRACTS.md](../../../docs/design/05-RUNTIME-CONTRACTS.md)、[07-ECONOMY-ORGANIZATION.md](../../../docs/design/07-ECONOMY-ORGANIZATION.md)、[14-EARLY-GAME-DETAILED-DESIGN.md](../../../docs/design/14-EARLY-GAME-DETAILED-DESIGN.md)、[SECT-GROWTH-PLAN.md](../../../docs/SECT-GROWTH-PLAN.md)、[41-COURTYARD-VALLEY-IMPLEMENTATION.md](../../../docs/design/41-COURTYARD-VALLEY-IMPLEMENTATION.md)、[51-COURTYARD-MANAGEMENT-INTEGRATION.md](../../../docs/design/51-COURTYARD-MANAGEMENT-INTEGRATION.md)、[46-CONTINUOUS-DOMAIN-FOUNDATION.md](../../../docs/design/46-CONTINUOUS-DOMAIN-FOUNDATION.md)、[52-EAST-TERRACE-INTEGRATION.md](../../../docs/design/52-EAST-TERRACE-INTEGRATION.md)、[45-SECT-IDLE-SLICE.md](../../../docs/design/45-SECT-IDLE-SLICE.md)、[53-COURTYARD-AUTONOMY-ACCEPTANCE.md](../../../docs/design/53-COURTYARD-AUTONOMY-ACCEPTANCE.md)、[56-COURTYARD-FOOD-SUPPLY.md](../../../docs/design/56-COURTYARD-FOOD-SUPPLY.md)、[58-GOLDEN-CORE-PRESET-BUILDINGS.md](../../../docs/design/58-GOLDEN-CORE-PRESET-BUILDINGS.md)、[62-EAST-SERVICES-INTEGRATION.md](../../../docs/design/62-EAST-SERVICES-INTEGRATION.md)、[69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md](../../../docs/design/69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md)、[75-SECT-SUSTENANCE.md](../../../docs/design/75-SECT-SUSTENANCE.md)、[76-DISCIPLE-CULTIVATION-PROGRESSION.md](../../../docs/design/76-DISCIPLE-CULTIVATION-PROGRESSION.md)、[77-DISCIPLE-BREAKTHROUGH-LOOP.md](../../../docs/design/77-DISCIPLE-BREAKTHROUGH-LOOP.md)、[86-MEDICINE-MATERIALS.md](../../../docs/design/86-MEDICINE-MATERIALS.md)、[88-SECT-CONCURRENCY.md](../../../docs/design/88-SECT-CONCURRENCY.md)、[89-DISCIPLE-CRAFT-REQUEST.md](../../../docs/design/89-DISCIPLE-CRAFT-REQUEST.md)、[90-DISCIPLE-ADVANCEMENT.md](../../../docs/design/90-DISCIPLE-ADVANCEMENT.md)、[91-EXPEDITION-GROWTH.md](../../../docs/design/91-EXPEDITION-GROWTH.md)。

依赖：[SR-XF-002](SR-XF-002.md)、[SR-XF-003](SR-XF-003.md)、[SR-XF-009](SR-XF-009.md)。

关联既有验收：ECON-02, ECON-03, GROWTH-03, GROWTH-04, GROWTH-06, GROWTH-08, GROWTH-11；本SR的AC细化这些目标，不代表旧版本已经通过。

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

SR-XF-010-AC-01证据：tests/acceptance/ea-sr-010-construction-logistics-public-acceptance.mjs；tests/acceptance/ea-sr-building-change-public-acceptance.mjs；src/simulation/ea-sr-spatial.mjs；src/simulation/ea-sr-economy.mjs；docs/design/STATUS.md

SR-XF-010-AC-02证据：tests/acceptance/ea-sr-010-transport-interrupt-public-acceptance.mjs；tests/acceptance/ea-sr-010-construction-logistics-public-acceptance.mjs；src/simulation/ea-sr-economy.mjs；docs/design/STATUS.md；docs/design/90-DISCIPLE-ADVANCEMENT.md；docs/design/91-EXPEDITION-GROWTH.md

SR-XF-010-AC-03证据：tests/acceptance/ea-sr-010-property-public-acceptance.mjs；tests/acceptance/ea-sr-growth-acceptance.mjs；src/simulation/ea-sr-economy.mjs；src/simulation/ea-sr-equipment.mjs；docs/design/STATUS.md

2026-10-08 M2 工地物流缺口复现：正常公开疗伤后在世界步200营造灵草田，下单同刻公库木65→40、石45→35，有逻辑材料预约但无工地位置库存或搬运批次；前后精确存读档在 /tmp/immortal-m2-sr010-gap。SR010-AC01 保持 not_run，待补材料实际到场/逐段守恒并复核现有营造与旧档。
2026-10-08 M2 AC01：正常公开灵草田档在主屋预留、掌门携料、工地交付、安装和完工各阶段木石数量守恒；交付前进度0，取消后材料实际返仓才一次退款，旧无材料流在建档保留原结算。定向7/7、空间34/34、相关场景UI10/10、升级/迁建/拆除公开回归4/4；独立只读复核施工条真实阶段/百分比。隔离桌面浏览器另确认建成和在途取消返仓。受伤/断路仅故障注入，AC02/03和整项仍未完成。
2026-10-08 M2 AC03：公开命令来源的赠药与入宗、同所有者私仓搬运、远程赠物绕行拒绝；隔离医疗触发后内部只取公药一剂，公开命令不可伪造。原借剑由借物人实际走到主屋公库，抵达后 30 世界步完成同一实例归还；公库末 40 木只准一单预约。各阶段精确存读，权限专项6/6、装备成长回归45/45；医药伤势为标注的注入，网页真机未验，整项 D/I/V/R 不关闭。
2026-10-08 r22 相邻物权复验：公库百工单预留/取货/取消/返院保留公共权限，只有玩家明确划拨才转掌门私物；位置库存4/4、产权6/6根复跑。SR010完整I/V/R与目标设备仍待。

2026-10-09 U-105 / R-32：山域成长的迁居、外谷/分峰配送、货位、所有权与预约继续使用本SR已有实体搬运及守恒契约，关联 docs/SECT-GROWTH-PLAN.md 的 GROWTH-03/04/06/08/11。本批仅补设计来源与接缝，原AC文案、状态、证据及D/I/V/R保持；新山域实际流程与负载仍待对应GROWTH验证。

2026-10-11 云岫首畦子批：本地 Godot Web 隔离档实点公库向田边送 2 份种苗，公库灵草 6→4，田边 0→2；下种消耗田边 2，首收 13.8 份入田边，公库保持 4。定向测试覆盖缺现场种苗拒绝、运输、播种存读与首收守恒。完整物权、跨峰搬运和目标设备未验，状态不推进。

2026-10-12 U-123：第一炉成丹2份分至随身1／公库1，存读守恒；山谷队伍采草6份，返院工单搬草6加粮3，公库草4→10，队伍归零。炼药2／2、山谷5／5。 局部证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。

2026-10-12 U-123 首战本地网页：最终本地网页服用同炉随身回春散1份，随身1→0、总丹2→1、伤势14.6153→0，返院存读仍保剩余1份；完整账本 AC 状态保持。 证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。
2026-10-12 Issue #5：最新main6000秒实验16笔生产/14笔微量灵石，修复显式receipt、9位新计算精度、工资封顶、事务提交与运输严格余额。专项12/12，正常公开开局2/2、丹炉公开链1/1；旧数量和事实逐字保留，不推进完整SR状态。见 docs/design/ISSUE-5-PRODUCTION-ACCOUNTING.md。

2026-10-18 U-164/U-165局部：多Agent完成林长风门籍规则及同窗交互首轮，规则8/8、相关11/11，主Agent联合供粮/操作33/33；亲传Electron专项9项，范围限当时人物交互。用户明确扩大主殿山域、整体绘制采伐场、所有建筑完全预设并由人物实际到场修建；院前临时营造入口与独立素材已撤下。下一步先确认整体场景和稳定建位，再接施工与三人同源长验。二十分钟、当前桌面包、Windows及完整SR/AC尚未完成，整项状态保持。

2026-10-25 宗门供给与门人自主突破本批完成：补齐既有炼丹院务奖励入口、修复突破通勤互等及让行工位接缝；正常桌面源280680经实际补种/两批采粮交库至282724，再自主修炼、唯一扣24灵石/8灵草，于284309完成180工步升至炼气二层。最终284504，五人供给正常、饥荒0；准备及核心共5组原生保存/关闭重开一致，公开人物窗只读正确，两个成功段errors均0。原走近超时场景现点击3.72秒通过15秒门限，仍有明显等待。空间相邻37/37、根奖励/突破/通勤16/16通过；旧requester-clear基线失败、Windows、长期平衡、完整SR/AC及发布状态保持。 详见 docs/design/77-DISCIPLE-BREAKTHROUGH-LOOP.md。

2026-10-25 药物材料自主筹备与口粮保障完成本批：缺草/水通过既有生产候选、真实工位和运输补足；普通灵泉新增显式取洁水/凝灵晶选择，未完批次拒切。足粮场景从零公共草水经取水、种采、搬运、四阶段炼制，于4624公库入药2；低粮场景初始5粮，722实运30粮至35，727才开始药物任务，4909药2/粮41，全程饥荒0。缺人和旧承诺100步保持；61项独立定向/相邻单测、最终四场景10类检查、实际Chrome管理组件6类检查通过。修复首次洁水入库缺省键与种粮压过运粮的实际问题，原失败保留；最终场景14份/组件5份散列前后一致并匹配当前源码，错误为空。按U-172配置设施和初始物资，未做建井长链、原生整局、存读及长期供需平衡；完整SR/AC和发布状态保持。
2026-10-25 三至五人并行经营完成本批：3/5名门人另加掌门，同钟生产、修行与历练均有实际进度；各跨三次日结，每日分别8/12粮，全程饥荒0。两档均炼2药于2168归库，三人实运11粮后余35；五人两次真实伤10→0服药并归院、本人返工，实运13粮后余23，药物总账1+2−2=1。修复未完功课和有效承诺被出游抢占，以及承诺到期先续约导致无法出游；既有夜休/恢复/突破优先。根61项定向及相邻单测、独立6项复核、最终两场景11类检查通过，17份散列前后及当前一致，工程检查通过。初始住宅非法入口和验收器遗漏夜休条件的失败报告保留；按U-172配置场景，原生整局、Windows、存读长链及长期平衡未验，完整SR/AC及发布状态保持。
2026-10-25 当面商议炼丹与成药交付完成本批：统一人物窗选丹方、看实际费用与现场缺口，由门人按资格、意愿及原承诺答复。正式商议筑基丹后，本人完成四阶段780工步，2099现场成药1、2689实际运抵公库、2690登记交付；医理80→80.6、药理35.1→35.7。缺料/资格/承诺不足与本人不愿分别反馈，远距和隐藏药理禁止商议，重复请求不另开炉；重伤退款和途中中止保留实际投入与实物。共同生活成员的完整人物窗入口已补齐；阅读暂停下进度直接投影实际炉单与运单。根53项不同定向/相邻测试、末次8项投影相关复验、实际Chromium人物窗与七场景11类检查通过；16份散列前后及当前一致，浏览器错误0。按U-172配置初始条件；原生整局、Windows、存读长链及长期平衡未验，完整SR/AC与发布状态保持。

## 开发任务

| 任务 | 工作 | 状态 | 前置 | 责任人 |
| --- | --- | --- | --- | --- |
| SR-XF-010-D01 | 设计补齐：交付：stockpile位置、容量、拥有者/保管者和资源最小单位表。；取料、携带、在途、交付、损失与归还的运输状态机及批量。；与施工/生产预约接口、公私账本、取消与迁建中的库存恢复。；填实必需参数并标记U/R/T来源。 | done | 无 | Codex/economy_people |
| SR-XF-010-D02 | 契约与内容审阅：审阅位置库存、搬运与公私账本与依赖契约（SR-XF-002、SR-XF-003、SR-XF-009）的字段、时序、失败及恢复；逐项核对本SR的REQ/AC。 | done | SR-XF-010-D01 | Codex/root |
| SR-XF-010-I01 | 开发与集成：在经营模块实现位置库存、搬运与公私账本；交付SR-XF-010-REQ-01至REQ-03，接入相关数据、行为、素材、UI和恢复，提交关联SR。 | in_progress | SR-XF-010-D02 | 待分配 |
| SR-XF-010-V01 | 验收与兼容：执行SR-XF-010-AC-01至AC-03及ECON-02、ECON-03；登记实际结果、兼容和设备证据边界。 | todo | SR-XF-010-I01 | 待分配 |
| SR-XF-010-R01 | 发布与关闭：完成所需源码/运行时发布核对、交接和未覆盖说明；本轮用户不要求上传QA过程产物。 | todo | SR-XF-010-V01 | 待分配 |

SR-XF-010-D01证据：docs/requirements/design/SR-XF-007-011-019-026-027.md；docs/design/05-RUNTIME-CONTRACTS.md；src/simulation/ea-sr-economy.mjs；src/simulation/ea-sr-spatial.mjs；src/simulation/ea-sr-equipment.mjs

SR-XF-010-D02证据：docs/requirements/design/SR-XF-007-011-019-026-027.md；tests/acceptance/ea-sr-010-study-budget-contract-acceptance.mjs；tests/acceptance/ea-sr-010-construction-logistics-public-acceptance.mjs；src/simulation/ea-sr-economy.mjs

SR-XF-010-I01证据：src/simulation/ea-sr-economy.mjs；tests/acceptance/ea-sr-economy-acceptance.mjs；2026-10-08 r20: tests/acceptance/ea-sr-010-inventory-summary-acceptance.mjs 4/4, adjacent SR010 25/25, market-order 7/7, UI 17/17; local Chromium isolated import showed public/private/merchant five-number cards; source f8b8912244d05a7c101d5dc8b81dc2502d41d5d4 and Pages 098cc0511096de37b5da79cf01cceb65e68e7727 built, all 162 packaged text blobs matched；docs/design/49-P0-P2-COURTYARD-PROGRESS.md；2026-10-15 U-147/R-47：院务/人物/工位/物资/研习操作、保存失败保护和疗伤收据重放；47/47 Node检查。浏览器内核缺失且官方下载失败，实际UI与桌面未验，完整P0—P2及SR/AC状态保持。

SR-XF-010-V01证据：src/simulation/ea-sr-economy.mjs；tests/acceptance/ea-sr-economy-acceptance.mjs；docs/design/49-P0-P2-COURTYARD-PROGRESS.md；2026-10-15 U-147/R-47：院务/人物/工位/物资/研习操作、保存失败保护和疗伤收据重放；47/47 Node检查。浏览器内核缺失且官方下载失败，实际UI与桌面未验，完整P0—P2及SR/AC状态保持。

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
- src/simulation/ea-sr-economy.mjs
- tests/acceptance/ea-sr-economy-acceptance.mjs
- tests/acceptance/ea-sr-010-construction-logistics-public-acceptance.mjs
- tests/acceptance/ea-sr-building-change-public-acceptance.mjs
- src/simulation/ea-sr-spatial.mjs
- docs/design/STATUS.md
- tests/acceptance/ea-sr-010-property-public-acceptance.mjs
- tests/acceptance/ea-sr-growth-acceptance.mjs
- src/simulation/ea-sr-equipment.mjs
- tests/acceptance/ea-sr-010-study-budget-contract-acceptance.mjs
- docs/art/system-ui-20261012/RUNTIME.md
- tests/unit/web/ea-system-ui-projection.test.mjs
- 2026-10-12 U-120：行囊读取真实位置库存与所有权；Node 专项验证只读、非法数量拒绝、实际搬运和存读守恒。本地 Chromium 公库 16 份灵草取 3 份后为公库 13／随身 3，送回公库 16，保存刷新保持。丹药使用采用明确人工库存边界 QA，未覆盖生产取得链；完整 SR/AC 状态保持。
- docs/art/COURTYARD-VALLEY-2026-10-12.md
- tests/unit/web/ea-mountain-alchemy.test.mjs
- tests/unit/web/ea-mountain-valley.test.mjs
- tests/acceptance/ea-sr-production-accounting-acceptance.mjs
- docs/design/ISSUE-5-PRODUCTION-ACCOUNTING.md
- docs/art/OPENING-CHAIN-2026-10-12.md；2026-10-12 U-124：采木采石送公库、药圃至丹房、成药携带与公库入账、采回6灵草及3余粮真实搬运；最终存读一致。 仅增局部证据，完整 SR/AC 状态保持。
- docs/art/OPENING-GUIDANCE-2026-10-13.md；2026-10-13 U-124：新增携药仍走真实搬运；实际随身取得、重复/空炉保护及刷新前后完整存档相等。 仅增局部证据，完整 SR/AC 状态保持。
- docs/design/49-P0-P2-COURTYARD-PROGRESS.md；2026-10-15 U-147/R-47：院务/人物/工位/物资/研习操作、保存失败保护和疗伤收据重放；47/47 Node检查。浏览器内核缺失且官方下载失败，实际UI与桌面未验，完整P0—P2及SR/AC状态保持。
- docs/design/50-COURTYARD-UI-DESIGN-AUDIT.md；2026-10-15 U-148/R-48：四页及关联入口30项设计审查与7条后续场景；两处物流问题由正常命令复现，运行代码未修，实际UI未验，完整状态保持。
- docs/design/51-COURTYARD-MANAGEMENT-INTEGRATION.md；2026-10-15 U-149/R-49：四页与共用详情、单趟40份留苗搬运、落地回收和保存恢复接通；组件与相邻回归57/57，同一检查点真实桌面387.845秒13/13、最终包页面8/8、恢复链9/9，原生选择文件/预检/恢复及手动暂停已验。完整新档、规模、对话/突破、跨区施工、20分钟自主与Windows待接；完整D/I/V/R和AC状态保持。
- docs/design/52-EAST-TERRACE-INTEGRATION.md
- tests/acceptance/courtyard-east-desktop.mjs
- docs/design/53-COURTYARD-AUTONOMY-ACCEPTANCE.md
- tests/acceptance/courtyard-autonomy-desktop.mjs
- tests/acceptance/courtyard-autonomy-audit.py
- docs/design/56-COURTYARD-FOOD-SUPPLY.md
- tests/unit/courtyard/sect-food.test.mjs
- tests/acceptance/courtyard-food-desktop.mjs
- docs/design/57-THREE-RESIDENT-COURTYARD.md
- docs/design/58-GOLDEN-CORE-PRESET-BUILDINGS.md
- docs/art/golden-core-domain-20261018/README.md
- docs/design/62-EAST-SERVICES-INTEGRATION.md
- docs/design/69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md
- docs/design/69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md；2026-10-20：六居民同源生活已完成settlement-02：tick190800公库食粮16→4，实际消耗12，5位门人供给事实均supplied且starvation=0，原生暂停与关闭重开完整世界相等。living-03在东台返院路触发身体走面失配，正常暂停保存至tick191089；路径与呈现修复仍待living-04同档实机复验。现有三项未领院务奖励（引灵入府、仙途初成、安居有粮）已接桌面入口与整包容量守卫；专项5/5、直接相关回归7/7，正常档实际领取未验。GC21–23仅布局候选。下一步接living-04、GC25/26正常筹料营建及纸胎实收、四段成药回库；完整SR/AC状态保持。
- docs/design/69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md；2026-10-20：living-04从living-03原生停点继续并通过：顾听澜在tick191090实际使用床1；裴照雪tick191170完成床4入住，191171观测为executing。掌门真实采粮368于191593取得16份，运输369于191626送入公库；192000日结5位门人均supplied且starvation=0。实测118.716135秒，原生暂停与关闭重开完整世界相等，来源及运行文件散列不变，错误0。裴照雪继承的非法脚点在实际运行tick191090从(123.5,45)恢复至(123.5,45.1)，原活动、起始tick和床4预约继续；恢复后按严格身体、门槛与道路判据检查。living-03失败及原始快照继续保留。封存源tick192003 SHA 1b19735d324326bfb6682f60160229e26f054e24da46bd20551318a8b2e9ef42。筹料、奖励实际领取与GC25/26正式生产结果未验；完整SR/AC保持。
- docs/design/69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md；funding-01在192003正式领取三项既有奖励并精确原生重开通过；随后renderer不响应，725.897205秒段以failed收口。lastHarnessObservedTick192200不代表落盘终点；当前可恢复来源为funding-01/native-preserved-while-waiting.json，tick192063，SHA cf63afd0879a0669f46d3724adb3e27204e770433d0616612af6fc9367b93430，manualPause=false，待公开recover阶段生成新的paused原生。STOP保存未完成，SIGTERM未退出后仅QA Electron树被SIGKILL，未落盘尾段时长及最终tick未知，不计连续成功。living-04通过保留，GC25/26正常筹料营建与生产未完成，完整SR/AC状态保持。
- docs/design/69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md；recover-01已从保全的原生192063运行态通过公开暂停按钮自然推进5步至192068，暂停保存及精确关闭重开通过；实测25.840198秒，来源和运行散列保持、错误0。当前唯一接续启动档为/Volumes/Media/immortal-qa/sol-production-20261020/recover-01/world/sect-save.json，tick192068，SHA 796a659e63472a706606271077f0c77752d98421d46b8afec8d1bfbb8690f984，manualPause=true。原report的sourceManualPause=null为字段误读，独立metadata-correction.json绑定原source哈希并校正为false，原报告保持。funding-01失败与未知未落盘尾段证据继续保留；GC25/26正常筹料营建与生产待继续，完整SR/AC状态保持。
- docs/design/75-SECT-SUSTENANCE.md
- 2026-10-25 U-170留守供给与掌门外出：v1门人自主运回收成、桌面采寻入口及出行供给反馈已接入。普通源267998正常备粮，macOS源码Electron分段离院270016→实际归院272082，NPC实际送6粮、五人日结供给正常并继续成长；采6草返院实际交库，最终272332粮23。最后一段原生存读/正常关闭/来源及运行散列一致、错误0；早先脚本失败和精确续接证据保持。37项集成及4项采寻检查通过（有交叉）；独立审计10项、13对原生存读通过。并行美术署名弹窗不在本批冻结原生范围。长期供需平衡、Windows、完整SR/AC与发布状态保持，详见75。最终全仓check被并行署名CREDITS.md缺失阻塞；需求校验通过。
- docs/design/76-DISCIPLE-CULTIVATION-PROGRESSION.md
- tests/acceptance/courtyard-disciple-cultivation-desktop.mjs
- tests/acceptance/courtyard-disciple-cultivation-reopen.mjs
- 2026-10-25 宗门供给与门人自主突破局部：docs/design/77-DISCIPLE-BREAKTHROUGH-LOOP.md；普通源280680→桌面准备282724→桌面终档284504，唯一180工步升至二层、5组原生存读一致。完整SR/AC状态保持。
- docs/design/86-MEDICINE-MATERIALS.md
- 2026-10-25 药物材料自主筹备与口粮保障完成本批：缺草/水通过既有生产候选、真实工位和运输补足；普通灵泉新增显式取洁水/凝灵晶选择，未完批次拒切。足粮场景从零公共草水经取水、种采、搬运、四阶段炼制，于4624公库入药2；低粮场景初始5粮，722实运30粮至35，727才开始药物任务，4909药2/粮41，全程饥荒0。缺人和旧承诺100步保持；61项独立定向/相邻单测、最终四场景10类检查、实际Chrome管理组件6类检查通过。修复首次洁水入库缺省键与种粮压过运粮的实际问题，原失败保留；最终场景14份/组件5份散列前后一致并匹配当前源码，错误为空。按U-172配置设施和初始物资，未做建井长链、原生整局、存读及长期供需平衡；完整SR/AC和发布状态保持。
- 2026-10-25 三至五人并行经营完成本批：3/5名门人另加掌门，同钟生产、修行与历练均有实际进度；各跨三次日结，每日分别8/12粮，全程饥荒0。两档均炼2药于2168归库，三人实运11粮后余35；五人两次真实伤10→0服药并归院、本人返工，实运13粮后余23，药物总账1+2−2=1。修复未完功课和有效承诺被出游抢占，以及承诺到期先续约导致无法出游；既有夜休/恢复/突破优先。根61项定向及相邻单测、独立6项复核、最终两场景11类检查通过，17份散列前后及当前一致，工程检查通过。初始住宅非法入口和验收器遗漏夜休条件的失败报告保留；按U-172配置场景，原生整局、Windows、存读长链及长期平衡未验，完整SR/AC及发布状态保持。 证据：/Users/shepard/.codex/tmp/immortal-sect-concurrency-20261025/scenario-04/report.json。
- 2026-10-25 当面商议炼丹与成药交付完成本批：统一人物窗选丹方、看实际费用与现场缺口，由门人按资格、意愿及原承诺答复。正式商议筑基丹后，本人完成四阶段780工步，2099现场成药1、2689实际运抵公库、2690登记交付；医理80→80.6、药理35.1→35.7。缺料/资格/承诺不足与本人不愿分别反馈，远距和隐藏药理禁止商议，重复请求不另开炉；重伤退款和途中中止保留实际投入与实物。共同生活成员的完整人物窗入口已补齐；阅读暂停下进度直接投影实际炉单与运单。根53项不同定向/相邻测试、末次8项投影相关复验、实际Chromium人物窗与七场景11类检查通过；16份散列前后及当前一致，浏览器错误0。按U-172配置初始条件；原生整局、Windows、存读长链及长期平衡未验，完整SR/AC与发布状态保持。 证据：/Users/shepard/.codex/tmp/immortal-disciple-craft-request-20261025/scenario-05/report.json。
- 2026-10-26 门人进阶需求与自主筑基完成本批：人物窗从缺丹需求导航到同门并预选筑基丹，正式自愿炼制780工步，2692本人运药归公库；另一门人2750自主取丹、2772收入随身，2780开启突破，2825实际炼化、2975完成180工步升至筑基，3150本人再参与生产并按贡献成长。近身和远取统一公药许可，保本人私药、旧承诺与实际身体；唯一丹竞争、满袋拒绝、炼化前后取消及执事继续成长通过。根77项不同定向/相邻单测、六场景12类检查及实际Chromium人物窗组件通过；main选中/走近薄接缝受控执行核验，16份散列前后与当前一致，13完整快照、6截图，浏览器错误0。主Agent发现首轮旧缺丹提示与在途冲突后修正，最终scenario-02通过，旧记录保留。按U-172配置初始条件；原生整局、Windows、存读长链和长期平衡未验，完整SR/AC与发布状态保持。 证据：/Users/shepard/.codex/tmp/immortal-disciple-advancement-20261025/scenario-02/report.json。
- 2026-10-26 历练收获反哺成长完成本批：真实采6草于1729归库，当面筹备一炉并保留本人旧承诺，2545实运材料到丹房，3428完成原四阶段780工步，4020成药归库，林长风4112收入随身、4120开始突破、4310完成180工步升至筑基。掌门正式搬40木腾库后，5080本人实际参与生产，贡献90%、百工增长0.54；灵草总账119+6−75−50=0。筹备可撤回，已接运输保留；修复休息续约饿死取丹机会、交库容量/产权检查及运输提示滞后。根116项定向/相邻测试、最终投影14项复验、三场景9项检查和实际Chromium人物窗组件通过；23源码散列一致、14完整快照、6截图及独立复核通过。按U-172配置初始条件；原生整局、Windows、存读长链与长期平衡未验，完整SR/AC及发布状态保持。 证据：/Users/shepard/.codex/tmp/immortal-expedition-growth-20261026/scenario-04/report.json；/Users/shepard/.codex/tmp/immortal-expedition-growth-20261026/final-independent-audit.json。
- 2026-10-28 Web Work回归批次：从e61ceb8复现默认1059/1096、37失败；修复东台长段规划漏检导致实走清路及第二批石料卡死，原卡档125步继续完工。同步当前战斗/客院/访客测试契约、Windows文件URL/LF与CI浏览器依赖。三/五门人各2954步、三日结、生产/粮药交付/历练归来返工通过；默认全量与CI最终结论见 docs/engineering/REGRESSION-20261028.md。仅局部证据，完整SR/AC及发布状态保持，不沿用旧空间版本FPS结论。

- 2026-10-06：由v1.2设计缺口审计建立SR；新增内容和参数遵循作者默认，不冒充用户逐项确认。
- 2026-10-06：用户授权目标模式、多agent并行开发与验收；启动D01，按现有契约展开模块设计，未将建档或局部实现标作交付。
- 2026-10-07：M1 正常成长链定位掌门实物搬运完成后路线已清而 action 仍为 walk，下一正式命令被存档校验拒绝；结束/取消搬运只在本人物持有对应活动时复位残留行走。经济定向52/52通过，独立只读复核另查取料前和携带中取消4/4及精确存读。此为局部稳定性修复，AC及整项状态不提升。
- 2026-10-08：2026-10-08 M2 工地物流缺口复现：正常公开疗伤后在世界步200营造灵草田，下单同刻公库木65→40、石45→35，有逻辑材料预约但无工地位置库存或搬运批次；前后精确存读档在 /tmp/immortal-m2-sr010-gap。SR010-AC01 保持 not_run，待补材料实际到场/逐段守恒并复核现有营造与旧档。
- 2026-10-08：新施工材料流按主屋预留、携带、工地、安装分段守恒，取消实物返仓后退款一次，兼容旧在建档；独立复核 AC01 正常公开链和界面后记 passed，AC02/03 保留。
- 2026-10-08：M2 第八批：公开赠药、同所有者搬运、跨所有者私财拒绝、内部自主取公药、实际步行归还原借剑及公库末批竞争按 AC03 原文复验；公开权限 6/6，装备成长 45/45，精确存读通过。AC03 passed；完整 D/I/V/R 与网页真机仍待。
- 2026-10-08：SR010-D01 仓位/容量/归属与最小计量、搬运状态和失败恢复、施工四处守恒、生产/迁建及公私权限已写入当前设计小节，根 Agent 对照原 D01 交付项与当前配置独立审阅，记 D01 done。D02 跨规格差异另行处理，设计整体仍 draft。
- 2026-10-08：独立跨规格复核完成：道韵预算与运输边界、施工取消返料、仓位归属位置校验和公库容量结算已统一；旧档保留原值与在途单。
- 2026-10-08：r20 ships read-only five-number inventory summaries by public, master-private and merchant ownership; full ECON-02/03 and cancellation property paths remain open
- 2026-10-09：2026-10-09 U-105 / R-32：山域成长的迁居、外谷/分峰配送、货位、所有权与预约继续使用本SR已有实体搬运及守恒契约，关联 docs/SECT-GROWTH-PLAN.md 的 GROWTH-03/04/06/08/11。本批仅补设计来源与接缝，原AC文案、状态、证据及D/I/V/R保持；新山域实际流程与负载仍待对应GROWTH验证。
- 2026-10-12：2026-10-12 U-120：行囊读取真实位置库存与所有权；Node 专项验证只读、非法数量拒绝、实际搬运和存读守恒。本地 Chromium 公库 16 份灵草取 3 份后为公库 13／随身 3，送回公库 16，保存刷新保持。丹药使用采用明确人工库存边界 QA，未覆盖生产取得链；完整 SR/AC 状态保持。
- 2026-10-12：2026-10-12 U-123：第一炉成丹2份分至随身1／公库1，存读守恒；山谷队伍采草6份，返院工单搬草6加粮3，公库草4→10，队伍归零。炼药2／2、山谷5／5。 局部证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。
- 2026-10-12：2026-10-12 U-123 首战本地网页：最终本地网页服用同炉随身回春散1份，随身1→0、总丹2→1、伤势14.6153→0，返院存读仍保剩余1份；完整账本 AC 状态保持。 证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。
- 2026-10-12：2026-10-12 Issue #5：最新main6000秒实验16笔生产/14笔微量灵石，修复显式receipt、9位新计算精度、工资封顶、事务提交与运输严格余额。专项12/12，正常公开开局2/2、丹炉公开链1/1；旧数量和事实逐字保留，不推进完整SR状态。见 docs/design/ISSUE-5-PRODUCTION-ACCOUNTING.md。
- 2026-10-15：U-147接续P0—P2：新增两人小院可操作供给成长和保存/事务保护，登记局部实现与Node证据；实际UI/桌面未验，完整状态不推进。
- 2026-10-15：U-148：记录四页及关联入口设计审查、操作断点和R-48重整提案；未修运行代码，完整D/I/V/R与AC状态保持。
- 2026-10-15：U-149：接续远端main并完成当前山院管理和取消回收、保存恢复的局部桌面验证；完整状态保持。
- 2026-10-16：U-150/R-50：追加连续东路、实际分趟运料施工、四床启用与同源macOS存读往返局部证据。流程两段308.849秒，最终包阶段6项及往返9项，错误0；保留验收脚本中断记录。完整SR/AC与D/I/V/R状态保持。
- 2026-10-16：U-151/R-43：同一东台完成档实际自主1200.036秒，后台180.857秒、接管、预算风险、生产搬运及关闭重开。原脚本末段分类失败保留，同轮证据补核验38项；同档手动补粮恢复5项。持续公库供给仍有缺口，完整SR/AC与D/I/V/R状态保持。
- 2026-10-18：U-163/R-52/T-18：口粮目标、有限采粮与实际送库、保留生活粮的付费补种、预算与旧策略兼容已接入。供粮8项、相关17项、默认核心152/152通过。macOS源码Electron同源实际自主1200.016秒，实采送库80、消费40、公库3→43，解除饥荒后持续为0；长验11/11、证据核对12/12、界面7/7、macOS包同档短复验6/6，暂停关闭重开精确恢复。成功付费补种实机、三至五人、Windows及完整SR/AC状态保持。
- 2026-10-18：2026-10-18 U-164/U-165局部：多Agent完成林长风门籍规则及同窗交互首轮，规则8/8、相关11/11，主Agent联合供粮/操作33/33；亲传Electron专项9项，范围限当时人物交互。用户明确扩大主殿山域、整体绘制采伐场、所有建筑完全预设并由人物实际到场修建；院前临时营造入口与独立素材已撤下。下一步先确认整体场景和稳定建位，再接施工与三人同源长验。二十分钟、当前桌面包、Windows及完整SR/AC尚未完成，整项状态保持。
- 2026-10-18：U-166/R-54将金丹篇建筑纳入同一预设山域规划：25项设施、31处编号位置，覆盖14类现行类型及专门工位。完成目录核对、编号图与整体场景概念；布局待评看，米制校准、施工接入和运行验收继续推进，本SR及AC状态保持。
- 2026-10-20：六居民同档日结与原生精确重开通过；living-03道路body失配保留tick191089，修复待living-04。院务奖励入口与容量边界规则检查通过，实际领取、GC25/26正常生产未验；GC21–23仅布局候选。完整SR/AC及任务状态保持。
- 2026-10-20：living-04从191089同档完成73/75实际床位、自主16粮采送、192000五门人日结与精确原生重开，118.716135秒、错误0；living-03失败保留。只更新局部证据，不提升完整SR/AC；funding-01及GC25/26正式生产待验。
- 2026-10-25：登记正常供给与门人自主突破的局部实现/原生证据；保持整项与AC状态。
- 2026-10-25：登记材料自主生产/运输、显式灵泉工序及粮食优先整链，完整SR/AC状态保持。
- 2026-10-25：登记三/五人并行经营、粮药实际收支与承诺到期接缝；完整SR/AC状态保持。
- 2026-10-25：登记当面自愿炼丹、完整人物窗入口及本人实运交付；完整SR/AC状态保持。
- 2026-10-26：登记进阶需求、同门商议、实际取丹与原阶段自主突破后恢复经营；完整SR/AC状态保持。
- 2026-10-26：登记历练实采、单炉筹备、真实交付、自主筑基及返工针对性验证；完整SR/AC状态保持。
- 2026-10-28：登记CI与现有回归修复、东台带货施工及三/五门人多日经营验证；完整SR/AC状态保持。

本文件由[registry.json](../registry.json)派生；更新台账后执行 `python scripts/requirements/sr-manager.py refresh`，不单独修改此派生页。
