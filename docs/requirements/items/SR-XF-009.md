# SR-XF-009 · 有限供给链与配方产能表

来源：DB-2026-10-05 v1.2；需求版本：1.1；建档日期：2026-10-06。

| 字段 | 值 |
| --- | --- |
| 范围 / 模块 | 前期必需 / 经营 |
| 优先级 / 计划 | P0 / I1 |
| 设计 / 开发 | draft / in_progress |
| 验收 / 发布 | in_progress / not_released_for_this_sr |
| 责任人 / 复核人 | Codex/economy_people / Codex/root（集成） |

## 来源、依赖与范围

纳入云岫前期，按依赖推进。

决策来源：U-63, U-93, R-25, U-94, U-98, U-99, R-28, U-105, R-32, U-123, U-124, U-149, R-49, U-151, R-43, U-158, R-51, T-17, U-163, R-52, T-18, U-166, R-54, U-167, T-20, T-21。这是继承的U项和作者实施默认；具体新增名称/数值不得伪装成用户逐项批准。

规格：[02-EQUIPMENT-ARTS.md](../../../docs/design/02-EQUIPMENT-ARTS.md)、[07-ECONOMY-ORGANIZATION.md](../../../docs/design/07-ECONOMY-ORGANIZATION.md)、[14-EARLY-GAME-DETAILED-DESIGN.md](../../../docs/design/14-EARLY-GAME-DETAILED-DESIGN.md)、[06-OPENING-ACCEPTANCE.md](../../../docs/design/06-OPENING-ACCEPTANCE.md)、[SECT-GROWTH-PLAN.md](../../../docs/SECT-GROWTH-PLAN.md)、[41-COURTYARD-VALLEY-IMPLEMENTATION.md](../../../docs/design/41-COURTYARD-VALLEY-IMPLEMENTATION.md)、[51-COURTYARD-MANAGEMENT-INTEGRATION.md](../../../docs/design/51-COURTYARD-MANAGEMENT-INTEGRATION.md)、[45-SECT-IDLE-SLICE.md](../../../docs/design/45-SECT-IDLE-SLICE.md)、[53-COURTYARD-AUTONOMY-ACCEPTANCE.md](../../../docs/design/53-COURTYARD-AUTONOMY-ACCEPTANCE.md)、[56-COURTYARD-FOOD-SUPPLY.md](../../../docs/design/56-COURTYARD-FOOD-SUPPLY.md)、[58-GOLDEN-CORE-PRESET-BUILDINGS.md](../../../docs/design/58-GOLDEN-CORE-PRESET-BUILDINGS.md)、[59-WEST-FOREST-INTEGRATION.md](../../../docs/design/59-WEST-FOREST-INTEGRATION.md)、[60-WEST-VALLEY-INTEGRATION.md](../../../docs/design/60-WEST-VALLEY-INTEGRATION.md)、[61-RESIDENTIAL-INTEGRATION.md](../../../docs/design/61-RESIDENTIAL-INTEGRATION.md)、[62-EAST-SERVICES-INTEGRATION.md](../../../docs/design/62-EAST-SERVICES-INTEGRATION.md)。

依赖：[SR-XF-002](SR-XF-002.md)、[SR-XF-004](SR-XF-004.md)。

关联既有验收：ECON-01, ECON-02, OPEN-06, GROWTH-04, GROWTH-05, GROWTH-06, GROWTH-11；本SR的AC细化这些目标，不代表旧版本已经通过。

## 现状与设计缺口

既有 JS 运行基线：已有药田生产、材料预留和多人共享批次。 U-98本轮暂缓院内铺路，既有通行与山外交通保留。 U-99整格营造与0.5米导航分离，旧档按明确单位格版本映射。 U-105 山域成长方案见 docs/SECT-GROWTH-PLAN.md；本批只登记设计与阶段原型，正式运行版本保持。

既有有限配方与冻结批次实现保留。U-105 外谷承接生产及四峰供给的需求、有效产能、配送周期、检验窗口与安全余量仍待配置和实际验证。

现状是适用旧能力的基线，不表示该SR完整目标已通过。

## 必须补齐的设计交付物

1. 保留木石、药用及器用配方表，补五阶段服务需求、有效工位、人手及生产/配送瓶颈。
2. Z-03 新产能接通到货、通过供给核对后退出旧产能的条件；旧批次收获/取消/转运规则。
3. 各阶段供给检验窗口、余量、短缺与断路恢复来源；人数样例用于验算，不作为硬编码解锁门槛。

## 需求行为

SR-XF-009-REQ-01：有限材料、实际劳动和工位形成有限产出；多人共享批次只结算一份，产出入真实货位并经配送到需求区。

SR-XF-009-REQ-02：离岗、缺料、断路或设施失效时等待并说明原因；外围新产能及到货通过供给核对后才能逐项退去主峰旧生产。

SR-XF-009-REQ-03：掌门可补足早期缺工；各阶段保留基础供给和恢复来源，成熟主峰的生产需求由外围真实设施与运输承担。


## 验收标准

| ID | 情景 / 操作 | 必须看到的结果 | 状态 |
| --- | --- | --- | --- |
| SR-XF-009-AC-01 | 在新产区无人、缺料、货物在途或断路时尝试接替并退出旧生产 | 未满足条件的工序不产出；实际产出和送达按登记窗口满足需求并留余量后才允许退旧，失效时有明确等待或恢复来源。 | not_run |
| SR-XF-009-AC-02 | 多人协作完成一批并重载 | 只产出规定数量，成本、技能与记忆按同一结果结算。 | passed |
| SR-XF-009-AC-03 | 取消加工或原料被其他订单预留 | 区分可用/预留/已用量，余料返还一次且可继续其他合法活动。 | passed |

SR-XF-009-AC-02证据：tests/acceptance/ea-sr-009-shared-batch-public-acceptance.mjs；src/simulation/ea-sr-economy.mjs；docs/design/STATUS.md

SR-XF-009-AC-03证据：tests/acceptance/ea-sr-009-reservation-competition-public-acceptance.mjs；tests/acceptance/ea-sr-009-cancel-public-acceptance.mjs；docs/design/STATUS.md；2026-10-08 r24 局部丹炉：正常公开开局建炉/运草/成丹59命令、39次精确存读；v1及旧已付费迁移、取消余料一次返还、满仓同地同产权暂存、完成/取消坏事实拒载。根1/1、独立1/1，本地Chromium导入/刷新续档4/20。施工/装备和完整新档解锁未验，整项状态不提升。

2026-10-07局部修正：掌门采集与有限来源恢复在受伤、离位或低精力时明确paused，不再保留working伪装劳动；包裹满的采集也暂停而不扣有限来源。公开命令定向覆盖伤势、低精力、自然四批包裹满、精确存读与恢复3/3，离位分支尚未单独验证；经济52/52通过。完整配方/产能和SR-XF-009各AC仍未关闭。
2026-10-07 M1正常成长链阻断修复：有来源正常档 tick404450 的商人精力9.706低于工坊收货门槛10，空闲长期不恢复，真实工序停在190/200。现在商人仅在院/坊市始末同场且无身体活动时每世界tick恢复0.3；出行或收货中不恢复。定向3/3、经济52/52；独立只读复核从该正常档克隆1200 tick内见两批实物收货/分别付款64.1923331328及64.503802176，商人减少与工坊增加逐笔相等，生产工资0.8另按公库和人物钱袋守恒；600 tick完整存读逐字一致。仅局部Node证据，不提升原AC或完整D/I/V/R。
2026-10-08 M2 有限工序验收：根 Agent 独立复跑 SR-XF-009-AC-01 正常公开命令来源档三场景 3/3；无人实际执行时旧批次不前进，工位缺料虽公库有货仍拒绝邀请，木材预约/取货/在途不进入工位库存或产出，送达后才可用。各关键点精确存读，生产管理 HTML 与位置库存/公开原因同源。此 AC 按原文 passed；未做浏览器/真机，AC02/03、配方设计和整项 D/I/V/R 未关闭。
2026-10-08 M2 两人一批验收：正常百工坊公开来源档续实物木3石2搬入、两人自愿到双工位；第1批贡献110/90，唯一生产事实、一次木石成本、买方实付20.220271868159998、现场入账19.420271868159997、两人总工资0.8及各按贡献技能增长同一结果。修复成功结算后缺少个人记忆，每人记一条以事实ID关联的持久公开记忆，失败试算/重载后30步无重复。根 Agent 复跑定向1/1及经济52/52，按原文 AC02 passed。证据为 Node 公开命令链，浏览器/真机、AC03与整项门槛未关闭。
2026-10-08 M2 AC03：有来源百工坊活跃批次部分加工30/200，取消只退现场未用木2.55/石1.7、重复取消无变化，后续掌门可采石；另一有来源档中运输订单预留工位仅有木3后，第二生产邀请以缺料拒绝，取消运输原位返木一次，随后真实门人可开批。两条公开命令 Node 链各1/1、多阶段精确存读，独立只读复核通过；未据此宣布浏览器/真机或完整 SR009 通过。
2026-10-08 同两份有来源公开命令工坊档复验 SR009-AC01/02：新档 187 命令、100 次存读、tick32157，旧有效档 208/109、tick31820；两档各 4/4。验收按真实门人到位、商人行程与物流交付判定，不依赖固定世界步或指定门人。新档两人贡献110/90，商人付款与现场产出均28.7743092，0.8工资由公库支付；旧档两人贡献110/90，付款20.22027186816，现场19.42027186816，0.8工资从批次收入支付。均一次结算、记忆关联唯一且精确存读。此次只修订 QA 的时序假设，现有 AC01/02 passed 不改判，整项 D/I/V/R 仍待。
2026-10-08 SR009 D01/D02 设计复核：现行木石、丹药、装备数值及共享生产贡献量对照代码；新增药田种苗2、10步成熟、积水暂停/恢复、单次收获及旧活跃药田免追缴，四类工单冻结 v1 快照与逐入口克隆迁移/校验，阶段1丹炉和阶段2百工坊的正常新档门槛。独立 D02 初审三项阻断修订后复审 PASS；采购只能获得补种材料，不能直接恢复地块来源余额。此为设计契约，v2 运行实现、旧档迁移、浏览器和真机均未验，既有 AC passed 证据及整项状态不因设计文稿提升。
2026-10-08 r23 普通生产 v2 配方快照：木场、采石、谷仓、藏经、井、百工坊、打坐的投入/产出/时长/技能及首位贡献者固定于开工单；旧活跃 v1 批次克隆时一次迁移，坏快照拒载，旧批在现行建筑定义变化后仍按原值唯一结算。独立复核新旧批与技能归属；根复跑共享生产1/1、门槛3/3、取消1/1、预留竞争1/1、生命11/11、邀请1/1。施工/丹炉/装备及完整新档解锁仍待，I01/V01/R01 不关闭。
2026-10-08 r24 局部丹炉：正常公开开局建炉/运草/成丹59命令、39次精确存读；v1及旧已付费迁移、取消余料一次返还、满仓同地同产权暂存、完成/取消坏事实拒载。根1/1、独立1/1，本地Chromium导入/刷新续档4/20。施工/装备和完整新档解锁未验，整项状态不提升。

2026-10-09 U-105 / R-32：当前需求更新为 1.1，山域设计关联 GROWTH-04、GROWTH-05、GROWTH-06、GROWTH-11。旧版 1.0 的标题、需求、AC原文/证据及D/I任务完成范围保存在 registry.json 的 version_history；当前重新记 not_run：SR-XF-009-AC-01。 当前D01继续补实施参数，D02及本版本I01待前置完成；development_status保留既有运行实现基线。未改变的已通过AC只沿用原行为及原运行环境证据，新增地域、布局与迁移流程按GROWTH另验。本批未执行运行时验收，未修改正式运行版本或发布状态。

2026-10-11 云岫首畦子批：已落成灵草田用原生产工单和田边实物种苗经历播种、出苗、成熟、首收；新档定向存读与守恒通过，本地 Godot Web 隔离档实点送苗、请门人照料至首收。首收留田边，公库不凭空增加。完整配方产能表、多设施与目标设备未验，当前 AC/D/I/V/R 状态不推进。

2026-10-12 U-123：田边10份灵草实运到炉边，掌门单炉炼得回春散2份；炼药定向2／2。完整产能与供给链继续。 局部证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。
2026-10-12 Issue #5：最新main6000秒实验16笔生产/14笔微量灵石，修复显式receipt、9位新计算精度、工资封顶、事务提交与运输严格余额。专项12/12，正常公开开局2/2、丹炉公开链1/1；旧数量和事实逐字保留，不推进完整SR状态。见 docs/design/ISSUE-5-PRODUCTION-ACCOUNTING.md。

2026-10-18 U-167局部：批准25项设施/31预设建位布局并分期开发；31目录已接入，原殿/药圃/东台保留身份，西林一级完成真实西桥运料、到场施工、两工位产木与搬回公库，其余27处待接。默认170/170、相关31项及地面校准后6+10项复验通过。macOS源码Electron同一两人来源档10/10、100.894秒，投入25灵石20木8石，6木实际回库，三次存读精确，页面/运行错误0。证据docs/design/59-WEST-FOREST-INTEGRATION.md；升级画层、三人长验、Windows及当前包另验，整项D/I/V/R与AC状态保持。 2026-10-18 U-167西谷GC-17/18/19/24开发中：显式扩谷、固定施工、有限石源、现场种粮及独立分类公库已写入。同源30条公开命令连续营造四处并精确存读，证据/Volumes/Media/immortal-qa/west-valley-prepared-20261018-v2/。阶段美术及完整桌面验收继续；远路邀请已改为有限通勤、到岗后计劳动承诺，旧邀请期限保留，公库口粮纳入实际回运；整项SR/AC状态保持。

## 开发任务

| 任务 | 工作 | 状态 | 前置 | 责任人 |
| --- | --- | --- | --- | --- |
| SR-XF-009-D01 | 设计补齐：当前版本设计补齐：补齐各阶段需求、瓶颈、检验窗口及安全余量配置，复核外谷到四峰的供给接替条件。 原版本已完成范围和证据保存在 version_history。 | in_progress | 无 | Codex/economy_people |
| SR-XF-009-D02 | 契约与内容审阅：在当前版本D01完成后，审阅有限供给链与配方产能表与依赖契约的字段、时序、失败及恢复；核对本SR的REQ/AC和GROWTH-04、GROWTH-05、GROWTH-06、GROWTH-11。旧版审阅完成事实保存在 version_history。 | todo | SR-XF-009-D01 | 待分配 |
| SR-XF-009-I01 | 开发与集成：按当前版本设计在相关模块集成有限供给链与配方产能表，接入真实数据、行为、素材、界面和存读。既有实现保留为运行基线；本版本在D02完成后进入集成。 | todo | SR-XF-009-D02 | 待分配 |
| SR-XF-009-V01 | 验收与兼容：执行本SR的AC-01至AC-03及GROWTH-04、GROWTH-05、GROWTH-06、GROWTH-11；分别记录正常、失败、存读、网页视口和适用真机证据。 | todo | SR-XF-009-I01 | 待分配 |
| SR-XF-009-R01 | 发布与关闭：完成所需源码/运行时发布核对、交接和未覆盖说明；本轮用户不要求上传QA过程产物。 | todo | SR-XF-009-V01 | 待分配 |

SR-XF-009-D01证据：docs/SECT-GROWTH-PLAN.md；docs/design/47-GOLDEN-CORE-ARTS-CATALOGUE-DRAFT.md；2026-10-15 U-145/R-45：169项修行内容草案、五脉续篇、获取替代、百艺阵法、暗线与特效；仅补设计证据，金丹运行与完整D/I/V/R、AC状态保持。；docs/design/48-GOLDEN-CORE-WORLD-ARTS-V02.md；2026-10-15 U-146/R-46：720项玩家/NPC世界修行库、72新增来源谱系，符箓蛊道心法攻防及获取特效补齐；仅设计字段、来源与引用检查，运行及完整D/I/V/R、AC状态保持。；docs/design/50-COURTYARD-UI-DESIGN-AUDIT.md；2026-10-15 U-148/R-48：四页及关联入口30项设计审查与7条后续场景；两处物流问题由正常命令复现，运行代码未修，实际UI未验，完整状态保持。

SR-XF-009-I01证据：src/simulation/ea-sr-economy.mjs；src/simulation/ea-sr-persons.mjs；tests/unit/web/ea-activity-truth.test.mjs；tests/acceptance/ea-sr-economy-acceptance.mjs；2026-10-08 r19: tests/acceptance/ea-sr-009-herb-crop-public-acceptance.mjs 5/5; adjacent production 5/5, facility and door 17/17, opt-in v2 work route 1/1; local Chromium memory import showed crop status and cancellation; source c9be1d476311a558e7a37a4e0305e5086b71a369, Pages 15ec91db21b8f4b37f30accdd5ac643e024a160d built；2026-10-08 r23: ordinary production recipe:v2 snapshots, old active v1 migration, tamper rejection and scoped independent replay; runtime main dc1ff06670f569be34f836580ce83c31f1c92150, Pages e7f6a8a55f2e7bbd74d33d6a33563d885bd17b27 built; construction/craft/equipment snapshots and full new-game unlock remain open；2026-10-08 r26 局部装备配方：七件配方的新制作单冻结投入、工时、槽位、关键实物 claim、来源仓及产权；旧活跃已付费制作单在克隆读档时一次迁移，旧已完成物品保持，坏快照或重复结果拒载。有来源正常公开命令百工坊 checkpoint（worldTick31820）实际备料、制作行山轻衣、开工前/后取消、25步旧活跃单接续及成品唯一事实；根专项1/1，10条补充公开命令、6次精确存读，界面17通过/4待设备。本地Chromium导入真实在制档，七件报价、进度及取消可见；零进度取消实点后灵石98→110、木11→17，控制台0错误/0警告（1条浏览器autocomplete提示）。源码94986d3、Pages fa17a3b built，162文本blob与两个公网模块字节匹配。基线新档建坊处旧门道候位读档差异另案处理；本批没有测试七件分别全链或施工配方/跨仓物流/完整新档解锁，SR009整体状态不提升。证据 tests/acceptance/ea-sr-009-equipment-recipe-public-acceptance.mjs、/tmp/immortal-sr009-root-r26/.playwright-cli/page-2026-10-08T11-52-40-680Z.yml。；docs/design/49-P0-P2-COURTYARD-PROGRESS.md；2026-10-15 U-147/R-47：院务/人物/工位/物资/研习操作、保存失败保护和疗伤收据重放；47/47 Node检查。浏览器内核缺失且官方下载失败，实际UI与桌面未验，完整P0—P2及SR/AC状态保持。；docs/design/59-WEST-FOREST-INTEGRATION.md；tests/acceptance/courtyard-west-desktop.mjs；2026-10-18 U-167西谷GC-17/18/19/24开发中：显式扩谷、固定施工、有限石源、现场种粮及独立分类公库已写入。同源30条公开命令连续营造四处并精确存读，证据/Volumes/Media/immortal-qa/west-valley-prepared-20261018-v2/。阶段美术及完整桌面验收继续；远路邀请已改为有限通勤、到岗后计劳动承诺，旧邀请期限保留，公库口粮纳入实际回运；整项SR/AC状态保持。；2026-10-18 U-167/T-20住宅接续：GC09–12沿固定建位建设，四院一级16实体床；独立床位模块10/10规则检查，含只读旧档、唯一床位、真实到床、途中存读与失效恢复。三院完工及空地母稿已制作，世界位置与升级占地待校准。正式运行接缝、近身有限交易筹资和同源桌面营建入住尚待完成；本条只登记住宅局部准备，不推进完整SR/AC状态。；2026-10-18 U-167/T-19西谷一级批：同一未改正常来源macOS源码Electron连续31/31，墙钟1219.061秒、tick646→10944、7次精确关闭重开、错误0。四址实际运料施工，有限采石18.4及两田实际收获后35.2593256粮搬入新公库，两田各留2种粮。根独立读回来源SHA/最终状态/截图，源码与素材hash随run03封存；完整SR/AC、升级损坏图、供水保鲜、Windows和安装包仍按原范围接续。详见docs/design/60-WEST-VALLEY-INTEGRATION.md。；2026-10-18 U-167/T-20住宅筹资接缝：掌门从公库实际取货到随身，统一人物窗近身买卖、有限库存/本金及实际回款。专项5/5含重试一次结算；macOS源码Electron独立来源连续11/11、两次精确重开、错误0。20石换18灵石，买10粮花10，余8灵石实际入HOME。见61§10；该轨道不代替住宅营建或完整SR/AC验收。；2026-10-19 U-63/T-26百工坊五道专业工序：纸胎压制与晾晒、制绳、裁缝、修理、乐器各自配方版本进入生产目录，宗主委托后按坊内实料预留，门人实际到岗累计工时，结算、工资与商人实收沿用原链路。规则夹具courtyard-workshop-processes 2/2（配方一致、委托与精确存读、取消退料、改委托、受邀门人实际完工及整档校验）；百工坊固定场地需山院初成与100灵石/65木/45石，正常档实机与专用台面仍待，不推进完整SR/AC状态。；2026-10-19 U-63/T-27 GC22育苗药圃作物参数：每轮3灵草、生长160世界步、照料240贡献、产出18灵草，按固定建位身份选择专用作物版本，普通药圃（2灵草/10步/200贡献/12灵草）与灵稻田保持原值。规则选择与参数由courtyard-nursery-crop 2/2及药圃/灵稻田既有测试覆盖；锚点待西谷母稿扩展，完整种植与桌面验收随锚点批，不推进完整SR/AC状态。；2026-10-19 U-63/T-28 GC23灵泉供水参数：每批200贡献产出12洁水，按固定建位身份选择spring-water:yunxiu:v1，须先启用生活物资；普通灵泉仍为4灵晶。生产结算与账目校验改为按当前资源目录识别服务资源，定向courtyard-spring-water 3/3（配方/版本选择、快照、未启用拒绝与启用后可用）。锚点待西谷母稿扩展，完整取水净水与桌面验收随锚点批，不推进完整SR/AC状态。；2026-10-19 GC25五道工序补途中取消与GC23作业区投影：第二份同源会话中受邀门人实际开工后精确存读并中止，未耗木草按进度退回、无生产事实、整档再校验通过；作业区投影按T-28版本读取GC23灵泉配方（锚点登记前不出现）。定向courtyard-workshop-processes 2/2、courtyard-spring-water 3/3，默认套件392/392。；2026-10-19 GC25完工后作业区投影显示商人取货阶段与实付：受邀门人完成工序批次后，projection.collection为carrying、payment等于生产事实payment、carrier为青溪商人；courtyard-workshop-processes 2/2，默认套件392/392。

SR-XF-009-V01证据：src/simulation/ea-sr-economy.mjs；src/simulation/ea-sr-persons.mjs；tests/unit/web/ea-activity-truth.test.mjs；tests/acceptance/ea-sr-economy-acceptance.mjs；tests/acceptance/ea-sr-integration-acceptance.mjs；docs/design/STATUS.md；2026-10-08 r24 局部丹炉：正常公开开局建炉/运草/成丹59命令、39次精确存读；v1及旧已付费迁移、取消余料一次返还、满仓同地同产权暂存、完成/取消坏事实拒载。根1/1、独立1/1，本地Chromium导入/刷新续档4/20。施工/装备和完整新档解锁未验，整项状态不提升。；2026-10-08 r26 局部装备配方：七件配方的新制作单冻结投入、工时、槽位、关键实物 claim、来源仓及产权；旧活跃已付费制作单在克隆读档时一次迁移，旧已完成物品保持，坏快照或重复结果拒载。有来源正常公开命令百工坊 checkpoint（worldTick31820）实际备料、制作行山轻衣、开工前/后取消、25步旧活跃单接续及成品唯一事实；根专项1/1，10条补充公开命令、6次精确存读，界面17通过/4待设备。本地Chromium导入真实在制档，七件报价、进度及取消可见；零进度取消实点后灵石98→110、木11→17，控制台0错误/0警告（1条浏览器autocomplete提示）。源码94986d3、Pages fa17a3b built，162文本blob与两个公网模块字节匹配。基线新档建坊处旧门道候位读档差异另案处理；本批没有测试七件分别全链或施工配方/跨仓物流/完整新档解锁，SR009整体状态不提升。证据 tests/acceptance/ea-sr-009-equipment-recipe-public-acceptance.mjs、/tmp/immortal-sr009-root-r26/.playwright-cli/page-2026-10-08T11-52-40-680Z.yml。；docs/design/49-P0-P2-COURTYARD-PROGRESS.md；2026-10-15 U-147/R-47：院务/人物/工位/物资/研习操作、保存失败保护和疗伤收据重放；47/47 Node检查。浏览器内核缺失且官方下载失败，实际UI与桌面未验，完整P0—P2及SR/AC状态保持。；docs/design/59-WEST-FOREST-INTEGRATION.md；tests/acceptance/courtyard-west-desktop.mjs；2026-10-18 U-167西谷GC-17/18/19/24开发中：显式扩谷、固定施工、有限石源、现场种粮及独立分类公库已写入。同源30条公开命令连续营造四处并精确存读，证据/Volumes/Media/immortal-qa/west-valley-prepared-20261018-v2/。阶段美术及完整桌面验收继续；远路邀请已改为有限通勤、到岗后计劳动承诺，旧邀请期限保留，公库口粮纳入实际回运；整项SR/AC状态保持。；2026-10-18 U-167/T-20住宅接续：GC09–12沿固定建位建设，四院一级16实体床；独立床位模块10/10规则检查，含只读旧档、唯一床位、真实到床、途中存读与失效恢复。三院完工及空地母稿已制作，世界位置与升级占地待校准。正式运行接缝、近身有限交易筹资和同源桌面营建入住尚待完成；本条只登记住宅局部准备，不推进完整SR/AC状态。；2026-10-18 U-167/T-19西谷一级批：同一未改正常来源macOS源码Electron连续31/31，墙钟1219.061秒、tick646→10944、7次精确关闭重开、错误0。四址实际运料施工，有限采石18.4及两田实际收获后35.2593256粮搬入新公库，两田各留2种粮。根独立读回来源SHA/最终状态/截图，源码与素材hash随run03封存；完整SR/AC、升级损坏图、供水保鲜、Windows和安装包仍按原范围接续。详见docs/design/60-WEST-VALLEY-INTEGRATION.md。；2026-10-18 U-167/T-20住宅筹资接缝：掌门从公库实际取货到随身，统一人物窗近身买卖、有限库存/本金及实际回款。专项5/5含重试一次结算；macOS源码Electron独立来源连续11/11、两次精确重开、错误0。20石换18灵石，买10粮花10，余8灵石实际入HOME。见61§10；该轨道不代替住宅营建或完整SR/AC验收。

## 可进入开发的条件

- 设计交付物存在且版本/引用正确。
- 所有行为、失败、取消、恢复和存档影响可执行；未定必需参数已填入配置。
- 依赖契约已可使用；涉及身份、风险、真相与来源的作者卡固定。
- 验收步骤、预期、数据/设备和结果守恒条件可检查。
- U-105 对应的建位/布局、容量或供给、迁居及存档字段已按本SR补齐；成长原型审阅不能代替实施参数与契约审阅。

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
- src/simulation/ea-sr-persons.mjs
- tests/unit/web/ea-activity-truth.test.mjs
- tests/acceptance/ea-sr-economy-acceptance.mjs
- tests/unit/web/ea-merchant-idle-recovery.test.mjs
- tests/acceptance/ea-sr-integration-acceptance.mjs
- docs/design/STATUS.md
- tests/acceptance/ea-sr-009-production-gates-public-acceptance.mjs
- apps/web/ea-sr-ui.mjs
- tests/acceptance/ea-sr-009-shared-batch-public-acceptance.mjs
- tests/acceptance/ea-sr-009-reservation-competition-public-acceptance.mjs
- tests/acceptance/ea-sr-009-cancel-public-acceptance.mjs
- 2026-10-08 r23 普通生产 v2 配方快照：木场、采石、谷仓、藏经、井、百工坊、打坐的投入/产出/时长/技能及首位贡献者固定于开工单；旧活跃 v1 批次克隆时一次迁移，坏快照拒载，旧批在现行建筑定义变化后仍按原值唯一结算。独立复核新旧批与技能归属；根复跑共享生产1/1、门槛3/3、取消1/1、预留竞争1/1、生命11/11、邀请1/1。施工/丹炉/装备及完整新档解锁仍待，I01/V01/R01 不关闭。
- 2026-10-08 r24 局部丹炉：正常公开开局建炉/运草/成丹59命令、39次精确存读；v1及旧已付费迁移、取消余料一次返还、满仓同地同产权暂存、完成/取消坏事实拒载。根1/1、独立1/1，本地Chromium导入/刷新续档4/20。施工/装备和完整新档解锁未验，整项状态不提升。
- 2026-10-08 r26 局部装备配方：七件配方的新制作单冻结投入、工时、槽位、关键实物 claim、来源仓及产权；旧活跃已付费制作单在克隆读档时一次迁移，旧已完成物品保持，坏快照或重复结果拒载。有来源正常公开命令百工坊 checkpoint（worldTick31820）实际备料、制作行山轻衣、开工前/后取消、25步旧活跃单接续及成品唯一事实；根专项1/1，10条补充公开命令、6次精确存读，界面17通过/4待设备。本地Chromium导入真实在制档，七件报价、进度及取消可见；零进度取消实点后灵石98→110、木11→17，控制台0错误/0警告（1条浏览器autocomplete提示）。源码94986d3、Pages fa17a3b built，162文本blob与两个公网模块字节匹配。基线新档建坊处旧门道候位读档差异另案处理；本批没有测试七件分别全链或施工配方/跨仓物流/完整新档解锁，SR009整体状态不提升。证据 tests/acceptance/ea-sr-009-equipment-recipe-public-acceptance.mjs、/tmp/immortal-sr009-root-r26/.playwright-cli/page-2026-10-08T11-52-40-680Z.yml。
- docs/SECT-GROWTH-PLAN.md；2026-10-09 山域总图、五阶段迁移及统一原型的设计来源；当前运行验收待补。
- docs/art/COURTYARD-VALLEY-2026-10-12.md
- tests/unit/web/ea-mountain-alchemy.test.mjs
- tests/acceptance/ea-sr-production-accounting-acceptance.mjs
- docs/design/ISSUE-5-PRODUCTION-ACCOUNTING.md
- docs/art/OPENING-CHAIN-2026-10-12.md；2026-10-12 U-124：药圃首收、筹料建丹房、炉边交付10灵草并炼成2份回春散的普通新档完整路径。 仅增局部证据，完整 SR/AC 状态保持。
- docs/art/OPENING-GUIDANCE-2026-10-13.md；2026-10-13 U-124：百艺明确携药与服用，炉边2→1、随身0→1且未消费；炼药正常命令与存读检查通过。 仅增局部证据，完整 SR/AC 状态保持。
- docs/design/47-GOLDEN-CORE-ARTS-CATALOGUE-DRAFT.md；2026-10-15 U-145/R-45：169项修行内容草案、五脉续篇、获取替代、百艺阵法、暗线与特效；仅补设计证据，金丹运行与完整D/I/V/R、AC状态保持。
- docs/design/48-GOLDEN-CORE-WORLD-ARTS-V02.md；2026-10-15 U-146/R-46：720项玩家/NPC世界修行库、72新增来源谱系，符箓蛊道心法攻防及获取特效补齐；仅设计字段、来源与引用检查，运行及完整D/I/V/R、AC状态保持。
- docs/design/49-P0-P2-COURTYARD-PROGRESS.md；2026-10-15 U-147/R-47：院务/人物/工位/物资/研习操作、保存失败保护和疗伤收据重放；47/47 Node检查。浏览器内核缺失且官方下载失败，实际UI与桌面未验，完整P0—P2及SR/AC状态保持。
- docs/design/50-COURTYARD-UI-DESIGN-AUDIT.md；2026-10-15 U-148/R-48：四页及关联入口30项设计审查与7条后续场景；两处物流问题由正常命令复现，运行代码未修，实际UI未验，完整状态保持。
- docs/design/51-COURTYARD-MANAGEMENT-INTEGRATION.md；2026-10-15 U-149/R-49：四页与共用详情、单趟40份留苗搬运、落地回收和保存恢复接通；组件与相邻回归57/57，同一检查点真实桌面387.845秒13/13、最终包页面8/8、恢复链9/9，原生选择文件/预检/恢复及手动暂停已验。完整新档、规模、对话/突破、跨区施工、20分钟自主与Windows待接；完整D/I/V/R和AC状态保持。
- docs/design/53-COURTYARD-AUTONOMY-ACCEPTANCE.md
- tests/acceptance/courtyard-autonomy-desktop.mjs
- tests/acceptance/courtyard-autonomy-audit.py
- docs/design/55-CHARACTER-ACTION-LIBRARY.md
- docs/design/character-actions/WEAPONS-AND-SUPERNATURAL.md
- docs/design/character-actions/CRAFTS.md
- docs/design/character-actions/craft-coverage.json
- docs/design/56-COURTYARD-FOOD-SUPPLY.md
- tests/unit/courtyard/sect-food.test.mjs
- tests/acceptance/courtyard-food-desktop.mjs
- docs/design/58-GOLDEN-CORE-PRESET-BUILDINGS.md
- docs/art/golden-core-domain-20261018/README.md
- docs/design/60-WEST-VALLEY-INTEGRATION.md
- docs/design/61-RESIDENTIAL-INTEGRATION.md
- 2026-10-18 U-167/T-20住宅接续：GC09–12沿固定建位建设，四院一级16实体床；独立床位模块10/10规则检查，含只读旧档、唯一床位、真实到床、途中存读与失效恢复。三院完工及空地母稿已制作，世界位置与升级占地待校准。正式运行接缝、近身有限交易筹资和同源桌面营建入住尚待完成；本条只登记住宅局部准备，不推进完整SR/AC状态。
- 2026-10-18 U-167/T-19西谷一级批：同一未改正常来源macOS源码Electron连续31/31，墙钟1219.061秒、tick646→10944、7次精确关闭重开、错误0。四址实际运料施工，有限采石18.4及两田实际收获后35.2593256粮搬入新公库，两田各留2种粮。根独立读回来源SHA/最终状态/截图，源码与素材hash随run03封存；完整SR/AC、升级损坏图、供水保鲜、Windows和安装包仍按原范围接续。详见docs/design/60-WEST-VALLEY-INTEGRATION.md。
- tests/unit/courtyard/courtyard-local-trade.test.mjs
- tests/acceptance/courtyard-local-trade-desktop.mjs
- tests/unit/courtyard/courtyard-east-residences-domain.test.mjs
- tests/unit/courtyard/courtyard-housing-presentation.test.mjs
- tests/acceptance/courtyard-residential-funding-public.mjs
- tests/acceptance/courtyard-residential-roads-desktop.mjs
- tests/acceptance/courtyard-residential-build-desktop.mjs
- docs/design/62-EAST-SERVICES-INTEGRATION.md
- docs/design/66-NORTH-MEDITATION-INTEGRATION.md
- docs/design/68-WEST-WORKSHOPS-INTEGRATION.md

- 2026-10-06：由v1.2设计缺口审计建立SR；新增内容和参数遵循作者默认，不冒充用户逐项确认。
- 2026-10-06：用户授权目标模式、多agent并行开发与验收；启动D01，按现有契约展开模块设计，未将建档或局部实现标作交付。
- 2026-10-06：U-98改常态通用方格布局并暂缓院内铺路；沿用0.5米营造格、旧位置/工位/身份及导航，地面点选同源吸附。空间34、正常旧档9、grid6、UI/输入13均通过（生产Canvas/组件非browser），整项SR不关闭，发布证据单独登记。
- 2026-10-06：U-99将细网格更正为建筑单位格；R-28作者默认2米/格，一级伐木采石2×2、主屋4×4，导航仍0.5米连续移动。整格预制件、显示、摆放、冲突、工位与旧档一次映射共同调整；局部验证和发布分别登记，不关闭整项SR。
- 2026-10-07：2026-10-07局部修正：掌门采集与有限来源恢复在受伤、离位或低精力时明确paused，不再保留working伪装劳动；包裹满的采集也暂停而不扣有限来源。公开命令定向覆盖伤势、低精力、自然四批包裹满、精确存读与恢复3/3，离位分支尚未单独验证；经济52/52通过。完整配方/产能和SR-XF-009各AC仍未关闭。
- 2026-10-07：修复商人空闲精力门槛造成的正常工坊收货停滞，独立检查同场恢复、真实付款/收货及存读守恒；完整AC状态不变。
- 2026-10-07：M1 灵泉正常生产子链：世界步439776有来源建泉，独立复核先运粮、门人自愿接工，再至440710产晶6.8432并留生产事实；掌门公开搬运6晶至公库且交付事实守恒。仅覆盖此生产/供给局部，完整AC与整项门槛保持原状。
- 2026-10-08：2026-10-08 M2 有限工序验收：根 Agent 独立复跑 SR-XF-009-AC-01 正常公开命令来源档三场景 3/3；无人实际执行时旧批次不前进，工位缺料虽公库有货仍拒绝邀请，木材预约/取货/在途不进入工位库存或产出，送达后才可用。各关键点精确存读，生产管理 HTML 与位置库存/公开原因同源。此 AC 按原文 passed；未做浏览器/真机，AC02/03、配方设计和整项 D/I/V/R 未关闭。
- 2026-10-08：2026-10-08 M2 两人一批验收：正常百工坊公开来源档续实物木3石2搬入、两人自愿到双工位；第1批贡献110/90，唯一生产事实、一次木石成本、买方实付20.220271868159998、现场入账19.420271868159997、两人总工资0.8及各按贡献技能增长同一结果。修复成功结算后缺少个人记忆，每人记一条以事实ID关联的持久公开记忆，失败试算/重载后30步无重复。根 Agent 复跑定向1/1及经济52/52，按原文 AC02 passed。证据为 Node 公开命令链，浏览器/真机、AC03与整项门槛未关闭。
- 2026-10-08：独立复核取消加工和其他订单预留竞争两条有来源公开命令链各1/1，余料、占用、重复取消和恢复活动守恒，按原文将 SR009-AC03 记 passed；整项设计/验收仍未收口。
- 2026-10-08：SR009 D01 配方、种苗成熟、旧四类工单快照及新档解锁经独立 D02 初审三项退回、修订复审通过；仅设计 ready，I01 完整实现和 V/R 未完成。
- 2026-10-08：r19 implements seeded herb crop batches and exact old-active-batch compatibility; other versioned recipes, full early-game unlock and target-device acceptance remain open
- 2026-10-08：r23 普通生产 v2 版本配方快照及旧活跃批次迁移发布、独立审读并局部验收；其余工单与完整 I/V/R 继续。
- 2026-10-08：2026-10-08 r24 局部丹炉：正常公开开局建炉/运草/成丹59命令、39次精确存读；v1及旧已付费迁移、取消余料一次返还、满仓同地同产权暂存、完成/取消坏事实拒载。根1/1、独立1/1，本地Chromium导入/刷新续档4/20。施工/装备和完整新档解锁未验，整项状态不提升。
- 2026-10-08：2026-10-08 r26 局部装备配方：七件配方的新制作单冻结投入、工时、槽位、关键实物 claim、来源仓及产权；旧活跃已付费制作单在克隆读档时一次迁移，旧已完成物品保持，坏快照或重复结果拒载。有来源正常公开命令百工坊 checkpoint（worldTick31820）实际备料、制作行山轻衣、开工前/后取消、25步旧活跃单接续及成品唯一事实；根专项1/1，10条补充公开命令、6次精确存读，界面17通过/4待设备。本地Chromium导入真实在制档，七件报价、进度及取消可见；零进度取消实点后灵石98→110、木11→17，控制台0错误/0警告（1条浏览器autocomplete提示）。源码94986d3、Pages fa17a3b built，162文本blob与两个公网模块字节匹配。基线新档建坊处旧门道候位读档差异另案处理；本批没有测试七件分别全链或施工配方/跨仓物流/完整新档解锁，SR009整体状态不提升。证据 tests/acceptance/ea-sr-009-equipment-recipe-public-acceptance.mjs、/tmp/immortal-sr009-root-r26/.playwright-cli/page-2026-10-08T11-52-40-680Z.yml。
- 2026-10-09：2026-10-09 U-105 / R-32：当前需求更新为 1.1，山域设计关联 GROWTH-04、GROWTH-05、GROWTH-06、GROWTH-11。旧版 1.0 的标题、需求、AC原文/证据及D/I任务完成范围保存在 registry.json 的 version_history；当前重新记 not_run：SR-XF-009-AC-01。 当前D01继续补实施参数，D02及本版本I01待前置完成；development_status保留既有运行实现基线。未改变的已通过AC只沿用原行为及原运行环境证据，新增地域、布局与迁移流程按GROWTH另验。本批未执行运行时验收，未修改正式运行版本或发布状态。
- 2026-10-12：2026-10-12 U-123：田边10份灵草实运到炉边，掌门单炉炼得回春散2份；炼药定向2／2。完整产能与供给链继续。 局部证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。
- 2026-10-12：2026-10-12 Issue #5：最新main6000秒实验16笔生产/14笔微量灵石，修复显式receipt、9位新计算精度、工资封顶、事务提交与运输严格余额。专项12/12，正常公开开局2/2、丹炉公开链1/1；旧数量和事实逐字保留，不推进完整SR状态。见 docs/design/ISSUE-5-PRODUCTION-ACCOUNTING.md。
- 2026-10-15：U-145授权起草至金丹复仇收束的修行目录；R-45是作者提案。本批仅文档与同源JSON，不推进实现、验收或发布状态。
- 2026-10-15：U-146纠正169项过少，扩写至720项的R-46作者草案；玩家与NPC共用，补符蛊完整路线与散修来源，不推进运行或验收状态。
- 2026-10-15：U-147接续P0—P2：新增两人小院可操作供给成长和保存/事务保护，登记局部实现与Node证据；实际UI/桌面未验，完整状态不推进。
- 2026-10-15：U-148：记录四页及关联入口设计审查、操作断点和R-48重整提案；未修运行代码，完整D/I/V/R与AC状态保持。
- 2026-10-15：U-149：接续远端main并完成当前山院管理和取消回收、保存恢复的局部桌面验证；完整状态保持。
- 2026-10-16：U-151/R-43：同一东台完成档实际自主1200.036秒，后台180.857秒、接管、预算风险、生产搬运及关闭重开。原脚本末段分类失败保留，同轮证据补核验38项；同档手动补粮恢复5项。持续公库供给仍有缺口，完整SR/AC与D/I/V/R状态保持。
- 2026-10-17：U-158/R-51/T-17：登记人物动作设计稿及兵器神通、百艺分册，100动作组区分姿势、手位、物件、作用事件及中断收势；172项百艺草案按工序和阵法组对应。本批只检查设计覆盖、引用与同源时钟/身体活动/封闭建筑/知情等契约。具体姿势、八向建议与制作批次待评看，新动作素材和正常/失败/存读及设备验证待后续；完整SR/AC与任务状态保持。
- 2026-10-18：U-163/R-52/T-18：口粮目标、有限采粮与实际送库、保留生活粮的付费补种、预算与旧策略兼容已接入。供粮8项、相关17项、默认核心152/152通过。macOS源码Electron同源实际自主1200.016秒，实采送库80、消费40、公库3→43，解除饥荒后持续为0；长验11/11、证据核对12/12、界面7/7、macOS包同档短复验6/6，暂停关闭重开精确恢复。成功付费补种实机、三至五人、Windows及完整SR/AC状态保持。
- 2026-10-18：U-166/R-54将金丹篇建筑纳入同一预设山域规划：25项设施、31处编号位置，覆盖14类现行类型及专门工位。完成目录核对、编号图与整体场景概念；布局待评看，米制校准、施工接入和运行验收继续推进，本SR及AC状态保持。
- 2026-10-18：U-167 GC03同源公开筹料91743→117712→167589→168109完成，前两段失败及自然人物成长保持。macOS Electron run01勘察途中身体边缘检查失败，实际168489原生档封存，页面错误0；道路中心修复已合入、实机接续待验。GC25/26在隔离副本制作，完整SR/AC状态保持。
- 2026-10-18：U-167 GC03北台路心与静态地面查询修复合入，主树5项及原168489实际94步/4次存读通过。桌面原勘察1170在168583完成，施工14仅扣60灵石40木25石一次；实际168803封存后定位林长风自主回床路线检查失败。run02离开建位缺步及run03热字段遗漏为验收脚本问题，全部实际来源、进度及失败保留。完整经营与SR/AC继续验收。
- 2026-10-18：U-167 GC03原施工14已在同源桌面完成；四蒲团/两检修位、180步炼气6→7层、有限供灵与四次关闭重开通过。北路返床/绕人修复主树8项及实际27步回路成立。现场货位目的地过滤已补；当前170563检修运输347续接核对主殿门槛圈样本，维护全链未完成。丹房四阶段四工位16项为隔离候选证据。完整SR/AC状态保持。
- 2026-10-18：U-167 GC03一级同源macOS源码桌面链完成：最终171973，run07为10/10、错误0、209.943秒，七段实际逐项合计777.710秒。勘察/施工、180步6→7层、有限供灵、原运输347与348送2木1石、80步维护均成立，携货及活动中多次精确重开。Lu门槛为外部脚圈检查室内边界遗漏，已按正式预约/holder/floor纠正且保留离路反例。整体建筑与完整SR/AC继续。
- 2026-10-19：U-167 GC25/26一级道路、四阶段、真实工位与四段炼丹已合入23源码/测试和14图，主树30项及工程检查通过；有限供料负坐标整档完成施工到唯一两份成药，正常桌面生产另验。求见链真实续至174422，首位来客到时离开、第二位入院，未新增收录；绕柱导航已修，北坡迎面互等继续验证。完整SR/AC状态保持。

本文件由[registry.json](../registry.json)派生；更新台账后执行 `python scripts/requirements/sr-manager.py refresh`，不单独修改此派生页。
