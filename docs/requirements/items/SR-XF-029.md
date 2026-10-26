# SR-XF-029 · 统一操作流程、窄屏与人物触控

来源：DB-2026-10-05 v1.2；需求版本：1.2；建档日期：2026-10-06。

| 字段 | 值 |
| --- | --- |
| 范围 / 模块 | 前期必需 / 体验 |
| 优先级 / 计划 | P0 / I1 |
| 设计 / 开发 | draft / in_progress |
| 验收 / 发布 | in_progress / not_released_for_this_sr |
| 责任人 / 复核人 | Codex/ui_acceptance / Codex/root（集成） |

## 来源、依赖与范围

纳入云岫前期，按依赖推进。

决策来源：U-63, U-93, R-25, U-94, U-95, U-96, U-97, R-27, U-100, R-29, R-30, U-102, U-103, U-104, U-105, R-32, U-109, U-120, U-123, U-125, U-124, U-126, U-127, U-128, U-129, U-130, U-131, U-132, U-139, U-142, U-144, U-149, R-49, U-150, R-50, U-151, R-43, U-154, U-155, U-163, R-52, T-18, U-167, T-20, T-21, T-22, U-170, U-172。这是继承的U项和作者实施默认；具体新增名称/数值不得伪装成用户逐项批准。

规格：[01-CHARACTERS.md](../../../docs/design/01-CHARACTERS.md)、[03-SPATIAL-ART.md](../../../docs/design/03-SPATIAL-ART.md)、[06-OPENING-ACCEPTANCE.md](../../../docs/design/06-OPENING-ACCEPTANCE.md)、[14-EARLY-GAME-DETAILED-DESIGN.md](../../../docs/design/14-EARLY-GAME-DETAILED-DESIGN.md)、[GODOT-MIGRATION.md](../../../docs/GODOT-MIGRATION.md)、[ART-REALTIME-TRIAL.md](../../../docs/ART-REALTIME-TRIAL.md)、[SECT-GROWTH-PLAN.md](../../../docs/SECT-GROWTH-PLAN.md)、[41-COURTYARD-VALLEY-IMPLEMENTATION.md](../../../docs/design/41-COURTYARD-VALLEY-IMPLEMENTATION.md)、[42-CHARACTER-DIALOGUE.md](../../../docs/design/42-CHARACTER-DIALOGUE.md)、[51-COURTYARD-MANAGEMENT-INTEGRATION.md](../../../docs/design/51-COURTYARD-MANAGEMENT-INTEGRATION.md)、[46-CONTINUOUS-DOMAIN-FOUNDATION.md](../../../docs/design/46-CONTINUOUS-DOMAIN-FOUNDATION.md)、[52-EAST-TERRACE-INTEGRATION.md](../../../docs/design/52-EAST-TERRACE-INTEGRATION.md)、[45-SECT-IDLE-SLICE.md](../../../docs/design/45-SECT-IDLE-SLICE.md)、[53-COURTYARD-AUTONOMY-ACCEPTANCE.md](../../../docs/design/53-COURTYARD-AUTONOMY-ACCEPTANCE.md)、[56-COURTYARD-FOOD-SUPPLY.md](../../../docs/design/56-COURTYARD-FOOD-SUPPLY.md)、[59-WEST-FOREST-INTEGRATION.md](../../../docs/design/59-WEST-FOREST-INTEGRATION.md)、[60-WEST-VALLEY-INTEGRATION.md](../../../docs/design/60-WEST-VALLEY-INTEGRATION.md)、[61-RESIDENTIAL-INTEGRATION.md](../../../docs/design/61-RESIDENTIAL-INTEGRATION.md)、[62-EAST-SERVICES-INTEGRATION.md](../../../docs/design/62-EAST-SERVICES-INTEGRATION.md)、[64-NORTH-LIBRARY-INTEGRATION.md](../../../docs/design/64-NORTH-LIBRARY-INTEGRATION.md)、[69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md](../../../docs/design/69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md)、[70-COURTYARD-FIRST-COMBAT.md](../../../docs/design/70-COURTYARD-FIRST-COMBAT.md)、[71-GUESTHOUSE-INTEGRATION.md](../../../docs/design/71-GUESTHOUSE-INTEGRATION.md)、[75-SECT-SUSTENANCE.md](../../../docs/design/75-SECT-SUSTENANCE.md)、[76-DISCIPLE-CULTIVATION-PROGRESSION.md](../../../docs/design/76-DISCIPLE-CULTIVATION-PROGRESSION.md)、[77-DISCIPLE-BREAKTHROUGH-LOOP.md](../../../docs/design/77-DISCIPLE-BREAKTHROUGH-LOOP.md)、[78-APPROACH-RESPONSE.md](../../../docs/design/78-APPROACH-RESPONSE.md)、[79-DISCIPLE-WORK-SPECIALIZATION.md](../../../docs/design/79-DISCIPLE-WORK-SPECIALIZATION.md)、[80-EXPEDITION-RECOVERY.md](../../../docs/design/80-EXPEDITION-RECOVERY.md)、[81-DISCIPLE-ONBOARDING.md](../../../docs/design/81-DISCIPLE-ONBOARDING.md)、[82-EXPEDITION-PURPOSE.md](../../../docs/design/82-EXPEDITION-PURPOSE.md)、[83-ENCOUNTER-DISTANCE.md](../../../docs/design/83-ENCOUNTER-DISTANCE.md)、[84-EXPEDITION-MEDICINE.md](../../../docs/design/84-EXPEDITION-MEDICINE.md)、[85-MEDICINE-SUPPLY.md](../../../docs/design/85-MEDICINE-SUPPLY.md)、[86-MEDICINE-MATERIALS.md](../../../docs/design/86-MEDICINE-MATERIALS.md)、[87-PHARMACIST-DEVELOPMENT.md](../../../docs/design/87-PHARMACIST-DEVELOPMENT.md)、[88-SECT-CONCURRENCY.md](../../../docs/design/88-SECT-CONCURRENCY.md)、[89-DISCIPLE-CRAFT-REQUEST.md](../../../docs/design/89-DISCIPLE-CRAFT-REQUEST.md)、[90-DISCIPLE-ADVANCEMENT.md](../../../docs/design/90-DISCIPLE-ADVANCEMENT.md)、[91-EXPEDITION-GROWTH.md](../../../docs/design/91-EXPEDITION-GROWTH.md)、[92-EXPEDITION-COMPANIONS.md](../../../docs/design/92-EXPEDITION-COMPANIONS.md)、[93-COMPANION-OPERATIONS.md](../../../docs/design/93-COMPANION-OPERATIONS.md)、[94-EXPEDITION-RESPONSE.md](../../../docs/design/94-EXPEDITION-RESPONSE.md)、[95-GROUND-PANEL-RESPONSE.md](../../../docs/design/95-GROUND-PANEL-RESPONSE.md)、[96-NORTH-RECOVERY-PATH-RESPONSE.md](../../../docs/design/96-NORTH-RECOVERY-PATH-RESPONSE.md)、[README.md](../../../docs/art/combat-response-goal-20261027/README.md)。

依赖：[SR-XF-003](SR-XF-003.md)、[SR-XF-004](SR-XF-004.md)、[SR-XF-005](SR-XF-005.md)、[SR-XF-007](SR-XF-007.md)。

关联既有验收：INPUT-01, INPUT-02, OPEN-10, GROWTH-10, GROWTH-12；本SR的AC细化这些目标，不代表旧版本已经通过。

## 现状与设计缺口

既有 JS 运行基线：建筑侧卡按预制件显示床位、作业位、研习位及当前占用；现场及重叠人物使用同身份头像入口。pointerup补验移动距离，拖动放开保持拖动语义；推荐营造确认消费正式返回字段。推荐营造说明使用稳定布局，指针离开画布后确认按钮仍可点击。 U-105 山域成长方案见 docs/SECT-GROWTH-PLAN.md；本批只登记设计与阶段原型，正式运行版本保持。
2026-10-14 U-142：先审核完整山院美术原型，再按构图、细节、精度与材质还原实机。目标模式、场景接入及20分钟长验按用户要求暂停；本地增量保留。原型见 docs/art/pixel-courtyard-prototype-20261014/README.md；原型不计作运行验收，既有SR/AC状态保持。

既有统一输入与DPR局部实现保留；U-105 的地域总览、预设建位项目卡、迁居/供给状态和失败恢复流程待详细交互设计及桌面/iPad视口和真机验证。

现状是适用旧能力的基线，不表示该SR完整目标已通过。

## 必须补齐的设计交付物

1. 掌门移动、点选、遮挡和预设建位项目选择的统一鼠标/触控语义与防误操作。
2. 地域总览、项目资格、施工容量、迁居进度、供给缺口的查看/确认/取消/恢复流程。
3. iPadOS横竖与Windows/macOS窗口、DPR的信息布局；五种规模的真实负载和设备结果分列。

## 需求行为

SR-XF-029-REQ-01：可见人物触控命中至少44CSS像素；从山域总览进入分区后保持同一人物/建筑选择及合理视点。

SR-XF-029-REQ-02：项目卡分别显示资格、实际工程、容量、迁居和供给；查看及阶段切换不替玩家确认建设、迁居或交易。

SR-XF-029-REQ-03：拖拽与手势不劫持侧栏/输入/弹窗；未开放、缺料、断路、满床/满仓分别提供具体恢复方法。


## 验收标准

| ID | 情景 / 操作 | 必须看到的结果 | 状态 |
| --- | --- | --- | --- |
| SR-XF-029-AC-01 | 鼠标与触控从山域总览进入分区并完成移动、选择和预设建位营造 | 两种输入语义一致，同一人物/建筑可定位；项目状态与实际资格和工程对应，遮挡/重叠选择及辅助预览不挡关键控制。 | not_run |
| SR-XF-029-AC-02 | iPadOS横竖网页视口与Windows/macOS窗口缩放操作新系统 | 画布位图与实际CSS容器/DPR匹配，投影和命中保持；关键文本/按钮不被覆盖截断，可取消恢复；浏览器与三平台实机结果分列。 | not_run |
| SR-XF-029-AC-03 | 关闭帮助/拒绝操作/保存失败 | 不会自动扣费或丢关键线索，能明确找到继续与恢复路径。 | not_run |

SR-XF-029-AC-02证据：docs/design/90-DISCIPLE-ADVANCEMENT.md；docs/design/91-EXPEDITION-GROWTH.md；docs/design/92-EXPEDITION-COMPANIONS.md；docs/design/93-COMPANION-OPERATIONS.md；docs/design/94-EXPEDITION-RESPONSE.md；docs/design/95-GROUND-PANEL-RESPONSE.md；docs/design/96-NORTH-RECOVERY-PATH-RESPONSE.md

2026-10-07本地小院批次：成人家具/单位格/空间定向检查48/48（8/6/34），正常公开命令接受/拒绝邀请两路完成营造、产出搬运、研习、到床休息与迁建取消/续建；分别60命令/36次精确存读和61命令/37次精确存读。六身份卧姿与预约前提2/2，生产Canvas卧姿加载/只读/身体点选/缺图回退4/4，已读图。旧v5完成档40建筑30门人保留资源、时间和return结局，全部入口可达，二次存读一致。各SR仅登记适用子情景；完整AC、真机触摸/FPS和真人首次体验状态分别保留。 浏览器DPR1鼠标在1366×900、1180×820、820×1180点选床上掌门通过；正常推荐营造经Enter和鼠标确认、实际施工落成。一次动态模块加载失败经页面重载恢复同档，原因待定位。I/V证据为沿既有可用契约实施的本批子范围；完整D01/D02及I/V关闭门槛保持原状态。

2026-10-07 M0/M1 接续批：鼠标自由营造误触拒绝、正常确认、施工详情和重载可用；双指合成输入13/13及生产Canvas显式锚点检查34/34。真iPad双指、三平台设备、全系统焦点/失败恢复仍未验，AC01/02/03状态不变；旧非schema6渲染委派分支尚未承诺指针锚点。

2026-10-07 M1 第五批：隔离浏览器首战大档实际导入、保存、刷新续玩与再次连续保存成功；旧未压缩大档容量失败会显式告知且旧主档留存，随后通过较大快照压缩修复。同一验收浏览器首次载入仍偶发动态模块连接重置，重载后可进入。此为保存失败/恢复及战斗界面的局部证据，未覆盖 AC03 全部帮助/拒绝/失败情景或目标设备，AC状态不提升。

2026-10-09 M1 r37：真实 DPR 2 的主画布与地面底图按 CSS 容器精确分配位图；窄屏帮助入口恢复可点击。空间 Canvas 36/36、输入点选 13/13；本地 Chromium 834×1194 与1194×834 DPR2、820×1180 DPR1 点选/帮助及 QA 档存读通过。四组5秒前后浏览器样本约60帧/秒、P95约16.7ms，DPR2两画布位图估算多约7.11MiB；不作为整体卡顿改善或真机证据。完整输入、设备/真人 AC 继续 not_run。 公网 r37 隔离 Chromium 模拟 iPad Pro 11 竖屏 834×1194/DPR2：两画布均 1668×2388，44×44 帮助可实点，Canvas 实点选中陆知微；QA 档暂停手存、刷新续玩保留时刻/伤势/口粮，随后时间继续，控制台零错误/警告。此非真机证据。

2026-10-09 U-105 / R-32：当前需求更新为 1.2，山域设计关联 GROWTH-10、GROWTH-12。旧版 1.1 的标题、需求、AC原文/证据及D/I任务完成范围保存在 registry.json 的 version_history；本SR未重置任何已通过AC。 当前D01继续补实施参数，D02及本版本I01待前置完成；development_status保留既有运行实现基线。未改变的已通过AC只沿用原行为及原运行环境证据，新增地域、布局与迁移流程按GROWTH另验。本批未执行运行时验收，未修改正式运行版本或发布状态。

2026-10-11 云岫首畦子批：新山院游戏卷册可从目标进入陆知微会面、实际走近后赠药与入院，再从药圃送苗、邀请照料；本地 Chromium 实点长链及刷新续档，旧档无来客时不导向来客任务。右侧卷册侧牌依当前人物/地块切换，数值清理浮点尾数。目标 iPad/Windows/macOS、完整输入与真人体验未验，状态不推进。

2026-10-12 U-120：系统界面原型经用户认可。Chromium 1440×960 九个入口及主要示例交互、820×1180 百艺竖屏已检查，详见 docs/art/system-ui-20261012/UI-CONTRACT.md。正式人物/物资/时钟/存读尚待接入；本批设计证据不提升完整 AC/SR 状态。

2026-10-12 U-123：百艺桌面1200×855及窄屏820×1180已实点第一炉；山外1440×960实走谷内互动及送库按钮禁重复。首战 UI 与目标设备继续核验。 局部证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。

2026-10-12 U-123 首战本地网页：最终本地战斗网页1440×960及820×1180已目视，字体完整、无横向溢出；攻击／护持／闪避／撤退及战斗页存档按钮实点，控制台0 error。目标设备与完整输入 AC 状态保持。 证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。

2026-10-12 U-123 发布核验：运行源码 main 836ccb605a42e7c21c2aae8c5e2c4eee7e55c03e；gh-pages 4d6786da521f1ab92818c20f67c036a829469e6e；GitHub API Pages build=built。公开 mountain-courtyard 的14个交付文件（release/build/index、界面与加载模块、桥接及世界／战斗规则、三片场景包）HTTP 200，SHA与本地导出一致。公开浏览器百艺、导档、实际行走旅行与采集的操作证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；本记录仅是U-123局部发布证据，整项 D/I/V/R 与 AC 状态不变。

2026-10-18 U-164/U-165局部：多Agent完成林长风门籍规则及同窗交互首轮，规则8/8、相关11/11，主Agent联合供粮/操作33/33；亲传Electron专项9项，范围限当时人物交互。用户明确扩大主殿山域、整体绘制采伐场、所有建筑完全预设并由人物实际到场修建；院前临时营造入口与独立素材已撤下。下一步先确认整体场景和稳定建位，再接施工与三人同源长验。二十分钟、当前桌面包、Windows及完整SR/AC尚未完成，整项状态保持。

2026-10-18 U-167局部：批准25项设施/31预设建位布局并分期开发；31目录已接入，原殿/药圃/东台保留身份，西林一级完成真实西桥运料、到场施工、两工位产木与搬回公库，其余27处待接。默认170/170、相关31项及地面校准后6+10项复验通过。macOS源码Electron同一两人来源档10/10、100.894秒，投入25灵石20木8石，6木实际回库，三次存读精确，页面/运行错误0。证据docs/design/59-WEST-FOREST-INTEGRATION.md；升级画层、三人长验、Windows及当前包另验，整项D/I/V/R与AC状态保持。 2026-10-18 U-167西谷GC-17/18/19/24开发中：显式扩谷、固定施工、有限石源、现场种粮及独立分类公库已写入。同源30条公开命令连续营造四处并精确存读，证据/Volumes/Media/immortal-qa/west-valley-prepared-20261018-v2/。阶段美术及完整桌面验收继续；远路邀请已改为有限通勤、到岗后计劳动承诺，旧邀请期限保留，公库口粮纳入实际回运；整项SR/AC状态保持。

2026-10-23 本轮战斗采用独立林间战场：WASD持续走位，鼠标落点／方向配合1／2／3技能与Space短步，自动攻击仅执行射程内普通攻击，走位和技能由玩家操作。真实投射物碰撞后结算；暂停、模态与原生失焦清输入，后台世界规则保持。本轮直接相关规则28/28及主Agent工程检查通过；正常开局Node术法与自动普攻两条胜利链均只有一次结算，身体释放并恢复谷内行走。macOS源码Electron分段完成移动、原生失焦及后续技能操作：direct-run-01前8项局部通过、direct-run-03原生失焦清键且后台续进5步、direct-run-04后续9项通过（834→972、24.511037秒、错误0）；各段失败与两处界面修复分别保留，不拼作一次连续通过。新控制下的存档、旧档入口与返院复验暂缓。run-04按钮／存读链按历史版本保留。主Agent独立目视最终投射物／护持及此前探索截图，构图、空地脚点、敌预警与技能栏可辨，八个主战斗源码SHA与最终冻结一致；新素材用户美术评看与完整SR/AC另计。

2026-10-25 宗门供给与门人自主突破本批完成：补齐既有炼丹院务奖励入口、修复突破通勤互等及让行工位接缝；正常桌面源280680经实际补种/两批采粮交库至282724，再自主修炼、唯一扣24灵石/8灵草，于284309完成180工步升至炼气二层。最终284504，五人供给正常、饥荒0；准备及核心共5组原生保存/关闭重开一致，公开人物窗只读正确，两个成功段errors均0。原走近超时场景现点击3.72秒通过15秒门限，仍有明显等待。空间相邻37/37、根奖励/突破/通勤16/16通过；旧requester-clear基线失败、Windows、长期平衡、完整SR/AC及发布状态保持。 详见 docs/design/77-DISCIPLE-BREAKTHROUGH-LOOP.md。

2026-10-25 人物走近已接入后台寻路，主线程保留正式身体校验与事务提交。macOS源码Electron两普通来源实际近身、途中及终点共4组原生保存/关闭重开通过，最终284802；首反馈约48–55ms。旧场景最长帧间隔206.5ms，最新经营档192.1ms，200ms响应目标尚未全部通过。根定向32/32；导航相邻9/10及命令相邻41/44的4项失败均在修前版本复现。原失败记录保留，完整流畅度、Windows、整项SR/AC及发布状态保持。 详见 docs/design/78-APPROACH-RESPONSE.md。

2026-10-25 门人自主历练目的已接入：根据公库缺口、本人志向和本人既往风险见闻选择采药补给或探索修行。定向场景验证采6草返院与实际到点观察60步分别结算8经验；遇险未完成及新采药空药丛不发完成经验。新增及独立边界9/9、归院恢复回归7/7、三场景9项及实际浏览器组件通过。相邻19项18通过，唯一5.3米近身受伤断言在入口同样失败，保留待修。完整SR/AC及发布状态保持。

2026-10-25 历练距离修复完成：近身伤害恢复原3米，感知6米，应战交互9米各自独立。默认怪位置下正式探索在6米发现后撤退，1279步归院伤0；配置2米接触的行程实际伤10，589步归院后保留养伤意图。两场景7项、根距离10/10、目的与恢复16/16、原历练回归7/7通过。82记录的5.3米旧失败已修复；历史结果保持，完整SR/AC及发布状态保持。

2026-10-25 历练备药至恢复经营闭环完成：实际到公库按许可领一份回春散，个人随身药优先；受伤后退到安全处停20世界步服药，沿原路归院，未用公药实际归还。四场景均到真实工位产生新生产贡献：有药伤10→0；缺药/无许可归院伤10，实际到床恢复至4.9后返工；平安未用归库1。根新增及相邻39/39、四场景11类检查和实际浏览器组件通过；私药、每日限制、死亡、取消及旧行程兼容独立核验。完整SR/AC与发布状态保持。

2026-10-25 回春散供给闭环完成本批开发与针对性验收：正式院务设置0–10份公库目标，门人自愿搬运有限原料、完成四阶段280工步、成药实际归库，达标停产。场景陆知微耗10草/2水/1木及10灵石炼2份，tick2207归库；林长风2374领1份、2823安全处服药伤10→0、3103归院，公库余1。缺水实际补运后恢复、无人愿意、既有在制、防重复、关闭保留投入等通过。根61项单测，最后提示优先级修正后6项边界复验，四场景10类检查及实际浏览器组件通过，14文件散列一致、错误0。按U-172配置场景，未做原生整局或存读；完整SR/AC及发布状态保持。

2026-10-25 药物材料自主筹备与口粮保障完成本批：缺草/水通过既有生产候选、真实工位和运输补足；普通灵泉新增显式取洁水/凝灵晶选择，未完批次拒切。足粮场景从零公共草水经取水、种采、搬运、四阶段炼制，于4624公库入药2；低粮场景初始5粮，722实运30粮至35，727才开始药物任务，4909药2/粮41，全程饥荒0。缺人和旧承诺100步保持；61项独立定向/相邻单测、最终四场景10类检查、实际Chrome管理组件6类检查通过。修复首次洁水入库缺省键与种粮压过运粮的实际问题，原失败保留；最终场景14份/组件5份散列前后一致并匹配当前源码，错误为空。按U-172配置设施和初始物资，未做建井长链、原生整局、存读及长期供需平衡；完整SR/AC和发布状态保持。
2026-10-25 药师实操成长与供给接续完成本批：实际完工唯一增加医理，已学药理通过实操加深；场景34.5→35.1达到原资格后真实炼成筑基丹1份。伤停、真实外出、半炉中断三种替补均另起自愿炉单并实际归库2药；半炉0.5草损耗及余料退款保持。修复替补赴炉与伤者返床的真实窄路互堵，退让不计工时。根69项不同定向/相邻单测、四场景11类检查、实际Chrome组件6类及原培养DOM1项通过；最终16份场景/7份组件散列一致，失败报告保留。自动储备仍为回春散；按U-172配置初始条件，原生整局、Windows、存读长链与长期平衡未验，完整SR/AC及发布状态保持。
2026-10-25 三至五人并行经营完成本批：3/5名门人另加掌门，同钟生产、修行与历练均有实际进度；各跨三次日结，每日分别8/12粮，全程饥荒0。两档均炼2药于2168归库，三人实运11粮后余35；五人两次真实伤10→0服药并归院、本人返工，实运13粮后余23，药物总账1+2−2=1。修复未完功课和有效承诺被出游抢占，以及承诺到期先续约导致无法出游；既有夜休/恢复/突破优先。根61项定向及相邻单测、独立6项复核、最终两场景11类检查通过，17份散列前后及当前一致，工程检查通过。初始住宅非法入口和验收器遗漏夜休条件的失败报告保留；按U-172配置场景，原生整局、Windows、存读长链及长期平衡未验，完整SR/AC及发布状态保持。
2026-10-25 当面商议炼丹与成药交付完成本批：统一人物窗选丹方、看实际费用与现场缺口，由门人按资格、意愿及原承诺答复。正式商议筑基丹后，本人完成四阶段780工步，2099现场成药1、2689实际运抵公库、2690登记交付；医理80→80.6、药理35.1→35.7。缺料/资格/承诺不足与本人不愿分别反馈，远距和隐藏药理禁止商议，重复请求不另开炉；重伤退款和途中中止保留实际投入与实物。共同生活成员的完整人物窗入口已补齐；阅读暂停下进度直接投影实际炉单与运单。根53项不同定向/相邻测试、末次8项投影相关复验、实际Chromium人物窗与七场景11类检查通过；16份散列前后及当前一致，浏览器错误0。按U-172配置初始条件；原生整局、Windows、存读长链及长期平衡未验，完整SR/AC与发布状态保持。

## 开发任务

| 任务 | 工作 | 状态 | 前置 | 责任人 |
| --- | --- | --- | --- | --- |
| SR-XF-029-D01 | 设计补齐：当前版本设计补齐：补齐地域总览、预设项目、迁居和供给状态的逐页交互，保留现有输入原则与设备门槛。 原版本已完成范围和证据保存在 version_history。 | in_progress | 无 | Codex/r35-input-design |
| SR-XF-029-D02 | 契约与内容审阅：在当前版本D01完成后，审阅统一操作流程、窄屏与人物触控与依赖契约的字段、时序、失败及恢复；核对本SR的REQ/AC和GROWTH-10、GROWTH-12。旧版审阅完成事实保存在 version_history。 | todo | SR-XF-029-D01 | Codex/r35-input-design |
| SR-XF-029-I01 | 开发与集成：按当前版本设计在相关模块集成统一操作流程、窄屏与人物触控，接入真实数据、行为、素材、界面和存读。既有实现保留为运行基线；本版本在D02完成后进入集成。 | todo | SR-XF-029-D02 | Codex/courtyard-integration |
| SR-XF-029-V01 | 验收与兼容：执行本SR的AC-01至AC-03及GROWTH-10、GROWTH-12；分别记录正常、失败、存读、网页视口和适用真机证据。 | todo | SR-XF-029-I01 | Codex/courtyard-acceptance |
| SR-XF-029-R01 | 发布与关闭：完成所需源码/运行时发布核对、交接和未覆盖说明；本轮用户不要求上传QA过程产物。 | todo | SR-XF-029-V01 | 待分配 |

SR-XF-029-D01证据：docs/SECT-GROWTH-PLAN.md；docs/design/50-COURTYARD-UI-DESIGN-AUDIT.md；2026-10-15 U-148/R-48：四页及关联入口30项设计审查与7条后续场景；两处物流问题由正常命令复现，运行代码未修，实际UI未验，完整状态保持。

SR-XF-029-I01证据：apps/web/ea-ui.mjs；apps/web/map-input.mjs；apps/web/ea-game.mjs；docs/design/STATUS.md；apps/web/ea.css；apps/web/ea-courtyard-renderer.mjs；docs/design/49-P0-P2-COURTYARD-PROGRESS.md；2026-10-15 U-147/R-47：院务/人物/工位/物资/研习操作、保存失败保护和疗伤收据重放；47/47 Node检查。浏览器内核缺失且官方下载失败，实际UI与桌面未验，完整P0—P2及SR/AC状态保持。；docs/design/59-WEST-FOREST-INTEGRATION.md；tests/acceptance/courtyard-west-desktop.mjs；2026-10-18 U-167西谷GC-17/18/19/24开发中：显式扩谷、固定施工、有限石源、现场种粮及独立分类公库已写入。同源30条公开命令连续营造四处并精确存读，证据/Volumes/Media/immortal-qa/west-valley-prepared-20261018-v2/。阶段美术及完整桌面验收继续；远路邀请已改为有限通勤、到岗后计劳动承诺，旧邀请期限保留，公库口粮纳入实际回运；整项SR/AC状态保持。；2026-10-18 U-167/T-20住宅接续：GC09–12沿固定建位建设，四院一级16实体床；独立床位模块10/10规则检查，含只读旧档、唯一床位、真实到床、途中存读与失效恢复。三院完工及空地母稿已制作，世界位置与升级占地待校准。正式运行接缝、近身有限交易筹资和同源桌面营建入住尚待完成；本条只登记住宅局部准备，不推进完整SR/AC状态。；2026-10-18 U-167/T-19西谷一级批：同一未改正常来源macOS源码Electron连续31/31，墙钟1219.061秒、tick646→10944、7次精确关闭重开、错误0。四址实际运料施工，有限采石18.4及两田实际收获后35.2593256粮搬入新公库，两田各留2种粮。根独立读回来源SHA/最终状态/截图，源码与素材hash随run03封存；完整SR/AC、升级损坏图、供水保鲜、Windows和安装包仍按原范围接续。详见docs/design/60-WEST-VALLEY-INTEGRATION.md。；2026-10-18 U-167/T-20住宅筹资接缝：掌门从公库实际取货到随身，统一人物窗近身买卖、有限库存/本金及实际回款。专项5/5含重试一次结算；macOS源码Electron独立来源连续11/11、两次精确重开、错误0。20石换18灵石，买10粮花10，余8灵石实际入HOME。见61§10；该轨道不代替住宅营建或完整SR/AC验收。；2026-10-18 T-20 housing runtime: 27 scoped checks and 8 related opening/care regressions passed. Existing-hall source Electron UI: select bed, real arrival, shared person/building display, exact reopen: 6/6, errors 0. See docs/design/61-RESIDENTIAL-INTEGRATION.md section 11. Four-house normal construction and full SR/AC acceptance remain in progress.

SR-XF-029-V01证据：tests/unit/web/ea-scene-ui.test.mjs；tests/unit/web/map-input.test.mjs；tests/acceptance/ea-courtyard-rest-render-acceptance.mjs；docs/design/STATUS.md；tests/acceptance/ea-sr-spatial-acceptance.mjs；docs/design/49-P0-P2-COURTYARD-PROGRESS.md；2026-10-15 U-147/R-47：院务/人物/工位/物资/研习操作、保存失败保护和疗伤收据重放；47/47 Node检查。浏览器内核缺失且官方下载失败，实际UI与桌面未验，完整P0—P2及SR/AC状态保持。；docs/design/59-WEST-FOREST-INTEGRATION.md；tests/acceptance/courtyard-west-desktop.mjs；2026-10-18 U-167西谷GC-17/18/19/24开发中：显式扩谷、固定施工、有限石源、现场种粮及独立分类公库已写入。同源30条公开命令连续营造四处并精确存读，证据/Volumes/Media/immortal-qa/west-valley-prepared-20261018-v2/。阶段美术及完整桌面验收继续；远路邀请已改为有限通勤、到岗后计劳动承诺，旧邀请期限保留，公库口粮纳入实际回运；整项SR/AC状态保持。；2026-10-18 U-167/T-20住宅接续：GC09–12沿固定建位建设，四院一级16实体床；独立床位模块10/10规则检查，含只读旧档、唯一床位、真实到床、途中存读与失效恢复。三院完工及空地母稿已制作，世界位置与升级占地待校准。正式运行接缝、近身有限交易筹资和同源桌面营建入住尚待完成；本条只登记住宅局部准备，不推进完整SR/AC状态。；2026-10-18 U-167/T-19西谷一级批：同一未改正常来源macOS源码Electron连续31/31，墙钟1219.061秒、tick646→10944、7次精确关闭重开、错误0。四址实际运料施工，有限采石18.4及两田实际收获后35.2593256粮搬入新公库，两田各留2种粮。根独立读回来源SHA/最终状态/截图，源码与素材hash随run03封存；完整SR/AC、升级损坏图、供水保鲜、Windows和安装包仍按原范围接续。详见docs/design/60-WEST-VALLEY-INTEGRATION.md。；2026-10-18 U-167/T-20住宅筹资接缝：掌门从公库实际取货到随身，统一人物窗近身买卖、有限库存/本金及实际回款。专项5/5含重试一次结算；macOS源码Electron独立来源连续11/11、两次精确重开、错误0。20石换18灵石，买10粮花10，余8灵石实际入HOME。见61§10；该轨道不代替住宅营建或完整SR/AC验收。；2026-10-18 T-20 housing runtime: 27 scoped checks and 8 related opening/care regressions passed. Existing-hall source Electron UI: select bed, real arrival, shared person/building display, exact reopen: 6/6, errors 0. See docs/design/61-RESIDENTIAL-INTEGRATION.md section 11. Four-house normal construction and full SR/AC acceptance remain in progress.

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

- docs/requirements/design/SR-XF-029-INPUT-FLOW.md
- docs/requirements/design/SR-XF-029-032-034.md
- docs/art/combat-field-study-20261025/README.md
- docs/art/combat-motion-study-20261025/README.md
- 2026-10-25 U-171最新接续：用户认可整体美术方向并授权校准后制作帧动画，非新尺度/动作/实机验收。40逻辑像素/米同网格静态图人101px/兽164px，主Agent审看可继续，用户新比例未评；阴影及原生像素密度一致性未验。跑步v1–v3均未通过，停止生成；白底/HTML/100ms诊断GIF保留，未完成连续播放或实机验收。仅离线局部证据，运行素材registry与全部D/I/V/R、AC及任务状态保持。
- 2026-10-25 U-171静态美术候选：网站真实global prompt起步，三次内置image_gen生成/定向修订后展示1536×1024第三稿，主Agent已审图、用户评看待定；人物超过108px预算、严格像素网格未验，22米精确比例未锁定。原LPC人物、通用兽人及重复草地成品已被用户否决，原包和运行引用保留。本批仅静态构图与来源记录，无动作库、运行替换、性能或游戏存档操作；D/I/V/R与全部AC状态保持，详见73。
- docs/requirements/IMPLEMENTATION-2026-10-06.md
- docs/design/03-SPATIAL-ART.md
- docs/design/STATUS.md
- apps/web/ea-ui.mjs
- apps/web/map-input.mjs
- apps/web/ea-game.mjs
- tests/unit/web/ea-scene-ui.test.mjs
- tests/unit/web/map-input.test.mjs
- tests/acceptance/ea-courtyard-rest-render-acceptance.mjs
- docs/CODEX-HANDOFF.md
- apps/web/ea.css
- apps/web/ea-courtyard-renderer.mjs
- tests/acceptance/ea-sr-spatial-acceptance.mjs
- docs/art/REALTIME-TRIAL-2026-10-09.md
- archive/godot/art/art_courtyard.gd
- archive/godot/art/actor_3d.gd
- archive/godot/tools/build-art-web.py
- docs/art/PAINTED-COURTYARD-2026-10-09.md
- docs/SECT-GROWTH-PLAN.md；2026-10-09 山域总图、五阶段迁移及统一原型的设计来源；当前运行验收待补。
- docs/design/STATUS.md；2026-10-10 U-109 旧别院 3D 本地预览局部网页证据；完整 AC 状态不变。
- docs/art/system-ui-20261012/README.md
- docs/art/system-ui-20261012/RUNTIME.md
- tests/unit/web/ea-system-ui-projection.test.mjs
- 2026-10-12 U-120：共同大窗口、七导航、真实门人／掌门／行囊已接入；本地 1440×960 实点导航、详情、邀约、换装、搬运、存读与定位。820×1180 行囊可滚动至取物操作，按钮在窗口内、页面无横向溢出，并实点服丹。任务目标延迟已修正；增量更新保留按钮及滚动。目标真机、用户对接入画面评看及完整 SR/AC 状态保持。
- docs/art/COURTYARD-VALLEY-2026-10-12.md
- tests/unit/web/ea-mountain-alchemy.test.mjs
- tests/unit/web/ea-mountain-valley.test.mjs
- 2026-10-12 U-123 发布核验：运行源码 main 836ccb605a42e7c21c2aae8c5e2c4eee7e55c03e；gh-pages 4d6786da521f1ab92818c20f67c036a829469e6e；GitHub API Pages build=built。公开 mountain-courtyard 的14个交付文件（release/build/index、界面与加载模块、桥接及世界／战斗规则、三片场景包）HTTP 200，SHA与本地导出一致。公开浏览器百艺、导档、实际行走旅行与采集的操作证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；本记录仅是U-123局部发布证据，整项 D/I/V/R 与 AC 状态不变。
- 2026-10-12 U-125：42 人物交谈及关联契约定义统一立绘聊天窗、身份叠加、知情、距离、意愿、暂停和持久规则；DIALOGUE-01–10 为 not_run。本批为设计与静态原型，运行接入及完整 SR/AC 状态保持。
- docs/art/OPENING-CHAIN-2026-10-12.md；2026-10-12 U-124：1440×960本地Chromium通过当前已实现界面走完整条开局；U-125人物窗仍仅为设计。 仅增局部证据，完整 SR/AC 状态保持。
- docs/art/OPENING-GUIDANCE-2026-10-13.md；2026-10-13 U-124：首炉至返院目标与丹房携药/缺料入口在1440×960实际网页验证。 仅增局部证据，完整 SR/AC 状态保持。
- docs/art/mountain-flat-20261013/README.md; U-126 flat-color art direction confirmed; prototype review pending, runtime art not implemented. SR/AC states unchanged.
- docs/art/mountain-flat-20261013/RUNTIME.md；2026-10-13 U-126：平涂场景、建筑作物阶段及人物接入同一模拟，局部 Godot 与实际网页验证；完整 SR/AC、目标真机与用户美术评看状态保持。
- docs/art/desktop-style-review-20261013/README.md；2026-10-13 U-127/U-128：五种画风、战场总览及交战近景共七张静态原型待用户审核；桌面交付方向为Windows主力、macOS先验证。仅设计与原型证据，桌面迁移及新战斗未实施。
- 2026-10-13 U-129/U-130：独立 Three.js/Electron 双画风自动样板用于空间、人物与特效评看；范围及实际证据见 docs/art/DESKTOP-RUNTIME-SAMPLES-2026-10-13.md。正式玩法、Windows 与完整 SR/AC 状态保持。
- 2026-10-13 U-131：Blender / Three.js 独立 D 主殿山院制作样板，固定机位实际图与剩余视觉差距见 docs/art/reference-reconstruction-20261013/README.md。本批仅提供局部模型与呈现证据，用户视觉认可、完整 SR/AC、正式迁移与 Windows 继续待验。
- 2026-10-14 U-132: local asset design sheets, editable Blender models and Three.js/Electron multi-view gallery. Evidence and visual limitations: docs/art/asset-review-20261013/README.md. Full SR/AC, game integration, visual approval and Windows remain separate.
- 2026-10-14 U-132 人物接续：正侧背设计稿、头部细节参照和可编辑 Blender / GLB 衣装样件；局部实际渲染与桌面检查见 docs/art/asset-review-20261013/character-study-v2.md。美术认可、正式游戏接入、多人性能与 Windows 待验；完整 SR/AC 状态保持。
- 2026-10-14 U-133: pure 2D HD pixel art direction confirmed; courtyard battle and character/effects static concepts generated. Evidence: docs/art/hd-pixel-20261014/README.md. User art review, desktop 2D runtime, animation and crowd performance remain pending; full SR/AC states unchanged.
- 2026-10-14 U-134：纯 2D 高清像素独立桌面场景，macOS 可见窗口 1600×900 实际行走、石灯前后遮挡、三类技能与冷却、16 人样例及暂停／重播，组件 6／6、自动 10／10、运行错误 0；打包应用已实际操作行走、缩放、暂停、护阵与重播。局部证据见 docs/art/hd-pixel-20261014/RUNTIME.md。正式模拟与存档未接入，完整大地图、Windows 和用户美术认可另验；D/I/V/R 与 AC 状态保持。
- 2026-10-14 U-135 / R-41 / T-14：用户认可 U-134 高清像素实机并要求保持设计，以目标模式接续独立桌面演武。整数 100 毫秒步与前台计时复用接入独立演武；暂停预排不扣费、暂停冻结、恢复执行、飞行阶段读档后命中仅一次已验证。原生活动记录在 tick 129、266 失焦／恢复均保持同一步，隐藏期间完整快照哈希不变，回前台无补时。局部证据见 docs/art/hd-pixel-20261014/ARENA-RUNTIME.md；最终记录 /Volumes/Media/immortal-qa/pixel-arena-20261014/ 下 final-run-3/metrics.json、restart-final/ 与 native-final/。源码与素材随本批源码检查点保存；正式规则完整移植、大地图、正式人物与存档、Windows 和完整 SR/AC 另验，D/I/V/R 与 AC 状态保持。
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
- apps/courtyard/sect-combat.mjs
- apps/courtyard/courtyard-combat.mjs
- tests/unit/courtyard/courtyard-combat-direct-controls.test.mjs
- tests/acceptance/courtyard-combat-direct-desktop.mjs
- assets/courtyard/valley-battlefield-v1.provenance.json
- assets/courtyard/valley-shanxiao-actions-v1.provenance.json
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
- docs/design/79-DISCIPLE-WORK-SPECIALIZATION.md
- 2026-10-25 门人生产专长已参与v1自主择业，最多12分软偏好；按U-172配置场景，正式世界步646→910验证不同专长择业、真实工位生产、两人对应技能80→80.6及下一次决策。同种子只交换技能，岗位随之互换。实际浏览器组件近身理由、远处保密和只读通过；修复v2日程字段过滤接缝。此为针对性模拟与组件证据，完整SR/AC及发布状态保持。
- docs/design/80-EXPEDITION-RECOVERY.md
- 2026-10-25 历练归来恢复已接入：真实归院伤势大于5时保留养伤意图，有药按既有规则耗草，缺药自然调养，恢复后回到日常自主决策；健康同伴按现有供给与意愿接活。按U-172配置三场景验证归库、真实床位恢复及生产补位，饥饿可优先解决而保留恢复意图。完整SR/AC与发布状态保持。
- docs/design/81-DISCIPLE-ONBOARDING.md
- 2026-10-25 新门人安置与首次贡献针对性验证：普通求见工厂生成同一身份，正式收录提交唯一门籍与具体待入住床，本人实际到床才登记入住，随后自主到生产工位贡献并取得对应技艺成长。缺床/缺粮拒绝不改世界，本人拒绝及重复收录保持边界。现有产品逻辑成立，本批增加可复用夹具和专项场景；完整SR/AC与发布状态保持。
- docs/design/82-EXPEDITION-PURPOSE.md
- 2026-10-25 门人自主历练目的已接入：根据公库缺口、本人志向和本人既往风险见闻选择采药补给或探索修行。定向场景验证采6草返院与实际到点观察60步分别结算8经验；遇险未完成及新采药空药丛不发完成经验。新增及独立边界9/9、归院恢复回归7/7、三场景9项及实际浏览器组件通过。相邻19项18通过，唯一5.3米近身受伤断言在入口同样失败，保留待修。完整SR/AC及发布状态保持。
- docs/design/83-ENCOUNTER-DISTANCE.md
- 2026-10-25 历练距离修复完成：近身伤害恢复原3米，感知6米，应战交互9米各自独立。默认怪位置下正式探索在6米发现后撤退，1279步归院伤0；配置2米接触的行程实际伤10，589步归院后保留养伤意图。两场景7项、根距离10/10、目的与恢复16/16、原历练回归7/7通过。82记录的5.3米旧失败已修复；历史结果保持，完整SR/AC及发布状态保持。
- docs/design/84-EXPEDITION-MEDICINE.md
- 2026-10-25 历练备药至恢复经营闭环完成：实际到公库按许可领一份回春散，个人随身药优先；受伤后退到安全处停20世界步服药，沿原路归院，未用公药实际归还。四场景均到真实工位产生新生产贡献：有药伤10→0；缺药/无许可归院伤10，实际到床恢复至4.9后返工；平安未用归库1。根新增及相邻39/39、四场景11类检查和实际浏览器组件通过；私药、每日限制、死亡、取消及旧行程兼容独立核验。完整SR/AC与发布状态保持。
- docs/design/85-MEDICINE-SUPPLY.md
- 2026-10-25 回春散供给闭环完成本批开发与针对性验收：正式院务设置0–10份公库目标，门人自愿搬运有限原料、完成四阶段280工步、成药实际归库，达标停产。场景陆知微耗10草/2水/1木及10灵石炼2份，tick2207归库；林长风2374领1份、2823安全处服药伤10→0、3103归院，公库余1。缺水实际补运后恢复、无人愿意、既有在制、防重复、关闭保留投入等通过。根61项单测，最后提示优先级修正后6项边界复验，四场景10类检查及实际浏览器组件通过，14文件散列一致、错误0。按U-172配置场景，未做原生整局或存读；完整SR/AC及发布状态保持。
- docs/design/86-MEDICINE-MATERIALS.md
- 2026-10-25 药物材料自主筹备与口粮保障完成本批：缺草/水通过既有生产候选、真实工位和运输补足；普通灵泉新增显式取洁水/凝灵晶选择，未完批次拒切。足粮场景从零公共草水经取水、种采、搬运、四阶段炼制，于4624公库入药2；低粮场景初始5粮，722实运30粮至35，727才开始药物任务，4909药2/粮41，全程饥荒0。缺人和旧承诺100步保持；61项独立定向/相邻单测、最终四场景10类检查、实际Chrome管理组件6类检查通过。修复首次洁水入库缺省键与种粮压过运粮的实际问题，原失败保留；最终场景14份/组件5份散列前后一致并匹配当前源码，错误为空。按U-172配置设施和初始物资，未做建井长链、原生整局、存读及长期供需平衡；完整SR/AC和发布状态保持。
- 2026-10-25 药师实操成长与供给接续完成本批：实际完工唯一增加医理，已学药理通过实操加深；场景34.5→35.1达到原资格后真实炼成筑基丹1份。伤停、真实外出、半炉中断三种替补均另起自愿炉单并实际归库2药；半炉0.5草损耗及余料退款保持。修复替补赴炉与伤者返床的真实窄路互堵，退让不计工时。根69项不同定向/相邻单测、四场景11类检查、实际Chrome组件6类及原培养DOM1项通过；最终16份场景/7份组件散列一致，失败报告保留。自动储备仍为回春散；按U-172配置初始条件，原生整局、Windows、存读长链与长期平衡未验，完整SR/AC及发布状态保持。 证据：/Users/shepard/.codex/tmp/immortal-pharmacist-development-20261025/scenario-03/report.json；/Users/shepard/.codex/tmp/immortal-pharmacist-development-20261025/panel-06/report.json。
- 2026-10-25 三至五人并行经营完成本批：3/5名门人另加掌门，同钟生产、修行与历练均有实际进度；各跨三次日结，每日分别8/12粮，全程饥荒0。两档均炼2药于2168归库，三人实运11粮后余35；五人两次真实伤10→0服药并归院、本人返工，实运13粮后余23，药物总账1+2−2=1。修复未完功课和有效承诺被出游抢占，以及承诺到期先续约导致无法出游；既有夜休/恢复/突破优先。根61项定向及相邻单测、独立6项复核、最终两场景11类检查通过，17份散列前后及当前一致，工程检查通过。初始住宅非法入口和验收器遗漏夜休条件的失败报告保留；按U-172配置场景，原生整局、Windows、存读长链及长期平衡未验，完整SR/AC及发布状态保持。 证据：/Users/shepard/.codex/tmp/immortal-sect-concurrency-20261025/scenario-04/report.json。
- 2026-10-25 当面商议炼丹与成药交付完成本批：统一人物窗选丹方、看实际费用与现场缺口，由门人按资格、意愿及原承诺答复。正式商议筑基丹后，本人完成四阶段780工步，2099现场成药1、2689实际运抵公库、2690登记交付；医理80→80.6、药理35.1→35.7。缺料/资格/承诺不足与本人不愿分别反馈，远距和隐藏药理禁止商议，重复请求不另开炉；重伤退款和途中中止保留实际投入与实物。共同生活成员的完整人物窗入口已补齐；阅读暂停下进度直接投影实际炉单与运单。根53项不同定向/相邻测试、末次8项投影相关复验、实际Chromium人物窗与七场景11类检查通过；16份散列前后及当前一致，浏览器错误0。按U-172配置初始条件；原生整局、Windows、存读长链及长期平衡未验，完整SR/AC与发布状态保持。 证据：/Users/shepard/.codex/tmp/immortal-disciple-craft-request-20261025/scenario-05/report.json。
- 2026-10-26 门人进阶需求与自主筑基完成本批：人物窗从缺丹需求导航到同门并预选筑基丹，正式自愿炼制780工步，2692本人运药归公库；另一门人2750自主取丹、2772收入随身，2780开启突破，2825实际炼化、2975完成180工步升至筑基，3150本人再参与生产并按贡献成长。近身和远取统一公药许可，保本人私药、旧承诺与实际身体；唯一丹竞争、满袋拒绝、炼化前后取消及执事继续成长通过。根77项不同定向/相邻单测、六场景12类检查及实际Chromium人物窗组件通过；main选中/走近薄接缝受控执行核验，16份散列前后与当前一致，13完整快照、6截图，浏览器错误0。主Agent发现首轮旧缺丹提示与在途冲突后修正，最终scenario-02通过，旧记录保留。按U-172配置初始条件；原生整局、Windows、存读长链和长期平衡未验，完整SR/AC与发布状态保持。 证据：/Users/shepard/.codex/tmp/immortal-disciple-advancement-20261025/scenario-02/report.json。
- 2026-10-26 历练收获反哺成长完成本批：真实采6草于1729归库，当面筹备一炉并保留本人旧承诺，2545实运材料到丹房，3428完成原四阶段780工步，4020成药归库，林长风4112收入随身、4120开始突破、4310完成180工步升至筑基。掌门正式搬40木腾库后，5080本人实际参与生产，贡献90%、百工增长0.54；灵草总账119+6−75−50=0。筹备可撤回，已接运输保留；修复休息续约饿死取丹机会、交库容量/产权检查及运输提示滞后。根116项定向/相邻测试、最终投影14项复验、三场景9项检查和实际Chromium人物窗组件通过；23源码散列一致、14完整快照、6截图及独立复核通过。按U-172配置初始条件；原生整局、Windows、存读长链与长期平衡未验，完整SR/AC及发布状态保持。 证据：/Users/shepard/.codex/tmp/immortal-expedition-growth-20261026/scenario-04/report.json；/Users/shepard/.codex/tmp/immortal-expedition-growth-20261026/final-independent-audit.json。
- 2026-10-26 门人结伴历练完成本批：院务开放结伴机会，近身且同目的的两位门人分别自愿，至少一人留守；各自准备2粮8精力、独立身体与药囊。平安场景1925双人归院，各得8经验并各退1药，2400共同生产木21.384；遇险两人各伤10，陆知微1139–1158实际安全服唯一药，林长风等候19步，1424/1427分别归院，林1470到床养伤，陆1730产木、林1860产水。近距提醒与亲见分开；拒绝、失散120步独自返、死亡不复活及临时交接不可达恢复通过。修复两人公库互堵、观察脚点及返回入口接缝。主Agent54项定向/相邻测试、最终三场景12项检查通过，19源码散列一致、32完整快照、5实际Chromium组件截图，错误0。谷口有0.04米短暂交叉，通用身体净距未验；原生整局、Windows、存读长链及长期平衡未验，完整SR/AC与发布状态保持。 证据：/Users/shepard/.codex/tmp/immortal-expedition-companions-20261026/scenario-02/report.json。
- 2026-10-26 五人结伴与留守经营完成本批：谷口交叉中心距0.04→0.54米，补有限绕行和落点占位；修复有收获却持续种粮压过运粮。五门人两出三留，平安/遇险各四次日结供给成立，缺粮拒发、满库等待与正式腾库、唯一药、床休和双方返工通过。主树100项不同定向/相邻测试通过，最终经营4项重跑通过；独立复核及两轮macOS源码Electron7/8项检查通过、错误0。原生固定HEAD加本批代码，非全部并行改动集成。整轮仍见513/593ms长任务，归院后45秒静默最大帧间隔35.1ms且无长任务；性能根因、Windows、存读长链与长期平衡待验。完整SR/AC及发布状态保持。 docs/design/93-COMPANION-OPERATIONS.md
- 2026-10-26 结伴经营响应优化完成本批：原生506ms长任务定位为留守门人工位寻路中的静态身体地面查询，新增保守内部单元证明并保留边界原判定。同初始档/视口/采样平安最大rAF间隔508.1→95.2ms、长任务506→90ms；p95与点击未改善，遇险最大109.3ms/长任务108ms。独立1168427点及1000路线零差异；两场景合计10000步完整状态、200份完整view一致。14项定向全过，相邻52项51过1项基线同样失败。两轮原生7/8项通过，QA档重开载入与关闭保存完整状态相等。剩余路径90–108ms、院务打开57ms、旧北路恢复失败保留；完整SR/AC及发布保持。 docs/design/94-EXPEDITION-RESPONSE.md
- docs/art/combat-sword-study-integration-20261026/README.md
- docs/design/73-COMBAT-FRAME-PRODUCTION.md
- 2026-10-27 持剑单人战斗正式接入取得局部证据：新建单人山谷启用sword-study-v1，WASD/鼠标、移动剑气、已学剑法Q锁点重击、胜败确认与返院沿正式模拟；旧无标记战斗保持原规则。本批新增专项46项通过（规则11/音频13/插值7/呈现9/公开命令6）；旧冻结版四场26项功能检查通过，最终移动03有19帧左右跑及出手后回跑诊断。长档120人/5后台活动原生265430→265471，Q因未学剑正式拒绝且不扣气；源/运行散列与关闭均一致。精确坐标缓存同源冷步219.23→143.05ms、热2.48→2.34ms，完整状态字节一致；原生该步仍127.1ms、活动帧间隔125ms、Tab264.1ms，另有Node158ms慢步。旧失败/限定记录保留，完整动作、流畅度、听感、Windows与完整SR/AC及发布状态保持开放。
- 2026-10-27 地面查询与院务响应完成本批：精确坐标缓存及走廊预筛、单次面板渲染复用检查投影。同档暂停院务中位16.3→5.55ms、人物8.45→3.7ms，12份文本及完整世界相同；原生跨日食粮39→27即时刷新、人物筛选与保存读回通过。两轮经营分别7项、8项均通过，最大帧间隔89.1/80.2ms，仍有88/78ms路径长任务。独立几何626693查询零差异，10000步完整状态及200份view相同。定向15/15、相邻49/50，旧北路恢复失败保留；完整SR/AC与发布保持。 docs/design/95-GROUND-PANEL-RESPONSE.md
- 2026-10-27 六小时目标执行中：北路施工运料旧档200步停滞定位为恢复许可漏接正式施工材料流；补齐身份/订单/预留/目标验证后11步实际恢复，最大单步0.3168米，取消实际返料及无效许可边界通过，定向相邻37/37。原生与三轮性能对照待做，完整SR/AC状态保持。 docs/design/96-NORTH-RECOVERY-PATH-RESPONSE.md
- docs/art/combat-response-goal-20261027/README.md；2026-10-27 六小时响应目标执行中：真实长档90秒原120人身份保留，正常求师事件新增1人至121，5后台活动持续。各类按键处理p95低于50ms且无超过100ms处理；活动rAF p95为6.1ms但最大300ms、世界步151.8ms，性能目标未通过。long-sustained-01保留failed，固定人数断言与正常求师新增不匹配；normal/defeat/retreat原生12/5/6项通过。最后恢复收步补丁37项相关回归及resume-01原生两项通过；完整SR/AC状态保持。
- docs/art/combat-response-goal-20261027/README.md；2026-10-27 后续长档原生long-lean-01实际90.0529秒/900步：原120身份与5后台活动持续，正常求师新增至121通过；94次输入边沿处理p95为34.9ms、最大40.1ms。活动rAF p95为6.1ms、最大140.7ms，回调最大144.4ms、世界步142.8ms、观察器最大0.5ms，性能门槛仍未通过；long-sustained-01原failed保留，完整SR/AC状态保持。
- docs/art/combat-response-goal-20261027/README.md；2026-10-27 当前ground为3f3d AABB版：20项相关测试、14,519点及900正式步完整世界/路径等价通过；long-aabb-01无注入90.0766秒/901tick，94输入边沿p95 37.6ms/最大42.2ms，rAF p95 6.1ms/最大135ms、回调143.2ms、世界步138.6ms，仍未达100ms尖峰目标。positive候选21项/30,314点/900步等价，但原生世界步135.8ms无明确收益，已仅撤回该试验；旧failed与试验报告保留，完整SR/AC状态保持。
- docs/art/combat-response-goal-20261027/README.md；2026-10-27 最终final-long-lean-01同冻结runtime无注入90.019秒/900tick，120原身份及5后台活动保持，17,728前台active帧无失焦。94输入边沿p95 35.2ms/最大40.5ms，活动rAF p95 6.1ms/最大124.9ms、实际回调133.1ms、世界步132.1ms仍在266160，观察器0.6ms/绘制2.8ms；100ms尖峰门槛未通过。局部产品31项及900步完整状态/路径逐字等价、根独立4项与cmp通过；当前domain022bdc/spatialcb8538/ground3f3d，旧failed及试验报告保留，完整SR/AC状态保持。
- docs/art/combat-response-goal-20261027/README.md；2026-10-27 astar-cost-lean-01在spatial cd477bf1版本无注入90.084秒/901tick，94输入边沿p95 37.1ms/最大42.5ms，rAF p95 6.0ms/最大109.6ms、实际回调118.8ms、世界步112.8ms仍在266160，观察器0.5ms/绘制2.3ms。17,709前台active帧无失焦，原120身份/5后台保留；窗口正常关闭、源档/运行散列保持。a-star-cost-gate的31项/7场景及900步完整状态/路径等价成立；五场功能视觉证据属于此前cb8538版本，100ms尖峰目标及完整SR/AC仍未通过。
- docs/art/combat-response-goal-20261027/README.md；2026-10-27 final-freeze-02/long-lean-01在完整cd477冻结版本无注入90.026秒/900tick，94输入边沿p95 35.7ms/最大38.9ms（Tab最大38.9ms）；rAF p95 6.1ms/最大114.7ms、实际回调121.8ms、世界步117.1ms仍在266160，观察器0.6ms/绘制2.7ms。17,704前台active帧无失焦，原120身份与5后台保留、正常求师新增成立；窗口/源/运行及落盘state核对通过。补充startup七项/resume两项同runtime检查：普通起步/反向首位移4.3–10.4ms、自由移动脚点平台0；失焦10ms与碰墙186.1ms平台单列。恢复回拉/站姿滑均0。本轮100ms尖峰目标仍未通过，完整SR/AC状态保持。
- docs/art/combat-response-goal-20261027/README.md；2026-10-27 c95版同120原人物/5后台、1672×941 DPR1/22米场景无profile/注入两轮长档：90.101秒与90.056秒，均901tick/94输入；输入p95/最大35.7/40.7ms与37.8/44.3ms。rAF p95/最大6.0/90.1ms与6.1/91.0ms，实际回调96.4/98.2ms，世界步94.4/93.2ms，观察器均0.5ms、绘制14.4/12.6ms。两轮原性能门在该场景通过，最大回调仅余1.8ms裕量；原120身份/5后台及正常新增121来源核对成立，五场同runtime/落盘state相等。此为限定场景证据，全场景流畅、Windows及完整SR/AC保持开放；旧failed/observed保留。

- 2026-10-06：由v1.2设计缺口审计建立SR；新增内容和参数遵循作者默认，不冒充用户逐项确认。
- 2026-10-06：用户授权目标模式、多agent并行开发与验收；启动D01，按现有契约展开模块设计，未将建档或局部实现标作交付。
- 2026-10-06：U-95明确画布只适配iPadOS/Windows/macOS网页分辨率；必需验收平台改为iPad横竖与桌面窗口/DPR，浏览器视口与实机证据分列。
- 2026-10-06：U-96/U-97将经营成长和同场可交互美术置于优先；按R-27消费已有米制/单时钟/存档契约实现局部模块，D/I/V/R完整门槛仍未关闭。本轮验证及发布待主集成回填，不更改旧AC事实。
- 2026-10-06：回填主集成/独立验收确认的本轮组件和正常公开命令旧档结果；保留浏览器不可用、床体过短、混合画风的视觉缺口；闭屋后墙及两类田地已修复，并经最终Canvas快照静态读图复核。上述局部通过不提升SR整体状态，gh-pages可试玩开发版已成功部署，本轮源码main待确认；完整SR门槛仍未通过。
- 2026-10-07：U-100固定2.5D、旧云岫人物/建筑资源接回正式U-99主线；R-29山院扩96米，旧64档先校验仅登记extentVersion。人物6/6、扩图9/9、单位格6/6与正常公开链局部通过，真实网页/发布另记STATUS；完整SR保持in_progress，不冒称全动画或全体验完成。
- 2026-10-07：成人家具与现场交互本地批次：建筑侧卡按预制件显示床位、作业位、研习位及当前占用；现场及重叠人物使用同身份头像入口。pointerup补验移动距离，拖动放开保持拖动语义；推荐营造确认消费正式返回字段。 已登记适用实现与独立复验证据，整体开发/验收保持in_progress，AC状态沿用已有范围。 推荐营造按钮的指针离开布局变化已修复并由实际鼠标复验。
- 2026-10-07：M0/M1 接续批完成局部设计、修复和独立复核；具体通过范围与缺口见 acceptance_notes 和 STATUS。整项 D/I/V/R 及 AC 状态保持原门槛。
- 2026-10-08：SR-XF-029-D01：鼠标/触控语义、八页主目标至恢复、三平台布局和低动态实施参数已写入统一输入流程设计。
- 2026-10-08：SR-XF-029-D02：对照 SR003/004/005/007、05/06 逐项核对字段、时序、失败恢复和 029-REQ/AC；设计契约可用于 I01，实际网页与设备仍待验收。
- 2026-10-08：SR-XF-029 D01/D02 细化开局结缘的赠药、暂居与正式入宗三次独立确认；新流程本人拒绝单独留痕，旧档 declined 保留掌门让陆知微回家照应家人的选择与赠药善缘；OPEN-04/REQ-02 步骤可核对。设计 ready，运行实现与设备验收状态不变。
- 2026-10-09：M1 r37 局部实现实际 DPR 位图与窄屏帮助入口；本地与公开浏览器定向验证单独登记，不提升 SR029 整项或三条 AC。
- 2026-10-09：U-103：用户批准真实Godot 3D美术小院，一栋主殿、山石道路、两名人物已在本地WebKit实机运行，基础点选/行走/入殿后劳动/暂停/刷新及三个DPR1视口取得局部证据，独立Godot复核暂停骨骼和隐藏人物点选修复。地表/岩石/屋瓦质感仍有差距，用户实机美术确认、目标设备及正式玩法集成待完成。证据详见 docs/art/REALTIME-TRIAL-2026-10-09.md；本批未发布，完整AC及D/I/V/R状态保持。
- 2026-10-09：U-104：用户明确停止3D模型路线以控制制作工作量和网页性能预算。保留U-103试验工程及历史证据；Godot/Web方向保持，Godot 2D绘画素材与二维动画候选方案待确认。此次只同步约束，运行代码及完整SR/AC状态不变。
- 2026-10-09：U-104用户确认Godot 2D制作；绘画小院本地构建与WebKit鼠标操作、三视口DPR1局部复核完成。暂停出殿/双指锚点/拖动输入修复，最终拖动实点通过；人物辨识、动作观感、用户美术认可、殿后完整浏览器遮挡、真机/DPR2/真实触摸继续。正式SR/AC状态保持，未发布。证据 docs/art/PAINTED-COURTYARD-2026-10-09.md。
- 2026-10-09：2026-10-09 U-105 / R-32：当前需求更新为 1.2，山域设计关联 GROWTH-10、GROWTH-12。旧版 1.1 的标题、需求、AC原文/证据及D/I任务完成范围保存在 registry.json 的 version_history；本SR未重置任何已通过AC。 当前D01继续补实施参数，D02及本版本I01待前置完成；development_status保留既有运行实现基线。未改变的已通过AC只沿用原行为及原运行环境证据，新增地域、布局与迁移流程按GROWTH另验。本批未执行运行时验收，未修改正式运行版本或发布状态。
- 2026-10-10：U-109 第一批本地预览：旧别院本地 3D 预览已在桌面和横竖浏览器视口检查建筑与地块选择；目标设备触摸未验。此为局部证据，不提升完整 AC/SR 状态。
- 2026-10-12：U-120 用户认可系统界面原型并要求推送。归档九个入口、字体与窗框素材，以及示例交互的浏览器检查；正式模拟、存读与目标设备接入继续，完整状态保持。
- 2026-10-12：2026-10-12 U-120：共同大窗口、七导航、真实门人／掌门／行囊已接入；本地 1440×960 实点导航、详情、邀约、换装、搬运、存读与定位。820×1180 行囊可滚动至取物操作，按钮在窗口内、页面无横向溢出，并实点服丹。任务目标延迟已修正；增量更新保留按钮及滚动。目标真机、用户对接入画面评看及完整 SR/AC 状态保持。
- 2026-10-12：2026-10-12 U-123：百艺桌面1200×855及窄屏820×1180已实点第一炉；山外1440×960实走谷内互动及送库按钮禁重复。首战 UI 与目标设备继续核验。 局部证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。
- 2026-10-12：2026-10-12 U-123 首战本地网页：最终本地战斗网页1440×960及820×1180已目视，字体完整、无横向溢出；攻击／护持／闪避／撤退及战斗页存档按钮实点，控制台0 error。目标设备与完整输入 AC 状态保持。 证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。
- 2026-10-12：2026-10-12 U-123 发布核验：运行源码 main 836ccb605a42e7c21c2aae8c5e2c4eee7e55c03e；gh-pages 4d6786da521f1ab92818c20f67c036a829469e6e；GitHub API Pages build=built。公开 mountain-courtyard 的14个交付文件（release/build/index、界面与加载模块、桥接及世界／战斗规则、三片场景包）HTTP 200，SHA与本地导出一致。公开浏览器百艺、导档、实际行走旅行与采集的操作证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；本记录仅是U-123局部发布证据，整项 D/I/V/R 与 AC 状态不变。
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
- 2026-10-23：2026-10-23 本轮战斗采用独立林间战场：WASD持续走位，鼠标落点／方向配合1／2／3技能与Space短步，自动攻击仅执行射程内普通攻击，走位和技能由玩家操作。真实投射物碰撞后结算；暂停、模态与原生失焦清输入，后台世界规则保持。本轮直接相关规则28/28及主Agent工程检查通过；正常开局Node术法与自动普攻两条胜利链均只有一次结算，身体释放并恢复谷内行走。macOS源码Electron分段完成移动、原生失焦及后续技能操作：direct-run-01前8项局部通过、direct-run-03原生失焦清键且后台续进5步、direct-run-04后续9项通过（834→972、24.511037秒、错误0）；各段失败与两处界面修复分别保留，不拼作一次连续通过。新控制下的存档、旧档入口与返院复验暂缓。run-04按钮／存读链按历史版本保留。主Agent独立目视最终投射物／护持及此前探索截图，构图、空地脚点、敌预警与技能栏可辨，八个主战斗源码SHA与最终冻结一致；新素材用户美术评看与完整SR/AC另计。
- 2026-10-23：2026-10-23 GC15一级客院已接入：两张独立客床、当面自愿邀请、实际步行入住、原来访期限退房下山及原生存读。macOS源码Electron有限夹具入住ui-fixture-03通过7项（1656→3851、235.557720083秒），施工build-fixture-01通过3项（646→1700、114.379689209秒）；唯一工单3投入45灵石/40木/20石，两趟实际送达后于1683完成200施工步。两段错误0，来源、运行文件与原生重开均一致。GPT-6.1-sol独立读回6个原生检查点及12个核心源码通过。正常世界仍保留医庐tick261253原档；该世界的筹资建设、Windows和完整SR/AC保持待验。 详见docs/design/71-GUESTHOUSE-INTEGRATION.md。
- 2026-10-25：登记正常供给与门人自主突破的局部实现/原生证据；保持整项与AC状态。
- 2026-10-25：登记人物走近后台规划、原生实际通行和响应测量的局部证据，200ms目标未全部通过，整项与AC状态保持。
- 2026-10-25：登记历练自主目的、实际采药/观察结果及局部证据；保留既有接触半径失败和整项状态。
- 2026-10-25：登记历练距离修复及安全/受伤归院局部证据，完整SR/AC状态保持。
- 2026-10-25：登记历练实体携药/使用/归还与恢复生产闭环证据，完整SR/AC状态保持。
- 2026-10-25：登记回春散库存目标、实体备料、自主四阶段炼制、归库及历练实用证据，完整SR/AC状态保持。
- 2026-10-25：登记材料自主生产/运输、显式灵泉工序及粮食优先整链，完整SR/AC状态保持。
- 2026-10-25：登记真实炼药成长、原进阶资格、伤停外出补位及初次赴炉通勤修复；完整SR/AC状态保持。
- 2026-10-25：登记三/五人并行经营、粮药实际收支与承诺到期接缝；完整SR/AC状态保持。
- 2026-10-25：登记当面自愿炼丹、完整人物窗入口及本人实运交付；完整SR/AC状态保持。
- 2026-10-26：登记进阶需求、同门商议、实际取丹与原阶段自主突破后恢复经营；完整SR/AC状态保持。
- 2026-10-26：登记历练实采、单炉筹备、真实交付、自主筑基及返工针对性验证；完整SR/AC状态保持。
- 2026-10-26：登记门人自主结伴、近距协作、逐人用药/死亡/返院恢复及生产针对性验证；完整SR/AC状态保持。

本文件由[registry.json](../registry.json)派生；更新台账后执行 `python scripts/requirements/sr-manager.py refresh`，不单独修改此派生页。
