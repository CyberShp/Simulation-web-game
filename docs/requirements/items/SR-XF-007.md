# SR-XF-007 · 稳定人物外观、肖像与活动动作

来源：DB-2026-10-05 v1.2；需求版本：1.0；建档日期：2026-10-06。

| 字段 | 值 |
| --- | --- |
| 范围 / 模块 | 前期必需 / 人物 |
| 优先级 / 计划 | P0 / I1 |
| 设计 / 开发 | ready / in_progress |
| 验收 / 发布 | in_progress / not_released_for_this_sr |
| 责任人 / 复核人 | Codex/economy_people / Codex/root（集成） |

## 来源、依赖与范围

纳入云岫前期，按依赖推进。

决策来源：U-63, U-93, R-25, U-94, U-96, U-97, R-27, U-100, R-29, R-30, U-101, U-102, U-103, U-104, U-118, U-120, U-125, U-126, U-127, U-128, U-129, U-130, U-131, U-132, U-138, U-142, U-143, U-144, U-149, R-49, U-150, R-50, U-155, U-157, U-158, R-51, T-17, U-159, U-160, U-161, U-162。这是继承的U项和作者实施默认；具体新增名称/数值不得伪装成用户逐项批准。

规格：[01-CHARACTERS.md](../../../docs/design/01-CHARACTERS.md)、[02-EQUIPMENT-ARTS.md](../../../docs/design/02-EQUIPMENT-ARTS.md)、[03-SPATIAL-ART.md](../../../docs/design/03-SPATIAL-ART.md)、[14-EARLY-GAME-DETAILED-DESIGN.md](../../../docs/design/14-EARLY-GAME-DETAILED-DESIGN.md)、[06-OPENING-ACCEPTANCE.md](../../../docs/design/06-OPENING-ACCEPTANCE.md)、[GODOT-MIGRATION.md](../../../docs/GODOT-MIGRATION.md)、[ART-REALTIME-TRIAL.md](../../../docs/ART-REALTIME-TRIAL.md)、[42-CHARACTER-DIALOGUE.md](../../../docs/design/42-CHARACTER-DIALOGUE.md)、[51-COURTYARD-MANAGEMENT-INTEGRATION.md](../../../docs/design/51-COURTYARD-MANAGEMENT-INTEGRATION.md)、[46-CONTINUOUS-DOMAIN-FOUNDATION.md](../../../docs/design/46-CONTINUOUS-DOMAIN-FOUNDATION.md)、[52-EAST-TERRACE-INTEGRATION.md](../../../docs/design/52-EAST-TERRACE-INTEGRATION.md)、[55-CHARACTER-ACTION-LIBRARY.md](../../../docs/design/55-CHARACTER-ACTION-LIBRARY.md)、[70-COURTYARD-FIRST-COMBAT.md](../../../docs/design/70-COURTYARD-FIRST-COMBAT.md)、[71-GUESTHOUSE-INTEGRATION.md](../../../docs/design/71-GUESTHOUSE-INTEGRATION.md)、[73-COMBAT-FRAME-PRODUCTION.md](../../../docs/design/73-COMBAT-FRAME-PRODUCTION.md)、[README.md](../../../docs/art/combat-response-goal-20261027/README.md)、[player-down-prompt.md](../../../docs/art/combat-response-goal-20261027/player-down-prompt.md)。

依赖：[SR-XF-002](SR-XF-002.md)、[SR-XF-004](SR-XF-004.md)。

关联既有验收：OPEN-02, ACT-01；本SR的AC细化这些目标，不代表旧版本已经通过。

## 现状与设计缺口

沿用六列云岫人物及稳定spriteIndex/外观配方；真实床位休憩、书案研习和满包等候已按同一身份与身体活动投影静态姿态，缺图保留基础同身份人物和点选。
2026-10-14 U-142：先审核完整山院美术原型，再按构图、细节、精度与材质还原实机。目标模式、场景接入及20分钟长验按用户要求暂停；本地增量保留。原型见 docs/art/pixel-courtyard-prototype-20261014/README.md；原型不计作运行验收，既有SR/AC状态保持。

D01/D02 已补齐关键人物配方、活动/工具和三视图同身份映射，并完成 SR002/SR004 与 REQ/AC 契约审阅。疗伤/劳动/斗法等完整连续动作、持久配方版本及面部标记范围门禁、三人以上真人辨识体验仍属 I/V 后续缺口；静态姿态与回退不代表完整动画完成。

现状是适用旧能力的基线，不表示该SR完整目标已通过。

## 必须补齐的设计交付物

1. 关键人物配方及普通人物可组合体型/脸/发型/主色/服饰目录。
2. 站立、行走、采集、种植、研习、休息、疗伤、施法、受击动作与工具对应表。
3. 肖像/山院/战斗的同身份映射，装备挂点和缺帧回退规则。

## 需求行为

SR-XF-007-REQ-01：角色重载、入宗、换衣和切场景不重掷身份外观。

SR-XF-007-REQ-02：活动状态、姿态与随身工具对应，途中不能显示正在执行劳动。

SR-XF-007-REQ-03：远景不破坏人类尺度；近景可区分至少三名人物。


## 验收标准

| ID | 情景 / 操作 | 必须看到的结果 | 状态 |
| --- | --- | --- | --- |
| SR-XF-007-AC-01 | 三名以上同场角色指定点选 | 可凭外观和肖像对应身份，能说出当前活动。 | not_run |
| SR-XF-007-AC-02 | 换装备和切到战斗再返回 | 身份特征稳定，武器/法器外观与实际实例对应。 | passed |
| SR-XF-007-AC-03 | 等待、睡眠和研习切换 | 动作/工具/标签与权威状态一致，回退不冒充完整动作。 | passed |

SR-XF-007-AC-01证据：局部：tests/acceptance/ea-person-three-selection-acceptance.mjs（同场三人公开命令、精确存读、生产Canvas脚点）；局部：tests/unit/web/ea-scene-ui.test.mjs（肖像与当前动作只读点选）；局部：docs/design/STATUS.md（独立本地浏览器三人、重叠候选与续档；真人/真机仍待）；局部：docs/art/SYSTEM-UI-2026-10-10.md（宽庭院人物卷册读取正式身份、外观和活动；同场三人场景动作未验）；2026-10-24局部进度／未通过：docs/design/70-COURTYARD-FIRST-COMBAT.md；规则33、反馈9、山魈3分别检查，macOS源码Electron 03/04/05原failed保留；用户反馈手部变形，visual-failed、正在返工，非空短预输入暂停／失焦清理待验；本AC状态保持。；2026-10-24手修06局部：docs/design/70-COURTYARD-FIRST-COMBAT.md；离线4/4、缓存90采样／4绘制对照，根Agent有限目检。原失败及qa-hand-06失焦失败保持；新原生手部／buffer、用户视觉／声音与最大射程视觉距离继续待验，AC状态保持。；2026-10-24整帧局部：docs/design/70-COURTYARD-FIRST-COMBAT.md；整帧5/5与18组RGBA忠实性对照、反馈10/10。qa-frames-08右击774命中25，但0.79米未满足1–1.4米观察带、整体failed，其余方向／连续操作未执行；4步态候选均未通过，样板与用户认可未完成，AC状态保持。；docs/art/combat-minimum-20261025/README.md；docs/art/combat-minimum-20261025/review.json；docs/art/combat-minimum-20261025/review-v002.json；docs/art/combat-encounter-20261026/README.md；docs/art/combat-encounter-20261026/review.json；docs/art/combat-ranged-20261026/README.md；docs/art/combat-ranged-20261026/review.json；docs/art/combat-ranged-20261026/review-v002.json

SR-XF-007-AC-02证据：tests/acceptance/ea-person-equipment-battle-acceptance.mjs；tests/acceptance/ea-person-equipment-art-acceptance.mjs；src/simulation/ea-life.mjs；apps/web/ea-ui.mjs；docs/design/STATUS.md；2026-10-24局部进度／未通过：docs/design/70-COURTYARD-FIRST-COMBAT.md；规则33、反馈9、山魈3分别检查，macOS源码Electron 03/04/05原failed保留；用户反馈手部变形，visual-failed、正在返工，非空短预输入暂停／失焦清理待验；本AC状态保持。；2026-10-24手修06局部：docs/design/70-COURTYARD-FIRST-COMBAT.md；离线4/4、缓存90采样／4绘制对照，根Agent有限目检。原失败及qa-hand-06失焦失败保持；新原生手部／buffer、用户视觉／声音与最大射程视觉距离继续待验，AC状态保持。；2026-10-24整帧局部：docs/design/70-COURTYARD-FIRST-COMBAT.md；整帧5/5与18组RGBA忠实性对照、反馈10/10。qa-frames-08右击774命中25，但0.79米未满足1–1.4米观察带、整体failed，其余方向／连续操作未执行；4步态候选均未通过，样板与用户认可未完成，AC状态保持。

SR-XF-007-AC-03证据：tests/acceptance/ea-person-activity-switch-acceptance.mjs；tests/unit/web/ea-scene-ui.test.mjs；tests/acceptance/ea-courtyard-rest-render-acceptance.mjs；docs/design/STATUS.md

2026-10-07本地小院批次：成人家具/单位格/空间定向检查48/48（8/6/34），正常公开命令接受/拒绝邀请两路完成营造、产出搬运、研习、到床休息与迁建取消/续建；分别60命令/36次精确存读和61命令/37次精确存读。六身份卧姿与预约前提2/2，生产Canvas卧姿加载/只读/身体点选/缺图回退4/4，已读图。旧v5完成档40建筑30门人保留资源、时间和return结局，全部入口可达，二次存读一致。各SR仅登记适用子情景；完整AC、真机触摸/FPS和真人首次体验状态分别保留。 浏览器DPR1鼠标在1366×900、1180×820、820×1180点选床上掌门通过；正常推荐营造经Enter和鼠标确认、实际施工落成。一次动态模块加载失败经页面重载恢复同档，原因待定位。I/V证据为沿既有可用契约实施的本批子范围；完整D01/D02及I/V关闭门槛保持原状态。 2026-10-07活动事实局部修正：采集/补种因受伤、离位、低精力暂停时阶段记paused，画面为等候，不推进；自然采集第四批包裹满也暂停且不扣来源。定向测试覆盖伤势、低精力、包裹满、存读与恢复3/3，离位未逐项注入验收。人物投影asset限定为身份基础云岫画稿，卧床只列sceneAssetCandidate；实际床几何、脚点与加载由渲染决定，完整动作标记false。人物与卧姿11/11、空间34/34、经济52/52通过；三人辨识、全套动作、触屏及整项AC仍未通过。

2026-10-07 M1 首批人物画稿：沿既有六身份图集新增各自等待立姿与持书研习坐姿；沿权威活动与原 personId 选图，缺图回退原身份画稿。定向资产/人物/卧姿/界面 21/21；六身份静态图集已读图。疗伤、劳动、施法、受击和战斗连续动作、三人真人辨识及换装往返仍未验，AC 与 D/I/V/R 保持原状态。
独立只读复核已确认首批三项房屋接缝修复：显示与点选同阶段、迁建旧址不误显升级、错尺寸图集回退；定向重跑 22/22，仍不等于完整 AC。
2026-10-07 独立浏览器仅内存试读五人正常档：暂停同一第62日场景，画布分别点选程问舟、温南星、林长风三名门人，侧卡身份与休憩/候位等当前活动一致，主屋床位列表列出实际预约者。此为指定点选与事实标签子范围；尚无真人盲辨外观/肖像，也未核对三人全动作和换装实战，因此AC01–03均保持not_run。
2026-10-07 M1 第七批研习子情景：sr-cultivation 订单执行时取真实身体活动/书案/进度驱动姿态、掌门状态及详情，旧休憩字段不再覆盖；到位前显示前往研习位置。公开命令 + 精确存读的生产 Canvas 及桌面浏览器画面/点选通过，scene UI 9/9。等待、睡眠、专用完整动作和回退矩阵未由本批覆盖，AC03 仍 not_run，整项 SR007 不提升。
2026-10-08 M1 第十批：AC02 由独立只读复核按原文通过。五份公开命令来源档精确存读，同一掌门换衣、真实制作装备法器、实战及返院；生产画布和隔离桌面浏览器核对身份与实际实例挂点，战斗活动提示按真实状态显示。战场远景法器细节需结合生产画布与状态；真机/真人及整项仍未关闭。
2026-10-08 M1 r9 AC01 三人点选窄批：掌门、陆知微、林长风由正式公开开局 37 命令、24 次精确存读得到，生产 Canvas 真脚点 1/1；人物列表、档案、侧卡及重叠候选显示相同身份肖像与权威当前动作，不回写模拟。根独立复跑 scene UI 11/11、人物图集 6/6、Canvas 1/1。独立本地 Chromium 首载、三人实点、伐木工位1/2、掌门返床途中行走、保存刷新续档通过；196 请求全 200、控制台 0 错误/0 警告，报告 /private/tmp/immortal-sr007-r9-browser-review.json。公开网页验收另记。真人外观盲辨、真机触控和恢复世界步后的完整动作未验，AC01 not_run、I/V/R 原状态不变。
2026-10-08 r9 公网独立验收：Pages 39ad10e34c6afa44821745cf6d7433ee4ebaedf7 built，四脚本 HTTP 200 且与发布树 blob 一致。隔离命名空间新档保存刷新续玩；合法第5日两门人来源档仅内存试读，实际点中陆知微采集/伐木工位1、林长风采集/工位2、重叠候选中掌门行走/前往主屋床位1，列表一致。198 请求全 200、控制台 0 消息，报告 /private/tmp/immortal-r9-public-review.json。来源档未写本机，也未验证其刷新；真人盲辨、真 iPadOS、全部动作分支仍待，AC01 not_run。

2026-10-23 用户新续接聚焦掌门／山魈动作、命中特效与真实受击僵直，沿55动作库及同一100毫秒世界步实现。命中主事件补稳定编号、时步、双方身份、真实入射方向／接触点、伤害／护持／闪避／打断结果；人物提供只读动作阶段。作者试调 T-COMBAT-IMPACT-20261023：轻击僵直2步并保留蓄势，重击3步并取消未释放动作，站稳后保护12步，敌方打断后至少收势6步；已发射物继续，费用／冷却遵循真实释放。规则与相关回归25/25，三个规则模块语法检查通过；特效8种离线夹具重复像素一致且不回写世界。人物／山魈36姿离线检查8/8，已按只读动作阶段接入；388文件runtime-01冻结及6核心文件、规则报告5文件读回一致。macOS源码Electron三段分别通过：正常操作qa-run-01为33项（423→1087、108.629018秒），实际落败qa-defeat-01为3项（763→1333、64.839664秒），左右朝向停稳补帧qa-orientation-02为18项（763→881、42.211894秒）；各段错误0且source/runtime保持，分段证据不记为一次连续运行。补帧只调整检查脚本，251个功能／素材路径与首段一致。根Agent已独立目视最终画面，两份388文件清单仅检查脚本不同；仓库6核心源码及本批素材共40文件SHA与runtime-01一致。掌门左向受击为离线证据、实机受击为右向；完整僵直持续窗以规则证据覆盖，方向实机全矩阵另计。新控制下的存档、旧档入口与返院复验仍暂缓；生产／医庐沿各自来源，完整SR/AC状态保持。

2026-10-24 流畅度返工按T-COMBAT-FEEL-20261023接入：持键保存移动意图，施法起手停脚、释放后恢复走位，合法短步接起手／收势，单槽2步预输入；真实结算仍用100毫秒世界步。规则33/33（新增8＋直接回归25）、反馈模块9/9、山魈模块3/3分别记录。人物离线6条及focused5条检查与公开规则时钟预览属离线证据。macOS源码Electron qa-feel-03、qa-feel-04、qa-buffer-05均保留failed，各已完成10、2、2项局部检查：03持键术法777释放、778恢复位移及释放后短步／接触／暂停等成立；05证明目标冻结与一次消费。非空短预输入的暂停／失焦清理尚未完成。用户明确反馈手部变形，qa-review.json冻结为visual-failed，QA窗口已关闭，当前手掌／腕／肘正在返工，不声明视觉通过或交付。证据根目录 /Users/shepard/.codex/tmp/immortal-combat-feel-20261023/，范围限macOS源码Electron；绘制JS耗时及rAF回调间隔不称实际显示FPS。修后视觉、完整存读／旧档／返院、用户评看与Windows继续待验，完整SR/AC及任务状态保持。

2026-10-24 旧拆件rig版本手修06历史记录：固定手掌比例、24／21臂骨与70度腕限，校准贴图腕／握柄锚点、肘分支和左向施法层级，剑轨迹渐隐，完整动作bounds缓存保留剑尖。专项4/4、90个量化采样及4个Canvas draw对照通过，86项预热约27.29MiB，96项／40MiB上限，1000次闲置新增miss为0；根Agent及Astra完成有限离线复核。851／1001的0.381／0.259像素接触距离属于旧场景离线重绘。该版登记为hand-repair-offline-checked/native-pending；qa-hand-06在移动准备时原生失焦，以failed保留，未取得手部或buffer新证据，来源／运行文件保持、窗口已关闭。原03／04／05 failed及visual-failed汇总保持。右剑痕约领先可见剑尖3.8像素、最大水平1.9米处约10–30像素可达差仍open；用户视觉／声音认可、Windows、当前包与完整SR/AC仍待验。规则33、反馈9、山魈3的既有模块证据各自保留。详见70规格及 /Users/shepard/.codex/tmp/immortal-combat-feel-20261023/hand-fix-06/；该段当时登记离线修复，当前整帧证据另列。

2026-10-24 人形整帧blit生产路径已接入，同一原帧统一缩放；释放当步保留出手，下一世界步按已接受的moveIntent切整身walk，短步／受击／倒下优先，同一100毫秒时钟、位置插值和暂停冻结保持。新专项5/5、9组原PNG裁切／合成在95／112像素身高共18组RGBA对照一致（排除脚影）；反馈10/10含正式投射物方向回归。S01仍为原单母稿离线网格烘焙PNG，离线小样仅作为接续基线，完整动作样板未完成。qa-frames-08整体failed：763→776、11.06978秒，右普攻774实际命中25，但中心距0.790000079米未满足专项1–1.4米观察带，左动作、施法→走位→短步和斜剑未执行；source/runtime保持、收尾错误0、未录像且窗口关闭。根Agent有限目检右起手／释放，敌我重叠遮挡手掌与剑，尚不能验证其质量。内置imagegen左右各两次共4张六格步态候选均未形成反相支撑腿，已停止并留外部。当前欠完整反相步态、左右攻击收势／连续剑路、左闪避／受击专图与斜向攻击图，swordTrail为空、真实接触光效保留。旧06／07及03／04／05失败按原版本保留；非空buffer原生清理、当前控制存读／旧档／返院、用户视觉／声音认可、Windows、当前包和完整SR/AC继续待验，状态不提升。 证据见docs/design/70-COURTYARD-FIRST-COMBAT.md。

## 开发任务

| 任务 | 工作 | 状态 | 前置 | 责任人 |
| --- | --- | --- | --- | --- |
| SR-XF-007-D01 | 设计补齐：交付：关键人物配方及普通人物可组合体型/脸/发型/主色/服饰目录。；站立、行走、采集、种植、研习、休息、疗伤、施法、受击动作与工具对应表。；肖像/山院/战斗的同身份映射，装备挂点和缺帧回退规则。；填实必需参数并标记U/R/T来源。 | done | 无 | Codex/sr007-design |
| SR-XF-007-D02 | 契约与内容审阅：审阅稳定人物外观、肖像与活动动作与依赖契约（SR-XF-002、SR-XF-004）的字段、时序、失败及恢复；逐项核对本SR的REQ/AC。 | done | SR-XF-007-D01 | Codex/sr007-contract-review |
| SR-XF-007-I01 | 开发与集成：在人物模块实现稳定人物外观、肖像与活动动作；交付SR-XF-007-REQ-01至REQ-03，接入相关数据、行为、素材、UI和恢复，提交关联SR。 | todo | SR-XF-007-D02 | Codex/courtyard-integration |
| SR-XF-007-V01 | 验收与兼容：执行SR-XF-007-AC-01至AC-03及OPEN-02、ACT-01；登记实际结果、兼容和设备证据边界。 | todo | SR-XF-007-I01 | Codex/courtyard-acceptance |
| SR-XF-007-R01 | 发布与关闭：完成所需源码/运行时发布核对、交接和未覆盖说明；本轮用户不要求上传QA过程产物。 | todo | SR-XF-007-V01 | 待分配 |

SR-XF-007-D01证据：docs/requirements/design/SR-XF-007-011-019-026-027.md

SR-XF-007-D02证据：docs/requirements/design/SR-XF-007-011-019-026-027.md

SR-XF-007-I01证据：apps/web/ea-character-art.mjs；apps/web/ea-courtyard-renderer.mjs；assets/web/estate-v1/characters-rest-v1.png；docs/design/STATUS.md；assets/manifest.json；src/simulation/ea-sr-persons.mjs；src/simulation/ea-sr-economy.mjs；tests/unit/web/ea-activity-truth.test.mjs；tests/acceptance/ea-sr-economy-acceptance.mjs；tests/acceptance/ea-sr-spatial-acceptance.mjs；src/simulation/ea-sr-equipment.mjs；tests/acceptance/ea-sr-integration-acceptance.mjs；tests/acceptance/ea-person-equipment-battle-acceptance.mjs；tests/acceptance/ea-person-equipment-art-acceptance.mjs；apps/web/ea-ui.mjs；tests/unit/web/ea-scene-ui.test.mjs；tests/acceptance/ea-person-three-selection-acceptance.mjs；tests/acceptance/ea-person-recipe-save-acceptance.mjs；docs/design/49-P0-P2-COURTYARD-PROGRESS.md；2026-10-15 U-147/R-47：院务/人物/工位/物资/研习操作、保存失败保护和疗伤收据重放；47/47 Node检查。浏览器内核缺失且官方下载失败，实际UI与桌面未验，完整P0—P2及SR/AC状态保持。

SR-XF-007-V01证据：tests/acceptance/ea-courtyard-rest-render-acceptance.mjs；tests/unit/web/ea-rest-pose.test.mjs；tests/acceptance/ea-courtyard-life-acceptance.mjs；docs/design/STATUS.md；src/simulation/ea-sr-persons.mjs；src/simulation/ea-sr-economy.mjs；tests/unit/web/ea-activity-truth.test.mjs；tests/acceptance/ea-sr-economy-acceptance.mjs；tests/acceptance/ea-sr-spatial-acceptance.mjs；src/simulation/ea-sr-equipment.mjs；tests/acceptance/ea-sr-integration-acceptance.mjs；tests/acceptance/ea-person-equipment-battle-acceptance.mjs；tests/acceptance/ea-person-equipment-art-acceptance.mjs；tests/unit/web/ea-scene-ui.test.mjs；tests/acceptance/ea-person-three-selection-acceptance.mjs；tests/acceptance/ea-person-recipe-save-acceptance.mjs；docs/design/49-P0-P2-COURTYARD-PROGRESS.md；2026-10-15 U-147/R-47：院务/人物/工位/物资/研习操作、保存失败保护和疗伤收据重放；47/47 Node检查。浏览器内核缺失且官方下载失败，实际UI与桌面未验，完整P0—P2及SR/AC状态保持。

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
- docs/art/kling-stop-supplement-20261025/README.md
- 2026-10-25 收步返回片审看：主Agent审21点全片与首2秒49帧，首次落地后9–18又蹬离大跨步，未达当前脚直接收步；身份/剑保留，不整段加速、不批量抠底、不接D。用户要求无声，AVFoundation视频轨透传导出0音轨，241压缩视频包/PTS保持，Chrome加载可播；新提示候选从原frame52接地稳住仅收后脚，尚未发Kling。详见本目录review.json，旧输入包保持，全部D/I/V/R、AC及任务状态不推进。
- 2026-10-25 55 B04收步补片输入：主Agent审原185–210全部26帧，185–197仍续原跑步半步、198后才连续回正，未见独立另一半步收步链。选原RGB48→240备单条Kling首末帧与提示词，两940图保持原字节/水印、来源与SHA随小ZIP留存；仅输入准备，新视频尚未返回，无动作或实机验收。原片/D样板/前批包保留，未接入运行；全部D/I/V/R、AC及任务状态保持。
- docs/art/kling-motion-review-20261025/README.md
- 2026-10-25 55 B03/B04右向离线样板：仅D，复用87帧，连续3.3m/s标尺与22m投影取证；contact只拟合5个人工水平端点，仍19帧480ms、保留equal。主Chrome实查keyup位置保持、A禁用及stop203→run63被新D打断；独立只读76边界/114矩阵通过、累计距离不随动画圈归零。正式100ms世界步/.045m预显/35–100ms收敛未改，任意相位视觉仍有腾空转站腿、腿位收缩与衣发回跳，不称整圈无滑步。QA页面与review留存，未接入runtime或改存档，不新增87帧ZIP；全部D/I/V/R、AC及任务状态保持。
- 2026-10-25 Kling起停组合候选：用户确定19帧跑步480ms，新增待机/起跑/收步/回稳68帧；87原生RGB保持，H650/root[580,825]/BOX58。主Agent审13页68帧，Chrome观察idle11→start15、自动停240/110of110及滑块24→58、61→198，接受本批离线候选；独立只读核对87帧RGB/BOX/atlas、200散列、110帧序与197个GIF编码帧图像及时长通过，未做UI美术。小灰残点/浅边、任意相位起停/脚速与实机未验；PNG/GIF/HTML/ZIP留QA，未接入运行。全部D/I/V/R、AC及任务状态保持。
- 2026-10-25 Kling透明跑步候选：用户选择脚本逐帧分离背景，frame48–66共19张940×940原生RGBA的RGB逐像素保持；固定H0=650/root[580,825]，BOX统一58逻辑像素、nearest呈现，人工衣物保护范围明记。主Agent审dark01–04全19帧，在Chrome播放观察52→57后暂停，切校准场景检查全身/比例，接受本轮透明跑步候选。轻微浅边仍在，闪烁完全消除、接缝/脚速和实机未验；PNG/atlas/GIF/HTML与ZIP留QA，未接入运行。全部D/I/V/R、AC及任务状态保持。
- 2026-10-25 Kling原片接续：用户返回940×940/约24fps视频，实际解码241帧并保全原SHA和QA原字节备份。主Agent在Chrome播放/seek看原画面，另审21点全片表、跑步25帧及起停13/25帧密集表后，判断可继续帧制作；人工分段与frame48–66的19帧周期仅为候选。软化像素、RGB背景、接缝/滑步及实际尺度待验，未去背景或接入运行；全部D/I/V/R、AC及任务状态保持。
- docs/art/kling-motion-input-20261025/PROMPTS.md
- 2026-10-25 Kling接续：用户自行使用Kling制作动作；本批仅备提示词、1254×1254浅灰底首帧及身份/尺度/循环参考输入包，复制SHA一致。尚无Kling视频或动作验收，未上传、未操作账号或运行游戏；全部D/I/V/R、AC及任务状态保持。
- 2026-10-25 U-171 / 55 B02：用户认可同标尺整体观感；v6四帧→v5四帧为首个单方向8帧候选，固定H0=500、统一58/500、60ms×8=480ms。主Agent已看源sheet/contact全8帧，在Chrome播放/暂停/下一帧、跨圈回1并对照2/6支撑，仅通过离线逐帧、播放器可播放和视觉初审。地面速度同步、起停、其余方向、完整动作及实机仍未验；源SHA/透明裁边/atlas一致与禁止覆盖失败检查通过，存读不适用。本批只补局部素材，D/I/V/R、AC及任务状态保持，详见docs/art/combat-motion-study-20261025/README.md及run-cycle-v001/review.json。
- docs/art/combat-field-study-20261025/README.md
- docs/art/combat-motion-study-20261025/README.md
- 2026-10-25 U-171最新接续：用户认可整体美术方向并授权校准后制作帧动画，非新尺度/动作/实机验收。40逻辑像素/米同网格静态图人101px/兽164px，主Agent审看可继续，用户新比例未评；阴影及原生像素密度一致性未验。跑步v1–v3均未通过，v3后半圈换腿不足且帧8左手变剑诀，停止生成；原RGBA及诊断输出保留，未完成连续播放或实机验收。仅离线局部证据，运行素材registry与全部D/I/V/R、AC及任务状态保持。
- 2026-10-25 U-171静态美术候选：网站真实global prompt起步，三次内置image_gen生成/定向修订后展示1536×1024第三稿，主Agent已审图、用户评看待定；人物超过108px预算、严格像素网格未验，22米精确比例未锁定。原LPC人物、通用兽人及重复草地成品已被用户否决，原包和运行引用保留。本批无动作库、运行替换、性能或游戏存档操作。native-01与独立reopen-01均保持failed，后者存读/关闭局部成立但署名请求失败，不合并动作/接触/性能证据；D/I/V/R与全部AC状态保持，详见73。
- docs/design/03-SPATIAL-ART.md
- docs/design/STATUS.md
- apps/web/ea-character-art.mjs
- apps/web/ea-courtyard-renderer.mjs
- assets/web/estate-v1/characters-rest-v1.png
- tests/acceptance/ea-courtyard-rest-render-acceptance.mjs
- tests/unit/web/ea-rest-pose.test.mjs
- tests/acceptance/ea-courtyard-life-acceptance.mjs
- docs/CODEX-HANDOFF.md
- assets/manifest.json
- src/simulation/ea-sr-persons.mjs
- src/simulation/ea-sr-economy.mjs
- tests/unit/web/ea-activity-truth.test.mjs
- tests/acceptance/ea-sr-economy-acceptance.mjs
- tests/acceptance/ea-sr-spatial-acceptance.mjs
- assets/web/estate-v1/characters-wait-study-v1.png
- tests/unit/web/ea-house-activity-art.test.mjs
- src/simulation/ea-sr-equipment.mjs
- tests/acceptance/ea-sr-integration-acceptance.mjs
- tests/acceptance/ea-indoor-activities-acceptance.mjs
- src/simulation/ea-life.mjs
- tests/unit/web/ea-scene-ui.test.mjs
- tests/acceptance/ea-person-activity-switch-acceptance.mjs
- tests/acceptance/ea-person-equipment-battle-acceptance.mjs
- tests/acceptance/ea-person-equipment-art-acceptance.mjs
- apps/web/ea-ui.mjs
- tests/acceptance/ea-person-three-selection-acceptance.mjs
- tests/acceptance/ea-person-recipe-save-acceptance.mjs
- docs/art/REALTIME-TRIAL-2026-10-09.md
- archive/godot/art/art_courtyard.gd
- archive/godot/art/actor_3d.gd
- archive/godot/tools/build-art-web.py
- docs/art/PAINTED-COURTYARD-2026-10-09.md
- archive/godot/estate_2d/estate.gd
- 2026-10-11 U-118 局部：Godot 2D 图集按逻辑米位移推进；隔离 Chromium 行走五秒窗口观测每秒切换 9–11 帧，实际目标设备与三人以上辨识仍待验，AC 状态不变。
- archive/godot/painted_courtyard/actor_2d.gd
- archive/godot/qa/painted-actor-check.gd
- 2026-10-11 U-118 转向校准：人物动作 45／45，行走跨越转向时持续使用行走帧；本地 Chromium 行走中站立转身帧 0。角色辨识与目标设备 AC 状态不变。
- docs/art/system-ui-20261012/RUNTIME.md
- tests/unit/web/ea-system-ui-projection.test.mjs
- 2026-10-12 U-120：真实人物 ID、外观和公开修习接入名册／详情／掌门页；30 门人五页名册及人物功法往返通过模块检查，浏览器实点四页详情并定位同一场景人物。场景定位后继续行走的短样本仅覆盖本机 Chromium。完整人物动作、辨识及目标设备 AC 状态保持。
- 2026-10-12 U-125：42 人物交谈及关联契约定义统一立绘聊天窗、身份叠加、知情、距离、意愿、暂停和持久规则；DIALOGUE-01–10 为 not_run。本批为设计与静态原型，运行接入及完整 SR/AC 状态保持。
- docs/art/mountain-flat-20261013/README.md; U-126 flat-color art direction confirmed; prototype review pending, runtime art not implemented. SR/AC states unchanged.
- docs/art/mountain-flat-20261013/RUNTIME.md；2026-10-13 U-126：平涂场景、建筑作物阶段及人物接入同一模拟，局部 Godot 与实际网页验证；完整 SR/AC、目标真机与用户美术评看状态保持。
- docs/art/desktop-style-review-20261013/README.md；2026-10-13 U-127/U-128：五种画风、战场总览及交战近景共七张静态原型待用户审核；桌面交付方向为Windows主力、macOS先验证。仅设计与原型证据，桌面迁移及新战斗未实施。
- 2026-10-13 U-129/U-130：独立 Three.js/Electron 双画风自动样板用于空间、人物与特效评看；范围及实际证据见 docs/art/DESKTOP-RUNTIME-SAMPLES-2026-10-13.md。正式玩法、Windows 与完整 SR/AC 状态保持。
- 2026-10-13 U-131：Blender / Three.js 独立 D 主殿山院制作样板，固定机位实际图与剩余视觉差距见 docs/art/reference-reconstruction-20261013/README.md。本批仅提供局部模型与呈现证据，用户视觉认可、完整 SR/AC、正式迁移与 Windows 继续待验。
- 2026-10-14 U-132: local asset design sheets, editable Blender models and Three.js/Electron multi-view gallery. Evidence and visual limitations: docs/art/asset-review-20261013/README.md. Full SR/AC, game integration, visual approval and Windows remain separate.
- 2026-10-14 U-132 人物接续：正侧背设计稿、头部细节参照和可编辑 Blender / GLB 衣装样件；局部实际渲染与桌面检查见 docs/art/asset-review-20261013/character-study-v2.md。美术认可、正式游戏接入、多人性能与 Windows 待验；完整 SR/AC 状态保持。
- 2026-10-14 U-133: pure 2D HD pixel art direction confirmed; courtyard battle and character/effects static concepts generated. Evidence: docs/art/hd-pixel-20261014/README.md. User art review, desktop 2D runtime, animation and crowd performance remain pending; full SR/AC states unchanged.
- 2026-10-14 U-134：纯 2D 高清像素独立桌面场景，macOS 可见窗口 1600×900 实际行走、石灯前后遮挡、三类技能与冷却、16 人样例及暂停／重播，组件 6／6、自动 10／10、运行错误 0；打包应用已实际操作行走、缩放、暂停、护阵与重播。局部证据见 docs/art/hd-pixel-20261014/RUNTIME.md。正式模拟与存档未接入，完整大地图、Windows 和用户美术认可另验；D/I/V/R 与 AC 状态保持。
- 2026-10-14 U-135 / R-41 / T-14：用户认可 U-134 高清像素实机并要求保持设计，以目标模式接续独立桌面演武。同一像素素材接入掌门移动选敌、实际血条、命中反馈与双方 NPC 自主交手；组件 29／29、最终 macOS 打包应用可见窗口集成 13／13、运行错误 0；实际键鼠验证行走 110 像素、Tab 选敌、超距反馈、剑气命中、护阵、缩放、点地预排和保存。局部证据见 docs/art/hd-pixel-20261014/ARENA-RUNTIME.md；最终记录 /Volumes/Media/immortal-qa/pixel-arena-20261014/ 下 final-run-3/metrics.json、restart-final/ 与 native-final/。源码与素材随本批源码检查点保存；正式规则完整移植、大地图、正式人物与存档、Windows 和完整 SR/AC 另验，D/I/V/R 与 AC 状态保持。
- 2026-10-14 U-136/U-137，R-42/T-15：独立近山行程扩为同一1672×2823图像空间，山院→溪桥→林道→谷地会武→实际返院；16/32人稳定身份、只控掌门、同一时钟和独立存读。组件45/45；最终可见macOS包run-3检查22/22、运行错误0；16人实际返院胜利，32人到谷后采样15.00秒（其中交战13.08秒）再公开退出。原生输入、存读及画面差距见 docs/art/hd-pixel-trail-20261014/RUNTIME.md，设计见 docs/design/44-PIXEL-TRAIL-SLICE.md。源码与素材随本批检查点保存；当前画面认可、正式世界与存档接入、Windows及完整SR/AC另验；D/I/V/R及AC状态保持。
- 2026-10-14 U-138：以上方原山院为美术基准，南方林道与谷地使用trail-terrain-v5，匹配细密松针、灰青岩石与暖灰石板；同步松岛视觉遮挡及缓存接缝边缘。原四份素材哈希、导航和规则源码保持。渲染6/6，最终macOS包行程22/22、错误0；同机位、过松岛及32人截图见 docs/art/hd-pixel-trail-20261014/STYLE-ALIGNMENT.md。局部衔接纹理及队伍重叠仍待完善，当前实机美术认可待用户评看；完整SR/AC状态保持。
- 2026-10-14 U-138 山门接续修整：固定坐标实色补画接通松石、流水、石阶与栏杆，边界按对应纹理接合；同机位及左右2.25倍实机复核确认叠影和整条横向接线消除。渲染6/6，最终可见macOS包verified-run行程22/22、错误0；最终规则快照与上一批逐字段一致。证据见 docs/art/hd-pixel-trail-20261014/STAIR-CONNECTION.md。本批为局部美术修复，完整SR/AC状态保持。
- 2026-10-15 U-143：山域总图方向与保真制作流程获确认，生成并静态复核1672×941山院近景母稿，主殿、药田、两人及东/西/后/南道路可见。docs/art/pixel-courtyard-prototype-20261014/README.md 记录原图、提示词与实际尺寸；图稿待用户认可，素材分层、首屏实机还原与运行验收待完成，完整D/I/V/R及AC状态保持。
- 2026-10-15 U-144：用户确认按courtyard-v2.png还原。首屏采用原尺寸环境与独立人物、正式米制事实及同一模拟，实走、点选、原稿对照与存读的局部证据见 docs/art/pixel-courtyard-prototype-20261014/RUNTIME.md。用户实机美术认可、相邻地区、经营长验与Windows继续分别接续；完整D/I/V/R和AC状态保持。 最终macOS首屏94/94、70.029秒自主观察701次采样及原生输入/旧候选存档升级已复核，运行错误0；环境1,447,576像素比较差异0（排除状态与补画区）。
- docs/design/49-P0-P2-COURTYARD-PROGRESS.md；2026-10-15 U-147/R-47：院务/人物/工位/物资/研习操作、保存失败保护和疗伤收据重放；47/47 Node检查。浏览器内核缺失且官方下载失败，实际UI与桌面未验，完整P0—P2及SR/AC状态保持。
- docs/design/50-COURTYARD-UI-DESIGN-AUDIT.md；2026-10-15 U-148/R-48：四页及关联入口30项设计审查与7条后续场景；两处物流问题由正常命令复现，运行代码未修，实际UI未验，完整状态保持。
- docs/design/51-COURTYARD-MANAGEMENT-INTEGRATION.md；2026-10-15 U-149/R-49：四页与共用详情、单趟40份留苗搬运、落地回收和保存恢复接通；组件与相邻回归57/57，同一检查点真实桌面387.845秒13/13、最终包页面8/8、恢复链9/9，原生选择文件/预检/恢复及手动暂停已验。完整新档、规模、对话/突破、跨区施工、20分钟自主与Windows待接；完整D/I/V/R和AC状态保持。
- docs/design/52-EAST-TERRACE-INTEGRATION.md
- tests/acceptance/courtyard-east-desktop.mjs
- docs/design/54-COURTYARD-OPENING-DEMO.md；2026-10-17 U-155：三张守阵/逃离v3画帧、四类访客真实山路入离场、相向让行与旧档保护。基础143/143、定向17/17；最终macOS包序章17/17八次重启、同一普通新档陆知微入场4/4与99个在途脚点、暂停跨进程恢复/点选/走近通过。赠药仅同源隔离副本命令门槛证据；Windows、桌面完整交谈链、既有网页择法暂停提示和完整SR/AC状态保持。
- docs/art/shen-yan-model-reference-20261017/README.md
- assets/characters/shen-yan/hunyuan-v1/README.md
- assets/characters/shen-yan/hunyuan-v2/README.md
- assets/characters/shen-yan/walk-study-v1/README.md
- assets/characters/shen-yan/pixel-walk-study-v1/README.md
- assets/characters/shen-yan/pixel-walk-study-v1/provenance.json
- docs/design/55-CHARACTER-ACTION-LIBRARY.md
- docs/design/character-actions/WEAPONS-AND-SUPERNATURAL.md
- docs/design/character-actions/CRAFTS.md
- docs/design/character-actions/craft-coverage.json
- docs/art/character-actions-20261017/README.md
- docs/art/character-actions-20261017/review.json
- assets/characters/shen-yan/cast-study-v1/README.md
- assets/characters/shen-yan/cast-study-v1/review.json
- assets/characters/shen-yan/guard-study-v1/README.md
- assets/characters/shen-yan/guard-study-v1/review.json
- docs/design/70-COURTYARD-FIRST-COMBAT.md
- src/simulation/ea-combat-impact.mjs
- apps/courtyard/courtyard-combat-actors.mjs
- apps/courtyard/courtyard-combat-effects.mjs
- tests/unit/courtyard/courtyard-combat-impact.test.mjs
- assets/courtyard/combat-actors-v1/provenance.json
- docs/design/71-GUESTHOUSE-INTEGRATION.md
- tests/unit/courtyard/courtyard-guest-lodging.test.mjs
- tests/acceptance/courtyard-guesthouse-desktop.mjs
- apps/courtyard/courtyard-combat-presentation.mjs
- apps/courtyard/courtyard-combat-rig.mjs
- apps/courtyard/courtyard-combat-beast-rig.mjs
- apps/courtyard/courtyard-combat-audio.mjs
- tests/unit/courtyard/courtyard-combat-feel.test.mjs
- tests/unit/courtyard/courtyard-combat-feedback.test.mjs
- tests/unit/courtyard/courtyard-combat-beast-rig.test.mjs
- tests/acceptance/courtyard-combat-feel-desktop.mjs
- tests/acceptance/courtyard-combat-observations.mjs
- tests/unit/courtyard/courtyard-combat-rig.test.mjs
- apps/courtyard/courtyard-combat-frame-metadata.mjs
- tests/unit/courtyard/courtyard-combat-frames.test.mjs
- docs/art/combat-sword-study-integration-20261026/README.md
- docs/design/73-COMBAT-FRAME-PRODUCTION.md
- 2026-10-27 持剑单人战斗正式接入取得局部证据：新建单人山谷启用sword-study-v1，WASD/鼠标、移动剑气、已学剑法Q锁点重击、胜败确认与返院沿正式模拟；旧无标记战斗保持原规则。本批新增专项46项通过（规则11/音频13/插值7/呈现9/公开命令6）；旧冻结版四场26项功能检查通过，最终移动03有19帧左右跑及出手后回跑诊断。长档120人/5后台活动原生265430→265471，Q因未学剑正式拒绝且不扣气；源/运行散列与关闭均一致。精确坐标缓存同源冷步219.23→143.05ms、热2.48→2.34ms，完整状态字节一致；原生该步仍127.1ms、活动帧间隔125ms、Tab264.1ms，另有Node158ms慢步。旧失败/限定记录保留，完整动作、流畅度、听感、Windows与完整SR/AC及发布状态保持开放。
- docs/art/combat-response-goal-20261027/README.md；2026-10-27 六小时目标执行中：原生normal12/12、defeat5/5、retreat6/6通过，侧向收步203→206→209、移动攻击、Q/Space接续及同一掌门胜败撤离返院取得局部证据；同身份三段倒地按统一H650/root注册，主已看跪姿与侧卧。最后恢复收步补丁37项相关回归后，resume-01原生两项通过；主已看25/100ms恢复收步与站稳图，stop203/206/209、回拉0/idle滑0；完整方向、流畅度、听感、Windows与完整SR/AC仍开放。
- docs/art/combat-response-goal-20261027/README.md；2026-10-27 894版vertical-down-02正式4项通过，主亲看W/S松键25ms跑姿、100ms双脚戒备及到位保持，跪/撑/卧三阶段实际像素；566版action-pixels-01四向跑、移动J释放/回跑及左右真实受击8项通过并已目检。上下戒备复用cast07/11，尾差沿原run到位后停；完整动作、性能、听感、Windows与完整SR/AC仍开放，首轮验收误key的failed保留。
- docs/art/combat-response-goal-20261027/README.md；2026-10-27 最终五场同冻结runtime原生复核：final-normal-02为12/12、final-defeat-02为5/5、final-retreat-01为6/6，final-action-pixels-01为8项observed；主亲看当前四向跑姿、移动J蓄势/释放/回跑、左右真实受击及0HP胜败终帧。五窗口正常关闭、源档及764运行文件保持，完整汇总见/Volumes/Media/immortal-qa/combat-final-native-20261027/final-batch-01.json；性能尖峰、完整动作库、听感、Windows与完整SR/AC仍开放。
- docs/art/combat-response-goal-20261027/README.md；2026-10-27 仅A*排序成本计算局部优化后，astar-cost-lean-01在spatial cd477bf1版本无注入90.084秒/901tick，原120身份及5后台保留；世界步112.8ms、rAF109.6ms，性能仍未通过。先前final-batch-01五场功能/视觉证据属于spatial cb8538版本；其余呈现/整帧及素材不变，完整世界状态/路径等价另有a-star-cost-gate证明，不将旧像素称为新runtime复验，完整SR/AC状态保持。
- docs/art/combat-response-goal-20261027/README.md；2026-10-27 final-freeze-02完整cd477冻结版本五场复核：normal12/12、defeat5/5、retreat6/6通过，action-pixels八项observed；主亲看四向不同跑姿、移动J蓄势/释放/回跑、左右真实受击、W/S与侧向收步、Q→Space接续及0HP终帧。63张活动Canvas复制PNG及6张终局/返院图有逐张来源SHA索引；五场及startup/resume两probe正常关闭、完整764文件runtime相同且各自保持，七份落盘state等于最终session.state。startup-probe七项及resume-probe两项检查成立（report均observed），主已看起步25/200ms、反向25ms及恢复25/100ms。见/Volumes/Media/immortal-qa/combat-final-native-20261027/final-freeze-02/batch-summary.json；性能、完整动作库、听感、Windows及完整SR/AC仍开放。
- docs/art/combat-response-goal-20261027/README.md；2026-10-27 05:32冻结c95版取得新五场同runtime证据：normal9/defeat5/retreat6项通过，同一掌门分别794→973/746→915/764→858返院，主已看胜败双方终帧。两轮同120原人物/5后台长档原性能门通过，余量有限；五份落盘state等于最终session.state，源/运行保持、窗口关闭。旧cd477七场四向/停步/J/Q→Space/hit/startup/resume像素证据与63+6索引保持原版本范围，presentation894/framesbe81/data98ac未变。汇总见/Volumes/Media/immortal-qa/combat-final-native-20261027/final-freeze-02/equivalent-rooms-summary.json；完整动作库、听感、Windows及完整SR/AC状态保持。

- 2026-10-06：由v1.2设计缺口审计建立SR；新增内容和参数遵循作者默认，不冒充用户逐项确认。
- 2026-10-06：用户授权目标模式、多agent并行开发与验收；启动D01，按现有契约展开模块设计，未将建档或局部实现标作交付。
- 2026-10-06：U-96/U-97将经营成长和同场可交互美术置于优先；按R-27消费已有米制/单时钟/存档契约实现局部模块，D/I/V/R完整门槛仍未关闭。本轮验证及发布待主集成回填，不更改旧AC事实。
- 2026-10-06：回填主集成/独立验收确认的本轮组件和正常公开命令旧档结果；保留浏览器不可用、床体过短、混合画风的视觉缺口；闭屋后墙及两类田地已修复，并经最终Canvas快照静态读图复核。上述局部通过不提升SR整体状态，gh-pages可试玩开发版已成功部署，本轮源码main待确认；完整SR门槛仍未通过。
- 2026-10-07：U-100固定2.5D、旧云岫人物/建筑资源接回正式U-99主线；R-29山院扩96米，旧64档先校验仅登记extentVersion。人物6/6、扩图9/9、单位格6/6与正常公开链局部通过，真实网页/发布另记STATUS；完整SR保持in_progress，不冒称全动画或全体验完成。
- 2026-10-07：成人家具与现场交互本地批次：沿用六列云岫人物及稳定spriteIndex/外观配方。本批新增同六身份的真实静态仰卧素材；只有到床执行且持有对应预约时投影到床面，掉图保留同身份床边人物和点选。 已登记适用实现与独立复验证据，整体开发/验收保持in_progress，AC状态沿用已有范围。
- 2026-10-07：2026-10-07活动事实局部修正：采集/补种因受伤、离位、低精力暂停时阶段记paused，画面为等候，不推进；自然采集第四批包裹满也暂停且不扣来源。定向测试覆盖伤势、低精力、包裹满、存读与恢复3/3，离位未逐项注入验收。人物投影asset限定为身份基础云岫画稿，卧床只列sceneAssetCandidate；实际床几何、脚点与加载由渲染决定，完整动作标记false。人物与卧姿11/11、空间34/34、经济52/52通过；三人辨识、全套动作、触屏及整项AC仍未通过。
- 2026-10-07：M1 战斗共同身体或房屋/人物画稿首批局部实现与独立验收；整项原门槛未关闭。
- 2026-10-07：M1 换装子链：山院、山外与战斗绘制统一按同一有效装备实例过滤定义、槽位、耐久及归属/借用；肖像同步使用该挂点，法器与配饰按真实定义显示不同形状。新档公开借剑同行返院10命令、5次精确存读至470世界步，身份与实例稳定；独立只读复核、空间34/34和画稿12/12通过。完整自然实战、浏览器视觉、真人辨识与专用动作仍待验，AC02及整项状态不提升。
- 2026-10-07：M1 第七批修复实际研习与旧休憩字段冲突、到位前地点误述，并以公开命令和浏览器核对研习姿态/标签子范围；AC03 仍待完整动作/回退验收。
- 2026-10-08：M1 第九批按原文通过 SR-XF-007-AC-03：同一掌门公开命令依次休憩、研习、满包等候，34/22/3660、37/23/3833、43/24/4416 三态各自精确存读；桌面浏览器画布点选、活动图集缺失回退及生产 Canvas 独立只读复核通过，定向 25/25。只证实静态姿态、工具、标签和回退真实；AC01/02、完整连续动作、真机/真人与整项 D/I/V/R 均未关闭。
- 2026-10-08：M1 第十批 SR-XF-007-AC-02 独立复核通过：同一掌门以正式公开命令换衣、制作并装备护持小印、真实实战、结算返院，五阶段精确存读，装备实例与身份稳定；生产 Canvas 及隔离桌面浏览器复验。实战活动提示修正为临敌交锋。战场远景法器细节须结合来源档和生产画布核对；AC01、完整连续动作、真机/真人及整项 D/I/V/R 仍未关闭。
- 2026-10-08：M1 r9 SR007-AC01 三人身份、肖像与实时动作窄批：同一权威投影用于列表/档案/侧卡/重叠候选，模拟和存档不变。公开开局 37 命令/24 次精确存读、生产 Canvas 1/1、界面与人物图集 17/17；独立本地 Chromium 三人实点与刷新续档通过，196 请求全 200。真人盲辨、真 iPadOS 与完整动作仍待，AC01 和 I/V/R 不提级。
- 2026-10-08：SR007 D01：按现行新档、权威人物/空间设计补齐具名外观配方、普通组合目录、活动与工具条件、三视图身份挂点及缺帧回退；未知配方版本校验保留为 I01。
- 2026-10-08：SR007 D02：逐项对照 SR002/SR004 与 REQ01-03、AC01-03、OPEN02/ACT01 的身份、时序、失败、存读和证据边界；静态 AC02/03 既有通过保留，AC01 及完整 I/V/R 不提升。
- 2026-10-08：SR007 D01/D02 设计及契约审阅完成，design_status 调为 ready；现有 AC02/03 适用证据不变，AC01、开发/验收/发布及完整动作、配方版本门禁继续原状态。
- 2026-10-08：M1 r35 人物外观配方版本和本人 ID 校验：新档初始化后全员配方/日程齐全；有来源 v5 已完成档及旧 schema6 的已知后期客户复制 ID 在校验副本中保留外观值并归本人，其他错误 ID、越界标记和显式空配方拒载。专项 5/5、世界 21/21、空间 36/36，经独立复核；连续专用动作、真人辨识、真机及完整 I/V/R 继续。
- 2026-10-09：U-103：用户批准真实Godot 3D美术小院，一栋主殿、山石道路、两名人物已在本地WebKit实机运行，基础点选/行走/入殿后劳动/暂停/刷新及三个DPR1视口取得局部证据，独立Godot复核暂停骨骼和隐藏人物点选修复。地表/岩石/屋瓦质感仍有差距，用户实机美术确认、目标设备及正式玩法集成待完成。证据详见 docs/art/REALTIME-TRIAL-2026-10-09.md；本批未发布，完整AC及D/I/V/R状态保持。
- 2026-10-09：U-104：用户明确停止3D模型路线以控制制作工作量和网页性能预算。保留U-103试验工程及历史证据；Godot/Web方向保持，Godot 2D绘画素材与二维动画候选方案待确认。此次只同步约束，运行代码及完整SR/AC状态不变。
- 2026-10-09：U-104用户确认Godot 2D制作；绘画小院本地构建与WebKit鼠标操作、三视口DPR1局部复核完成。暂停出殿/双指锚点/拖动输入修复，最终拖动实点通过；人物辨识、动作观感、用户美术认可、殿后完整浏览器遮挡、真机/DPR2/真实触摸继续。正式SR/AC状态保持，未发布。证据 docs/art/PAINTED-COURTYARD-2026-10-09.md。
- 2026-10-11：2026-10-11 U-118 局部：Godot 2D 图集按逻辑米位移推进；隔离 Chromium 行走五秒窗口观测每秒切换 9–11 帧，实际目标设备与三人以上辨识仍待验，AC 状态不变。
- 2026-10-11：2026-10-11 U-118 转向校准：人物动作 45／45，行走跨越转向时持续使用行走帧；本地 Chromium 行走中站立转身帧 0。角色辨识与目标设备 AC 状态不变。
- 2026-10-12：2026-10-12 U-120：真实人物 ID、外观和公开修习接入名册／详情／掌门页；30 门人五页名册及人物功法往返通过模块检查，浏览器实点四页详情并定位同一场景人物。场景定位后继续行走的短样本仅覆盖本机 Chromium。完整人物动作、辨识及目标设备 AC 状态保持。
- 2026-10-13：U-126：用户要求从原型中断处继续，接入平涂地形、建筑、药田、人物和山谷；校准投影、脚点、透明命中、前景遮挡和田地绘制顺序。定向断言及网页点选、行走和保存刷新证据见本批 RUNTIME。仅登记局部实现与验证，整项 D/I/V/R、任务与 AC 状态不变。
- 2026-10-13：U-127/U-128：按用户要求先审核大场景多人即时战斗与画风原型，平台转为桌面。地图尺寸、人数上限、技能数值与最终画风未定；保留既有实现和验收事实，完整SR/AC及任务状态不变。
- 2026-10-15：U-147接续P0—P2：新增两人小院可操作供给成长和保存/事务保护，登记局部实现与Node证据；实际UI/桌面未验，完整状态不推进。
- 2026-10-15：U-148：记录四页及关联入口设计审查、操作断点和R-48重整提案；未修运行代码，完整D/I/V/R与AC状态保持。
- 2026-10-15：U-149：接续远端main并完成当前山院管理和取消回收、保存恢复的局部桌面验证；完整状态保持。
- 2026-10-16：U-150/R-50：追加连续东路、实际分趟运料施工、四床启用与同源macOS存读往返局部证据。流程两段308.849秒，最终包阶段6项及往返9项，错误0；保留验收脚本中断记录。完整SR/AC与D/I/V/R状态保持。
- 2026-10-17：按用户要求生成沈砚序章形象的去头全身三视图、头部五视图与面部细节。原图和提示词已保存，属于供评看的建模参考；完整SR/AC及运行实现状态保持。
- 2026-10-17：按用户要求实际调用Hunyuan生成沈砚序章模型并完成基础绑骨，保存原始GLB/OBJ/FBX及整理后的GLB和Blender工程。实物重新导入核对19978三角面、28骨骼、三张4K PBR、全顶点权重；整体朝向、材质和权重已整理，肩肘静态随动正常，屈膝长袍局部拉扯与手指/面部/衣摆控制留待动作细化。运行接入、连续动作与完整SR/AC状态保持。
- 2026-10-17：按用户确认的细节重做方案，完成沈砚头身分件生成、发髻与面部材质修整、颈根拼合和基础绑骨。完整绑定母模995874三角面；工作副本200000三角面、七张4K材质、28骨骼（22根变形）。母模重开核对几何/UV/法线一致；实际导出GLB重导核对全顶点归一权重，静态站立、抬臂屈肘、轻度屈膝和转头点头已检查。输入、原始云文件、任务与散列记录保留。外观待用户评看，手指/表情/衣料控制、连续动作、运行接入和完整SR/AC状态保持。
- 2026-10-17：按固定视角与近景立绘方向复用沈砚v2，完成一次Hunyuan行走动作生成、22关节适配与贴地/闭合修正，保存1.366667秒Blender循环及16张2D透明帧。83半帧重开检查、独立桌面控件14项与最终111/150/222像素播放/循环检查完成，独立静态复核可交候选。用户画面评看、手型与衣褶细线、连续闪烁/水平滑移、换装复用和正式运行接入继续分项处理；完整SR/AC状态保持。
- 2026-10-17：U-157：按用户指定的原像素外观与已生成行走动作，保存原图纹理二维网格小样，实际骨架关节投影驱动16帧，周期1.366667秒，位移和转角幅度适配为0.6倍。源图和动作散列保持；独立静态复核原形象、双脚交替和剑发完整，最终资产本地Electron三档111/150/222像素加载、播放、步进、暂停及单次结束通过，页面错误0。008–011帧裤腿仍有单图拉伸感；连续滑步与闪边、补图屈膝、更多方向、换装、用户画面批准及正式接入继续分项处理，完整SR/AC状态保持。
- 2026-10-17：U-158/R-51/T-17：登记人物动作设计稿及兵器神通、百艺分册，100动作组区分姿势、手位、物件、作用事件及中断收势；172项百艺草案按工序和阵法组对应。本批只检查设计覆盖、引用与同源时钟/身体活动/封闭建筑/知情等契约。具体姿势、八向建议与制作批次待评看，新动作素材和正常/失败/存读及设备验证待后续；完整SR/AC与任务状态保持。
- 2026-10-17：U-159：按用户确认制作引诀、护持、落旗、撑阵、放蛊、掷符和操偶七组关键姿势图，每组四格，共28格；原像素外观、双手分工、承力与实物去向已逐张静态评看并独立复核。图片、完整提示词、来源与散列已保存。供用户美术评看；尺寸与脚点对齐、透明拆层、过渡帧、111像素辨识、连续动画及正常/失败/存读接入另行完成，完整SR/AC与任务状态保持。
- 2026-10-18：U-160：完成S01引诀点发12帧、1.28秒的分层动画小样与本地Electron播放器。人物、剑、法术独立；12帧靴部像素相同、首尾像素差0，49项资源散列一致。最终素材三档尺寸、播放/暂停/步进/单次/循环/半速/效果开关20项通过，页面错误0；收诀袖口、释放手腕与握剑经独立静态复核。用户美术认可、深草/工位背景、更多方向及正式释放/存读接入继续接续，完整SR/AC和任务状态保持。
- 2026-10-18：U-161：用户确认沿用S01人物外观，完成S04双掌护持12帧、1.76秒分层动画小样。双掌、袖口、腰侧剑鞘及护障已复核；全部靴区像素一致、首尾差0、61项资源散列一致。门前对照将本小样人物标尺校到80母稿像素，阶前脚点落在平地；人物与环境共同缩放。最终macOS Electron正常27项、缺失素材4项检查通过，页面错误0，六张场景截图经独立复核。S04用户画面认可、其他朝向、破障/取消、正式护持事件与存读接入继续推进；正式桌面比例和完整SR/AC、任务状态保持。
- 2026-10-18：U-162：S04按护盾作用修订为掐诀护身，12帧、1.76秒涵盖胸前结诀、脚边升盾、合顶包身、持诀、盾面受击及收诀消散；沿用S01人物与U-161的80母稿像素标尺。成盾帧全部人物/装备可见像素在盾内，12帧靴区相同、首尾差0，61项资源散列一致。实际macOS Electron正常30项、缺失清单4项检查通过，页面错误0；整套姿势及场景截图复核。用户美术认可、其他朝向、破盾/取消、正式护持事件和存读接入分别推进，完整SR/AC与任务状态保持。
- 2026-10-23：2026-10-23 用户新续接聚焦掌门／山魈动作、命中特效与真实受击僵直，沿55动作库及同一100毫秒世界步实现。命中主事件补稳定编号、时步、双方身份、真实入射方向／接触点、伤害／护持／闪避／打断结果；人物提供只读动作阶段。作者试调 T-COMBAT-IMPACT-20261023：轻击僵直2步并保留蓄势，重击3步并取消未释放动作，站稳后保护12步，敌方打断后至少收势6步；已发射物继续，费用／冷却遵循真实释放。规则与相关回归25/25，三个规则模块语法检查通过；特效8种离线夹具重复像素一致且不回写世界。人物／山魈36姿离线检查8/8，已按只读动作阶段接入；388文件runtime-01冻结及6核心文件、规则报告5文件读回一致。macOS源码Electron三段分别通过：正常操作qa-run-01为33项（423→1087、108.629018秒），实际落败qa-defeat-01为3项（763→1333、64.839664秒），左右朝向停稳补帧qa-orientation-02为18项（763→881、42.211894秒）；各段错误0且source/runtime保持，分段证据不记为一次连续运行。补帧只调整检查脚本，251个功能／素材路径与首段一致。根Agent已独立目视最终画面，两份388文件清单仅检查脚本不同；仓库6核心源码及本批素材共40文件SHA与runtime-01一致。掌门左向受击为离线证据、实机受击为右向；完整僵直持续窗以规则证据覆盖，方向实机全矩阵另计。新控制下的存档、旧档入口与返院复验仍暂缓；生产／医庐沿各自来源，完整SR/AC状态保持。
- 2026-10-23：2026-10-23 GC15一级客院已接入：两张独立客床、当面自愿邀请、实际步行入住、原来访期限退房下山及原生存读。macOS源码Electron有限夹具入住ui-fixture-03通过7项（1656→3851、235.557720083秒），施工build-fixture-01通过3项（646→1700、114.379689209秒）；唯一工单3投入45灵石/40木/20石，两趟实际送达后于1683完成200施工步。两段错误0，来源、运行文件与原生重开均一致。GPT-6.1-sol独立读回6个原生检查点及12个核心源码通过。正常世界仍保留医庐tick261253原档；该世界的筹资建设、Windows和完整SR/AC保持待验。 详见docs/design/71-GUESTHOUSE-INTEGRATION.md。
- 2026-10-24：2026-10-24 流畅度返工按T-COMBAT-FEEL-20261023接入：持键保存移动意图，施法起手停脚、释放后恢复走位，合法短步接起手／收势，单槽2步预输入；真实结算仍用100毫秒世界步。规则33/33（新增8＋直接回归25）、反馈模块9/9、山魈模块3/3分别记录。人物离线6条及focused5条检查与公开规则时钟预览属离线证据。macOS源码Electron qa-feel-03、qa-feel-04、qa-buffer-05均保留failed，各已完成10、2、2项局部检查：03持键术法777释放、778恢复位移及释放后短步／接触／暂停等成立；05证明目标冻结与一次消费。非空短预输入的暂停／失焦清理尚未完成。用户明确反馈手部变形，qa-review.json冻结为visual-failed，QA窗口已关闭，当前手掌／腕／肘正在返工，不声明视觉通过或交付。证据根目录 /Users/shepard/.codex/tmp/immortal-combat-feel-20261023/，范围限macOS源码Electron；绘制JS耗时及rAF回调间隔不称实际显示FPS。修后视觉、完整存读／旧档／返院、用户评看与Windows继续待验，完整SR/AC及任务状态保持。
- 2026-10-24：2026-10-24 手修06已完成有限离线检查：固定手掌比例、24／21臂骨与70度腕限，校准贴图腕／握柄锚点、肘分支和左向施法层级，剑轨迹渐隐，完整动作bounds缓存保留剑尖。专项4/4、90个量化采样及4个Canvas draw对照通过，86项预热约27.29MiB，96项／40MiB上限，1000次闲置新增miss为0；根Agent及Astra完成有限离线复核。851／1001的0.381／0.259像素接触距离属于旧场景离线重绘。当前为hand-repair-offline-checked/native-pending；qa-hand-06在移动准备时原生失焦，以failed保留，未取得手部或buffer新证据，来源／运行文件保持、窗口已关闭。原03／04／05 failed及visual-failed汇总保持。右剑痕约领先可见剑尖3.8像素、最大水平1.9米处约10–30像素可达差仍open；用户视觉／声音认可、Windows、当前包与完整SR/AC仍待验。规则33、反馈9、山魈3的既有模块证据各自保留。详见70规格及 /Users/shepard/.codex/tmp/immortal-combat-feel-20261023/hand-fix-06/；本次先登记离线修复，最终refresh／validate／check待新原生结果后统一执行。
- 2026-10-24：2026-10-24 当前实施现有完整姿势PNG／图集的整帧blit样板，按只读动作阶段切换，人物运行时绕过IK、mesh变形及切腿；保留已批准的施法停脚→释放恢复走位→短步、权威100毫秒规则、位置插值与山魈呈现。旧S01共12张PNG，来源为单母稿离线二维网格，复用metadata须保留该来源；06拆件修复烘帧不计为本次新素材制作。补图范围为内置imagegen生成左右各6相完整步态候选，图审通过前不进入正式项目。样板实现、批准步态与连续运行／用户评看证据尚待记录。06有限离线及07的9项原生局部检查按旧版保留，07整体failed；原03／04／05／qa-hand-06失败与visual-failed汇总不改。右剑痕约领先可见tip3.8像素、最大水平1.9米处约10–30像素可达差仍open。用户视觉／声音认可、非空buffer暂停／失焦清理、存读／旧档／返院、Windows、当前包和完整SR/AC待验；不关闭需求或推进AC状态，最终refresh／validate／check待最终证据统一执行。
- 2026-10-25：战斗帧制作继续：新标尺/1.2米接近规则与守卫、陆知微完整攻击帧进入候选；party-06原生动作记录确认短步执行，整段因QA观察漏读仍failed，世界推进最大296毫秒阻塞待定位。group-01初始状态契约失败后已生成修正fixture-03，仍为组件来源。完整动作、三规模实机终态及视觉质量尚未完成，SR/AC状态保持。详见docs/design/73-COMBAT-FRAME-PRODUCTION.md。
- 2026-10-25：主Agent制作并抽帧：两守卫各hit-left1帧/down-left3帧，掌门attack-up-right6帧；原源和提示词摘要留在人物素材目录，均列运行候选。hit/down错误回退idle修复，根帧/manifest专项21/21；完整连续视觉与新native待验。正常长档同源投影性能优化在逐步等价验证中，未宣称最终实机改善。SR/AC状态保持，详见73制作记录。
- 2026-10-25：party08同源实机17项通过，worldPump最大319.9→193.1ms，仍未达流畅目标；group03新反应素材18项通过并实见伏地；solo01正常独自出谷至返院22项通过，四项来源/运行/保存/关闭标志均true。甲衣右攻击6帧/待机1帧候选接入，完整16帧步态重绘候选仍外部待审。三规模功能证据不等于完整视觉交付，SR/AC保持。详见73制作记录。
- 2026-10-25：2026-10-25动作续作：陆知微东北掌击六帧完成抽取、白底透明合成及222像素接触表检查，算法validate通过；已接入registry，18个阶段/方向采样及24项回归通过，native待验。最近角度选帧修复已应用、24项专项通过，原生待复验。16帧慢走候选核对发现原周期与3.3m/s移动不匹配，保持外部候选；详细证据见73。完整SR/AC状态保持。
- 2026-10-25：2026-10-25快步制作：八帧生成候选因缺脚与腿相位问题未接入；已取得Hunyuan四秒连续慢跑FBX作为离线姿势参考，源文件散列与任务记录在73及外部QA。源动作检查、保留腾空的抽帧流程和暂停恢复显示相位修复正在进行，尚未作为正式动作验收；SR/AC保持。
- 2026-10-25：2026-10-25接缝修正：陆知微东北掌击末帧脚点重标为v002，离线浏览器首尾对齐、24项回归通过；暂停恢复显示相位与命中保持年龄修复，根针对6项通过、相关40项通过，原生待验。根实际导入慢跑FBX，52骨映射完整，初选63–87帧作待试循环，适配和最终像素帧未批准。见73制作记录；SR/AC保持。
- 2026-10-25：2026-10-25 party09同源同行实机17项通过，265353→265725，180.965秒，来源/运行/保存/关闭均保持、错误为空；worldPump峰195.4ms，与party08接近，交战卡顿未解决。纯多边形索引已冻结，等价通过、相邻177/178且唯一失败在原基线复现。慢跑16帧底稿已渲染及重绘，仍为外部候选。详见73；完整SR/AC保持。
- 2026-10-25：2026-10-25掌门左右受击/倒地帧候选接入，registry21clips；右批24回归、左批840方向/阶段采样和直接帧5项通过，原生反应待验。慢跑16帧已离线评看，比例/滑步仍待验。性能只读定位每50ms完整山院投影及0tick重复刷新，正在限定main/sect-sim实施投影优化，权威世界活动与公开完整view保持。详见73；完整SR/AC保持。
- 2026-10-25：2026-10-25林长风右剑击六帧接入，registry22clips；正式阶段180采样、身份隔离及帧5项通过，根核对registry与8素材散列一致，原生群战待验。慢跑同标尺比对发现偏小，另制sourceHeight260外部候选，未替换运行素材。刷新优化短测发现耗时转移到combat-input，正在修正并复测，不能认定流畅。详见73；完整SR/AC保持。
- 2026-10-25：2026-10-25林长风左向六帧制作完成并复看222像素起收势，源与runtime候选已保存，registry及原生接触验证继续。成功移动输入采用即时战斗投影的短测已报告明显下降，尚待冻结、独立读回与同源桌面验证；暂停/恢复完整投影耗时仍待处理。详见73，SR/AC保持。
- 2026-10-25：2026-10-25 party10 FAILED before ready: combat HUD still reads people.find from the new light projection. Real wound-field and DOM render regression fix is pending. Root closed the isolated QA window normally; lifecycle closed at 2026-10-24T18:19:00.899Z, process exited 1, source unchanged. Original failure report preserved; stale lock moved into the QA evidence directory. Lin left attack registered (23 clips), 556 direction/phase samples and 5 frame tests passed. Full SR/AC unchanged; see 73.
- 2026-10-25：2026-10-25 user added a reusable-skill deliverable: first complete and verify one full sword-combat animation set, then distill the proven art/extraction/integration/repair workflow for other weapons and spells. Full solo/party/group goal remains. Root owns art and skill; code agents remain GPT-6.1-sol xhigh. Ground-preview inspection still suggests jogging foot slip; measurement is pending, runtime gait unchanged. See 73.
- 2026-10-25：2026-10-25 full-sword sample: root produced and inspected four right-dodge poses; source saved, external pack only. Formal phase probe found repeated playback when all frames use evade; preparing explicit windup/release/recovery/evade mapping without changing movement rules. HUD real-DOM regression reproduced before repair and passed after adding authoritative masterWound; full native rerun remains pending. See 73. SR/AC unchanged.
- 2026-10-25：2026-10-25 party11 native passed all 17 checks after the HUD repair: tick265353 to265721,179.475589s, source/runtime/native-save/closed all true, errors and finalizationErrors empty. WorldPump p50/p95/max1.3/16.3/42.7ms versus party09 15.5/107/195.4ms; rAF still peaks199.9ms, so full smoothness remains unproven. Root contact screenshot shows remaining close-body overlap. See73; full SR/AC unchanged.
- 2026-10-25：2026-10-25 dodge sample: four explicit phases repacked and right clip registered; left four-frame asset prepared and registration pending. Root ran Blender foot measurement v2 successfully (measure02, inputs unchanged); original camera forward26.7324deg differs from formal30.3603deg, and measured sole motion still differs from ground. Repaint foot calibration remains unapproved. Remaining party11 long tasks correlate with pause/skills; QA readCombat hidden full query is being repaired before next performance run. See73; SR/AC unchanged.
- 2026-10-25：party12 passed17 native checks, source/runtime/native-save/closed all true; root saw new left-dodge frame. Active status126 reads p95/max0.1ms, full reads0; rAF max460.6ms remains unresolved. Left spell registered; right-idle four-frame candidate prepared, fallback repair pending. Calibrated jog repaint still needs contact correction. Complete sword sample and reusable skill remain in progress; SR/AC unchanged. See73.
- 2026-10-25：用户要求参照鬼谷八荒改为远程斗法及大场地。48×32米林间、跟随镜头、10米移动剑气已接入；victory-02原生19项流程通过，实际命中/施法接闪避/避岩刺/胜利返院与原生重开成立，来源和运行保持。同源worldPump尖峰1001.5→317.8ms，仍不流畅；跑步帧及整体美术未完成，完整SR/AC保持，详见73。
- 2026-10-25：战斗integrated-01原生7项通过，265258→265600、active34.199秒，来源/运行/保存/正常关闭一致。首键1.1ms，世界步仍232ms、activity完整投影61ms；流畅度未通过。用户指出跑动帧尺度/上下抖动，当前转入Game Art Style全站与开源动效选型，素材未替换；完整动作库、美术和skill继续开放。详见73。

本文件由[registry.json](../registry.json)派生；更新台账后执行 `python scripts/requirements/sr-manager.py refresh`，不单独修改此派生页。
