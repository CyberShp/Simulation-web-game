# SR-XF-005 · 预设建位、施工与入口安全

来源：DB-2026-10-05 v1.2；需求版本：1.1；建档日期：2026-10-06。

| 字段 | 值 |
| --- | --- |
| 范围 / 模块 | 前期必需 / 营造 |
| 优先级 / 计划 | P0 / I1 |
| 设计 / 开发 | draft / in_progress |
| 验收 / 发布 | in_progress / not_released_for_this_sr |
| 责任人 / 复核人 | Codex/space_construction / Codex/root（集成） |

## 来源、依赖与范围

纳入云岫前期，按依赖推进。

决策来源：U-63, U-93, R-25, U-94, U-96, U-97, R-27, U-98, U-99, R-28, U-100, R-29, R-30, U-105, R-32, U-109, U-123, U-124, U-150, R-50, U-166, R-54, U-167, T-20, T-21, T-22。这是继承的U项和作者实施默认；具体新增名称/数值不得伪装成用户逐项批准。

规格：[03-SPATIAL-ART.md](../../../docs/design/03-SPATIAL-ART.md)、[05-RUNTIME-CONTRACTS.md](../../../docs/design/05-RUNTIME-CONTRACTS.md)、[07-ECONOMY-ORGANIZATION.md](../../../docs/design/07-ECONOMY-ORGANIZATION.md)、[18-SPATIAL-CONTINUITY-IMPLEMENTATION.md](../../../docs/design/18-SPATIAL-CONTINUITY-IMPLEMENTATION.md)、[06-OPENING-ACCEPTANCE.md](../../../docs/design/06-OPENING-ACCEPTANCE.md)、[SECT-GROWTH-PLAN.md](../../../docs/SECT-GROWTH-PLAN.md)、[41-COURTYARD-VALLEY-IMPLEMENTATION.md](../../../docs/design/41-COURTYARD-VALLEY-IMPLEMENTATION.md)、[46-CONTINUOUS-DOMAIN-FOUNDATION.md](../../../docs/design/46-CONTINUOUS-DOMAIN-FOUNDATION.md)、[52-EAST-TERRACE-INTEGRATION.md](../../../docs/design/52-EAST-TERRACE-INTEGRATION.md)、[58-GOLDEN-CORE-PRESET-BUILDINGS.md](../../../docs/design/58-GOLDEN-CORE-PRESET-BUILDINGS.md)、[59-WEST-FOREST-INTEGRATION.md](../../../docs/design/59-WEST-FOREST-INTEGRATION.md)、[60-WEST-VALLEY-INTEGRATION.md](../../../docs/design/60-WEST-VALLEY-INTEGRATION.md)、[61-RESIDENTIAL-INTEGRATION.md](../../../docs/design/61-RESIDENTIAL-INTEGRATION.md)、[62-EAST-SERVICES-INTEGRATION.md](../../../docs/design/62-EAST-SERVICES-INTEGRATION.md)、[64-NORTH-LIBRARY-INTEGRATION.md](../../../docs/design/64-NORTH-LIBRARY-INTEGRATION.md)、[69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md](../../../docs/design/69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md)、[71-GUESTHOUSE-INTEGRATION.md](../../../docs/design/71-GUESTHOUSE-INTEGRATION.md)。

依赖：[SR-XF-003](SR-XF-003.md)、[SR-XF-004](SR-XF-004.md)。

关联既有验收：BUILD-01, BUILD-02, BUILD-03, OPEN-05, GROWTH-02, GROWTH-06, GROWTH-10；本SR的AC细化这些目标，不代表旧版本已经通过。

## 现状与设计缺口

既有 JS 运行基线：自由选址、材料预留和到场施工沿用单位格事务。本批推荐营造确认按返回的transform与选中建筑类型显示镜头及反馈；建筑卡读取真实可用容量和工位状态。推荐营造说明使用稳定布局，指针离开画布后确认按钮仍可点击。 U-105 山域成长方案见 docs/SECT-GROWTH-PLAN.md；本批只登记设计与阶段原型，正式运行版本保持。

U-105 已确定建筑预设位置和资格—投入—施工流程；建位允许项目、资格条件、占地/门道与工单字段需补齐后接入实际营造。旧版自由选址证据保留原版本。

现状是适用旧能力的基线，不表示该SR完整目标已通过。

## 必须补齐的设计交付物

1. Z-01–07 建位目录：稳定建位ID、允许项目、解锁前置、占地、入口及连通条件；人数样例不写成固定阈值。
2. 鼠标与触控的项目选择、建位预览、资格/缺料说明、确认和取消流程。
3. 施工材料预留、分阶段投入、到场贡献、完工容量与资格变化的安全状态图。

## 需求行为

SR-XF-005-REQ-01：建筑在已开放的预设建位施工；资格只开放可选项目，玩家选择并确认后才创建工程，规划显示实形与必要辅助。

SR-XF-005-REQ-02：确认前不扣费；一次确认生成一个工作单；实际投入和到场施工后才推进，未完工不提前提供容量。

SR-XF-005-REQ-03：确认及完工均检查建位允许类型、占用、真实通路和人物安全；未开放或受阻时说明原因并保留世界状态。


## 验收标准

| ID | 情景 / 操作 | 必须看到的结果 | 状态 |
| --- | --- | --- | --- |
| SR-XF-005-AC-01 | 在已开放的预设建位选择项目、确认并完成施工 | 资格达成只开放项目；玩家确认后才产生一次预留和工单，人员实际到场贡献，完工后场景与真实容量一致。 | not_run |
| SR-XF-005-AC-02 | 在未开放、已预约或阻挡通路/人物的建位尝试确认 | 明确说明资格或占用原因；费用、人物位置和原工程保持，条件恢复后可在合法建位继续。 | not_run |
| SR-XF-005-AC-03 | 反复确认、取消、存读档和暂停 | 任务/材料至多登记一次，暂停不推进，取消按已发生投入结算。 | passed |

SR-XF-005-AC-03证据：tests/acceptance/ea-sr-spatial-acceptance.mjs；docs/requirements/IMPLEMENTATION-2026-10-06.md；tests/acceptance/ea-courtyard-life-acceptance.mjs

2026-10-07本地小院批次：成人家具/单位格/空间定向检查48/48（8/6/34），正常公开命令接受/拒绝邀请两路完成营造、产出搬运、研习、到床休息与迁建取消/续建；分别60命令/36次精确存读和61命令/37次精确存读。六身份卧姿与预约前提2/2，生产Canvas卧姿加载/只读/身体点选/缺图回退4/4，已读图。旧v5完成档40建筑30门人保留资源、时间和return结局，全部入口可达，二次存读一致。各SR仅登记适用子情景；完整AC、真机触摸/FPS和真人首次体验状态分别保留。 浏览器DPR1鼠标在1366×900、1180×820、820×1180点选床上掌门通过；正常推荐营造经Enter和鼠标确认、实际施工落成。一次动态模块加载失败经页面重载恢复同档，原因待定位。I/V证据为沿既有可用契约实施的本批子范围；完整D01/D02及I/V关闭门槛保持原状态。

2026-10-07 M0/M1 接续批：独立 qa-m1-freebuild-20261007 新档鼠标链：疗伤前营造命令拒绝；疗伤后主屋占地拒绝且资源不扣；非推荐空地灵草田从110/65/45扣到80/40/35，实际到场施工、建成显示4工作位；第二座非推荐伐木场从80/40/35扣到55/20/27，建成显示2工作位；两座均从正式保存档重新加载，设施总数3、资源和暂停时间保留。首次链发现自由营造返回 transform 被误读为顶层 x/y，引发镜头 NaN/Canvas 错误；已修并用第二次链复验。AC原有 passed 保留，触控/入口封堵/人物占位等完整矩阵未因此新增通过声明。

2026-10-08 M1 双工位施工后端子批：工单保存最多两个排他脚点，掌门和自愿门人实际到场共享材料/进度，真实受伤/改派/离院/临时占位会停止该人贡献并安全释放或等待；读档拒绝伪造到位脚点，旧无 workSlots 单人单据继续执行。独立专项 8/8，相关 BUILD/SR006 13/13，合并空间/历史 46/46；仅后端子范围可发布。前端显式预览/确认、实际 iPadOS 选址及完整 I/V/R 继续。

2026-10-08 M1 双工位后端独立补证：tests/acceptance/ea-sr005-crew-acceptance.mjs 8/8 覆盖双排他施工位、自愿到场、共用进度/材料、受伤或离院释放、动态占位、伪造到位拒载和旧单人单据存读；tests/acceptance/ea-sr-spatial-acceptance.mjs 的 BUILD/SR005/006 相关 13/13。此次证据限运行时后端和 Node 存读；显式选址界面、iPadOS 实机和完整 I/V/R 继续。

2026-10-09 U-105 / R-32：当前需求更新为 1.1，山域设计关联 GROWTH-02、GROWTH-06、GROWTH-10。旧版 1.0 的标题、需求、AC原文/证据及D/I任务完成范围保存在 registry.json 的 version_history；当前重新记 not_run：SR-XF-005-AC-01、SR-XF-005-AC-02。 当前D01继续补实施参数，D02及本版本I01待前置完成；development_status保留既有运行实现基线。未改变的已通过AC只沿用原行为及原运行环境证据，新增地域、布局与迁移流程按GROWTH另验。本批未执行运行时验收，未修改正式运行版本或发布状态。

2026-10-11 云岫首座药圃子批：新档伤愈取卷、立殿后在固定建位确认灵草田；非法坐标拒绝且存档不变、施工中精确读档、完工同一建筑开放四个作业位，定向 1/1。本地 Chromium 实点到落成并核对材料扣除、三阶段画面与作业位。当前版 AC01/02、目标设备与门人种收未完成，状态不推进。

2026-10-12 U-123：新丹房建位与外观接入；新档首收与独立丹房QA档的第一炉分别在网页实走，炼药定向2／2。全部建位、施工和入口安全门槛仍按原 AC。 局部证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。

2026-10-18 U-164/U-165局部：多Agent完成林长风门籍规则及同窗交互首轮，规则8/8、相关11/11，主Agent联合供粮/操作33/33；亲传Electron专项9项，范围限当时人物交互。用户明确扩大主殿山域、整体绘制采伐场、所有建筑完全预设并由人物实际到场修建；院前临时营造入口与独立素材已撤下。下一步先确认整体场景和稳定建位，再接施工与三人同源长验。二十分钟、当前桌面包、Windows及完整SR/AC尚未完成，整项状态保持。

2026-10-18 U-167局部：批准25项设施/31预设建位布局并分期开发；31目录已接入，原殿/药圃/东台保留身份，西林一级完成真实西桥运料、到场施工、两工位产木与搬回公库，其余27处待接。默认170/170、相关31项及地面校准后6+10项复验通过。macOS源码Electron同一两人来源档10/10、100.894秒，投入25灵石20木8石，6木实际回库，三次存读精确，页面/运行错误0。证据docs/design/59-WEST-FOREST-INTEGRATION.md；升级画层、三人长验、Windows及当前包另验，整项D/I/V/R与AC状态保持。 2026-10-18 U-167西谷GC-17/18/19/24开发中：显式扩谷、固定施工、有限石源、现场种粮及独立分类公库已写入。同源30条公开命令连续营造四处并精确存读，证据/Volumes/Media/immortal-qa/west-valley-prepared-20261018-v2/。阶段美术及完整桌面验收继续；远路邀请已改为有限通勤、到岗后计劳动承诺，旧邀请期限保留，公库口粮纳入实际回运；整项SR/AC状态保持。

## 开发任务

| 任务 | 工作 | 状态 | 前置 | 责任人 |
| --- | --- | --- | --- | --- |
| SR-XF-005-D01 | 设计补齐：当前版本设计补齐：建立预设建位与项目资格目录，补齐选择/确认/拒绝及完工检查；旧版自由选址设计记录在 version_history。 原版本已完成范围和证据保存在 version_history。 | in_progress | 无 | Codex/root |
| SR-XF-005-D02 | 契约与内容审阅：在当前版本D01完成后，审阅预设建位、施工与入口安全与依赖契约的字段、时序、失败及恢复；核对本SR的REQ/AC和GROWTH-02、GROWTH-06、GROWTH-10。旧版审阅完成事实保存在 version_history。 | todo | SR-XF-005-D01 | Codex/sr010_contract_validation |
| SR-XF-005-I01 | 开发与集成：按当前版本设计在相关模块集成预设建位、施工与入口安全，接入真实数据、行为、素材、界面和存读。既有实现保留为运行基线；本版本在D02完成后进入集成。 | todo | SR-XF-005-D02 | Codex/courtyard-integration |
| SR-XF-005-V01 | 验收与兼容：执行本SR的AC-01至AC-03及GROWTH-02、GROWTH-06、GROWTH-10；分别记录正常、失败、存读、网页视口和适用真机证据。 | todo | SR-XF-005-I01 | Codex/courtyard-acceptance |
| SR-XF-005-R01 | 发布与关闭：完成所需源码/运行时发布核对、交接和未覆盖说明；本轮用户不要求上传QA过程产物。 | todo | SR-XF-005-V01 | 待分配 |

SR-XF-005-D01证据：docs/SECT-GROWTH-PLAN.md

SR-XF-005-I01证据：apps/web/ea-game.mjs；apps/web/ea-ui.mjs；docs/design/STATUS.md；apps/web/ea.css；apps/web/ea-courtyard-renderer.mjs；docs/design/59-WEST-FOREST-INTEGRATION.md；tests/acceptance/courtyard-west-desktop.mjs；2026-10-18 U-167西谷GC-17/18/19/24开发中：显式扩谷、固定施工、有限石源、现场种粮及独立分类公库已写入。同源30条公开命令连续营造四处并精确存读，证据/Volumes/Media/immortal-qa/west-valley-prepared-20261018-v2/。阶段美术及完整桌面验收继续；远路邀请已改为有限通勤、到岗后计劳动承诺，旧邀请期限保留，公库口粮纳入实际回运；整项SR/AC状态保持。；2026-10-18 U-167/T-20住宅接续：GC09–12沿固定建位建设，四院一级16实体床；独立床位模块10/10规则检查，含只读旧档、唯一床位、真实到床、途中存读与失效恢复。三院完工及空地母稿已制作，世界位置与升级占地待校准。正式运行接缝、近身有限交易筹资和同源桌面营建入住尚待完成；本条只登记住宅局部准备，不推进完整SR/AC状态。；2026-10-18 U-167/T-19西谷一级批：同一未改正常来源macOS源码Electron连续31/31，墙钟1219.061秒、tick646→10944、7次精确关闭重开、错误0。四址实际运料施工，有限采石18.4及两田实际收获后35.2593256粮搬入新公库，两田各留2种粮。根独立读回来源SHA/最终状态/截图，源码与素材hash随run03封存；完整SR/AC、升级损坏图、供水保鲜、Windows和安装包仍按原范围接续。详见docs/design/60-WEST-VALLEY-INTEGRATION.md。；2026-10-18 T-20 housing runtime: 27 scoped checks and 8 related opening/care regressions passed. Existing-hall source Electron UI: select bed, real arrival, shared person/building display, exact reopen: 6/6, errors 0. See docs/design/61-RESIDENTIAL-INTEGRATION.md section 11. Four-house normal construction and full SR/AC acceptance remain in progress.

SR-XF-005-V01证据：tests/acceptance/ea-courtyard-life-acceptance.mjs；tests/unit/web/ea-scene-ui.test.mjs；docs/design/STATUS.md；docs/design/59-WEST-FOREST-INTEGRATION.md；tests/acceptance/courtyard-west-desktop.mjs；2026-10-18 U-167西谷GC-17/18/19/24开发中：显式扩谷、固定施工、有限石源、现场种粮及独立分类公库已写入。同源30条公开命令连续营造四处并精确存读，证据/Volumes/Media/immortal-qa/west-valley-prepared-20261018-v2/。阶段美术及完整桌面验收继续；远路邀请已改为有限通勤、到岗后计劳动承诺，旧邀请期限保留，公库口粮纳入实际回运；整项SR/AC状态保持。；2026-10-18 U-167/T-20住宅接续：GC09–12沿固定建位建设，四院一级16实体床；独立床位模块10/10规则检查，含只读旧档、唯一床位、真实到床、途中存读与失效恢复。三院完工及空地母稿已制作，世界位置与升级占地待校准。正式运行接缝、近身有限交易筹资和同源桌面营建入住尚待完成；本条只登记住宅局部准备，不推进完整SR/AC状态。；2026-10-18 U-167/T-19西谷一级批：同一未改正常来源macOS源码Electron连续31/31，墙钟1219.061秒、tick646→10944、7次精确关闭重开、错误0。四址实际运料施工，有限采石18.4及两田实际收获后35.2593256粮搬入新公库，两田各留2种粮。根独立读回来源SHA/最终状态/截图，源码与素材hash随run03封存；完整SR/AC、升级损坏图、供水保鲜、Windows和安装包仍按原范围接续。详见docs/design/60-WEST-VALLEY-INTEGRATION.md。；2026-10-18 T-20 housing runtime: 27 scoped checks and 8 related opening/care regressions passed. Existing-hall source Electron UI: select bed, real arrival, shared person/building display, exact reopen: 6/6, errors 0. See docs/design/61-RESIDENTIAL-INTEGRATION.md section 11. Four-house normal construction and full SR/AC acceptance remain in progress.

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

- docs/requirements/design/SR-XF-003-006.md
- docs/requirements/IMPLEMENTATION-2026-10-06.md
- docs/design/03-SPATIAL-ART.md
- docs/design/STATUS.md
- apps/web/ea-game.mjs
- apps/web/ea-ui.mjs
- tests/acceptance/ea-courtyard-life-acceptance.mjs
- tests/unit/web/ea-scene-ui.test.mjs
- docs/CODEX-HANDOFF.md
- apps/web/ea.css
- apps/web/ea-courtyard-renderer.mjs
- docs/SECT-GROWTH-PLAN.md；2026-10-09 山域总图、五阶段迁移及统一原型的设计来源；当前运行验收待补。
- docs/design/STATUS.md；2026-10-10 U-109 旧别院 3D 本地预览局部网页证据；完整 AC 状态不变。
- docs/art/COURTYARD-VALLEY-2026-10-12.md
- tests/unit/web/ea-mountain-alchemy.test.mjs
- docs/art/OPENING-CHAIN-2026-10-12.md；2026-10-12 U-124：主殿撤离等待与新建帮工落点修复，两个实际卡点存档接续；正常行走、碰撞与物资守恒定向检查通过。 仅增局部证据，完整 SR/AC 状态保持。
- tests/unit/web/ea-mountain-hall-egress.test.mjs
- docs/design/52-EAST-TERRACE-INTEGRATION.md
- tests/acceptance/courtyard-east-desktop.mjs
- docs/design/57-THREE-RESIDENT-COURTYARD.md
- docs/design/58-GOLDEN-CORE-PRESET-BUILDINGS.md
- docs/art/golden-core-domain-20261018/README.md
- docs/design/60-WEST-VALLEY-INTEGRATION.md
- docs/design/61-RESIDENTIAL-INTEGRATION.md
- 2026-10-18 U-167/T-20住宅接续：GC09–12沿固定建位建设，四院一级16实体床；独立床位模块10/10规则检查，含只读旧档、唯一床位、真实到床、途中存读与失效恢复。三院完工及空地母稿已制作，世界位置与升级占地待校准。正式运行接缝、近身有限交易筹资和同源桌面营建入住尚待完成；本条只登记住宅局部准备，不推进完整SR/AC状态。
- 2026-10-18 U-167/T-19西谷一级批：同一未改正常来源macOS源码Electron连续31/31，墙钟1219.061秒、tick646→10944、7次精确关闭重开、错误0。四址实际运料施工，有限采石18.4及两田实际收获后35.2593256粮搬入新公库，两田各留2种粮。根独立读回来源SHA/最终状态/截图，源码与素材hash随run03封存；完整SR/AC、升级损坏图、供水保鲜、Windows和安装包仍按原范围接续。详见docs/design/60-WEST-VALLEY-INTEGRATION.md。
- tests/unit/courtyard/courtyard-residential-integration.test.mjs
- tests/unit/courtyard/courtyard-housing-presentation.test.mjs
- tests/acceptance/courtyard-residential-rest-desktop.mjs
- tests/unit/courtyard/courtyard-east-residences-domain.test.mjs
- tests/acceptance/courtyard-residential-funding-public.mjs
- tests/acceptance/courtyard-residential-roads-desktop.mjs
- tests/acceptance/courtyard-residential-build-desktop.mjs
- docs/design/62-EAST-SERVICES-INTEGRATION.md
- docs/design/64-NORTH-LIBRARY-INTEGRATION.md
- docs/design/66-NORTH-MEDITATION-INTEGRATION.md
- docs/design/68-WEST-WORKSHOPS-INTEGRATION.md
- docs/design/69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md
- docs/design/69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md；2026-10-20：六居民同源生活已完成settlement-02：tick190800公库食粮16→4，实际消耗12，5位门人供给事实均supplied且starvation=0，原生暂停与关闭重开完整世界相等。living-03在东台返院路触发身体走面失配，正常暂停保存至tick191089；路径与呈现修复仍待living-04同档实机复验。现有三项未领院务奖励（引灵入府、仙途初成、安居有粮）已接桌面入口与整包容量守卫；专项5/5、直接相关回归7/7，正常档实际领取未验。GC21–23仅布局候选。下一步接living-04、GC25/26正常筹料营建及纸胎实收、四段成药回库；完整SR/AC状态保持。
- docs/design/69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md；2026-10-20：living-04从living-03原生停点继续并通过：顾听澜在tick191090实际使用床1；裴照雪tick191170完成床4入住，191171观测为executing。掌门真实采粮368于191593取得16份，运输369于191626送入公库；192000日结5位门人均supplied且starvation=0。实测118.716135秒，原生暂停与关闭重开完整世界相等，来源及运行文件散列不变，错误0。裴照雪继承的非法脚点在实际运行tick191090从(123.5,45)恢复至(123.5,45.1)，原活动、起始tick和床4预约继续；恢复后按严格身体、门槛与道路判据检查。living-03失败及原始快照继续保留。封存源tick192003 SHA 1b19735d324326bfb6682f60160229e26f054e24da46bd20551318a8b2e9ef42。筹料、奖励实际领取与GC25/26正式生产结果未验；完整SR/AC保持。
- docs/design/69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md；funding-01在192003正式领取三项既有奖励并精确原生重开通过；随后renderer不响应，725.897205秒段以failed收口。lastHarnessObservedTick192200不代表落盘终点；当前可恢复来源为funding-01/native-preserved-while-waiting.json，tick192063，SHA cf63afd0879a0669f46d3724adb3e27204e770433d0616612af6fc9367b93430，manualPause=false，待公开recover阶段生成新的paused原生。STOP保存未完成，SIGTERM未退出后仅QA Electron树被SIGKILL，未落盘尾段时长及最终tick未知，不计连续成功。living-04通过保留，GC25/26正常筹料营建与生产未完成，完整SR/AC状态保持。
- docs/design/69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md；recover-01已从保全的原生192063运行态通过公开暂停按钮自然推进5步至192068，暂停保存及精确关闭重开通过；实测25.840198秒，来源和运行散列保持、错误0。当前唯一接续启动档为/Volumes/Media/immortal-qa/sol-production-20261020/recover-01/world/sect-save.json，tick192068，SHA 796a659e63472a706606271077f0c77752d98421d46b8afec8d1bfbb8690f984，manualPause=true。原report的sourceManualPause=null为字段误读，独立metadata-correction.json绑定原source哈希并校正为false，原报告保持。funding-01失败与未知未落盘尾段证据继续保留；GC25/26正常筹料营建与生产待继续，完整SR/AC状态保持。
- docs/design/71-GUESTHOUSE-INTEGRATION.md
- tests/unit/courtyard/courtyard-guest-lodging.test.mjs
- tests/acceptance/courtyard-guesthouse-desktop.mjs
- 2026-10-28 Web Work回归批次：从e61ceb8复现默认1059/1096、37失败；修复东台长段规划漏检导致实走清路及第二批石料卡死，原卡档125步继续完工。同步当前战斗/客院/访客测试契约、Windows文件URL/LF与CI浏览器依赖。三/五门人各2954步、三日结、生产/粮药交付/历练归来返工通过；默认全量与CI最终结论见 docs/engineering/REGRESSION-20261028.md。仅局部证据，完整SR/AC及发布状态保持，不沿用旧空间版本FPS结论。

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
- 2026-10-08：2026-10-08 M1 双工位施工后端子批：工单保存最多两个排他脚点，掌门和自愿门人实际到场共享材料/进度，真实受伤/改派/离院/临时占位会停止该人贡献并安全释放或等待；读档拒绝伪造到位脚点，旧无 workSlots 单人单据继续执行。独立专项 8/8，相关 BUILD/SR006 13/13，合并空间/历史 46/46；仅后端子范围可发布。前端显式预览/确认、实际 iPadOS 选址及完整 I/V/R 继续。
- 2026-10-08：2026-10-08 M1 双工位后端独立补证：tests/acceptance/ea-sr005-crew-acceptance.mjs 8/8 覆盖双排他施工位、自愿到场、共用进度/材料、受伤或离院释放、动态占位、伪造到位拒载和旧单人单据存读；tests/acceptance/ea-sr-spatial-acceptance.mjs 的 BUILD/SR005/006 相关 13/13。此次证据限运行时后端和 Node 存读；显式选址界面、iPadOS 实机和完整 I/V/R 继续。
- 2026-10-09：2026-10-09 U-105 / R-32：当前需求更新为 1.1，山域设计关联 GROWTH-02、GROWTH-06、GROWTH-10。旧版 1.0 的标题、需求、AC原文/证据及D/I任务完成范围保存在 registry.json 的 version_history；当前重新记 not_run：SR-XF-005-AC-01、SR-XF-005-AC-02。 当前D01继续补实施参数，D02及本版本I01待前置完成；development_status保留既有运行实现基线。未改变的已通过AC只沿用原行为及原运行环境证据，新增地域、布局与迁移流程按GROWTH另验。本批未执行运行时验收，未修改正式运行版本或发布状态。
- 2026-10-10：U-109 第一批本地预览：旧别院五处固定建位已接入本地预览；灵草田、伐木场从零营造，非法坐标拒绝，施工期存读局部通过。此为局部证据，不提升完整 AC/SR 状态。
- 2026-10-12：2026-10-12 U-123：新丹房建位与外观接入；新档首收与独立丹房QA档的第一炉分别在网页实走，炼药定向2／2。全部建位、施工和入口安全门槛仍按原 AC。 局部证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。
- 2026-10-16：U-150/R-50：追加连续东路、实际分趟运料施工、四床启用与同源macOS存读往返局部证据。流程两段308.849秒，最终包阶段6项及往返9项，错误0；保留验收脚本中断记录。完整SR/AC与D/I/V/R状态保持。
- 2026-10-18：2026-10-18 U-164/U-165局部：多Agent完成林长风门籍规则及同窗交互首轮，规则8/8、相关11/11，主Agent联合供粮/操作33/33；亲传Electron专项9项，范围限当时人物交互。用户明确扩大主殿山域、整体绘制采伐场、所有建筑完全预设并由人物实际到场修建；院前临时营造入口与独立素材已撤下。下一步先确认整体场景和稳定建位，再接施工与三人同源长验。二十分钟、当前桌面包、Windows及完整SR/AC尚未完成，整项状态保持。
- 2026-10-18：U-166/R-54将金丹篇建筑纳入同一预设山域规划：25项设施、31处编号位置，覆盖14类现行类型及专门工位。完成目录核对、编号图与整体场景概念；布局待评看，米制校准、施工接入和运行验收继续推进，本SR及AC状态保持。
- 2026-10-18：U-167 GC03同源公开筹料91743→117712→167589→168109完成，前两段失败及自然人物成长保持。macOS Electron run01勘察途中身体边缘检查失败，实际168489原生档封存，页面错误0；道路中心修复已合入、实机接续待验。GC25/26在隔离副本制作，完整SR/AC状态保持。
- 2026-10-18：U-167 GC03北台路心与静态地面查询修复合入，主树5项及原168489实际94步/4次存读通过。桌面原勘察1170在168583完成，施工14仅扣60灵石40木25石一次；实际168803封存后定位林长风自主回床路线检查失败。run02离开建位缺步及run03热字段遗漏为验收脚本问题，全部实际来源、进度及失败保留。完整经营与SR/AC继续验收。
- 2026-10-18：U-167 GC03原施工14已在同源桌面完成；四蒲团/两检修位、180步炼气6→7层、有限供灵与四次关闭重开通过。北路返床/绕人修复主树8项及实际27步回路成立。现场货位目的地过滤已补；当前170563检修运输347续接核对主殿门槛圈样本，维护全链未完成。丹房四阶段四工位16项为隔离候选证据。完整SR/AC状态保持。
- 2026-10-18：U-167 GC03一级同源macOS源码桌面链完成：最终171973，run07为10/10、错误0、209.943秒，七段实际逐项合计777.710秒。勘察/施工、180步6→7层、有限供灵、原运输347与348送2木1石、80步维护均成立，携货及活动中多次精确重开。Lu门槛为外部脚圈检查室内边界遗漏，已按正式预约/holder/floor纠正且保留离路反例。整体建筑与完整SR/AC继续。
- 2026-10-19：U-167 GC25/26一级道路、四阶段、真实工位与四段炼丹已合入23源码/测试和14图，主树30项及工程检查通过；有限供料负坐标整档完成施工到唯一两份成药，正常桌面生产另验。求见链真实续至174422，首位来客到时离开、第二位入院，未新增收录；绕柱导航已修，北坡迎面互等继续验证。完整SR/AC状态保持。
- 2026-10-20：六居民同档日结与原生精确重开通过；living-03道路body失配保留tick191089，修复待living-04。院务奖励入口与容量边界规则检查通过，实际领取、GC25/26正常生产未验；GC21–23仅布局候选。完整SR/AC及任务状态保持。
- 2026-10-20：living-04从191089同档完成73/75实际床位、自主16粮采送、192000五门人日结与精确原生重开，118.716135秒、错误0；living-03失败保留。只更新局部证据，不提升完整SR/AC；funding-01及GC25/26正式生产待验。
- 2026-10-23：2026-10-23 GC15一级客院已接入：两张独立客床、当面自愿邀请、实际步行入住、原来访期限退房下山及原生存读。macOS源码Electron有限夹具入住ui-fixture-03通过7项（1656→3851、235.557720083秒），施工build-fixture-01通过3项（646→1700、114.379689209秒）；唯一工单3投入45灵石/40木/20石，两趟实际送达后于1683完成200施工步。两段错误0，来源、运行文件与原生重开均一致。GPT-6.1-sol独立读回6个原生检查点及12个核心源码通过。正常世界仍保留医庐tick261253原档；该世界的筹资建设、Windows和完整SR/AC保持待验。 详见docs/design/71-GUESTHOUSE-INTEGRATION.md。
- 2026-10-28：登记CI与现有回归修复、东台带货施工及三/五门人多日经营验证；完整SR/AC状态保持。

本文件由[registry.json](../registry.json)派生；更新台账后执行 `python scripts/requirements/sr-manager.py refresh`，不单独修改此派生页。
