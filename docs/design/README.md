# 设计入口 · DB-2026-10-05 v1.2

当前开发主线是纯 2D 高清像素桌面山院，Windows 为主力平台、macOS 用于前期验证。当前目录、命令与本批工程迁移见 [接手指南](../CODEX-HANDOFF.md) 和 [工程说明](../engineering/REPOSITORY.md)。产品规则、实现状态与验收证据分别管理。

## 先读什么

1. [AGENTS](../../AGENTS.md) 和 [接手指南](../CODEX-HANDOFF.md)，保留当前未提交成果，核对工作区事实。
2. [统一基准](00-BASELINE.md)、[决策登记](DECISIONS.md)、[当前状态](STATUS.md)。历史规格中的批次说明按决策覆盖关系理解，最新用户指令优先。
3. [运行时契约](05-RUNTIME-CONTRACTS.md)、[开局验收](06-OPENING-ACCEPTANCE.md)、[前期详细设计](14-EARLY-GAME-DETAILED-DESIGN.md)，再读本次分系统及依赖。
4. [需求入口](../requirements/README.md)、[总表](../requirements/BACKLOG.md)、[台账](../requirements/registry.json) 和对应 SR 页面。

当前美术按 U-133/U-135、U-144 与 U-150 的批准依据接续；后台运行按 U-139。工程整理按 U-152，保持游戏逻辑和存档兼容。U 表示用户确认，R/T 表示作者建议或可调参数。U-93 暂停的主动远期问答继续保持，未定神道事项不阻塞前期。

## 当前桌面与经营

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
