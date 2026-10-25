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

决策来源：U-63, U-93, R-25, U-94, U-100, R-29, R-30, U-105, R-32, U-120, U-123, U-125, U-124, U-126, U-127, U-128, U-129, U-130, U-131, U-132, U-139, U-142, U-144, U-149, R-49, U-150, R-50, U-151, R-43, U-154, U-155, U-163, R-52, T-18, U-167, T-20, T-21, T-22, U-170。这是继承的U项和作者实施默认；具体新增名称/数值不得伪装成用户逐项批准。

规格：[02-EQUIPMENT-ARTS.md](../../../docs/design/02-EQUIPMENT-ARTS.md)、[03-SPATIAL-ART.md](../../../docs/design/03-SPATIAL-ART.md)、[05-RUNTIME-CONTRACTS.md](../../../docs/design/05-RUNTIME-CONTRACTS.md)、[10-CRISES-RESCUE-DEATH.md](../../../docs/design/10-CRISES-RESCUE-DEATH.md)、[14-EARLY-GAME-DETAILED-DESIGN.md](../../../docs/design/14-EARLY-GAME-DETAILED-DESIGN.md)、[06-OPENING-ACCEPTANCE.md](../../../docs/design/06-OPENING-ACCEPTANCE.md)、[SECT-GROWTH-PLAN.md](../../../docs/SECT-GROWTH-PLAN.md)、[41-COURTYARD-VALLEY-IMPLEMENTATION.md](../../../docs/design/41-COURTYARD-VALLEY-IMPLEMENTATION.md)、[42-CHARACTER-DIALOGUE.md](../../../docs/design/42-CHARACTER-DIALOGUE.md)、[51-COURTYARD-MANAGEMENT-INTEGRATION.md](../../../docs/design/51-COURTYARD-MANAGEMENT-INTEGRATION.md)、[46-CONTINUOUS-DOMAIN-FOUNDATION.md](../../../docs/design/46-CONTINUOUS-DOMAIN-FOUNDATION.md)、[52-EAST-TERRACE-INTEGRATION.md](../../../docs/design/52-EAST-TERRACE-INTEGRATION.md)、[45-SECT-IDLE-SLICE.md](../../../docs/design/45-SECT-IDLE-SLICE.md)、[53-COURTYARD-AUTONOMY-ACCEPTANCE.md](../../../docs/design/53-COURTYARD-AUTONOMY-ACCEPTANCE.md)、[56-COURTYARD-FOOD-SUPPLY.md](../../../docs/design/56-COURTYARD-FOOD-SUPPLY.md)、[59-WEST-FOREST-INTEGRATION.md](../../../docs/design/59-WEST-FOREST-INTEGRATION.md)、[60-WEST-VALLEY-INTEGRATION.md](../../../docs/design/60-WEST-VALLEY-INTEGRATION.md)、[61-RESIDENTIAL-INTEGRATION.md](../../../docs/design/61-RESIDENTIAL-INTEGRATION.md)、[62-EAST-SERVICES-INTEGRATION.md](../../../docs/design/62-EAST-SERVICES-INTEGRATION.md)、[64-NORTH-LIBRARY-INTEGRATION.md](../../../docs/design/64-NORTH-LIBRARY-INTEGRATION.md)、[69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md](../../../docs/design/69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md)、[70-COURTYARD-FIRST-COMBAT.md](../../../docs/design/70-COURTYARD-FIRST-COMBAT.md)、[71-GUESTHOUSE-INTEGRATION.md](../../../docs/design/71-GUESTHOUSE-INTEGRATION.md)、[75-SECT-SUSTENANCE.md](../../../docs/design/75-SECT-SUSTENANCE.md)、[76-DISCIPLE-CULTIVATION-PROGRESSION.md](../../../docs/design/76-DISCIPLE-CULTIVATION-PROGRESSION.md)、[77-DISCIPLE-BREAKTHROUGH-LOOP.md](../../../docs/design/77-DISCIPLE-BREAKTHROUGH-LOOP.md)、[78-APPROACH-RESPONSE.md](../../../docs/design/78-APPROACH-RESPONSE.md)。

依赖：[SR-XF-002](SR-XF-002.md)。

关联既有验收：EARLY-05, PERSIST-01, PERSIST-02, SAVE-01, GROWTH-08, GROWTH-09, GROWTH-11；本SR的AC细化这些目标，不代表旧版本已经通过。

## 现状与设计缺口

既有 JS 运行基线：已有v5至schema6迁移。本批新增adult-furniture-1：原布局先校验，在副本中映射家具工位、必要脚点和失效返院缓存，保留身份、资源、时间、RNG、已付投入及活动进度；山外实际位置和旅程事实保留。 U-105 山域成长方案见 docs/SECT-GROWTH-PLAN.md；本批只登记设计与阶段原型，正式运行版本保持。
2026-10-14 U-142：先审核完整山院美术原型，再按构图、细节、精度与材质还原实机。目标模式、场景接入及20分钟长验按用户要求暂停；本地增量保留。原型见 docs/art/pixel-courtyard-prototype-20261014/README.md；原型不计作运行验收，既有SR/AC状态保持。

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

SR-XF-030-AC-03证据：tests/acceptance/ea-sr-contracts-acceptance.mjs；docs/requirements/IMPLEMENTATION-2026-10-06.md；tests/acceptance/ea-indoor-furniture-acceptance.mjs

2026-10-07本地小院批次：成人家具/单位格/空间定向检查48/48（8/6/34），正常公开命令接受/拒绝邀请两路完成营造、产出搬运、研习、到床休息与迁建取消/续建；分别60命令/36次精确存读和61命令/37次精确存读。六身份卧姿与预约前提2/2，生产Canvas卧姿加载/只读/身体点选/缺图回退4/4，已读图。旧v5完成档40建筑30门人保留资源、时间和return结局，全部入口可达，二次存读一致。各SR仅登记适用子情景；完整AC、真机触摸/FPS和真人首次体验状态分别保留。 浏览器DPR1鼠标在1366×900、1180×820、820×1180点选床上掌门通过；正常推荐营造经Enter和鼠标确认、实际施工落成。一次动态模块加载失败经页面重载恢复同档，原因待定位。I/V证据为沿既有可用契约实施的本批子范围；完整D01/D02及I/V关闭门槛保持原状态。

2026-10-07 M0/M1 接续批：旅行连续性脚本原引用不存在的 legacy-full.json；改用仓库内合法 tests/fixtures/ea-reference-world.json（v5 完成档40建筑/30门人/return），复验7/7；仅证旧完成档升级及该条付费运输。独立浏览器验收档两座自由营造建成后重载保留设施数3、资源与暂停时间。未知引用、无法安置、写入失败总矩阵仍未做；AC02仍 not_run。

2026-10-07 M1 第四批：SR030-AC02 的两设施档由旧版公开营造，最近旧址阻塞入口时改选合法格并留迁移账，身份/资源/时间/RNG及源档原文保留。76 建筑三级设施档先设已立派，每一处均通过旧版 placementLock 且整档通过 Legacy.validateSave；新空间无法安置时实际档位拒载、禁写、原文导出并可选择有效备份恢复，故障字节留在保留区。当前版缺失人物位置引用同样实际拒载和恢复；未知建筑定义及未来版本不改原输入。专项 24/24，独立只读复核通过，AC02 按原文 Node 契约范围登记 passed。76 建筑档是合成的旧版合法结构压力样本，不是逐座公开建成的玩家历史档；持久层使用真实模块和内存存储，真实浏览器存储未验。历史 full fixture 缺失另记跳过；整项 SR030 D/I/V/R 仍未关闭。

2026-10-07 M1 第五批大档续存：同源公开操作首战档的普通 JSON 约 3.5 MB，实际浏览器原 2 MB 门槛阻止导入，扩容后导入成功但首次未压缩主档再保存触发浏览器配额失败且旧主档保留。当前对较大有效主档与滚动备份同步压缩存放，仍读取原普通 JSON，下载导出保持普通 JSON；8 MB 是未压缩输入上限，实际写入串也须在此范围。35/35 持久层测试包含 5 MB 模拟配额下旧大档连续保存与高熵压缩封装边界，旧集成 23/23。独立只读复核使用约3.60 MB真实结局状态及真实校验器，在5 MiB模拟配额连续保存4次、三份有效备份并精确读回。另在隔离的真实浏览器验收档位导入约3.5 MB首战档、刷新续玩并连续保存两次，主档约342 KB、三份备份约1.03 MB。浏览器加载偶发连接重置、设备配额与关闭时保存全矩阵、真机/触控仍待验；整项SR030 D/I/V/R保持原状态。

2026-10-08 M1 版本迁移窄项：prepareMigration 要求调用方提供返回已校验结构6状态的完整加载器，并在隔离初始化前后各校验一次。合法 v1–v4 生成器、真实 tests/fixtures/prototype-worlds/legacy-v4.json 与 tests/fixtures/ea-reference-world.json 的旧档均迁至 opening-runtime-2 + legacy-ea-1.4.2，原文保留、离线推进为0、存读稳定；已登记 opening/runtime 和 SR v6 来源仍可读。混搭主版本、未知内容或子版本、缺失 SR 核心模块拒载且不改输入。证据：tests/acceptance/ea-sr-version-gate-acceptance.mjs 9/9、tests/acceptance/ea-sr-contracts-acceptance.mjs 24/24，以及独立同源复验。浏览器存储、目标设备、旧可选模块来源全矩阵和完整 I/V/R 尚未由本窄项覆盖。

2026-10-08 M1 r28 持久层减顿窄项：仅已完整校验过且原始文本未变化的旧主档/备份，可在滚动备份和历史显示时复用校验结果，最多缓存6份；新状态、新封装和变更文本仍完整校验。持久层36/36；本地 Chromium 导入合法 v5 40建筑/30人档，自动保存得3份可用备份，刷新后同一世界续玩，控制台0错误。独立同一 Chromium DPR2 A/B 三轮自动存档旧150/193/373ms、新124/123/118ms，历史校验旧67/110/274ms、新57/43/54ms；有限样本，不代表持续帧率达标。Pages built，162文本 blob 与公网入口/持久层模块字节一致；200ms以上寻路长帧、目标设备和完整 SR030 验收仍待。

2026-10-09 U-105 / R-32：当前需求更新为 1.1，山域设计关联 GROWTH-08、GROWTH-09、GROWTH-11。旧版 1.0 的标题、需求、AC原文/证据及D/I任务完成范围保存在 registry.json 的 version_history；当前重新记 not_run：SR-XF-030-AC-01、SR-XF-030-AC-02。 当前D01继续补实施参数，D02及本版本I01待前置完成；development_status保留既有运行实现基线。未改变的已通过AC只沿用原行为及原运行环境证据，新增地域、布局与迁移流程按GROWTH另验。本批未执行运行时验收，未修改正式运行版本或发布状态。

2026-10-12 U-123：正式界面导档、第一炉随身1／公库1保存读取守恒，谷内存读保同一人物ID及scene:valley；旧布局和完整迁移 AC 状态保持。 局部证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。

2026-10-12 U-123 首战本地网页：最终本地网页活动战斗存读后worldTick5974、掌门血140／灵力80、敌血98及双方脚点一致；返院服药后再存读保home、wound0及剩余丹药1。完整旧档迁移 AC 状态保持。 证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。

2026-10-12 U-123 发布核验：运行源码 main 836ccb605a42e7c21c2aae8c5e2c4eee7e55c03e；gh-pages 4d6786da521f1ab92818c20f67c036a829469e6e；GitHub API Pages build=built。公开 mountain-courtyard 的14个交付文件（release/build/index、界面与加载模块、桥接及世界／战斗规则、三片场景包）HTTP 200，SHA与本地导出一致。公开浏览器百艺、导档、实际行走旅行与采集的操作证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；本记录仅是U-123局部发布证据，整项 D/I/V/R 与 AC 状态不变。
2026-10-12 Issue #5：最新main6000秒实验16笔生产/14笔微量灵石，修复显式receipt、9位新计算精度、工资封顶、事务提交与运输严格余额。专项12/12，正常公开开局2/2、丹炉公开链1/1；旧数量和事实逐字保留，不推进完整SR状态。见 docs/design/ISSUE-5-PRODUCTION-ACCOUNTING.md。

2026-10-18 U-164/U-165局部：多Agent完成林长风门籍规则及同窗交互首轮，规则8/8、相关11/11，主Agent联合供粮/操作33/33；亲传Electron专项9项，范围限当时人物交互。用户明确扩大主殿山域、整体绘制采伐场、所有建筑完全预设并由人物实际到场修建；院前临时营造入口与独立素材已撤下。下一步先确认整体场景和稳定建位，再接施工与三人同源长验。二十分钟、当前桌面包、Windows及完整SR/AC尚未完成，整项状态保持。

2026-10-18 U-167局部：批准25项设施/31预设建位布局并分期开发；31目录已接入，原殿/药圃/东台保留身份，西林一级完成真实西桥运料、到场施工、两工位产木与搬回公库，其余27处待接。默认170/170、相关31项及地面校准后6+10项复验通过。macOS源码Electron同一两人来源档10/10、100.894秒，投入25灵石20木8石，6木实际回库，三次存读精确，页面/运行错误0。证据docs/design/59-WEST-FOREST-INTEGRATION.md；升级画层、三人长验、Windows及当前包另验，整项D/I/V/R与AC状态保持。 2026-10-18 U-167西谷GC-17/18/19/24开发中：显式扩谷、固定施工、有限石源、现场种粮及独立分类公库已写入。同源30条公开命令连续营造四处并精确存读，证据/Volumes/Media/immortal-qa/west-valley-prepared-20261018-v2/。阶段美术及完整桌面验收继续；远路邀请已改为有限通勤、到岗后计劳动承诺，旧邀请期限保留，公库口粮纳入实际回运；整项SR/AC状态保持。

2026-10-23 桌面首战历史run-04保留活动战斗、撤退与受伤返院三处精确原生关闭重开证据（tick423→1005、13项、错误0）。当前已接入独立林间键鼠战斗；按用户本轮聚焦战斗，新控制下的原生存读、旧档入口及返院复验暂缓，不以历史run-04替代。生产／医庐heal-11来源保持独立，完整迁移与SR/AC状态保持。详见docs/design/70-COURTYARD-FIRST-COMBAT.md。

2026-10-25 宗门供给与门人自主突破本批完成：补齐既有炼丹院务奖励入口、修复突破通勤互等及让行工位接缝；正常桌面源280680经实际补种/两批采粮交库至282724，再自主修炼、唯一扣24灵石/8灵草，于284309完成180工步升至炼气二层。最终284504，五人供给正常、饥荒0；准备及核心共5组原生保存/关闭重开一致，公开人物窗只读正确，两个成功段errors均0。原走近超时场景现点击3.72秒通过15秒门限，仍有明显等待。空间相邻37/37、根奖励/突破/通勤16/16通过；旧requester-clear基线失败、Windows、长期平衡、完整SR/AC及发布状态保持。 详见 docs/design/77-DISCIPLE-BREAKTHROUGH-LOOP.md。

2026-10-25 人物走近已接入后台寻路，主线程保留正式身体校验与事务提交。macOS源码Electron两普通来源实际近身、途中及终点共4组原生保存/关闭重开通过，最终284802；首反馈约48–55ms。旧场景最长帧间隔206.5ms，最新经营档192.1ms，200ms响应目标尚未全部通过。根定向32/32；导航相邻9/10及命令相邻41/44的4项失败均在修前版本复现。原失败记录保留，完整流畅度、Windows、整项SR/AC及发布状态保持。 详见 docs/design/78-APPROACH-RESPONSE.md。

## 开发任务

| 任务 | 工作 | 状态 | 前置 | 责任人 |
| --- | --- | --- | --- | --- |
| SR-XF-030-D01 | 设计补齐：当前版本设计补齐：补齐地域/建位布局的正式字段及旧档确定映射、在途恢复与兼容/拒载矩阵。 原版本已完成范围和证据保存在 version_history。 | in_progress | 无 | Codex/contracts_save |
| SR-XF-030-D02 | 契约与内容审阅：在当前版本D01完成后，审阅旧布局、装备、成长与篇章的完整迁移与依赖契约的字段、时序、失败及恢复；核对本SR的REQ/AC和GROWTH-08、GROWTH-09、GROWTH-11。旧版审阅完成事实保存在 version_history。 | todo | SR-XF-030-D01 | 待分配 |
| SR-XF-030-I01 | 开发与集成：按当前版本设计在相关模块集成旧布局、装备、成长与篇章的完整迁移，接入真实数据、行为、素材、界面和存读。既有实现保留为运行基线；本版本在D02完成后进入集成。 | todo | SR-XF-030-D02 | Codex/courtyard-integration |
| SR-XF-030-V01 | 验收与兼容：执行本SR的AC-01至AC-03及GROWTH-08、GROWTH-09、GROWTH-11；分别记录正常、失败、存读、网页视口和适用真机证据。 | todo | SR-XF-030-I01 | Codex/courtyard-acceptance |
| SR-XF-030-R01 | 发布与关闭：完成所需源码/运行时发布核对、交接和未覆盖说明；本轮用户不要求上传QA过程产物。 | todo | SR-XF-030-V01 | 待分配 |

SR-XF-030-D01证据：docs/SECT-GROWTH-PLAN.md

SR-XF-030-I01证据：src/simulation/ea-sr-spatial.mjs；docs/design/STATUS.md；tests/acceptance/ea-sr-contracts-acceptance.mjs；docs/design/49-P0-P2-COURTYARD-PROGRESS.md；2026-10-15 U-147/R-47：院务/人物/工位/物资/研习操作、保存失败保护和疗伤收据重放；47/47 Node检查。浏览器内核缺失且官方下载失败，实际UI与桌面未验，完整P0—P2及SR/AC状态保持。；docs/design/59-WEST-FOREST-INTEGRATION.md；tests/acceptance/courtyard-west-desktop.mjs；2026-10-18 U-167西谷GC-17/18/19/24开发中：显式扩谷、固定施工、有限石源、现场种粮及独立分类公库已写入。同源30条公开命令连续营造四处并精确存读，证据/Volumes/Media/immortal-qa/west-valley-prepared-20261018-v2/。阶段美术及完整桌面验收继续；远路邀请已改为有限通勤、到岗后计劳动承诺，旧邀请期限保留，公库口粮纳入实际回运；整项SR/AC状态保持。；2026-10-18 U-167/T-20住宅接续：GC09–12沿固定建位建设，四院一级16实体床；独立床位模块10/10规则检查，含只读旧档、唯一床位、真实到床、途中存读与失效恢复。三院完工及空地母稿已制作，世界位置与升级占地待校准。正式运行接缝、近身有限交易筹资和同源桌面营建入住尚待完成；本条只登记住宅局部准备，不推进完整SR/AC状态。；2026-10-18 U-167/T-19西谷一级批：同一未改正常来源macOS源码Electron连续31/31，墙钟1219.061秒、tick646→10944、7次精确关闭重开、错误0。四址实际运料施工，有限采石18.4及两田实际收获后35.2593256粮搬入新公库，两田各留2种粮。根独立读回来源SHA/最终状态/截图，源码与素材hash随run03封存；完整SR/AC、升级损坏图、供水保鲜、Windows和安装包仍按原范围接续。详见docs/design/60-WEST-VALLEY-INTEGRATION.md。；2026-10-18 U-167/T-20住宅筹资接缝：掌门从公库实际取货到随身，统一人物窗近身买卖、有限库存/本金及实际回款。专项5/5含重试一次结算；macOS源码Electron独立来源连续11/11、两次精确重开、错误0。20石换18灵石，买10粮花10，余8灵石实际入HOME。见61§10；该轨道不代替住宅营建或完整SR/AC验收。；2026-10-18 T-20 housing runtime: 27 scoped checks and 8 related opening/care regressions passed. Existing-hall source Electron UI: select bed, real arrival, shared person/building display, exact reopen: 6/6, errors 0. See docs/design/61-RESIDENTIAL-INTEGRATION.md section 11. Four-house normal construction and full SR/AC acceptance remain in progress.

SR-XF-030-V01证据：tests/acceptance/ea-indoor-furniture-acceptance.mjs；tests/acceptance/ea-courtyard-life-acceptance.mjs；tests/fixtures/ea-reference-world.json；docs/design/STATUS.md；tests/acceptance/ea-sr-travel-continuity-acceptance.mjs；tests/acceptance/ea-sr-contracts-acceptance.mjs；docs/design/49-P0-P2-COURTYARD-PROGRESS.md；2026-10-15 U-147/R-47：院务/人物/工位/物资/研习操作、保存失败保护和疗伤收据重放；47/47 Node检查。浏览器内核缺失且官方下载失败，实际UI与桌面未验，完整P0—P2及SR/AC状态保持。；docs/design/59-WEST-FOREST-INTEGRATION.md；tests/acceptance/courtyard-west-desktop.mjs；2026-10-18 U-167西谷GC-17/18/19/24开发中：显式扩谷、固定施工、有限石源、现场种粮及独立分类公库已写入。同源30条公开命令连续营造四处并精确存读，证据/Volumes/Media/immortal-qa/west-valley-prepared-20261018-v2/。阶段美术及完整桌面验收继续；远路邀请已改为有限通勤、到岗后计劳动承诺，旧邀请期限保留，公库口粮纳入实际回运；整项SR/AC状态保持。；2026-10-18 U-167/T-20住宅接续：GC09–12沿固定建位建设，四院一级16实体床；独立床位模块10/10规则检查，含只读旧档、唯一床位、真实到床、途中存读与失效恢复。三院完工及空地母稿已制作，世界位置与升级占地待校准。正式运行接缝、近身有限交易筹资和同源桌面营建入住尚待完成；本条只登记住宅局部准备，不推进完整SR/AC状态。；2026-10-18 U-167/T-19西谷一级批：同一未改正常来源macOS源码Electron连续31/31，墙钟1219.061秒、tick646→10944、7次精确关闭重开、错误0。四址实际运料施工，有限采石18.4及两田实际收获后35.2593256粮搬入新公库，两田各留2种粮。根独立读回来源SHA/最终状态/截图，源码与素材hash随run03封存；完整SR/AC、升级损坏图、供水保鲜、Windows和安装包仍按原范围接续。详见docs/design/60-WEST-VALLEY-INTEGRATION.md。；2026-10-18 U-167/T-20住宅筹资接缝：掌门从公库实际取货到随身，统一人物窗近身买卖、有限库存/本金及实际回款。专项5/5含重试一次结算；macOS源码Electron独立来源连续11/11、两次精确重开、错误0。20石换18灵石，买10粮花10，余8灵石实际入HOME。见61§10；该轨道不代替住宅营建或完整SR/AC验收。；2026-10-18 T-20 housing runtime: 27 scoped checks and 8 related opening/care regressions passed. Existing-hall source Electron UI: select bed, real arrival, shared person/building display, exact reopen: 6/6, errors 0. See docs/design/61-RESIDENTIAL-INTEGRATION.md section 11. Four-house normal construction and full SR/AC acceptance remain in progress.

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
- src/simulation/ea-sr-spatial.mjs
- tests/acceptance/ea-indoor-furniture-acceptance.mjs
- tests/acceptance/ea-courtyard-life-acceptance.mjs
- tests/fixtures/ea-reference-world.json
- docs/design/STATUS.md
- docs/CODEX-HANDOFF.md
- tests/acceptance/ea-sr-travel-continuity-acceptance.mjs
- tests/acceptance/ea-sr-contracts-acceptance.mjs
- src/simulation/ea-persistence.mjs
- src/simulation/ea-save-codec.mjs
- src/simulation/vendor/pako.mjs
- src/simulation/vendor/PAKO-LICENSE
- tests/unit/web/ea-persistence.test.mjs
- docs/SECT-GROWTH-PLAN.md；2026-10-09 山域总图、五阶段迁移及统一原型的设计来源；当前运行验收待补。
- docs/art/system-ui-20261012/RUNTIME.md
- tests/unit/web/ea-system-ui-projection.test.mjs
- 2026-10-12 U-120：只读人物／库存投影沿同一存档，Node 验证装备预约／完成、邀约与搬运对应存读；本地浏览器保存刷新保留实际武器槽与库存，并经导入界面载入正式命令生成的药圃 QA 档。本批为当前流程存读与导入的局部证据，完整旧布局／装备／成长／篇章迁移 AC 状态保持。
- docs/art/COURTYARD-VALLEY-2026-10-12.md
- tests/unit/web/ea-mountain-alchemy.test.mjs
- tests/unit/web/ea-mountain-valley.test.mjs
- tests/unit/web/ea-godot-valley-projection.test.mjs
- 2026-10-12 U-123 发布核验：运行源码 main 836ccb605a42e7c21c2aae8c5e2c4eee7e55c03e；gh-pages 4d6786da521f1ab92818c20f67c036a829469e6e；GitHub API Pages build=built。公开 mountain-courtyard 的14个交付文件（release/build/index、界面与加载模块、桥接及世界／战斗规则、三片场景包）HTTP 200，SHA与本地导出一致。公开浏览器百艺、导档、实际行走旅行与采集的操作证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；本记录仅是U-123局部发布证据，整项 D/I/V/R 与 AC 状态不变。
- 2026-10-12 U-125：42 人物交谈及关联契约定义统一立绘聊天窗、身份叠加、知情、距离、意愿、暂停和持久规则；DIALOGUE-01–10 为 not_run。本批为设计与静态原型，运行接入及完整 SR/AC 状态保持。
- tests/acceptance/ea-sr-production-accounting-acceptance.mjs
- docs/design/ISSUE-5-PRODUCTION-ACCOUNTING.md
- docs/design/ISSUE-6-HISTORY-RETENTION.md
- tests/unit/web/ea-history-retention.test.mjs
- tests/acceptance/ea-history-benchmark.mjs
- tests/acceptance/ea-history-compare.mjs
- docs/art/OPENING-CHAIN-2026-10-12.md；2026-10-12 U-124：施工卡点、药成、战斗收势与返院伤愈存读，最终完整导出深度相等；未覆盖全部旧版迁移。 仅增局部证据，完整 SR/AC 状态保持。
- docs/art/OPENING-GUIDANCE-2026-10-13.md；2026-10-13 U-124：携药后世界步3729保存刷新完整导出相等；四份原实玩存档只读投影与存读通过。 仅增局部证据，完整 SR/AC 状态保持。
- docs/art/mountain-flat-20261013/RUNTIME.md；2026-10-13 U-126：平涂场景、建筑作物阶段及人物接入同一模拟，局部 Godot 与实际网页验证；完整 SR/AC、目标真机与用户美术评看状态保持。
- docs/art/desktop-style-review-20261013/README.md；2026-10-13 U-127/U-128：五种画风、战场总览及交战近景共七张静态原型待用户审核；桌面交付方向为Windows主力、macOS先验证。仅设计与原型证据，桌面迁移及新战斗未实施。
- 2026-10-13 U-129/U-130：独立 Three.js/Electron 双画风自动样板用于空间、人物与特效评看；范围及实际证据见 docs/art/DESKTOP-RUNTIME-SAMPLES-2026-10-13.md。正式玩法、Windows 与完整 SR/AC 状态保持。
- 2026-10-13 U-131：Blender / Three.js 独立 D 主殿山院制作样板，固定机位实际图与剩余视觉差距见 docs/art/reference-reconstruction-20261013/README.md。本批仅提供局部模型与呈现证据，用户视觉认可、完整 SR/AC、正式迁移与 Windows 继续待验。
- 2026-10-14 U-132: local asset design sheets, editable Blender models and Three.js/Electron multi-view gallery. Evidence and visual limitations: docs/art/asset-review-20261013/README.md. Full SR/AC, game integration, visual approval and Windows remain separate.
- 2026-10-14 U-132 人物接续：正侧背设计稿、头部细节参照和可编辑 Blender / GLB 衣装样件；局部实际渲染与桌面检查见 docs/art/asset-review-20261013/character-study-v2.md。美术认可、正式游戏接入、多人性能与 Windows 待验；完整 SR/AC 状态保持。
- 2026-10-14 U-133: pure 2D HD pixel art direction confirmed; courtyard battle and character/effects static concepts generated. Evidence: docs/art/hd-pixel-20261014/README.md. User art review, desktop 2D runtime, animation and crowd performance remain pending; full SR/AC states unchanged.
- 2026-10-14 U-134：纯 2D 高清像素独立桌面场景，macOS 可见窗口 1600×900 实际行走、石灯前后遮挡、三类技能与冷却、16 人样例及暂停／重播，组件 6／6、自动 10／10、运行错误 0；打包应用已实际操作行走、缩放、暂停、护阵与重播。局部证据见 docs/art/hd-pixel-20261014/RUNTIME.md。正式模拟与存档未接入，完整大地图、Windows 和用户美术认可另验；D/I/V/R 与 AC 状态保持。
- 2026-10-14 U-135 / R-41 / T-14：用户认可 U-134 高清像素实机并要求保持设计，以目标模式接续独立桌面演武。独立 arena-save.json 经动态版本／状态校验、2 MiB 限制、顺序原子替换保存；存储 9／9 覆盖真实规则快照往返、坏 JSON／未知版本原字节保留、失败不覆盖良档和并行调用顺序。最终打包应用跨进程写入 1／1、恢复 3／3：tick 4 火诀飞行存档恢复后敌方 100→72、掌门 280→266，各一次；原生手动和关闭保存完成验证。局部证据见 docs/art/hd-pixel-20261014/ARENA-RUNTIME.md；最终记录 /Volumes/Media/immortal-qa/pixel-arena-20261014/ 下 final-run-3/metrics.json、restart-final/ 与 native-final/。源码与素材随本批源码检查点保存；正式规则完整移植、大地图、正式人物与存档、Windows 和完整 SR/AC 另验，D/I/V/R 与 AC 状态保持。
- 2026-10-14 U-136/U-137，R-42/T-15：独立近山行程扩为同一1672×2823图像空间，山院→溪桥→林道→谷地会武→实际返院；16/32人稳定身份、只控掌门、同一时钟和独立存读。组件45/45；最终可见macOS包run-3检查22/22、运行错误0；16人实际返院胜利，32人到谷后采样15.00秒（其中交战13.08秒）再公开退出。原生输入、存读及画面差距见 docs/art/hd-pixel-trail-20261014/RUNTIME.md，设计见 docs/design/44-PIXEL-TRAIL-SLICE.md。源码与素材随本批检查点保存；当前画面认可、正式世界与存档接入、Windows及完整SR/AC另验；D/I/V/R及AC状态保持。
- 2026-10-14 U-139 设计确认：宗门模拟经营支持自主生活；桌面后台继续运行、关闭停止且重开不补离线进度；掌门按玩家设定的发展目标、预算和风险偏好选择修炼、出行和经营。见 docs/design/DECISIONS.md、docs/design/01-CHARACTERS.md、docs/design/05-RUNTIME-CONTRACTS.md。当前仅落档，运行接入与新行为验收待实施；既有 SR/AC 状态和历史证据范围保持。
- 2026-10-15 U-144：用户确认按courtyard-v2.png还原。首屏采用原尺寸环境与独立人物、正式米制事实及同一模拟，实走、点选、原稿对照与存读的局部证据见 docs/art/pixel-courtyard-prototype-20261014/RUNTIME.md。用户实机美术认可、相邻地区、经营长验与Windows继续分别接续；完整D/I/V/R和AC状态保持。 最终macOS首屏94/94、70.029秒自主观察701次采样及原生输入/旧候选存档升级已复核，运行错误0；环境1,447,576像素比较差异0（排除状态与补画区）。
- docs/design/49-P0-P2-COURTYARD-PROGRESS.md；2026-10-15 U-147/R-47：院务/人物/工位/物资/研习操作、保存失败保护和疗伤收据重放；47/47 Node检查。浏览器内核缺失且官方下载失败，实际UI与桌面未验，完整P0—P2及SR/AC状态保持。
- docs/design/50-COURTYARD-UI-DESIGN-AUDIT.md；2026-10-15 U-148/R-48：四页及关联入口30项设计审查与7条后续场景；两处物流问题由正常命令复现，运行代码未修，实际UI未验，完整状态保持。
- docs/design/51-COURTYARD-MANAGEMENT-INTEGRATION.md；2026-10-15 U-149/R-49：四页与共用详情、单趟40份留苗搬运、落地回收和保存恢复接通；组件与相邻回归57/57，同一检查点真实桌面387.845秒13/13、最终包页面8/8、恢复链9/9，原生选择文件/预检/恢复及手动暂停已验。完整新档、规模、对话/突破、跨区施工、20分钟自主与Windows待接；完整D/I/V/R和AC状态保持。
- docs/design/52-EAST-TERRACE-INTEGRATION.md
- tests/acceptance/courtyard-east-desktop.mjs
- docs/design/53-COURTYARD-AUTONOMY-ACCEPTANCE.md
- tests/acceptance/courtyard-autonomy-desktop.mjs
- tests/acceptance/courtyard-autonomy-audit.py
- docs/design/54-COURTYARD-OPENING-DEMO.md；2026-10-16 U-153：当前高清像素桌面正式空档接入灭门序章、落脚疗伤择卷与首次主殿营造。默认测试133/133、后增场景相关16/16、独立复核19/19；最终macOS包同一新档10/10（72.310秒，五处进程重启）、旧暂停档兼容5/5，页面/资源错误0。完整后续开局链、Windows与SR/AC状态保持。
- docs/design/54-COURTYARD-OPENING-DEMO.md；2026-10-16 U-154：六幕连环画与四帧包裹展开接入当前桌面，正式页码与共用状态保持。定向测试11/11；源码桌面17/17、八次进程重启保留子帧/开包/世界进度；最终macOS包同一新档连续录像检查7/7、160.104秒，错误0。开包、择卷与重播时草药16和世界步0保持。Windows与完整SR/AC状态保持。
- docs/design/54-COURTYARD-OPENING-DEMO.md；2026-10-17 U-155：三张守阵/逃离v3画帧、四类访客真实山路入离场、相向让行与旧档保护。基础143/143、定向17/17；最终macOS包序章17/17八次重启、同一普通新档陆知微入场4/4与99个在途脚点、暂停跨进程恢复/点选/走近通过。赠药仅同源隔离副本命令门槛证据；Windows、桌面完整交谈链、既有网页择法暂停提示和完整SR/AC状态保持。
- docs/design/56-COURTYARD-FOOD-SUPPLY.md
- tests/unit/courtyard/sect-food.test.mjs
- tests/acceptance/courtyard-food-desktop.mjs
- docs/design/57-THREE-RESIDENT-COURTYARD.md
- docs/design/60-WEST-VALLEY-INTEGRATION.md
- docs/design/61-RESIDENTIAL-INTEGRATION.md
- 2026-10-18 U-167/T-20住宅接续：GC09–12沿固定建位建设，四院一级16实体床；独立床位模块10/10规则检查，含只读旧档、唯一床位、真实到床、途中存读与失效恢复。三院完工及空地母稿已制作，世界位置与升级占地待校准。正式运行接缝、近身有限交易筹资和同源桌面营建入住尚待完成；本条只登记住宅局部准备，不推进完整SR/AC状态。
- 2026-10-18 U-167/T-19西谷一级批：同一未改正常来源macOS源码Electron连续31/31，墙钟1219.061秒、tick646→10944、7次精确关闭重开、错误0。四址实际运料施工，有限采石18.4及两田实际收获后35.2593256粮搬入新公库，两田各留2种粮。根独立读回来源SHA/最终状态/截图，源码与素材hash随run03封存；完整SR/AC、升级损坏图、供水保鲜、Windows和安装包仍按原范围接续。详见docs/design/60-WEST-VALLEY-INTEGRATION.md。
- tests/unit/courtyard/courtyard-local-trade.test.mjs
- tests/acceptance/courtyard-local-trade-desktop.mjs
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
- docs/design/70-COURTYARD-FIRST-COMBAT.md
- docs/design/71-GUESTHOUSE-INTEGRATION.md
- tests/unit/courtyard/courtyard-guest-lodging.test.mjs
- tests/acceptance/courtyard-guesthouse-desktop.mjs
- docs/design/75-SECT-SUSTENANCE.md
- 2026-10-25 U-170留守供给与掌门外出：v1门人自主运回收成、桌面采寻入口及出行供给反馈已接入。普通源267998正常备粮，macOS源码Electron分段离院270016→实际归院272082，NPC实际送6粮、五人日结供给正常并继续成长；采6草返院实际交库，最终272332粮23。最后一段原生存读/正常关闭/来源及运行散列一致、错误0；早先脚本失败和精确续接证据保持。37项集成及4项采寻检查通过（有交叉）；独立审计10项、13对原生存读通过。并行美术署名弹窗不在本批冻结原生范围。长期供需平衡、Windows、完整SR/AC与发布状态保持，详见75。最终全仓check被并行署名CREDITS.md缺失阻塞；需求校验通过。
- docs/design/76-DISCIPLE-CULTIVATION-PROGRESSION.md
- tests/acceptance/courtyard-disciple-cultivation-desktop.mjs
- tests/acceptance/courtyard-disciple-cultivation-reopen.mjs
- 2026-10-25 宗门供给与门人自主突破局部：docs/design/77-DISCIPLE-BREAKTHROUGH-LOOP.md；普通源280680→桌面准备282724→桌面终档284504，唯一180工步升至二层、5组原生存读一致。完整SR/AC状态保持。
- 2026-10-25 人物走近局部：docs/design/78-APPROACH-RESPONSE.md；两个普通来源实际近身、4组原生存读一致；反馈48–55ms，旧场景206.5ms峰值使200ms目标保持未通过。整项状态保持。

- 2026-10-06：由v1.2设计缺口审计建立SR；新增内容和参数遵循作者默认，不冒充用户逐项确认。
- 2026-10-06：用户授权目标模式、多agent并行开发与验收；启动D01，按现有契约展开模块设计，未将建档或局部实现标作交付。
- 2026-10-07：U-100固定2.5D、旧云岫人物/建筑资源接回正式U-99主线；R-29山院扩96米，旧64档先校验仅登记extentVersion。人物6/6、扩图9/9、单位格6/6与正常公开链局部通过，真实网页/发布另记STATUS；完整SR保持in_progress，不冒称全动画或全体验完成。
- 2026-10-07：成人家具与现场交互本地批次：已有v5至schema6迁移。本批新增adult-furniture-1：原布局先校验，在副本中映射家具工位、必要脚点和失效返院缓存，保留身份、资源、时间、RNG、已付投入及活动进度；山外实际位置和旅程事实保留。 已登记适用实现与独立复验证据，整体开发/验收保持in_progress，AC状态沿用已有范围。
- 2026-10-07：M0/M1 接续批完成局部设计、修复和独立复核；具体通过范围与缺口见 acceptance_notes 和 STATUS。整项 D/I/V/R 及 AC 状态保持原门槛。
- 2026-10-07：2026-10-07 M1 第四批：SR030-AC02 的两设施档由旧版公开营造，最近旧址阻塞入口时改选合法格并留迁移账，身份/资源/时间/RNG及源档原文保留。76 建筑三级设施档先设已立派，每一处均通过旧版 placementLock 且整档通过 Legacy.validateSave；新空间无法安置时实际档位拒载、禁写、原文导出并可选择有效备份恢复，故障字节留在保留区。当前版缺失人物位置引用同样实际拒载和恢复；未知建筑定义及未来版本不改原输入。专项 24/24，独立只读复核通过，AC02 按原文 Node 契约范围登记 passed。76 建筑档是合成的旧版合法结构压力样本，不是逐座公开建成的玩家历史档；持久层使用真实模块和内存存储，真实浏览器存储未验。历史 full fixture 缺失另记跳过；整项 SR030 D/I/V/R 仍未关闭。
- 2026-10-07：M1 第五批修复大档持续保存：有效本地快照和滚动备份压缩，普通导出及旧格式读取保留；模拟配额、真实浏览器续存与独立复核已登记，整项门槛继续。
- 2026-10-08：2026-10-08 M1 版本迁移窄项：prepareMigration 要求调用方提供返回已校验结构6状态的完整加载器，并在隔离初始化前后各校验一次。合法 v1–v4 生成器、真实 tests/fixtures/prototype-worlds/legacy-v4.json 与 tests/fixtures/ea-reference-world.json 的旧档均迁至 opening-runtime-2 + legacy-ea-1.4.2，原文保留、离线推进为0、存读稳定；已登记 opening/runtime 和 SR v6 来源仍可读。混搭主版本、未知内容或子版本、缺失 SR 核心模块拒载且不改输入。证据：tests/acceptance/ea-sr-version-gate-acceptance.mjs 9/9、tests/acceptance/ea-sr-contracts-acceptance.mjs 24/24，以及独立同源复验。浏览器存储、目标设备、旧可选模块来源全矩阵和完整 I/V/R 尚未由本窄项覆盖。
- 2026-10-09：2026-10-09 U-105 / R-32：当前需求更新为 1.1，山域设计关联 GROWTH-08、GROWTH-09、GROWTH-11。旧版 1.0 的标题、需求、AC原文/证据及D/I任务完成范围保存在 registry.json 的 version_history；当前重新记 not_run：SR-XF-030-AC-01、SR-XF-030-AC-02。 当前D01继续补实施参数，D02及本版本I01待前置完成；development_status保留既有运行实现基线。未改变的已通过AC只沿用原行为及原运行环境证据，新增地域、布局与迁移流程按GROWTH另验。本批未执行运行时验收，未修改正式运行版本或发布状态。
- 2026-10-12：2026-10-12 U-120：只读人物／库存投影沿同一存档，Node 验证装备预约／完成、邀约与搬运对应存读；本地浏览器保存刷新保留实际武器槽与库存，并经导入界面载入正式命令生成的药圃 QA 档。本批为当前流程存读与导入的局部证据，完整旧布局／装备／成长／篇章迁移 AC 状态保持。
- 2026-10-12：2026-10-12 U-123：正式界面导档、第一炉随身1／公库1保存读取守恒，谷内存读保同一人物ID及scene:valley；旧布局和完整迁移 AC 状态保持。 局部证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。
- 2026-10-12：2026-10-12 U-123 首战本地网页：最终本地网页活动战斗存读后worldTick5974、掌门血140／灵力80、敌血98及双方脚点一致；返院服药后再存读保home、wound0及剩余丹药1。完整旧档迁移 AC 状态保持。 证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。
- 2026-10-12：2026-10-12 U-123 发布核验：运行源码 main 836ccb605a42e7c21c2aae8c5e2c4eee7e55c03e；gh-pages 4d6786da521f1ab92818c20f67c036a829469e6e；GitHub API Pages build=built。公开 mountain-courtyard 的14个交付文件（release/build/index、界面与加载模块、桥接及世界／战斗规则、三片场景包）HTTP 200，SHA与本地导出一致。公开浏览器百艺、导档、实际行走旅行与采集的操作证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；本记录仅是U-123局部发布证据，整项 D/I/V/R 与 AC 状态不变。
- 2026-10-12：2026-10-12 Issue #5：最新main6000秒实验16笔生产/14笔微量灵石，修复显式receipt、9位新计算精度、工资封顶、事务提交与运输严格余额。专项12/12，正常公开开局2/2、丹炉公开链1/1；旧数量和事实逐字保留，不推进完整SR状态。见 docs/design/ISSUE-5-PRODUCTION-ACCOUNTING.md。
- 2026-10-12：Issue #6：只对白名单纯历史事实与完成商旅行程做引用闭包保护的周期摘要；生产及普通旅行完整保留，旧档先完整校验、保存恢复及日凭证幂等继续成立。真实6/12/24/48小时A/B与局部回归见ISSUE-6-HISTORY-RETENTION；不推进整项SR/AC、真机或真人状态。
- 2026-10-13：U-126：用户要求从原型中断处继续，接入平涂地形、建筑、药田、人物和山谷；校准投影、脚点、透明命中、前景遮挡和田地绘制顺序。定向断言及网页点选、行走和保存刷新证据见本批 RUNTIME。仅登记局部实现与验证，整项 D/I/V/R、任务与 AC 状态不变。
- 2026-10-13：U-127/U-128：按用户要求先审核大场景多人即时战斗与画风原型，平台转为桌面。地图尺寸、人数上限、技能数值与最终画风未定；保留既有实现和验收事实，完整SR/AC及任务状态不变。
- 2026-10-15：U-147接续P0—P2：新增两人小院可操作供给成长和保存/事务保护，登记局部实现与Node证据；实际UI/桌面未验，完整状态不推进。
- 2026-10-15：U-148：记录四页及关联入口设计审查、操作断点和R-48重整提案；未修运行代码，完整D/I/V/R与AC状态保持。
- 2026-10-15：U-149：接续远端main并完成当前山院管理和取消回收、保存恢复的局部桌面验证；完整状态保持。
- 2026-10-16：U-150/R-50：追加连续东路、实际分趟运料施工、四床启用与同源macOS存读往返局部证据。流程两段308.849秒，最终包阶段6项及往返9项，错误0；保留验收脚本中断记录。完整SR/AC与D/I/V/R状态保持。
- 2026-10-16：U-151/R-43：同一东台完成档实际自主1200.036秒，后台180.857秒、接管、预算风险、生产搬运及关闭重开。原脚本末段分类失败保留，同轮证据补核验38项；同档手动补粮恢复5项。持续公库供给仍有缺口，完整SR/AC与D/I/V/R状态保持。
- 2026-10-16：U-153：补充桌面正式空档到主殿完工的局部实现与同档实机证据；完整需求和AC状态保持。
- 2026-10-18：U-163/R-52/T-18：口粮目标、有限采粮与实际送库、保留生活粮的付费补种、预算与旧策略兼容已接入。供粮8项、相关17项、默认核心152/152通过。macOS源码Electron同源实际自主1200.016秒，实采送库80、消费40、公库3→43，解除饥荒后持续为0；长验11/11、证据核对12/12、界面7/7、macOS包同档短复验6/6，暂停关闭重开精确恢复。成功付费补种实机、三至五人、Windows及完整SR/AC状态保持。
- 2026-10-18：2026-10-18 U-164/U-165局部：多Agent完成林长风门籍规则及同窗交互首轮，规则8/8、相关11/11，主Agent联合供粮/操作33/33；亲传Electron专项9项，范围限当时人物交互。用户明确扩大主殿山域、整体绘制采伐场、所有建筑完全预设并由人物实际到场修建；院前临时营造入口与独立素材已撤下。下一步先确认整体场景和稳定建位，再接施工与三人同源长验。二十分钟、当前桌面包、Windows及完整SR/AC尚未完成，整项状态保持。
- 2026-10-18：U-167 GC03同源公开筹料91743→117712→167589→168109完成，前两段失败及自然人物成长保持。macOS Electron run01勘察途中身体边缘检查失败，实际168489原生档封存，页面错误0；道路中心修复已合入、实机接续待验。GC25/26在隔离副本制作，完整SR/AC状态保持。
- 2026-10-18：U-167 GC03北台路心与静态地面查询修复合入，主树5项及原168489实际94步/4次存读通过。桌面原勘察1170在168583完成，施工14仅扣60灵石40木25石一次；实际168803封存后定位林长风自主回床路线检查失败。run02离开建位缺步及run03热字段遗漏为验收脚本问题，全部实际来源、进度及失败保留。完整经营与SR/AC继续验收。
- 2026-10-18：U-167 GC03原施工14已在同源桌面完成；四蒲团/两检修位、180步炼气6→7层、有限供灵与四次关闭重开通过。北路返床/绕人修复主树8项及实际27步回路成立。现场货位目的地过滤已补；当前170563检修运输347续接核对主殿门槛圈样本，维护全链未完成。丹房四阶段四工位16项为隔离候选证据。完整SR/AC状态保持。
- 2026-10-18：U-167 GC03一级同源macOS源码桌面链完成：最终171973，run07为10/10、错误0、209.943秒，七段实际逐项合计777.710秒。勘察/施工、180步6→7层、有限供灵、原运输347与348送2木1石、80步维护均成立，携货及活动中多次精确重开。Lu门槛为外部脚圈检查室内边界遗漏，已按正式预约/holder/floor纠正且保留离路反例。整体建筑与完整SR/AC继续。
- 2026-10-19：U-167 GC25/26一级道路、四阶段、真实工位与四段炼丹已合入23源码/测试和14图，主树30项及工程检查通过；有限供料负坐标整档完成施工到唯一两份成药，正常桌面生产另验。求见链真实续至174422，首位来客到时离开、第二位入院，未新增收录；绕柱导航已修，北坡迎面互等继续验证。完整SR/AC状态保持。
- 2026-10-20：六居民同档日结与原生精确重开通过；living-03道路body失配保留tick191089，修复待living-04。院务奖励入口与容量边界规则检查通过，实际领取、GC25/26正常生产未验；GC21–23仅布局候选。完整SR/AC及任务状态保持。
- 2026-10-20：living-04从191089同档完成73/75实际床位、自主16粮采送、192000五门人日结与精确原生重开，118.716135秒、错误0；living-03失败保留。只更新局部证据，不提升完整SR/AC；funding-01及GC25/26正式生产待验。
- 2026-10-23：2026-10-23 桌面首战历史run-04保留活动战斗、撤退与受伤返院三处精确原生关闭重开证据（tick423→1005、13项、错误0）。当前已接入独立林间键鼠战斗；按用户本轮聚焦战斗，新控制下的原生存读、旧档入口及返院复验暂缓，不以历史run-04替代。生产／医庐heal-11来源保持独立，完整迁移与SR/AC状态保持。详见docs/design/70-COURTYARD-FIRST-COMBAT.md。
- 2026-10-23：2026-10-23 GC15一级客院已接入：两张独立客床、当面自愿邀请、实际步行入住、原来访期限退房下山及原生存读。macOS源码Electron有限夹具入住ui-fixture-03通过7项（1656→3851、235.557720083秒），施工build-fixture-01通过3项（646→1700、114.379689209秒）；唯一工单3投入45灵石/40木/20石，两趟实际送达后于1683完成200施工步。两段错误0，来源、运行文件与原生重开均一致。GPT-6.1-sol独立读回6个原生检查点及12个核心源码通过。正常世界仍保留医庐tick261253原档；该世界的筹资建设、Windows和完整SR/AC保持待验。 详见docs/design/71-GUESTHOUSE-INTEGRATION.md。
- 2026-10-25：登记正常供给与门人自主突破的局部实现/原生证据；保持整项与AC状态。
- 2026-10-25：登记人物走近后台规划、原生实际通行和响应测量的局部证据，200ms目标未全部通过，整项与AC状态保持。

本文件由[registry.json](../registry.json)派生；更新台账后执行 `python scripts/requirements/sr-manager.py refresh`，不单独修改此派生页。
