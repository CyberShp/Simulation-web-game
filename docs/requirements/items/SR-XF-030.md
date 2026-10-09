# SR-XF-030 · 旧布局、装备、成长与篇章的完整迁移

来源：DB-2026-10-05 v1.2；需求版本：1.1；建档日期：2026-10-06。

| 字段 | 值 |
| --- | --- |
| 范围 / 模块 | 前期必需 / 兼容 |
| 优先级 / 计划 | P0 / I1 |
| 设计 / 开发 | draft / in_progress |
| 验收 / 发布 | in_progress / not_released_for_this_sr |
| 责任人 / 复核人 | Codex/contracts_save / Codex/root（集成） |

## 来源、依赖与范围

纳入云岫前期，按依赖推进。

决策来源：U-63, U-93, R-25, U-94, U-100, R-29, R-30, U-105, R-32。这是继承的U项和作者实施默认；具体新增名称/数值不得伪装成用户逐项批准。

规格：[02-EQUIPMENT-ARTS.md](../../../docs/design/02-EQUIPMENT-ARTS.md)、[03-SPATIAL-ART.md](../../../docs/design/03-SPATIAL-ART.md)、[05-RUNTIME-CONTRACTS.md](../../../docs/design/05-RUNTIME-CONTRACTS.md)、[10-CRISES-RESCUE-DEATH.md](../../../docs/design/10-CRISES-RESCUE-DEATH.md)、[14-EARLY-GAME-DETAILED-DESIGN.md](../../../docs/design/14-EARLY-GAME-DETAILED-DESIGN.md)、[06-OPENING-ACCEPTANCE.md](../../../docs/design/06-OPENING-ACCEPTANCE.md)、[SECT-GROWTH-PLAN.md](../../../docs/SECT-GROWTH-PLAN.md)。

依赖：[SR-XF-002](SR-XF-002.md)。

关联既有验收：EARLY-05, PERSIST-01, PERSIST-02, SAVE-01, GROWTH-08, GROWTH-09, GROWTH-11；本SR的AC细化这些目标，不代表旧版本已经通过。

## 现状与设计缺口

既有 JS 运行基线：已有v5至schema6迁移。本批新增adult-furniture-1：原布局先校验，在副本中映射家具工位、必要脚点和失效返院缓存，保留身份、资源、时间、RNG、已付投入及活动进度；山外实际位置和旅程事实保留。 U-105 山域成长方案见 docs/SECT-GROWTH-PLAN.md；本批只登记设计与阶段原型，正式运行版本保持。

既有版本、成人家具与存储恢复证据保留；U-105 需新增旧自由布局/96米场景到地域/建位布局的确定映射、兼容待安置、施工/迁居/接替在途状态及失败保护矩阵。

现状是适用旧能力的基线，不表示该SR完整目标已通过。

## 必须补齐的设计交付物

1. 旧实体/坐标/工位到地域ID、建位ID和布局版本的确定映射；设施/工位身份与接替关系保留表。
2. 有来源旧自由布局、96米山院、施工、运输、疗养、生产接替和既有篇章的兼容样本矩阵。
3. 无法匹配建位、未知版本、重复迁移及保存失败的兼容/待安置/拒载恢复规则；保留原服务和一次性账本。

## 需求行为

SR-XF-030-REQ-01：原档备份保留并在隔离副本校验/映射；人物、建筑/工位身份、位置库存、工时、已用材料、时间、RNG与结局守恒，失败停止写入。

SR-XF-030-REQ-02：旧自由布局和96米山院先保留可恢复映射；不能凭人口重摆建筑，无法安全适配时进入明确兼容/待安置状态或拒载保原档，安全转换前保留原服务。

SR-XF-030-REQ-03：施工、迁居、运输及生产接替存读后延续同一事实；不追算离线损失，不重复补偿/奖励，不向旧完成档追加未清算目标。


## 验收标准

| ID | 情景 / 操作 | 必须看到的结果 | 状态 |
| --- | --- | --- | --- |
| SR-XF-030-AC-01 | 有来源旧自由布局/96米山院及多篇章阶段档迁入地域/建位布局 | 人物、建筑/工位ID、资源、货物位置、工时、时间、RNG、来源与结局守恒；迁居和接替状态可继续，人口不触发自动重摆。 | not_run |
| SR-XF-030-AC-02 | 旧设施无可用预设建位或存在未知地域/布局/工位引用 | 进入可查的兼容/待安置状态或拒绝加载并保留原文；安全转换前保留必要服务，有确定恢复路径，不能丢设施或资产。 | not_run |
| SR-XF-030-AC-03 | 重复迁移与保存失败后恢复 | 补偿/奖励/死亡只一次，旧knowledge不双倍变满理解与熟练。 | passed |

SR-XF-030-AC-03证据：qa/ea-sr-contracts-acceptance.mjs；docs/requirements/IMPLEMENTATION-2026-10-06.md；qa/ea-indoor-furniture-acceptance.mjs

2026-10-07本地小院批次：成人家具/单位格/空间定向检查48/48（8/6/34），正常公开命令接受/拒绝邀请两路完成营造、产出搬运、研习、到床休息与迁建取消/续建；分别60命令/36次精确存读和61命令/37次精确存读。六身份卧姿与预约前提2/2，生产Canvas卧姿加载/只读/身体点选/缺图回退4/4，已读图。旧v5完成档40建筑30门人保留资源、时间和return结局，全部入口可达，二次存读一致。各SR仅登记适用子情景；完整AC、真机触摸/FPS和真人首次体验状态分别保留。 浏览器DPR1鼠标在1366×900、1180×820、820×1180点选床上掌门通过；正常推荐营造经Enter和鼠标确认、实际施工落成。一次动态模块加载失败经页面重载恢复同档，原因待定位。I/V证据为沿既有可用契约实施的本批子范围；完整D01/D02及I/V关闭门槛保持原状态。

2026-10-07 M0/M1 接续批：旅行连续性脚本原引用不存在的 legacy-full.json；改用仓库内合法 qa/ea-reference-world.json（v5 完成档40建筑/30门人/return），复验7/7；仅证旧完成档升级及该条付费运输。独立浏览器验收档两座自由营造建成后重载保留设施数3、资源与暂停时间。未知引用、无法安置、写入失败总矩阵仍未做；AC02仍 not_run。

2026-10-07 M1 第四批：SR030-AC02 的两设施档由旧版公开营造，最近旧址阻塞入口时改选合法格并留迁移账，身份/资源/时间/RNG及源档原文保留。76 建筑三级设施档先设已立派，每一处均通过旧版 placementLock 且整档通过 Legacy.validateSave；新空间无法安置时实际档位拒载、禁写、原文导出并可选择有效备份恢复，故障字节留在保留区。当前版缺失人物位置引用同样实际拒载和恢复；未知建筑定义及未来版本不改原输入。专项 24/24，独立只读复核通过，AC02 按原文 Node 契约范围登记 passed。76 建筑档是合成的旧版合法结构压力样本，不是逐座公开建成的玩家历史档；持久层使用真实模块和内存存储，真实浏览器存储未验。历史 full fixture 缺失另记跳过；整项 SR030 D/I/V/R 仍未关闭。

2026-10-07 M1 第五批大档续存：同源公开操作首战档的普通 JSON 约 3.5 MB，实际浏览器原 2 MB 门槛阻止导入，扩容后导入成功但首次未压缩主档再保存触发浏览器配额失败且旧主档保留。当前对较大有效主档与滚动备份同步压缩存放，仍读取原普通 JSON，下载导出保持普通 JSON；8 MB 是未压缩输入上限，实际写入串也须在此范围。35/35 持久层测试包含 5 MB 模拟配额下旧大档连续保存与高熵压缩封装边界，旧集成 23/23。独立只读复核使用约3.60 MB真实结局状态及真实校验器，在5 MiB模拟配额连续保存4次、三份有效备份并精确读回。另在隔离的真实浏览器验收档位导入约3.5 MB首战档、刷新续玩并连续保存两次，主档约342 KB、三份备份约1.03 MB。浏览器加载偶发连接重置、设备配额与关闭时保存全矩阵、真机/触控仍待验；整项SR030 D/I/V/R保持原状态。

2026-10-08 M1 版本迁移窄项：prepareMigration 要求调用方提供返回已校验结构6状态的完整加载器，并在隔离初始化前后各校验一次。合法 v1–v4 生成器、真实 qa/prototype-worlds/legacy-v4.json 与 qa/ea-reference-world.json 的旧档均迁至 opening-runtime-2 + legacy-ea-1.4.2，原文保留、离线推进为0、存读稳定；已登记 opening/runtime 和 SR v6 来源仍可读。混搭主版本、未知内容或子版本、缺失 SR 核心模块拒载且不改输入。证据：qa/ea-sr-version-gate-acceptance.mjs 9/9、qa/ea-sr-contracts-acceptance.mjs 24/24，以及独立同源复验。浏览器存储、目标设备、旧可选模块来源全矩阵和完整 I/V/R 尚未由本窄项覆盖。

2026-10-08 M1 r28 持久层减顿窄项：仅已完整校验过且原始文本未变化的旧主档/备份，可在滚动备份和历史显示时复用校验结果，最多缓存6份；新状态、新封装和变更文本仍完整校验。持久层36/36；本地 Chromium 导入合法 v5 40建筑/30人档，自动保存得3份可用备份，刷新后同一世界续玩，控制台0错误。独立同一 Chromium DPR2 A/B 三轮自动存档旧150/193/373ms、新124/123/118ms，历史校验旧67/110/274ms、新57/43/54ms；有限样本，不代表持续帧率达标。Pages built，162文本 blob 与公网入口/持久层模块字节一致；200ms以上寻路长帧、目标设备和完整 SR030 验收仍待。

2026-10-09 U-105 / R-32：当前需求更新为 1.1，山域设计关联 GROWTH-08、GROWTH-09、GROWTH-11。旧版 1.0 的标题、需求、AC原文/证据及D/I任务完成范围保存在 registry.json 的 version_history；当前重新记 not_run：SR-XF-030-AC-01、SR-XF-030-AC-02。 当前D01继续补实施参数，D02及本版本I01待前置完成；development_status保留既有运行实现基线。未改变的已通过AC只沿用原行为及原运行环境证据，新增地域、布局与迁移流程按GROWTH另验。本批未执行运行时验收，未修改正式运行版本或发布状态。

## 开发任务

| 任务 | 工作 | 状态 | 前置 | 责任人 |
| --- | --- | --- | --- | --- |
| SR-XF-030-D01 | 设计补齐：当前版本设计补齐：补齐地域/建位布局的正式字段及旧档确定映射、在途恢复与兼容/拒载矩阵。 原版本已完成范围和证据保存在 version_history。 | in_progress | 无 | Codex/contracts_save |
| SR-XF-030-D02 | 契约与内容审阅：在当前版本D01完成后，审阅旧布局、装备、成长与篇章的完整迁移与依赖契约的字段、时序、失败及恢复；核对本SR的REQ/AC和GROWTH-08、GROWTH-09、GROWTH-11。旧版审阅完成事实保存在 version_history。 | todo | SR-XF-030-D01 | 待分配 |
| SR-XF-030-I01 | 开发与集成：按当前版本设计在相关模块集成旧布局、装备、成长与篇章的完整迁移，接入真实数据、行为、素材、界面和存读。既有实现保留为运行基线；本版本在D02完成后进入集成。 | todo | SR-XF-030-D02 | Codex/courtyard-integration |
| SR-XF-030-V01 | 验收与兼容：执行本SR的AC-01至AC-03及GROWTH-08、GROWTH-09、GROWTH-11；分别记录正常、失败、存读、网页视口和适用真机证据。 | todo | SR-XF-030-I01 | Codex/courtyard-acceptance |
| SR-XF-030-R01 | 发布与关闭：完成所需源码/运行时发布核对、交接和未覆盖说明；本轮用户不要求上传QA过程产物。 | todo | SR-XF-030-V01 | 待分配 |

SR-XF-030-D01证据：docs/SECT-GROWTH-PLAN.md

SR-XF-030-I01证据：dist/ea-sr-spatial.mjs；docs/design/STATUS.md；qa/ea-sr-contracts-acceptance.mjs

SR-XF-030-V01证据：qa/ea-indoor-furniture-acceptance.mjs；qa/ea-courtyard-life-acceptance.mjs；qa/ea-reference-world.json；docs/design/STATUS.md；qa/ea-sr-travel-continuity-acceptance.mjs；qa/ea-sr-contracts-acceptance.mjs

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

- docs/requirements/design/SR-XF-002-030.md
- docs/requirements/IMPLEMENTATION-2026-10-06.md
- dist/ea-sr-spatial.mjs
- qa/ea-indoor-furniture-acceptance.mjs
- qa/ea-courtyard-life-acceptance.mjs
- qa/ea-reference-world.json
- docs/design/STATUS.md
- docs/CODEX-HANDOFF.md
- qa/ea-sr-travel-continuity-acceptance.mjs
- qa/ea-sr-contracts-acceptance.mjs
- dist/ea-persistence.mjs
- dist/ea-save-codec.mjs
- dist/vendor/pako.mjs
- dist/vendor/PAKO-LICENSE
- tests/ea-persistence.test.mjs
- docs/SECT-GROWTH-PLAN.md；2026-10-09 山域总图、五阶段迁移及统一原型的设计来源；当前运行验收待补。

- 2026-10-06：由v1.2设计缺口审计建立SR；新增内容和参数遵循作者默认，不冒充用户逐项确认。
- 2026-10-06：用户授权目标模式、多agent并行开发与验收；启动D01，按现有契约展开模块设计，未将建档或局部实现标作交付。
- 2026-10-07：U-100固定2.5D、旧云岫人物/建筑资源接回正式U-99主线；R-29山院扩96米，旧64档先校验仅登记extentVersion。人物6/6、扩图9/9、单位格6/6与正常公开链局部通过，真实网页/发布另记STATUS；完整SR保持in_progress，不冒称全动画或全体验完成。
- 2026-10-07：成人家具与现场交互本地批次：已有v5至schema6迁移。本批新增adult-furniture-1：原布局先校验，在副本中映射家具工位、必要脚点和失效返院缓存，保留身份、资源、时间、RNG、已付投入及活动进度；山外实际位置和旅程事实保留。 已登记适用实现与独立复验证据，整体开发/验收保持in_progress，AC状态沿用已有范围。
- 2026-10-07：M0/M1 接续批完成局部设计、修复和独立复核；具体通过范围与缺口见 acceptance_notes 和 STATUS。整项 D/I/V/R 及 AC 状态保持原门槛。
- 2026-10-07：2026-10-07 M1 第四批：SR030-AC02 的两设施档由旧版公开营造，最近旧址阻塞入口时改选合法格并留迁移账，身份/资源/时间/RNG及源档原文保留。76 建筑三级设施档先设已立派，每一处均通过旧版 placementLock 且整档通过 Legacy.validateSave；新空间无法安置时实际档位拒载、禁写、原文导出并可选择有效备份恢复，故障字节留在保留区。当前版缺失人物位置引用同样实际拒载和恢复；未知建筑定义及未来版本不改原输入。专项 24/24，独立只读复核通过，AC02 按原文 Node 契约范围登记 passed。76 建筑档是合成的旧版合法结构压力样本，不是逐座公开建成的玩家历史档；持久层使用真实模块和内存存储，真实浏览器存储未验。历史 full fixture 缺失另记跳过；整项 SR030 D/I/V/R 仍未关闭。
- 2026-10-07：M1 第五批修复大档持续保存：有效本地快照和滚动备份压缩，普通导出及旧格式读取保留；模拟配额、真实浏览器续存与独立复核已登记，整项门槛继续。
- 2026-10-08：2026-10-08 M1 版本迁移窄项：prepareMigration 要求调用方提供返回已校验结构6状态的完整加载器，并在隔离初始化前后各校验一次。合法 v1–v4 生成器、真实 qa/prototype-worlds/legacy-v4.json 与 qa/ea-reference-world.json 的旧档均迁至 opening-runtime-2 + legacy-ea-1.4.2，原文保留、离线推进为0、存读稳定；已登记 opening/runtime 和 SR v6 来源仍可读。混搭主版本、未知内容或子版本、缺失 SR 核心模块拒载且不改输入。证据：qa/ea-sr-version-gate-acceptance.mjs 9/9、qa/ea-sr-contracts-acceptance.mjs 24/24，以及独立同源复验。浏览器存储、目标设备、旧可选模块来源全矩阵和完整 I/V/R 尚未由本窄项覆盖。
- 2026-10-09：2026-10-09 U-105 / R-32：当前需求更新为 1.1，山域设计关联 GROWTH-08、GROWTH-09、GROWTH-11。旧版 1.0 的标题、需求、AC原文/证据及D/I任务完成范围保存在 registry.json 的 version_history；当前重新记 not_run：SR-XF-030-AC-01、SR-XF-030-AC-02。 当前D01继续补实施参数，D02及本版本I01待前置完成；development_status保留既有运行实现基线。未改变的已通过AC只沿用原行为及原运行环境证据，新增地域、布局与迁移流程按GROWTH另验。本批未执行运行时验收，未修改正式运行版本或发布状态。

本文件由[registry.json](../registry.json)派生；更新台账后执行 `python qa/sr-manager.py refresh`，不单独修改此派生页。
