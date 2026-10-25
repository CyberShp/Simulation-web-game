# SR-XF-026 · 立派、任职、分峰与公开政策

来源：DB-2026-10-05 v1.2；需求版本：1.1；建档日期：2026-10-06。

| 字段 | 值 |
| --- | --- |
| 范围 / 模块 | 前期必需 / 组织 |
| 优先级 / 计划 | P1 / I4 |
| 设计 / 开发 | draft / in_progress |
| 验收 / 发布 | in_progress / not_released_for_this_sr |
| 责任人 / 复核人 | Codex/economy_people / Codex/root（集成） |

## 来源、依赖与范围

纳入云岫前期，按依赖推进。

决策来源：U-63, U-93, R-25, U-94, U-105, R-32, U-166, R-54, T-22, U-172。这是继承的U项和作者实施默认；具体新增名称/数值不得伪装成用户逐项批准。

规格：[01-CHARACTERS.md](../../../docs/design/01-CHARACTERS.md)、[07-ECONOMY-ORGANIZATION.md](../../../docs/design/07-ECONOMY-ORGANIZATION.md)、[14-EARLY-GAME-DETAILED-DESIGN.md](../../../docs/design/14-EARLY-GAME-DETAILED-DESIGN.md)、[06-OPENING-ACCEPTANCE.md](../../../docs/design/06-OPENING-ACCEPTANCE.md)、[SECT-GROWTH-PLAN.md](../../../docs/SECT-GROWTH-PLAN.md)、[58-GOLDEN-CORE-PRESET-BUILDINGS.md](../../../docs/design/58-GOLDEN-CORE-PRESET-BUILDINGS.md)、[64-NORTH-LIBRARY-INTEGRATION.md](../../../docs/design/64-NORTH-LIBRARY-INTEGRATION.md)、[71-GUESTHOUSE-INTEGRATION.md](../../../docs/design/71-GUESTHOUSE-INTEGRATION.md)、[81-DISCIPLE-ONBOARDING.md](../../../docs/design/81-DISCIPLE-ONBOARDING.md)。

依赖：[SR-XF-008](SR-XF-008.md)、[SR-XF-009](SR-XF-009.md)、[SR-XF-010](SR-XF-010.md)、[SR-XF-014](SR-XF-014.md)、[SR-XF-020](SR-XF-020.md)。

关联既有验收：ECON-04, ECON-05, LOAD-01, GROWTH-02, GROWTH-03, GROWTH-05；本SR的AC细化这些目标，不代表旧版本已经通过。

## 现状与设计缺口

既有 JS 运行基线：已有任职、师承、阶段与分峰旧基础。 U-105 山域成长方案见 docs/SECT-GROWTH-PLAN.md；本批只登记设计与阶段原型，正式运行版本保持。

U-105 已定义人口阶段开放资格、玩家建设和自愿分峰迁居；正式资格配置、人才/传承/供给/公约组合、归峰职责预算与政策流程仍待完整实施设计。

现状是适用旧能力的基线，不表示该SR完整目标已通过。

## 必须补齐的设计交付物

1. 山院、立派及分峰的资格配置，结合人口阶段、设施、传承、人才、产能和公约；5/20/50/100/150仅作规模验算样例。
2. Z-04–07 的生活圈容量、归峰邀约、真实迁居、职责时间、报酬、权限与退出预算。
3. 公开政策版本、知情与争议流程；人数下降保留已解锁地域，实际服务和维护按占用结算。

## 需求行为

SR-XF-026-REQ-01：NPC自愿任职、归峰与师承，迁居经实际行程到达合法目的地；同一人不能同时承担两处身体活动。

SR-XF-026-REQ-02：人数阶段与组织能力共同决定可选项目资格，实际建筑由投入/建设形成；少人专业路线仍可推进篇章，多人路线承担真实住居和物流成本。

SR-XF-026-REQ-03：新规不追溯定罪，处分基于可知事实；人数下降保留已解锁地域与建筑，归峰和退出不强收私人物品与知识。


## 验收标准

| ID | 情景 / 操作 | 必须看到的结果 | 状态 |
| --- | --- | --- | --- |
| SR-XF-026-AC-01 | 少人专业路线与五种规模样例分别推进，并取得新地域资格 | 各有合法成长途径；资格只开放项目且人数样例不是固定阈值，必须投入建设/供给才能迁居，主线不由人口单项锁定。 | not_run |
| SR-XF-026-AC-02 | 一人兼任授课与巡护 | 有限时间冲突被处理，不能同tick承担两个身体活动。 | not_run |
| SR-XF-026-AC-03 | 改变政策和NPC退出 | 生效/知情有记录，私人物品和知识不被强制没收。 | not_run |

2026-10-09 U-105 / R-32：当前需求更新为 1.1，山域设计关联 GROWTH-02、GROWTH-03、GROWTH-05。旧版 1.0 的标题、需求、AC原文/证据及D/I任务完成范围保存在 registry.json 的 version_history；本SR未重置任何已通过AC。 当前D01继续补实施参数，D02及本版本I01待前置完成；development_status保留既有运行实现基线。未改变的已通过AC只沿用原行为及原运行环境证据，新增地域、布局与迁移流程按GROWTH另验。本批未执行运行时验收，未修改正式运行版本或发布状态。

2026-10-18 U-164/U-165局部：多Agent完成林长风门籍规则及同窗交互首轮，规则8/8、相关11/11，主Agent联合供粮/操作33/33；亲传Electron专项9项，范围限当时人物交互。用户明确扩大主殿山域、整体绘制采伐场、所有建筑完全预设并由人物实际到场修建；院前临时营造入口与独立素材已撤下。下一步先确认整体场景和稳定建位，再接施工与三人同源长验。二十分钟、当前桌面包、Windows及完整SR/AC尚未完成，整项状态保持。

## 开发任务

| 任务 | 工作 | 状态 | 前置 | 责任人 |
| --- | --- | --- | --- | --- |
| SR-XF-026-D01 | 设计补齐：当前版本设计补齐：冻结阶段项目资格、归峰同意及生活服务预算，完整任职、公约与政策设计继续补齐。 原版本已完成范围和证据保存在 version_history。 | in_progress | 无 | Codex/economy_people |
| SR-XF-026-D02 | 契约与内容审阅：在当前版本D01完成后，审阅立派、任职、分峰与公开政策与依赖契约的字段、时序、失败及恢复；核对本SR的REQ/AC和GROWTH-02、GROWTH-03、GROWTH-05。旧版审阅完成事实保存在 version_history。 | todo | SR-XF-026-D01 | 待分配 |
| SR-XF-026-I01 | 开发与集成：按当前版本设计在相关模块集成立派、任职、分峰与公开政策，接入真实数据、行为、素材、界面和存读。既有实现保留为运行基线；本版本在D02完成后进入集成。 | todo | SR-XF-026-D02 | 待分配 |
| SR-XF-026-V01 | 验收与兼容：执行本SR的AC-01至AC-03及GROWTH-02、GROWTH-03、GROWTH-05；分别记录正常、失败、存读、网页视口和适用真机证据。 | todo | SR-XF-026-I01 | 待分配 |
| SR-XF-026-R01 | 发布与关闭：完成所需源码/运行时发布核对、交接和未覆盖说明；本轮用户不要求上传QA过程产物。 | todo | SR-XF-026-V01 | 待分配 |

SR-XF-026-D01证据：docs/SECT-GROWTH-PLAN.md

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
- docs/SECT-GROWTH-PLAN.md；2026-10-09 山域总图、五阶段迁移及统一原型的设计来源；当前运行验收待补。
- docs/design/57-THREE-RESIDENT-COURTYARD.md
- docs/design/58-GOLDEN-CORE-PRESET-BUILDINGS.md
- docs/art/golden-core-domain-20261018/README.md
- docs/design/64-NORTH-LIBRARY-INTEGRATION.md
- docs/design/66-NORTH-MEDITATION-INTEGRATION.md
- docs/design/68-WEST-WORKSHOPS-INTEGRATION.md
- docs/design/65-COURTYARD-SEEKERS.md；2026-10-19 U-167/T-23：求见修复已合入主树88ee118a；run03工具冻结当前149运行文件（run02为131，新增18/变更14/删除0）并完成只读预检，尚未启动Electron。陆清和公开走近、当面答复/按意愿收录、真实床位承诺与入住、途中及最终两次原生关闭重开待实际桌面验收；不运行五门人循环。局部合入与预检不改变整项SR/AC。
- docs/design/65-COURTYARD-SEEKERS.md；2026-10-19 实际桌面run04：同档174422→176699，1次原生重开；陆清和outer收录、具体床号building:yunxiu:7/slot:bed:3，入住仍pending；家库14.4灵石/20木/4石/2草/20粮，自然来访3/6。run05已从run04原生保存准备续接，目标5门人/6居民并记录多人食粮/日结/实际床位，尚未启动。局部通过不改变整项SR/AC。
- docs/design/65-COURTYARD-SEEKERS.md；2026-10-19 run05卡顿后recovery-01实际native177171 SHA4c0f52e3…，与checkpoint一致但批报告failed；176960 SHA57187d2f…仍为唯一卡死前可恢复源，177153仅为最后观测。recovery-02从177171原字节准备，累计987.764004秒、剩余212.235996秒，等待单次许可；五门人/GC26/生产未完成。
- docs/design/65-COURTYARD-SEEKERS.md；2026-10-19 recovery-02实际从177171 native继续至177361，公开approach仍停路，旁步候选未被moveArt接受；native a117dcca…与checkpoint一致，累计1026.201004秒、剩余173.798996秒。recovery-03已准备从177361原字节继续，等待单次许可；五门人/GC26生产未完成。
- docs/design/65-COURTYARD-SEEKERS.md；2026-10-19 transferFood修复/recovery-06及recovery-07实机：运输visibleBody寻路与旧路径校验重算；transport351的food18属recovery-06最终源并在recovery-06完成，HOME 12→30，不是run07新增；recovery-07新增transport352 6粮@178180与transport353 8粮@178436，HOME30→44；并收录顾听澜iv73为第四名门人；累计1300.159004秒(本批113.253/300，余186.747秒)，native dcd9be70…。随后陆知微rest去building:yunxiu:1/slot:bed:1在178680(42.944230,12.790354)身体越界，停178693；五门人/GC26未完成。
- docs/design/65-COURTYARD-SEEKERS.md；2026-10-20收口：merchant-harvest-01 native tick189867 SHA e76e9dd8a5c9642e50fff100febadb04c49f2b0dbc11e87ad662cb9bff2218e6，HOME food16/carried0/source304/5门人；366采16@189831、367 delivered16@189858；完整41.400066s、later370.287718、sumMeasured2777.050227、currentChainLB2854.560517、floor2874.609517、7IDs；unknownTail/overallExact=null（前者为feed01尾段未知，不是无缺口）。73/75 pending；190800日结、床位入住与持续供粮未验，整项SR/AC不提升。
- docs/design/71-GUESTHOUSE-INTEGRATION.md
- tests/unit/courtyard/courtyard-guest-lodging.test.mjs
- tests/acceptance/courtyard-guesthouse-desktop.mjs
- docs/design/81-DISCIPLE-ONBOARDING.md
- 2026-10-25 新门人安置与首次贡献针对性验证：普通求见工厂生成同一身份，正式收录提交唯一门籍与具体待入住床，本人实际到床才登记入住，随后自主到生产工位贡献并取得对应技艺成长。缺床/缺粮拒绝不改世界，本人拒绝及重复收录保持边界。现有产品逻辑成立，本批增加可复用夹具和专项场景；完整SR/AC与发布状态保持。

- 2026-10-06：由v1.2设计缺口审计建立SR；新增内容和参数遵循作者默认，不冒充用户逐项确认。
- 2026-10-06：用户授权目标模式、多agent并行开发与验收；启动D01，按现有契约展开模块设计，未将建档或局部实现标作交付。
- 2026-10-09：2026-10-09 U-105 / R-32：当前需求更新为 1.1，山域设计关联 GROWTH-02、GROWTH-03、GROWTH-05。旧版 1.0 的标题、需求、AC原文/证据及D/I任务完成范围保存在 registry.json 的 version_history；本SR未重置任何已通过AC。 当前D01继续补实施参数，D02及本版本I01待前置完成；development_status保留既有运行实现基线。未改变的已通过AC只沿用原行为及原运行环境证据，新增地域、布局与迁移流程按GROWTH另验。本批未执行运行时验收，未修改正式运行版本或发布状态。
- 2026-10-18：2026-10-18 U-164/U-165局部：多Agent完成林长风门籍规则及同窗交互首轮，规则8/8、相关11/11，主Agent联合供粮/操作33/33；亲传Electron专项9项，范围限当时人物交互。用户明确扩大主殿山域、整体绘制采伐场、所有建筑完全预设并由人物实际到场修建；院前临时营造入口与独立素材已撤下。下一步先确认整体场景和稳定建位，再接施工与三人同源长验。二十分钟、当前桌面包、Windows及完整SR/AC尚未完成，整项状态保持。
- 2026-10-18：U-166/R-54将金丹篇建筑纳入同一预设山域规划：25项设施、31处编号位置，覆盖14类现行类型及专门工位。完成目录核对、编号图与整体场景概念；布局待评看，米制校准、施工接入和运行验收继续推进，本SR及AC状态保持。
- 2026-10-18：U-167 GC03同源公开筹料91743→117712→167589→168109完成，前两段失败及自然人物成长保持。macOS Electron run01勘察途中身体边缘检查失败，实际168489原生档封存，页面错误0；道路中心修复已合入、实机接续待验。GC25/26在隔离副本制作，完整SR/AC状态保持。
- 2026-10-18：U-167 GC03北台路心与静态地面查询修复合入，主树5项及原168489实际94步/4次存读通过。桌面原勘察1170在168583完成，施工14仅扣60灵石40木25石一次；实际168803封存后定位林长风自主回床路线检查失败。run02离开建位缺步及run03热字段遗漏为验收脚本问题，全部实际来源、进度及失败保留。完整经营与SR/AC继续验收。
- 2026-10-18：U-167 GC03原施工14已在同源桌面完成；四蒲团/两检修位、180步炼气6→7层、有限供灵与四次关闭重开通过。北路返床/绕人修复主树8项及实际27步回路成立。现场货位目的地过滤已补；当前170563检修运输347续接核对主殿门槛圈样本，维护全链未完成。丹房四阶段四工位16项为隔离候选证据。完整SR/AC状态保持。
- 2026-10-18：U-167 GC03一级同源macOS源码桌面链完成：最终171973，run07为10/10、错误0、209.943秒，七段实际逐项合计777.710秒。勘察/施工、180步6→7层、有限供灵、原运输347与348送2木1石、80步维护均成立，携货及活动中多次精确重开。Lu门槛为外部脚圈检查室内边界遗漏，已按正式预约/holder/floor纠正且保留离路反例。整体建筑与完整SR/AC继续。
- 2026-10-19：U-167 GC25/26一级道路、四阶段、真实工位与四段炼丹已合入23源码/测试和14图，主树30项及工程检查通过；有限供料负坐标整档完成施工到唯一两份成药，正常桌面生产另验。求见链真实续至174422，首位来客到时离开、第二位入院，未新增收录；绕柱导航已修，北坡迎面互等继续验证。完整SR/AC状态保持。
- 2026-10-20：2026-10-20 收口到merchant-harvest-01：五门人/食物同档链停止在paused；真实food16入库、source304；未知尾段与整体exact保持null；不把pending当入住、不把补种成功当供粮恢复。历史更正：recovery-04失败人为陆知微，transport351/18属recovery-06而非run07新增。
- 2026-10-23：2026-10-23 GC15一级客院已接入：两张独立客床、当面自愿邀请、实际步行入住、原来访期限退房下山及原生存读。macOS源码Electron有限夹具入住ui-fixture-03通过7项（1656→3851、235.557720083秒），施工build-fixture-01通过3项（646→1700、114.379689209秒）；唯一工单3投入45灵石/40木/20石，两趟实际送达后于1683完成200施工步。两段错误0，来源、运行文件与原生重开均一致。GPT-6.1-sol独立读回6个原生检查点及12个核心源码通过。正常世界仍保留医庐tick261253原档；该世界的筹资建设、Windows和完整SR/AC保持待验。 详见docs/design/71-GUESTHOUSE-INTEGRATION.md。

本文件由[registry.json](../registry.json)派生；更新台账后执行 `python scripts/requirements/sr-manager.py refresh`，不单独修改此派生页。
