# 设计入口 · DB-2026-10-05 v1.2

- [96](96-NORTH-RECOVERY-PATH-RESPONSE.md) 2026-10-27 六小时目标执行中：北路施工运料旧档200步停滞定位为恢复许可漏接正式施工材料流；补齐身份/订单/预留/目标验证后11步实际恢复，最大单步0.3168米，取消实际返料及无效许可边界通过，定向相邻37/37。原生与三轮性能对照待做，完整SR/AC状态保持。

- [95 地面查询与院务响应](95-GROUND-PANEL-RESPONSE.md)：精确查询、面板投影复用、跨日刷新和剩余路径峰值。

- [94 结伴经营原生响应](94-EXPEDITION-RESPONSE.md)：工位寻路热点、几何等价、同档原生测量和保存读回。

- [93 五人结伴与留守经营](93-COMPANION-OPERATIONS.md)：身体通行、有限供给、满库恢复及原生界面响应。

- [92 门人结伴历练与遇险协作](92-EXPEDITION-COMPANIONS.md)：自愿结伴、近处提醒、有限等候、逐人归院恢复和实际生产。

- [91 历练材料与门人成长接续](91-EXPEDITION-GROWTH.md)：筹备一炉、实际交库、同门自主筑基与返工；针对性验收完成。

当前门人研习后的自主修炼批次见 [76 门人成长](76-DISCIPLE-CULTIVATION-PROGRESSION.md)。正常来源、旧课完成、修为增长和运输接缝证据在该记录维护。

当前留守供给与掌门外出批次见 [75 留守供给与掌门外出](75-SECT-SUSTENANCE.md)，U-170。正常来源与分层证据在该记录维护。

当前门人培养与宗门分工批次见 [74 门人培养与宗门分工](74-DISCIPLE-DEVELOPMENT.md)，U-169。正常来源与各层实际证据在该记录维护。

当前开发主线是纯 2D 高清像素桌面山院，Windows 为主力平台、macOS 用于前期验证。当前目录、命令与本批工程迁移见 [接手指南](../CODEX-HANDOFF.md) 和 [工程说明](../engineering/REPOSITORY.md)。产品规则、实现状态与验收证据分别管理。

## 先读什么

1. [AGENTS](../../AGENTS.md) 和 [接手指南](../CODEX-HANDOFF.md)，保留当前未提交成果，核对工作区事实。
2. [统一基准](00-BASELINE.md)、[决策登记](DECISIONS.md)、[当前状态](STATUS.md)。历史规格中的批次说明按决策覆盖关系理解，最新用户指令优先。
3. [运行时契约](05-RUNTIME-CONTRACTS.md)、[开局验收](06-OPENING-ACCEPTANCE.md)、[前期详细设计](14-EARLY-GAME-DETAILED-DESIGN.md)，再读本次分系统及依赖。
4. [需求入口](../requirements/README.md)、[总表](../requirements/BACKLOG.md)、[台账](../requirements/registry.json) 和对应 SR 页面。

当前美术按 U-133/U-135、U-144 与 U-150 的批准依据接续；后台运行按 U-139。工程整理按 U-152，保持游戏逻辑和存档兼容。U-156 删除旧网页场景并暂停发布，接续以 [退役记录](../engineering/WEB-RETIREMENT-20261017.md) 为准。U 表示用户确认，R/T 表示作者建议或可调参数。U-93 暂停的主动远期问答继续保持，未定神道事项不阻塞前期。

## 当前桌面与经营

[72 门人经营与山谷历练](72-DISCIPLE-EXPEDITIONS.md)：U-168当前阶段已完成，留守真实生产与裴照雪自发山谷往返、见险退避、6份药草交库及8点经验均有macOS桌面证据；三次原生重开、21项定向回归和独立复核通过。当前原生档tick263635，详细来源与失败接续见72。

[71 GC15客院](71-GUESTHOUSE-INTEGRATION.md)：一级两客床、自愿短住及到期离院已接入；macOS有限夹具施工与入住分别通过，正常世界继续使用医庐tick261253原档。

[62 医庐正常营建与诊疗](62-EAST-SERVICES-INTEGRATION.md#14-医庐正常营建与一次诊疗)：最新原生接续档为`/Users/shepard/.codex/tmp/immortal-clinic-20261023/supplies-clinic-02/world/sect-save.json`，tick261253；医患分别实际到位，80步消耗1草1洁水，程问舟伤势35→31，精确关闭重开。完整SR/AC保持。

[69 六居民生活与西谷生产](69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md)：2026-10-23 西谷炼药闭环已通过：原499药草、503木料与504清水实际交付，原505四个真实工位累计280步，唯一产出2份回春散；506实际取药至随身，507实际送入HOME，最终保存及关闭重开精确一致。当前接续源 `/Users/shepard/.codex/tmp/immortal-workshops-20261021/heal-11/world/sect-save.json`，tick237899，SHA `97f83e7c9efbafb396ffae9829e3e310aa2e8d5ea61d36a1262965dc8d88d837`；HOME回春散2，随身及丹房0。最终heal-11为237275→237899、174.153025秒，source/runtime保持，errors及finalizationErrors均0。四工位原生停点分别来自heal-08阶段0及heal-09阶段1–3；506携货中途存读窗口未捕获，实际唯一取药及最终回库不受影响。各停止与失败分支保留各自范围，不拼接成一次连续运行。慢读性能、Windows真机及完整40项SR/AC继续开放。

| 文档 | 主要用途 |
| --- | --- |
| [43 桌面演武](43-PIXEL-ARENA-SLICE.md) | 独立演武切片的规则与证据边界 |
| [44 近山行程](44-PIXEL-TRAIL-SLICE.md) | 同一行程中的移动、交战与返院 |
| [45 自主经营](45-SECT-IDLE-SLICE.md) | 玩家目标、预算、偏好及亲控交接 |
| [46 连续山域](46-CONTINUOUS-DOMAIN-FOUNDATION.md) | 同一空间、跨区道路、搬运与施工 |
| [48 世界修行库](48-GOLDEN-CORE-WORLD-ARTS-V02.md) | 720 项作者草案及运行接入边界 |
| [49 山院首批接入](49-P0-P2-COURTYARD-PROGRESS.md) | P0—P2 局部实现来源 |
| [50 界面审查](50-COURTYARD-UI-DESIGN-AUDIT.md) | 页面职责与交互问题来源 |
| [51 山院管理](51-COURTYARD-MANAGEMENT-INTEGRATION.md) | 管理、供给、成长、存档恢复的实际证据 |
| [52 东台扩建](52-EAST-TERRACE-INTEGRATION.md) | 批准母稿、道路、分趟运输、施工与往返 |
| [53 两人自主长验](53-COURTYARD-AUTONOMY-ACCEPTANCE.md) | 同源二十分钟长验、原脚本误报和粮食供给边界 |
| [54 桌面开局演示](54-COURTYARD-OPENING-DEMO.md) | 六幕连环画、包裹展开、落脚疗伤、遗卷选择、主殿营造与同档实机录像 |
| [55 人物动作库设计稿](55-CHARACTER-ACTION-LIBRARY.md) | 施术、阵法、蛊、符、傀儡、百兵攻防、神通与百艺；[首批七组关键姿势](../art/character-actions-20261017/README.md) |

[56 两人小院持续供粮](56-COURTYARD-FOOD-SUPPLY.md)：当前U-163主线批次，口粮目标、真实采粮搬运、有限来源补种与同档验证。

[57 三人山院与预设采伐场](57-THREE-RESIDENT-COURTYARD.md)：当前U-165接续，先确认主殿山域扩展与整体场景，再接预设营造、正式收录及三人经营。

[58 金丹篇全建筑与预设建位](58-GOLDEN-CORE-PRESET-BUILDINGS.md)：U-166将整体规划扩至金丹篇，R-54含25项设施、31处位置及百艺工位归属，U-167已批准分期开发；[整体场景与编号图](../art/golden-core-domain-20261018/README.md)为布局依据。

[59 西林采伐场接入](59-WEST-FOREST-INTEGRATION.md)：31号目录、负坐标山域与西桥，一级采伐场的实际营造、现场生产搬回及同源桌面存读验证。

[60 西谷石场、稻田与公库](60-WEST-VALLEY-INTEGRATION.md)：四处固定建位、有限石层、现场种粮、作物成长与独立仓储，当前开发和分层验证记录。

[61 东台住宅与真实入住](61-RESIDENTIAL-INTEGRATION.md)：GC09–12住宅、实体床位、入住与安置、正常筹资接缝；当前完成独立床位规则和新区域母稿，运行接入随西谷连续验收接续。

[62 东台膳房与医庐](62-EAST-SERVICES-INTEGRATION.md)：现场库存、有限洁水、炊事用膳与诊疗。

[63 正常成长接续](63-NORMAL-GROWTH-FACILITY-PATH.md)：成员、知识和突破等建筑开放依赖。

[64 主峰藏经阁](64-NORTH-LIBRARY-INTEGRATION.md)：北台道路、实体阅卷席、家传整理与正常桌面封存。

[65 山门求道者](65-COURTYARD-SEEKERS.md)：持久候选身份、沿路到访和当面收录。

[66 聚灵台](66-NORTH-MEDITATION-INTEGRATION.md)：固定台地、有限脉眼供能与现场检修。

[67 掌门突破](67-COURTYARD-BREAKTHROUGH.md)：实际练位、材料预约和调息炼化稳固。

[68 西谷丹房与百工坊](68-WEST-WORKSHOPS-INTEGRATION.md)：隔离制作的桥路、固定双院与现场工序。

[剩余建位接入队列](REMAINING-SITES-QUEUE.md)：未接入14处的逐处要素、依赖与建议批次（派生清单，不改变U-167批准布局）。
[GC21–23锚点与美术需求](GC21-23-ANCHOR-BRIEF.md)：三处规则已登记但锚点待新母稿／步行面扩展的实测证据与交付清单。


## 分系统与来源索引

| 文档 | 主要问题 |
| --- | --- |
| [统一基准](00-BASELINE.md) | 我们究竟要做哪种游戏？哪些体验不能失去？ |
| [宗门大山域试游](../MOUNTAIN-DOMAIN.md) | U-107的规划尺度、地形与游历范围、后续御物方向及DOMAIN验收是什么？ |
| [宗门山域成长章程](../SECT-GROWTH-PLAN.md) | 同一山域如何从开山小院成长为四峰仙宫，怎样建设、接替供给和迁居？ |
| [二维绘画小院](../PAINTED-COURTYARD.md) | U-104历史试游的素材、场景范围与直接验收步骤是什么？ |
| [历史美术试验](../ART-REALTIME-TRIAL.md) | U-103试验范围及局部证据怎样保留？ |
| [Godot 实施路线](../GODOT-MIGRATION.md) | 美术样板与规则迁移怎样分别接续和验收？ |
| [人物与关系](01-CHARACTERS.md) | 人是谁、为何行动、怎样成长、怎样相处？ |
| [人物立绘与统一交谈](42-CHARACTER-DIALOGUE.md) | 各类人物怎样共用立绘聊天窗，多重身份、距离、暂停和持久约定怎样成立？ |
| [装备与武学](02-EQUIPMENT-ARTS.md) | 物品属于谁、怎样获得、学什么、搭配怎样改变玩法？ |
| [空间与美术](03-SPATIAL-ART.md) | 真实营造、人物占位、室内与遮挡如何共同成立？ |
| [世界与剧情](04-WORLD-STORY.md) | 世界怎样开放、事件怎样演变、复仇怎样收束？ |
| [运行时契约](05-RUNTIME-CONTRACTS.md) | 状态、命令、时间、结果、迁移由谁负责？ |
| [开局与验收](06-OPENING-ACCEPTANCE.md) | 正常玩家怎样体验，何时才能称为完成？ |
| [云岫炼丹与山谷实玩](41-COURTYARD-VALLEY-IMPLEMENTATION.md) | U-123 局部玩法与 U-124 同一普通新档连续验收怎样接续？ |
| [经济与组织](07-ECONOMY-ORGANIZATION.md) | 生产、后勤、预算、任职、立派和分峰怎样运转？ |
| [活世界](08-LIVING-WORLD.md) | 人物日程、天气生态、道路供给与势力利益如何联动？ |
| [谋略与机缘](09-INTRIGUE-OPPORTUNITIES.md) | 道途和行为如何分开，真假消息、稀世暗线与破局怎样设计？ |
| [危机、救援与死亡](10-CRISES-RESCUE-DEATH.md) | 怎样发现定位、及时到场、自救救人或部署陷阱，死亡留下什么？ |
| [AI与内容边界](11-AI-CONTENT-CONTRACT.md) | 默认无AI怎样完整运行，可选AI能表达什么、不能改变什么？ |
| [内容创作规范](12-CONTENT-AUTHORING.md) | 每条重要内容怎样提交真相卡、线索图、时间预算和持续后果？ |
| [世界观问答记录](13-WORLDVIEW-DISCUSSION.md) | 多方势力与修行规则的确认来源、撤回方案及暂存远期问题 |
| [前期详细设计](14-EARLY-GAME-DETAILED-DESIGN.md) | 前期范围、地方内容、固定责任链、成长与迁移怎样具体落实？ |
| [五洲修行谱](19-FIVE-CONTINENT-ARTS.md) | 四千九百种的计数、类型与大道交融、云岫首批怎样衔接？ |
| [修行成长与斗法数值](20-ARTS-GROWTH-COMBAT.md) | 品质、六类修炼收益、物抗法抗、异常抗性和克制怎样计算？ |
| [逃亡包裹与五条传承](32-OPENING-INHERITANCE.md) | 首次疗伤怎样择法，五套攻守与未选原本怎样取得？ |
| [云岫首批逐项复评](33-ARTS-INITIAL-CALIBRATION.md) | Y-001–067 的品相、独立用途与失效条件怎样校准？ |
| [五洲修行谱扩写总账](28-FIVE-CONTINENT-ARTS-LEDGER.md) | 已写编号、类型和品相余额怎样计算？ |
| [扩写第五批](34-FIVE-CONTINENT-ARTS-EXPANSION-05.md) | Y-235–272 的五行与兵器交融有哪些？ |
| [扩写第六批](35-FIVE-CONTINENT-ARTS-EXPANSION-06.md) | Y-273–309 的魔、妖、毒与心灵交融有哪些？ |
| [扩写第七批](36-FIVE-CONTINENT-ARTS-EXPANSION-07.md) | Y-310–347 的兵家、阵法与古道痕有哪些？ |
| [第四批实施](18-SPATIAL-CONTINUITY-IMPLEMENTATION.md) | 营造场景联动修正、完工占位安全与当前真实差距 |
| [第三批实施](17-INDOOR-LIFE-IMPLEMENTATION.md) | 主屋床位、门道、屋顶与旧预约迁移，以及尚未完成的空间目标 |
| [第二批实施](16-WORKSTATIONS-ARTISAN-IMPLEMENTATION.md) | 独立工位、共享批次、伤匠照料与当前未覆盖范围 |
| [决策登记](DECISIONS.md) | 重要决定的状态和修改影响 |
| [实现状态](STATUS.md) | 目标与现状的差距、接续工作的起点 |
| [参考依据](REFERENCES.md) | 竞品事实、适配建议和不能照搬的部分 |
| [机器可读索引](manifest.json) | 当前设计版本、文件、强约束与任务读取范围 |

## 变更与交接

每批对应 SR/AC、规则条款、预计修改与实际验证。规则变更同步 DECISIONS、受影响规格、manifest 和 STATUS；运行实现、实际验证与发布分别记录。台账更新后运行 `python3 scripts/requirements/sr-manager.py refresh` 和 `validate`。

人物、UI、美术、模拟、战斗、世界和存档共用持久实体与规则。活世界任务联合读取 08–12 与 05：永久死亡、有限知情、时间预算、稀世暗线和默认关闭的可选 AI 继续遵守共同契约。

40 项 SR 继续按 U-94 及现有依赖推进。完成状态只由 [STATUS](STATUS.md) 与台账的实际证据确定。各批实施记录和 [历史入口快照](../history/README.md) 保留原始范围；纯设计或台账更新与游戏运行发布分别处理。

- [77 宗门供给与门人自主突破](77-DISCIPLE-BREAKTHROUGH-LOOP.md)：正常筹料、自主突破、通勤修复及分层验收。

- [79 门人专长与自主择业](79-DISCIPLE-WORK-SPECIALIZATION.md)：实际生产技艺参与自主接活，按U-172针对性场景验收。

- [80 历练归来与恢复经营](80-EXPEDITION-RECOVERY.md)：归院养伤、缺药调养、同伴自主生产及康复后回归日常。

- [81 新门人安置与首次贡献](81-DISCIPLE-ONBOARDING.md)：普通求见者正式入籍、实际入住与自主生产贡献的短场景。

- [82 门人历练目的与自主选择](82-EXPEDITION-PURPOSE.md)：采药补给、探索修行、本人风险见闻及实际结果来源。

- [83 历练感知与近身距离](83-ENCOUNTER-DISTANCE.md)：感知、接触伤害和应战入口的距离边界与真实撤退。

- [84 历练备药与归院经营](84-EXPEDITION-MEDICINE.md)：实际携药、退离服药、余药归库及恢复生产闭环。

- [85 回春散供给闭环](85-MEDICINE-SUPPLY.md)：库存目标、材料实运、自主炼制、归库与历练使用。

- [86 药物材料筹备与口粮保障](86-MEDICINE-MATERIALS.md)：自主种采取水、灵泉工序、真实运料与粮食优先。

- [87 药师实操成长与供给接续](87-PHARMACIST-DEVELOPMENT.md)：实际炼制成长、进阶丹方资格与伤停外出补位。

- [88 小宗门并行经营与供给压力](88-SECT-CONCURRENCY.md)：三/五门人同钟经营、真实粮药收支、归院返工及承诺到期接缝。

- [89 当面商议炼丹与成药交付](89-DISCIPLE-CRAFT-REQUEST.md)：完整人物窗、自愿接炉、实际费用、炼制进度与本人实运归库。
- [90 门人进阶需求与自主筑基](90-DISCIPLE-ADVANCEMENT.md)：同门商议炼丹、本人取丹、原阶段突破与恢复经营。
