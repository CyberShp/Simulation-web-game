# 设计入口 · DB-2026-10-05 v1.2

这套文档用于后续所有会话和模型接续同一项目。它把已确认方向、推荐方案、数据边界、验收和实现状态分开，不依赖模型记得聊天记录。

## 首次接管的读取顺序

1. 仓库根目录 [AGENTS.md](../../AGENTS.md)。
2. [00-BASELINE.md](00-BASELINE.md)：产品定位与跨系统约束。
3. [DECISIONS.md](DECISIONS.md)：哪些用户已确定，哪些只是建议，哪些可调或后置。
4. [STATUS.md](STATUS.md)：当前实际上有哪些、哪些尚未实现。
   世界观问答按U-93阶段收束；接续读取[14前期详细设计](14-EARLY-GAME-DETAILED-DESIGN.md)，确认来源查[13](13-WORLDVIEW-DISCUSSION.md)。远期未定项不阻塞前期。
5. [05-RUNTIME-CONTRACTS.md](05-RUNTIME-CONTRACTS.md)：ID、时钟、命令、事务和存档。
6. 本次任务涉及的分系统规格，并跟随其中的依赖链接。
7. [06-OPENING-ACCEPTANCE.md](06-OPENING-ACCEPTANCE.md)：该改动必须满足的可玩验收。

不要只读取一个模块后推翻其他模块的假设。UI、美术、模拟、战斗、世界与存档必须遵守同一实体与规则。

## SR需求管理

以[需求入口](../requirements/README.md)、[需求总表](../requirements/BACKLOG.md)和[权威台账](../requirements/registry.json)管理待补设计与开发。每项SR的D任务补设计，I任务实现，V任务验收，R任务交接；40项需求状态独立，前期不依赖远期/条件项。接续先读I1“完整小院”及本SR来源规格，不能只按旧批次继续加局部修复。

## 文件索引

| 文档 | 主要问题 |
| --- | --- |
| [统一基准](00-BASELINE.md) | 我们究竟要做哪种游戏？哪些体验不能失去？ |
| [人物与关系](01-CHARACTERS.md) | 人是谁、为何行动、怎样成长、怎样相处？ |
| [装备与武学](02-EQUIPMENT-ARTS.md) | 物品属于谁、怎样获得、学什么、搭配怎样改变玩法？ |
| [空间与美术](03-SPATIAL-ART.md) | 真实营造、人物占位、室内与遮挡如何共同成立？ |
| [世界与剧情](04-WORLD-STORY.md) | 世界怎样开放、事件怎样演变、复仇怎样收束？ |
| [运行时契约](05-RUNTIME-CONTRACTS.md) | 状态、命令、时间、结果、迁移由谁负责？ |
| [开局与验收](06-OPENING-ACCEPTANCE.md) | 正常玩家怎样体验，何时才能称为完成？ |
| [经济与组织](07-ECONOMY-ORGANIZATION.md) | 生产、后勤、预算、任职、立派和分峰怎样运转？ |
| [活世界](08-LIVING-WORLD.md) | 人物日程、天气生态、道路供给与势力利益如何联动？ |
| [谋略与机缘](09-INTRIGUE-OPPORTUNITIES.md) | 道途和行为如何分开，真假消息、稀世暗线与破局怎样设计？ |
| [危机、救援与死亡](10-CRISES-RESCUE-DEATH.md) | 怎样发现定位、及时到场、自救救人或部署陷阱，死亡留下什么？ |
| [AI与内容边界](11-AI-CONTENT-CONTRACT.md) | 默认无AI怎样完整运行，可选AI能表达什么、不能改变什么？ |
| [内容创作规范](12-CONTENT-AUTHORING.md) | 每条重要内容怎样提交真相卡、线索图、时间预算和持续后果？ |
| [世界观问答记录](13-WORLDVIEW-DISCUSSION.md) | 多方势力与修行规则的确认来源、撤回方案及暂存远期问题 |
| [前期详细设计](14-EARLY-GAME-DETAILED-DESIGN.md) | 前期范围、地方内容、固定责任链、成长与迁移怎样具体落实？ |
| [第四批实施](18-SPATIAL-CONTINUITY-IMPLEMENTATION.md) | 营造场景联动修正、完工占位安全与当前真实差距 |
| [第三批实施](17-INDOOR-LIFE-IMPLEMENTATION.md) | 主屋床位、门道、屋顶与旧预约迁移，以及尚未完成的空间目标 |
| [第二批实施](16-WORKSTATIONS-ARTISAN-IMPLEMENTATION.md) | 独立工位、共享批次、伤匠照料与当前未覆盖范围 |
| [决策登记](DECISIONS.md) | 重要决定的状态和修改影响 |
| [实现状态](STATUS.md) | 目标与现状的差距、接续工作的起点 |
| [参考依据](REFERENCES.md) | 竞品事实、适配建议和不能照搬的部分 |
| [机器可读索引](manifest.json) | 当前设计版本、文件、强约束与任务读取范围 |

## 通用接管提示词

v1.1新增的世界任务需联合读取08–12与05：NPC永久死亡覆盖v1.0的NPC死亡后置建议；约40%统计重要独立根链中的实质算计，不是谎言或死亡骰子；稀世暗线也可以是可信传承。AI推荐可选、默认关闭，世界规则与生死不依赖API。读单一暗线模板不能忽略人物自主、空间位置、时间预算和可知信息。

下面这段可用于任何模型、任何新会话。仓库支持读取AGENTS.md的工具会自动获得入口；其他工具需显式附上本提示词。任何文件都不能保证未获得仓库内容的模型自动知晓设计。

> 接续 CyberShp/Simulation-web-game。先读取仓库AGENTS.md，再读取docs/design/README.md、00-BASELINE.md、DECISIONS.md、STATUS.md、05-RUNTIME-CONTRACTS.md，以及任务相关规格和06-OPENING-ACCEPTANCE.md。当前设计为DB-2026-10-05 v1.2；先读14收束前期，不继续主动追问远期世界观。先核对实际代码和交付状态，不把规格、旧截图或通过数量当成已实现。保留仅直接控制掌门、NPC自主、复仇篇章收束、统一场景实体、稳定身份、单一时钟和旧档保护。遵守user-confirmed与recommended的区分。执行时更新实际状态与证据；若新用户指令改变设计，同步决策及所有受影响文档，不能只在聊天里改变。

## 本地开发增量

用户已要求开始开发。最新实现与未覆盖范围见[18](18-SPATIAL-CONTINUITY-IMPLEMENTATION.md)，第三批见[17](17-INDOOR-LIFE-IMPLEMENTATION.md)，第二批见[16](16-WORKSTATIONS-ARTISAN-IMPLEMENTATION.md)，首批历史见[15-OPENING-IMPLEMENTATION.md](15-OPENING-IMPLEMENTATION.md)；本地EA 1.5.0-dev使用schema 6，正式Pages已发布EA 1.5.0-dev，当前发布证据见STATUS首段。接续先核对STATUS，不能把首批开局当成完整v1.2验收。

## 变更与交接方法

- 新功能应能对应一条规则和一个验收ID；找不到对应时先补规格，不能凭模块作者偏好扩范围。
- 设计变更先写原因、受影响的实体/命令/UI/存档/验收，再更新分系统文件。
- 同步DECISIONS、manifest版本与STATUS，不能让不同文件各自宣布最新版。
- 用户已经授权的正常实现按规格推进，不因为文档有“建议”字样反复索要确认；未解决的真正阻塞选择只提出具体差异。
- 运行代码完成后再填写implemented；有对应证据后再填写verified。
- 修正状态时保留历史发布与验收事实，明确其适用版本和局限。
- 本套文档在源码仓库中管理；GitHub Pages运行时发布独立，不因更新设计文档自动部署游戏。
