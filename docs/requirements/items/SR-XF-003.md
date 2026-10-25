# SR-XF-003 · 统一米制空间、导航与镜头

来源：DB-2026-10-05 v1.2；需求版本：1.2；建档日期：2026-10-06。

| 字段 | 值 |
| --- | --- |
| 范围 / 模块 | 前期必需 / 空间 |
| 优先级 / 计划 | P0 / I1 |
| 设计 / 开发 | draft / in_progress |
| 验收 / 发布 | in_progress / not_released_for_this_sr |
| 责任人 / 复核人 | Codex/space_construction / Codex/root（集成） |

## 来源、依赖与范围

纳入云岫前期，按依赖推进。

决策来源：U-63, U-93, R-25, U-94, U-95, U-96, U-97, R-27, U-98, U-99, R-28, U-100, R-29, R-30, U-102, U-103, U-104, U-105, R-32, U-109, U-118, U-123, U-126, U-127, U-128, U-129, U-130, U-131, U-132, U-138, U-142, U-143, U-144, U-149, R-49, U-150, R-50, U-155, U-156, U-166, R-54, U-167, T-20, T-21, T-22。这是继承的U项和作者实施默认；具体新增名称/数值不得伪装成用户逐项批准。

规格：[03-SPATIAL-ART.md](../../../docs/design/03-SPATIAL-ART.md)、[05-RUNTIME-CONTRACTS.md](../../../docs/design/05-RUNTIME-CONTRACTS.md)、[14-EARLY-GAME-DETAILED-DESIGN.md](../../../docs/design/14-EARLY-GAME-DETAILED-DESIGN.md)、[18-SPATIAL-CONTINUITY-IMPLEMENTATION.md](../../../docs/design/18-SPATIAL-CONTINUITY-IMPLEMENTATION.md)、[GODOT-MIGRATION.md](../../../docs/GODOT-MIGRATION.md)、[ART-REALTIME-TRIAL.md](../../../docs/ART-REALTIME-TRIAL.md)、[SECT-GROWTH-PLAN.md](../../../docs/SECT-GROWTH-PLAN.md)、[41-COURTYARD-VALLEY-IMPLEMENTATION.md](../../../docs/design/41-COURTYARD-VALLEY-IMPLEMENTATION.md)、[51-COURTYARD-MANAGEMENT-INTEGRATION.md](../../../docs/design/51-COURTYARD-MANAGEMENT-INTEGRATION.md)、[46-CONTINUOUS-DOMAIN-FOUNDATION.md](../../../docs/design/46-CONTINUOUS-DOMAIN-FOUNDATION.md)、[52-EAST-TERRACE-INTEGRATION.md](../../../docs/design/52-EAST-TERRACE-INTEGRATION.md)、[WEB-RETIREMENT-20261017.md](../../../docs/engineering/WEB-RETIREMENT-20261017.md)、[58-GOLDEN-CORE-PRESET-BUILDINGS.md](../../../docs/design/58-GOLDEN-CORE-PRESET-BUILDINGS.md)、[59-WEST-FOREST-INTEGRATION.md](../../../docs/design/59-WEST-FOREST-INTEGRATION.md)、[60-WEST-VALLEY-INTEGRATION.md](../../../docs/design/60-WEST-VALLEY-INTEGRATION.md)、[61-RESIDENTIAL-INTEGRATION.md](../../../docs/design/61-RESIDENTIAL-INTEGRATION.md)、[62-EAST-SERVICES-INTEGRATION.md](../../../docs/design/62-EAST-SERVICES-INTEGRATION.md)、[64-NORTH-LIBRARY-INTEGRATION.md](../../../docs/design/64-NORTH-LIBRARY-INTEGRATION.md)、[69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md](../../../docs/design/69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md)、[71-GUESTHOUSE-INTEGRATION.md](../../../docs/design/71-GUESTHOUSE-INTEGRATION.md)、[76-DISCIPLE-CULTIVATION-PROGRESSION.md](../../../docs/design/76-DISCIPLE-CULTIVATION-PROGRESSION.md)、[78-APPROACH-RESPONSE.md](../../../docs/design/78-APPROACH-RESPONSE.md)。

依赖：[SR-XF-002](SR-XF-002.md)。

关联既有验收：PATH-01, SCENE-02, SAVE-01, GROWTH-01, GROWTH-02, GROWTH-09, GROWTH-10；本SR的AC细化这些目标，不代表旧版本已经通过。

## 现状与设计缺口

既有 JS 运行基线：96米山院与2米营造格沿用同一米制空间。本批登记adult-furniture-1室内布局，成人家具、导航、预约脚点和可见床面共用预制件；旧合法布局在副本中一次映射并记录位置变化。 U-105 山域成长方案见 docs/SECT-GROWTH-PLAN.md；本批只登记设计与阶段原型，正式运行版本保持。
2026-10-14 U-142：先审核完整山院美术原型，再按构图、细节、精度与材质还原实机。目标模式、场景接入及20分钟长验按用户要求暂停；本地增量保留。原型见 docs/art/pixel-courtyard-prototype-20261014/README.md；原型不计作运行验收，既有SR/AC状态保持。

U-105 山域分区、稳定地域身份和统一布局解析已写入成长章程；各区逻辑米边界、建位入口、道路长度和跨区连接仍待实施设计，五阶段镜头、寻路及目标设备待实际验收。

现状是适用旧能力的基线，不表示该SR完整目标已通过。

## 必须补齐的设计交付物

1. Z-01–07 的逻辑米边界、预设建位与连接端点表；保留 Z-01 既有96米空间的兼容映射。
2. 布局版本对建筑、入口、工位、碰撞、路径与镜头的统一解析，以及分区只读总览规则。
3. 各区导航、门道与旧布局映射的失败、恢复和存读规则。

## 需求行为

SR-XF-003-REQ-01：人物脚点、建筑、门口和工位使用同一米制空间；Z-01–07 仅组织同一山域中的实际地域，位置与路径由布局层解析。

SR-XF-003-REQ-02：建设、桥路连通及迁建改变后重验真实路线，人物不穿墙、不被困于失效入口；保留原身份和活动事实。

SR-XF-003-REQ-03：总览、分区近景、缩放与营造保持选中身份；阶段变化读取同一布局和世界时钟，不重建人物或设施。


## 验收标准

| ID | 情景 / 操作 | 必须看到的结果 | 状态 |
| --- | --- | --- | --- |
| SR-XF-003-AC-01 | 穿过门口并绕行新建筑 | 足够宽门道可通行，墙体与过窄缝隙不可通行；建设后能合法重规划。 | passed |
| SR-XF-003-AC-02 | 同一山域的五阶段总览、分区近景及触点缩放切换 | Z-01–07 的地域和选中对象对应同一世界位置；人物与门比例统一，布局和镜头切换不改身份、时间或资源。 | not_run |
| SR-XF-003-AC-03 | 有来源旧坐标/96米布局样本加载到山域地域与建位布局 | 旧位置与稳定建筑/工位引用有确定映射，可恢复兼容位置有记录；人物、时间、资产和既有活动保留，未知布局安全拒载。 | not_run |

SR-XF-003-AC-01证据：tests/unit/web/ea-sr-spatial-door-replan.test.mjs；tests/acceptance/ea-sr-spatial-acceptance.mjs；docs/design/STATUS.md；2026-10-15：tests/unit/web/ea-sr-spatial-door-replan.test.mjs 按U-115补齐公开择法，2/2；同档7条成功命令、1条拒绝、3次精确重载。设施与出口回归19/19，含真实堵路存档。记录见 docs/art/pixel-courtyard-prototype-20261014/RUNTIME.md。

SR-XF-003-AC-02证据：局部：tests/acceptance/ea-sr-spatial-acceptance.mjs（生产Canvas：总览按钮聚焦、同号对象与标签、显式触点逆投影及状态只读）；局部：tests/unit/web/map-input.test.mjs（双触点中点与取消）；局部：docs/design/STATUS.md（隔离真实浏览器鼠标/合成触控步骤、截图路径及未覆盖范围）；局部：tests/acceptance/ea-sr003-outer-camera-acceptance.mjs；局部：tests/acceptance/ea-sr-ui-acceptance.mjs；局部：2026-10-08 r21 青溪坊市与驻棚真实浏览器显式总览→选中建筑→回近景；坊市保存刷新续读，根复跑镜头5/5与UI17/17；门位画稿、目标设备未覆盖。

2026-10-07本地小院批次：成人家具/单位格/空间定向检查48/48（8/6/34），正常公开命令接受/拒绝邀请两路完成营造、产出搬运、研习、到床休息与迁建取消/续建；分别60命令/36次精确存读和61命令/37次精确存读。六身份卧姿与预约前提2/2，生产Canvas卧姿加载/只读/身体点选/缺图回退4/4，已读图。旧v5完成档40建筑30门人保留资源、时间和return结局，全部入口可达，二次存读一致。各SR仅登记适用子情景；完整AC、真机触摸/FPS和真人首次体验状态分别保留。 浏览器DPR1鼠标在1366×900、1180×820、820×1180点选床上掌门通过；正常推荐营造经Enter和鼠标确认、实际施工落成。一次动态模块加载失败经页面重载恢复同档，原因待定位。I/V证据为沿既有可用契约实施的本批子范围；完整D01/D02及I/V关闭门槛保持原状态。

2026-10-07 M0/M1 接续批：03 §3 的双指手势中心及滚轮当前指针锚点已接入统一米制镜头，输入13/13、空间生产Canvas34/34通过；非法焦点不再污染镜头。浏览器鼠标自由营造镜头已复验，真机双指/完整近景总览玩家链未做，AC02仍 not_run。

2026-10-07 M1 门道与绕行：新档公开命令疗伤后在(26,16)建成门人居，存读后穿真实门道到床位、退到左侧；在门口重叠营造灵草田被原子拒绝，随后向右沿合法路径绕墙，二次存读位置/原建筑保持。6条成功公开命令、1条拒绝、2次精确重载；定向1/1，已有窄缝/墙体和生产Canvas空间34/34。根执行者复读用例并复跑通过，AC01按Node公开命令/组件环境通过；未据此声称真实网页或目标设备已验，AC02及整项门槛保持。

2026-10-07 M1 第六批镜头子情景：隔离浏览器 qa-sr003-camera-20261007 从有来源的第584日五人/十设施返院档导入第二档位，暂停状态在 820×1180 和 1200×843 画面点选门人居，总览→按钮放大保持建筑可见和详情对应；在画布角落残留悬停后再放大复验通过。浏览器合成双触点缩放时，锚点和选择未丢；这是 CDP 合成触控而非 iPadOS 真机。首轮发现总览按钮放大落到空地，后经修复及独立复核；同号建筑/门人聚焦及标签歧义也已修复。生产 Canvas 定向34/34、输入13/13，镜头前后序列化世界状态不变。仍缺真机双指与逐建筑人物/门视觉比例、详情遮挡核对，故 AC02 保持 not_run，完整 D/I/V/R 保持原状态。
2026-10-08 U-101 背层版独立隔离浏览器复核 AC02 子范围：有来源第584日五人十设施档，在 1200×843 和 820×1180 视口点选主屋、门人居及掌门，切总览/近景、滚轮、平移和合成双指后，同一对象与详情仍对应；背层不挡点击，相关定向47/47。人物/门比例未见明显跳变，但未逐类审查，竖屏详情覆盖选中建筑局部；合成触控非 iPadOS 真机，故 AC02 继续 not_run。截图 /tmp/immortal-sr003-ac02-portrait-{near,overview}.png。

2026-10-08 M1 竖屏 UI 子批：820×1180 合法旧 v5 完成档 40 建筑/30 人，真实浏览器完整画稿加载、控制台零错误；选中宗门正殿与 (350,500) 滚轮放大后屋脊/屋檐/台阶/入口均完整在详情之外。生产 renderer 定向覆盖连续触点缩放、极端边缘限幅、地形边界、状态只读，合并空间相关 46/46；独立复核通过该交互窄项。门人居/藏经阁门洞画稿比例、真 iPadOS 触控与全部逐类视觉仍未验，AC02 保持 not_run，I/V/R 不关闭。

2026-10-08 M1 山外局部镜头子批：64×48 米、45°/0.65 镜头，四角物件占地、投影逆变换及限幅；封闭驻棚隐藏占地内人物画面，屋顶点选建筑，地点卡具名打开邢烈；露天谷地青萝保持可见可点。正常公开命令链生成 ward 档且逐次 validateSave；独立代码专项 5/5、相邻 SR003 3/3、输入 13/13、世界 21/21、SR UI 17 pass/4 pending。独立 Chromium 在 1200×849、820×1180 实点屋顶、姓名入口及谷地露天青萝通过，控制台 0 ERROR；试读仅内存，HUD 资源在点选前后相同；冻结版浏览器未专项核对 worldTick 数值。真 iPadOS、全建筑人物/门比例和显式总览按钮本进度仍待；AC02 not_run，I01 in_progress、V/R todo。
2026-10-08 r6 发布：运行源码 main 6617b8670fd396a488469a864ba170b4f2681425，Pages a6fd4838ff0ba998a7f1bb20b97016aa298ddf37，构建 built；四个公开脚本与发布树一致。独立公网 Chromium 首载 ea-persistence.mjs HTTP 503 导致页面未展开及 2 条控制台 ERROR；一次重载后隔离档新建/保存/刷新续档与合法 ward 试读屋顶、邢烈入口通过，之后 0 新 ERROR；再次刷新原档仍在。首载可用性未通过，真机和完整 AC02 仍待。公网报告 /private/tmp/immortal-sr003-r6-public-smoke.json。
2026-10-08 M1 r8 门道与避让子批：同 tick 候选下一步按(首达世界步,人物ID)授予单人过门，失效活动放锁；身体避让不穿墙，持货路线被新建筑截断时复核剩余全路并重求原目标。普通公开命令/精确存读 7/7，施工物流 7/7、相关串行 2/2，空间/施工人员/地图输入 57/57，独立只读复核室内精确脚点不变。浏览器旧档外观与露天人物点选通过，门道浏览器逐步读回/真机拥挤布局与 AC02 完整门槛未验；AC 状态不变。
2026-10-08 门人居门洞画稿对位只读量测：一级完工图可见门槛相对 spatialPrefab(b).door 投影估计偏横向 0.85 米、纵深 1.27 米，超过现行 0.35/0.25 米容差；试修未满足门槛，生产素材和元数据未改。其余六阶段、藏经阁/其他建筑、浏览器逐类与真机触控均未验，AC02 继续 not_run。仓库外量测 /private/tmp/immortal-r10-door-art-trial.json。
2026-10-08 M1 r10 暂停静止院景减负：合法 40 建筑/30 人档 1200×849/DPR1 冻结对照约3秒清画 180→0、drawImage 10440→0，画布像素 SHA-256 相同、点主殿卡一致；运行候选 139/139 帧照绘。同一 state 对象建筑/人物原地变化、hover/selection、镜头/视口/DPR、规划、素材重试均定向通过，独立 1/1 与相邻 16/16。发布源码 main 542b3502bd33055d62ac963f7ae1c06bdd6b4707，Pages f57c25079de2693e3625fce136f170b1de306042 built，162 文本发布 blob 全部匹配；公开浏览器被应用管理员策略验证不可用拦截，首载/交互未验。整幅运行卡顿未解决，AC02 和 I/V/R 不提升。
2026-10-08 r14 默认倍率密集山院局部减负：已验收来源档40建筑/30人、1200x849/DPR2，独立本地Chromium两次各6秒热身后对照，rAF回调约34.8/s→56.7/s、间隔P95 50→16.8ms；候选最长166.7ms且主线程累计任务时间更高，不等于实际显示FPS或整幅卡顿修复。32MiB LRU、每帧最多新建1幅、素材/销毁清空、无OffscreenCanvas直绘降级；像素专项均差0.11/255、强差0.07%，主殿外观/门位/人物遮挡与点选保持。缓存专项1/1、暂停/田地2/2、三人点选及封闭建筑回归通过；相邻4项旧断言在未改空间/场景逻辑失败。源码307894b、Pages f3e0d63 built，162文本blob匹配。缩放长帧、首次导入、公开浏览器、真机和完整AC02/I/V/R继续。
2026-10-08 M1 r21 山外总览标签子批：正式青溪坊市与驻棚公开来源档在本地 Chromium 实点“此地总览”，选建筑并用放大返回近景，详情保持；坊市明确保存、刷新续读后场景与资源保持。正式进度驻棚按钮可见；开局引导隐藏规则维持。根合入后镜头5/5、界面17/17，Pages built，162文本blob相符。七阶段门位画稿、真机触控和真人辨识未覆盖；AC02、完整I/V/R不提升。

2026-10-08 M1 r28 QA 基线修正：建筑网格脚本以真实当前场景检查缩放/平移，旧生产配方快照按既有一次迁移及幂等结果断言；此前两项旧基线失败均由验收脚本过时造成。仅改 tests/acceptance/ea-building-grid-acceptance.mjs，修正后6/6；不作为门位画稿、触控或 SR003-AC02 已验收证据。

2026-10-08 M1 r30 寻路碰撞减负：沿既有2米障碍索引，以多边形包围盒保守排除远离当前扫掠线段的障碍，不改路径和实际碰撞判定。独立复核先找到半径0贴边的1e-10容差反例，根修正索引/AABB 同一容差并加定向回归。空间36/36、门道2/2、建筑网格6/6；合法v5 40建筑/30人档540条路线+540次扫掠及400世界步终态与旧版完全一致。本地Chromium两轮400步均值7.90/9.49→6.49/8.14ms，P95 24.1/30.7→22.8/28.2ms；12秒真实页面 rAF P95 25.1→25.4ms、长任务3→4，不能认为整体画面卡顿已解决。公网包162文本blob与入口/空间模块一致，目标设备FPS和SR003整项继续。

2026-10-08 r36 门队列清理减负：单次调用共享门与在院人物集合，空队列早返回并避免重复识别行走者；逐人移动、候位与门独占规则未变。独立合法 40 建筑／30 人档 400 世界步终态 768336 字节、100/200/400 检查点、逐步门队列及读档与 r35 一致（345 步非空），门道人流 7/7、空间 Canvas 36/36。旧世界步 P95 两轮 28.01→24.35ms、27.23→23.80ms；本地 Chromium rAF P95 6.2/6.0→6.1/6.1ms 无稳定改善，整体卡顿继续。公开 r36 同档导入、运行、保存刷新续玩且控制台零错误；main 74e135d、Pages 47d4352 built、162 文本 blob 相符。门位画稿、完整 AC02 和真机仍未验，状态不提升。

2026-10-09 U-105 / R-32：当前需求更新为 1.2，山域设计关联 GROWTH-01、GROWTH-02、GROWTH-09、GROWTH-10。旧版 1.1 的标题、需求、AC原文/证据及D/I任务完成范围保存在 registry.json 的 version_history；当前重新记 not_run：SR-XF-003-AC-03。 当前D01继续补实施参数，D02及本版本I01待前置完成；development_status保留既有运行实现基线。未改变的已通过AC只沿用原行为及原运行环境证据，新增地域、布局与迁移流程按GROWTH另验。本批未执行运行时验收，未修改正式运行版本或发布状态。

2026-10-12 U-123：山谷场景50米赴山门、8秒旅行、谷内行走与返院已在1440×960网页实走；山谷及场景投影定向5／5、5／5，目标设备及整项空间验收继续。 局部证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。

2026-10-12 U-123 首战本地网页：最终本地战斗网页实走闪避脚点 y 4→1.2、撤退后谷内脚点（21.9332，35.7668）及返院路径；同一世界位置继续存档。完整空间与目标设备验收仍按原状态。 证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。

2026-10-12 U-123 发布核验：运行源码 main 836ccb605a42e7c21c2aae8c5e2c4eee7e55c03e；gh-pages 4d6786da521f1ab92818c20f67c036a829469e6e；GitHub API Pages build=built。公开 mountain-courtyard 的14个交付文件（release/build/index、界面与加载模块、桥接及世界／战斗规则、三片场景包）HTTP 200，SHA与本地导出一致。公开浏览器百艺、导档、实际行走旅行与采集的操作证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；本记录仅是U-123局部发布证据，整项 D/I/V/R 与 AC 状态不变。

2026-10-18 U-164/U-165局部：多Agent完成林长风门籍规则及同窗交互首轮，规则8/8、相关11/11，主Agent联合供粮/操作33/33；亲传Electron专项9项，范围限当时人物交互。用户明确扩大主殿山域、整体绘制采伐场、所有建筑完全预设并由人物实际到场修建；院前临时营造入口与独立素材已撤下。下一步先确认整体场景和稳定建位，再接施工与三人同源长验。二十分钟、当前桌面包、Windows及完整SR/AC尚未完成，整项状态保持。

2026-10-18 U-167局部：批准25项设施/31预设建位布局并分期开发；31目录已接入，原殿/药圃/东台保留身份，西林一级完成真实西桥运料、到场施工、两工位产木与搬回公库，其余27处待接。默认170/170、相关31项及地面校准后6+10项复验通过。macOS源码Electron同一两人来源档10/10、100.894秒，投入25灵石20木8石，6木实际回库，三次存读精确，页面/运行错误0。证据docs/design/59-WEST-FOREST-INTEGRATION.md；升级画层、三人长验、Windows及当前包另验，整项D/I/V/R与AC状态保持。 2026-10-18 U-167西谷GC-17/18/19/24开发中：显式扩谷、固定施工、有限石源、现场种粮及独立分类公库已写入。同源30条公开命令连续营造四处并精确存读，证据/Volumes/Media/immortal-qa/west-valley-prepared-20261018-v2/。阶段美术及完整桌面验收继续；远路邀请已改为有限通勤、到岗后计劳动承诺，旧邀请期限保留，公库口粮纳入实际回运；整项SR/AC状态保持。

2026-10-25 人物走近已接入后台寻路，主线程保留正式身体校验与事务提交。macOS源码Electron两普通来源实际近身、途中及终点共4组原生保存/关闭重开通过，最终284802；首反馈约48–55ms。旧场景最长帧间隔206.5ms，最新经营档192.1ms，200ms响应目标尚未全部通过。根定向32/32；导航相邻9/10及命令相邻41/44的4项失败均在修前版本复现。原失败记录保留，完整流畅度、Windows、整项SR/AC及发布状态保持。 详见 docs/design/78-APPROACH-RESPONSE.md。

## 开发任务

| 任务 | 工作 | 状态 | 前置 | 责任人 |
| --- | --- | --- | --- | --- |
| SR-XF-003-D01 | 设计补齐：当前版本设计补齐：补齐各区逻辑米范围、建位/入口/桥路连接及布局版本解析表，依据 GROWTH-01/02/09/10 复核。 原版本已完成范围和证据保存在 version_history。 | in_progress | 无 | Codex/root |
| SR-XF-003-D02 | 契约与内容审阅：在当前版本D01完成后，审阅统一米制空间、导航与镜头与依赖契约的字段、时序、失败及恢复；核对本SR的REQ/AC和GROWTH-01、GROWTH-02、GROWTH-09、GROWTH-10。旧版审阅完成事实保存在 version_history。 | todo | SR-XF-003-D01 | Codex/sr010_contract_validation |
| SR-XF-003-I01 | 开发与集成：按当前版本设计在相关模块集成统一米制空间、导航与镜头，接入真实数据、行为、素材、界面和存读。既有实现保留为运行基线；本版本在D02完成后进入集成。 | todo | SR-XF-003-D02 | Codex/courtyard-integration |
| SR-XF-003-V01 | 验收与兼容：执行本SR的AC-01至AC-03及GROWTH-01、GROWTH-02、GROWTH-09、GROWTH-10；分别记录正常、失败、存读、网页视口和适用真机证据。 | todo | SR-XF-003-I01 | Codex/courtyard-acceptance |
| SR-XF-003-R01 | 发布与关闭：完成所需源码/运行时发布核对、交接和未覆盖说明；本轮用户不要求上传QA过程产物。 | todo | SR-XF-003-V01 | 待分配 |

SR-XF-003-D01证据：docs/SECT-GROWTH-PLAN.md

SR-XF-003-I01证据：src/simulation/ea-sr-spatial.mjs；docs/design/STATUS.md；apps/web/map-input.mjs；apps/web/ea-game.mjs；apps/web/ea-courtyard-renderer.mjs；apps/web/ea-world-scene-art.mjs；apps/web/ea-sr-ui.mjs；tests/acceptance/ea-sr003-outer-camera-acceptance.mjs；tests/acceptance/ea-sr003-pedestrian-occupancy-acceptance.mjs；src/simulation/ea-scenic.mjs；src/simulation/ea-facility-activities.mjs；tests/acceptance/ea-paused-courtyard-render-acceptance.mjs；2026-10-08 r14 默认倍率密集山院局部减负：已验收来源档40建筑/30人、1200x849/DPR2，独立本地Chromium两次各6秒热身后对照，rAF回调约34.8/s→56.7/s、间隔P95 50→16.8ms；候选最长166.7ms且主线程累计任务时间更高，不等于实际显示FPS或整幅卡顿修复。32MiB LRU、每帧最多新建1幅、素材/销毁清空、无OffscreenCanvas直绘降级；像素专项均差0.11/255、强差0.07%，主殿外观/门位/人物遮挡与点选保持。缓存专项1/1、暂停/田地2/2、三人点选及封闭建筑回归通过；相邻4项旧断言在未改空间/场景逻辑失败。源码307894b、Pages f3e0d63 built，162文本blob匹配。缩放长帧、首次导入、公开浏览器、真机和完整AC02/I/V/R继续。；2026-10-08 r27 门道候位存读修复：正常公开新档建住宅、招三人、落成百工坊，完工后人物路线随几何更新被清空时，同步清理已失效候位，不再等加载才改变存档；林长风床位活动和真实脚步保留。根正常链1/1、原门道改路1/1、空间36/36，坏旧候位下一真实世界步清理、失效记录不留、精确存读。建筑网格宽测4/6，两失败（缩放选点、旧生产快照断言）在此前独立基线相同；首次空间宽测因本机缺Canvas依赖失败一项，按既有NODE_PATH重跑36/36。源码c8f71b8、Pages944f072 built，162文本blob及公网空间模块一致；本批未实点浏览器或目标设备。SR003-AC02门位画稿/触控与整项I/V/R继续。证据 tests/acceptance/ea-sr003-door-queue-reload-acceptance.mjs。；docs/design/49-P0-P2-COURTYARD-PROGRESS.md；2026-10-15 U-147/R-47：院务/人物/工位/物资/研习操作、保存失败保护和疗伤收据重放；47/47 Node检查。浏览器内核缺失且官方下载失败，实际UI与桌面未验，完整P0—P2及SR/AC状态保持。；docs/design/59-WEST-FOREST-INTEGRATION.md；tests/acceptance/courtyard-west-desktop.mjs；2026-10-18 U-167西谷GC-17/18/19/24开发中：显式扩谷、固定施工、有限石源、现场种粮及独立分类公库已写入。同源30条公开命令连续营造四处并精确存读，证据/Volumes/Media/immortal-qa/west-valley-prepared-20261018-v2/。阶段美术及完整桌面验收继续；远路邀请已改为有限通勤、到岗后计劳动承诺，旧邀请期限保留，公库口粮纳入实际回运；整项SR/AC状态保持。；2026-10-18 U-167/T-20住宅接续：GC09–12沿固定建位建设，四院一级16实体床；独立床位模块10/10规则检查，含只读旧档、唯一床位、真实到床、途中存读与失效恢复。三院完工及空地母稿已制作，世界位置与升级占地待校准。正式运行接缝、近身有限交易筹资和同源桌面营建入住尚待完成；本条只登记住宅局部准备，不推进完整SR/AC状态。；2026-10-18 U-167/T-19西谷一级批：同一未改正常来源macOS源码Electron连续31/31，墙钟1219.061秒、tick646→10944、7次精确关闭重开、错误0。四址实际运料施工，有限采石18.4及两田实际收获后35.2593256粮搬入新公库，两田各留2种粮。根独立读回来源SHA/最终状态/截图，源码与素材hash随run03封存；完整SR/AC、升级损坏图、供水保鲜、Windows和安装包仍按原范围接续。详见docs/design/60-WEST-VALLEY-INTEGRATION.md。

SR-XF-003-V01证据：tests/acceptance/ea-indoor-furniture-acceptance.mjs；tests/acceptance/ea-courtyard-life-acceptance.mjs；docs/design/STATUS.md；tests/unit/web/map-input.test.mjs；tests/acceptance/ea-sr-spatial-acceptance.mjs；tests/acceptance/ea-sr003-pedestrian-occupancy-acceptance.mjs；tests/acceptance/ea-paused-courtyard-render-acceptance.mjs；2026-10-08 r14 默认倍率密集山院局部减负：已验收来源档40建筑/30人、1200x849/DPR2，独立本地Chromium两次各6秒热身后对照，rAF回调约34.8/s→56.7/s、间隔P95 50→16.8ms；候选最长166.7ms且主线程累计任务时间更高，不等于实际显示FPS或整幅卡顿修复。32MiB LRU、每帧最多新建1幅、素材/销毁清空、无OffscreenCanvas直绘降级；像素专项均差0.11/255、强差0.07%，主殿外观/门位/人物遮挡与点选保持。缓存专项1/1、暂停/田地2/2、三人点选及封闭建筑回归通过；相邻4项旧断言在未改空间/场景逻辑失败。源码307894b、Pages f3e0d63 built，162文本blob匹配。缩放长帧、首次导入、公开浏览器、真机和完整AC02/I/V/R继续。；2026-10-08 r27 门道候位存读修复：正常公开新档建住宅、招三人、落成百工坊，完工后人物路线随几何更新被清空时，同步清理已失效候位，不再等加载才改变存档；林长风床位活动和真实脚步保留。根正常链1/1、原门道改路1/1、空间36/36，坏旧候位下一真实世界步清理、失效记录不留、精确存读。建筑网格宽测4/6，两失败（缩放选点、旧生产快照断言）在此前独立基线相同；首次空间宽测因本机缺Canvas依赖失败一项，按既有NODE_PATH重跑36/36。源码c8f71b8、Pages944f072 built，162文本blob及公网空间模块一致；本批未实点浏览器或目标设备。SR003-AC02门位画稿/触控与整项I/V/R继续。证据 tests/acceptance/ea-sr003-door-queue-reload-acceptance.mjs。；docs/design/49-P0-P2-COURTYARD-PROGRESS.md；2026-10-15 U-147/R-47：院务/人物/工位/物资/研习操作、保存失败保护和疗伤收据重放；47/47 Node检查。浏览器内核缺失且官方下载失败，实际UI与桌面未验，完整P0—P2及SR/AC状态保持。；docs/design/59-WEST-FOREST-INTEGRATION.md；tests/acceptance/courtyard-west-desktop.mjs；2026-10-18 U-167西谷GC-17/18/19/24开发中：显式扩谷、固定施工、有限石源、现场种粮及独立分类公库已写入。同源30条公开命令连续营造四处并精确存读，证据/Volumes/Media/immortal-qa/west-valley-prepared-20261018-v2/。阶段美术及完整桌面验收继续；远路邀请已改为有限通勤、到岗后计劳动承诺，旧邀请期限保留，公库口粮纳入实际回运；整项SR/AC状态保持。；2026-10-18 U-167/T-20住宅接续：GC09–12沿固定建位建设，四院一级16实体床；独立床位模块10/10规则检查，含只读旧档、唯一床位、真实到床、途中存读与失效恢复。三院完工及空地母稿已制作，世界位置与升级占地待校准。正式运行接缝、近身有限交易筹资和同源桌面营建入住尚待完成；本条只登记住宅局部准备，不推进完整SR/AC状态。；2026-10-18 U-167/T-19西谷一级批：同一未改正常来源macOS源码Electron连续31/31，墙钟1219.061秒、tick646→10944、7次精确关闭重开、错误0。四址实际运料施工，有限采石18.4及两田实际收获后35.2593256粮搬入新公库，两田各留2种粮。根独立读回来源SHA/最终状态/截图，源码与素材hash随run03封存；完整SR/AC、升级损坏图、供水保鲜、Windows和安装包仍按原范围接续。详见docs/design/60-WEST-VALLEY-INTEGRATION.md。

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
- docs/art/combat-field-study-20261025/README.md
- docs/art/combat-motion-study-20261025/README.md
- 2026-10-25 U-171最新接续：用户认可整体美术方向并授权校准后制作帧动画，非新尺度/动作/实机验收。40逻辑像素/米同网格静态图人101px/兽164px，主Agent审看可继续，用户新比例未评；阴影及原生像素密度一致性未验。跑步v1–v3均未通过，停止生成；白底/HTML/100ms诊断GIF保留，未完成连续播放或实机验收。仅离线局部证据，运行素材registry与全部D/I/V/R、AC及任务状态保持。
- 2026-10-25 U-171静态美术候选：网站真实global prompt起步，三次内置image_gen生成/定向修订后展示1536×1024第三稿，主Agent已审图、用户评看待定；人物超过108px预算、严格像素网格未验，22米精确比例未锁定。原LPC人物、通用兽人及重复草地成品已被用户否决，原包和运行引用保留。本批仅静态构图与来源记录，无动作库、运行替换、性能或游戏存档操作；D/I/V/R与全部AC状态保持，详见73。
- docs/design/03-SPATIAL-ART.md
- docs/design/STATUS.md
- src/simulation/ea-sr-spatial.mjs
- tests/acceptance/ea-indoor-furniture-acceptance.mjs
- tests/acceptance/ea-courtyard-life-acceptance.mjs
- docs/CODEX-HANDOFF.md
- apps/web/map-input.mjs
- apps/web/ea-courtyard-renderer.mjs
- tests/unit/web/map-input.test.mjs
- tests/unit/web/ea-sr-spatial-door-replan.test.mjs
- tests/acceptance/ea-sr-spatial-acceptance.mjs
- tests/acceptance/ea-sr003-pedestrian-occupancy-acceptance.mjs
- src/simulation/ea-scenic.mjs
- src/simulation/ea-facility-activities.mjs
- tests/acceptance/ea-paused-courtyard-render-acceptance.mjs
- apps/web/ea-estate-assets.mjs
- tests/acceptance/ea-building-raster-cache-acceptance.mjs
- apps/web/ea-ui.mjs
- 2026-10-08 r27 门道候位存读修复：正常公开新档建住宅、招三人、落成百工坊，完工后人物路线随几何更新被清空时，同步清理已失效候位，不再等加载才改变存档；林长风床位活动和真实脚步保留。根正常链1/1、原门道改路1/1、空间36/36，坏旧候位下一真实世界步清理、失效记录不留、精确存读。建筑网格宽测4/6，两失败（缩放选点、旧生产快照断言）在此前独立基线相同；首次空间宽测因本机缺Canvas依赖失败一项，按既有NODE_PATH重跑36/36。源码c8f71b8、Pages944f072 built，162文本blob及公网空间模块一致；本批未实点浏览器或目标设备。SR003-AC02门位画稿/触控与整项I/V/R继续。证据 tests/acceptance/ea-sr003-door-queue-reload-acceptance.mjs。
- docs/art/REALTIME-TRIAL-2026-10-09.md
- archive/godot/art/art_courtyard.gd
- archive/godot/art/actor_3d.gd
- archive/godot/tools/build-art-web.py
- docs/art/PAINTED-COURTYARD-2026-10-09.md
- docs/SECT-GROWTH-PLAN.md；2026-10-09 山域总图、五阶段迁移及统一原型的设计来源；当前运行验收待补。
- docs/design/STATUS.md；2026-10-10 U-109 旧别院 3D 本地预览局部网页证据；完整 AC 状态不变。
- archive/godot/estate_2d/estate.gd
- tests/unit/web/ea-godot-bridge.test.mjs
- 2026-10-11 U-118 局部：米制山院自由行走约 3.16 米／秒；tests/acceptance/ea-sr-spatial-acceptance.mjs 36／36，tests/unit/web/ea-godot-bridge.test.mjs 的步速与存读用例通过；隔离 Chromium 连续五秒行走及暂停重载见 STATUS。完整七区与目标设备 AC 继续按原门槛。
- archive/godot/qa/estate-motion-check.gd
- 2026-10-11 U-118 转向校准：Godot 路径交界 4／4；本地 Chromium 两段路线及中途改道累计 5 次转向，行走中站立转身帧 0、移动停帧最长 0 毫秒；暂停存读一致。完整地域及目标设备 AC 状态不变。
- docs/art/COURTYARD-VALLEY-2026-10-12.md
- tests/unit/web/ea-mountain-valley.test.mjs
- tests/unit/web/ea-godot-valley-projection.test.mjs
- 2026-10-12 U-123 发布核验：运行源码 main 836ccb605a42e7c21c2aae8c5e2c4eee7e55c03e；gh-pages 4d6786da521f1ab92818c20f67c036a829469e6e；GitHub API Pages build=built。公开 mountain-courtyard 的14个交付文件（release/build/index、界面与加载模块、桥接及世界／战斗规则、三片场景包）HTTP 200，SHA与本地导出一致。公开浏览器百艺、导档、实际行走旅行与采集的操作证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；本记录仅是U-123局部发布证据，整项 D/I/V/R 与 AC 状态不变。
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
- 2026-10-15 门道回归修复：按 U-115 补齐旧测试的首次疗伤择法步骤，验证择法前世界暂停、精确存读及草药不重复扣除，再执行原有营造、穿门、拒绝堵门、绕墙与存读断言。门道2/2、设施16/16、主殿与药田出口3/3，共21/21、失败0、跳过0；后者包含两份真实堵路存档恢复。本次仅修改测试与记录，运行规则、桌面包及完整SR/AC状态保持。 详见 docs/art/pixel-courtyard-prototype-20261014/RUNTIME.md。
- docs/design/49-P0-P2-COURTYARD-PROGRESS.md；2026-10-15 U-147/R-47：院务/人物/工位/物资/研习操作、保存失败保护和疗伤收据重放；47/47 Node检查。浏览器内核缺失且官方下载失败，实际UI与桌面未验，完整P0—P2及SR/AC状态保持。
- docs/design/51-COURTYARD-MANAGEMENT-INTEGRATION.md；2026-10-15 U-149/R-49：四页与共用详情、单趟40份留苗搬运、落地回收和保存恢复接通；组件与相邻回归57/57，同一检查点真实桌面387.845秒13/13、最终包页面8/8、恢复链9/9，原生选择文件/预检/恢复及手动暂停已验。完整新档、规模、对话/突破、跨区施工、20分钟自主与Windows待接；完整D/I/V/R和AC状态保持。
- docs/design/52-EAST-TERRACE-INTEGRATION.md
- tests/acceptance/courtyard-east-desktop.mjs
- docs/design/54-COURTYARD-OPENING-DEMO.md；2026-10-16 U-153：当前高清像素桌面正式空档接入灭门序章、落脚疗伤择卷与首次主殿营造。默认测试133/133、后增场景相关16/16、独立复核19/19；最终macOS包同一新档10/10（72.310秒，五处进程重启）、旧暂停档兼容5/5，页面/资源错误0。完整后续开局链、Windows与SR/AC状态保持。
- docs/design/54-COURTYARD-OPENING-DEMO.md；2026-10-17 U-155：三张守阵/逃离v3画帧、四类访客真实山路入离场、相向让行与旧档保护。基础143/143、定向17/17；最终macOS包序章17/17八次重启、同一普通新档陆知微入场4/4与99个在途脚点、暂停跨进程恢复/点选/走近通过。赠药仅同源隔离副本命令门槛证据；Windows、桌面完整交谈链、既有网页择法暂停提示和完整SR/AC状态保持。
- 2026-10-17 U-156：旧网页场景退役，Pages 已取消发布，公开首页/独立预览均404。默认144/144、定向18/18、根检查与桌面暂存通过；桌面/共用模拟保持，原8处修改逐字节一致。网页发布暂停，完整SR/AC状态保持。范围见 docs/engineering/WEB-RETIREMENT-20261017.md。
- docs/design/57-THREE-RESIDENT-COURTYARD.md
- docs/design/58-GOLDEN-CORE-PRESET-BUILDINGS.md
- docs/art/golden-core-domain-20261018/README.md
- docs/design/60-WEST-VALLEY-INTEGRATION.md
- docs/design/61-RESIDENTIAL-INTEGRATION.md
- 2026-10-18 U-167/T-20住宅接续：GC09–12沿固定建位建设，四院一级16实体床；独立床位模块10/10规则检查，含只读旧档、唯一床位、真实到床、途中存读与失效恢复。三院完工及空地母稿已制作，世界位置与升级占地待校准。正式运行接缝、近身有限交易筹资和同源桌面营建入住尚待完成；本条只登记住宅局部准备，不推进完整SR/AC状态。
- 2026-10-18 U-167/T-19西谷一级批：同一未改正常来源macOS源码Electron连续31/31，墙钟1219.061秒、tick646→10944、7次精确关闭重开、错误0。四址实际运料施工，有限采石18.4及两田实际收获后35.2593256粮搬入新公库，两田各留2种粮。根独立读回来源SHA/最终状态/截图，源码与素材hash随run03封存；完整SR/AC、升级损坏图、供水保鲜、Windows和安装包仍按原范围接续。详见docs/design/60-WEST-VALLEY-INTEGRATION.md。
- tests/unit/courtyard/courtyard-east-residences-domain.test.mjs
- tests/unit/courtyard/courtyard-housing-presentation.test.mjs
- tests/acceptance/courtyard-residential-funding-public.mjs
- tests/acceptance/courtyard-residential-roads-desktop.mjs
- tests/acceptance/courtyard-residential-build-desktop.mjs
- docs/design/62-EAST-SERVICES-INTEGRATION.md
- docs/design/64-NORTH-LIBRARY-INTEGRATION.md
- docs/design/66-NORTH-MEDITATION-INTEGRATION.md
- docs/design/68-WEST-WORKSHOPS-INTEGRATION.md
- docs/design/65-COURTYARD-SEEKERS.md；2026-10-19 U-167/T-23：北阶迎面互等与让路脚圈修复已合入主树88ee118a（ea-sect-domain、ea-sr-spatial、新ea-north-yield-ground、新courtyard-mutual-yield.test），主树新4项、旧2项与工程检查通过，隔离11/11保留；run03沿174422冻结149运行文件并完成只读预检，Electron走近/空间续接待验。局部合入不改变整项SR/AC。
- docs/design/65-COURTYARD-SEEKERS.md；2026-10-19 实际桌面run04：174422→176699，253.176秒；approach-midway原生重开174501，身体/脚点/来源字节与149运行文件封存；run04在入住等待处stopped，run05从run04原生保存续接，空间/走近已实测。局部通过不改变整项SR/AC。
- docs/design/65-COURTYARD-SEEKERS.md；2026-10-19 run05卡顿定位：CPU profile显示northSurfacePoint/inPolygon重复几何；ea-sect-domain最小修复（有界缓存、去slice）SHA ac8761e4…，9项相关+旧2项+工程检查通过；recovery-01从176960→177171因master↔陆清和互等停路失败，native4c0f52e3…保存；recovery-02尚未获运行许可。局部修复不改变整项SR/AC。
- docs/design/65-COURTYARD-SEEKERS.md；2026-10-19 recovery-02实际从177171 native继续至177361，公开approach仍停路，旁步候选未被moveArt接受；native a117dcca…与checkpoint一致，累计1026.201004秒、剩余173.798996秒。recovery-03已准备从177361原字节继续，等待单次许可；五门人/GC26生产未完成。
- docs/design/65-COURTYARD-SEEKERS.md；2026-10-19 transferFood修复/recovery-06及recovery-07实机：运输visibleBody寻路与旧路径校验重算；transport351的food18属recovery-06最终源并在recovery-06完成，HOME 12→30，不是run07新增；recovery-07新增transport352 6粮@178180与transport353 8粮@178436，HOME30→44；并收录顾听澜iv73为第四名门人；累计1300.159004秒(本批113.253/300，余186.747秒)，native dcd9be70…。随后陆知微rest去building:yunxiu:1/slot:bed:1在178680(42.944230,12.790354)身体越界，停178693；五门人/GC26未完成。
- docs/design/65-COURTYARD-SEEKERS.md；2026-10-20收口：merchant-harvest-01 native tick189867 SHA e76e9dd8a5c9642e50fff100febadb04c49f2b0dbc11e87ad662cb9bff2218e6，HOME food16/carried0/source304/5门人；366采16@189831、367 delivered16@189858；完整41.400066s、later370.287718、sumMeasured2777.050227、currentChainLB2854.560517、floor2874.609517、7IDs；unknownTail/overallExact=null（前者为feed01尾段未知，不是无缺口）。73/75 pending；190800日结、床位入住与持续供粮未验，整项SR/AC不提升。
- docs/design/69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md
- docs/design/69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md；2026-10-20：六居民同源生活已完成settlement-02：tick190800公库食粮16→4，实际消耗12，5位门人供给事实均supplied且starvation=0，原生暂停与关闭重开完整世界相等。living-03在东台返院路触发身体走面失配，正常暂停保存至tick191089；路径与呈现修复仍待living-04同档实机复验。现有三项未领院务奖励（引灵入府、仙途初成、安居有粮）已接桌面入口与整包容量守卫；专项5/5、直接相关回归7/7，正常档实际领取未验。GC21–23仅布局候选。下一步接living-04、GC25/26正常筹料营建及纸胎实收、四段成药回库；完整SR/AC状态保持。
- docs/design/69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md；2026-10-20：living-04从living-03原生停点继续并通过：顾听澜在tick191090实际使用床1；裴照雪tick191170完成床4入住，191171观测为executing。掌门真实采粮368于191593取得16份，运输369于191626送入公库；192000日结5位门人均supplied且starvation=0。实测118.716135秒，原生暂停与关闭重开完整世界相等，来源及运行文件散列不变，错误0。裴照雪继承的非法脚点在实际运行tick191090从(123.5,45)恢复至(123.5,45.1)，原活动、起始tick和床4预约继续；恢复后按严格身体、门槛与道路判据检查。living-03失败及原始快照继续保留。封存源tick192003 SHA 1b19735d324326bfb6682f60160229e26f054e24da46bd20551318a8b2e9ef42。筹料、奖励实际领取与GC25/26正式生产结果未验；完整SR/AC保持。
- docs/design/69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md；funding-01在192003正式领取三项既有奖励并精确原生重开通过；随后renderer不响应，725.897205秒段以failed收口。lastHarnessObservedTick192200不代表落盘终点；当前可恢复来源为funding-01/native-preserved-while-waiting.json，tick192063，SHA cf63afd0879a0669f46d3724adb3e27204e770433d0616612af6fc9367b93430，manualPause=false，待公开recover阶段生成新的paused原生。STOP保存未完成，SIGTERM未退出后仅QA Electron树被SIGKILL，未落盘尾段时长及最终tick未知，不计连续成功。living-04通过保留，GC25/26正常筹料营建与生产未完成，完整SR/AC状态保持。
- docs/design/69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md；recover-01已从保全的原生192063运行态通过公开暂停按钮自然推进5步至192068，暂停保存及精确关闭重开通过；实测25.840198秒，来源和运行散列保持、错误0。当前唯一接续启动档为/Volumes/Media/immortal-qa/sol-production-20261020/recover-01/world/sect-save.json，tick192068，SHA 796a659e63472a706606271077f0c77752d98421d46b8afec8d1bfbb8690f984，manualPause=true。原report的sourceManualPause=null为字段误读，独立metadata-correction.json绑定原source哈希并校正为false，原报告保持。funding-01失败与未知未落盘尾段证据继续保留；GC25/26正常筹料营建与生产待继续，完整SR/AC状态保持。
- docs/design/71-GUESTHOUSE-INTEGRATION.md
- tests/unit/courtyard/courtyard-guest-lodging.test.mjs
- tests/acceptance/courtyard-guesthouse-desktop.mjs
- docs/design/76-DISCIPLE-CULTIVATION-PROGRESSION.md
- tests/acceptance/courtyard-disciple-cultivation-desktop.mjs
- tests/acceptance/courtyard-disciple-cultivation-reopen.mjs
- 2026-10-25 人物走近局部：docs/design/78-APPROACH-RESPONSE.md；两个普通来源实际近身、4组原生存读一致；反馈48–55ms，旧场景206.5ms峰值使200ms目标保持未通过。整项状态保持。

- 2026-10-06：由v1.2设计缺口审计建立SR；新增内容和参数遵循作者默认，不冒充用户逐项确认。
- 2026-10-06：用户授权目标模式、多agent并行开发与验收；启动D01，按现有契约展开模块设计，未将建档或局部实现标作交付。
- 2026-10-06：U-95明确画布只适配iPadOS/Windows/macOS网页分辨率；必需验收平台改为iPad横竖与桌面窗口/DPR，浏览器视口与实机证据分列。
- 2026-10-06：U-96/U-97将经营成长和同场可交互美术置于优先；按R-27消费已有米制/单时钟/存档契约实现局部模块，D/I/V/R完整门槛仍未关闭。本轮验证及发布待主集成回填，不更改旧AC事实。
- 2026-10-06：回填主集成/独立验收确认的本轮组件和正常公开命令旧档结果；保留浏览器不可用、床体过短、混合画风的视觉缺口；闭屋后墙及两类田地已修复，并经最终Canvas快照静态读图复核。上述局部通过不提升SR整体状态，gh-pages可试玩开发版已成功部署，本轮源码main待确认；完整SR门槛仍未通过。
- 2026-10-06：U-98改常态通用方格布局并暂缓院内铺路；沿用0.5米营造格、旧位置/工位/身份及导航，地面点选同源吸附。空间34、正常旧档9、grid6、UI/输入13均通过（生产Canvas/组件非browser），整项SR不关闭，发布证据单独登记。
- 2026-10-06：U-99将细网格更正为建筑单位格；R-28作者默认2米/格，一级伐木采石2×2、主屋4×4，导航仍0.5米连续移动。整格预制件、显示、摆放、冲突、工位与旧档一次映射共同调整；局部验证和发布分别登记，不关闭整项SR。
- 2026-10-07：U-100固定2.5D、旧云岫人物/建筑资源接回正式U-99主线；R-29山院扩96米，旧64档先校验仅登记extentVersion。人物6/6、扩图9/9、单位格6/6与正常公开链局部通过，真实网页/发布另记STATUS；完整SR保持in_progress，不冒称全动画或全体验完成。
- 2026-10-07：成人家具与现场交互本地批次：96米山院与2米营造格沿用同一米制空间。本批登记adult-furniture-1室内布局，成人家具、导航、预约脚点和可见床面共用预制件；旧合法布局在副本中一次映射并记录位置变化。 已登记适用实现与独立复验证据，整体开发/验收保持in_progress，AC状态沿用已有范围。
- 2026-10-07：M0/M1 接续批完成局部设计、修复和独立复核；具体通过范围与缺口见 acceptance_notes 和 STATUS。整项 D/I/V/R 及 AC 状态保持原门槛。
- 2026-10-07：M1 新档真实门道与建后绕行子链经独立根复核通过，SR003-AC01登记Node公开命令/空间组件证据；完整D/I/V/R及其余AC不变。
- 2026-10-07：M1 第六批修复总览按钮焦点及同号对象标签；独立复核与隔离浏览器局部通过。真机手势和人物/门视觉比例未验，AC02及整项状态不提升。
- 2026-10-08：SR-XF-003-D01更新为done；任务状态不自动改变SR整体状态。
- 2026-10-08：SR-XF-003-D02更新为done；任务状态不自动改变SR整体状态。
- 2026-10-08：2026-10-08 M1 竖屏 UI 子批：820×1180 合法旧 v5 完成档 40 建筑/30 人，真实浏览器完整画稿加载、控制台零错误；选中宗门正殿与 (350,500) 滚轮放大后屋脊/屋檐/台阶/入口均完整在详情之外。生产 renderer 定向覆盖连续触点缩放、极端边缘限幅、地形边界、状态只读，合并空间相关 46/46；独立复核通过该交互窄项。门人居/藏经阁门洞画稿比例、真 iPadOS 触控与全部逐类视觉仍未验，AC02 保持 not_run，I/V/R 不关闭。
- 2026-10-08：M1 山外局部 45° 镜头与四角物件绘制接入；封闭屋顶遮挡室内人物并保持具名详情入口，露天人物正常可见。独立代码专项及两视口浏览器局部通过；I01 进入进行中，AC02 与 V/R 仍按完整门槛。
- 2026-10-08：M1 r8 门道按首达世界步和稳定人物 ID 单人排队、无效活动放锁，身体绕行与侧步有真实路线；室内床位/书案/工位终点不变，封闭屋只画外观。SR003 专项 7/7、相邻 57/57，独立只读复核；浏览器只验合法密集档外观/露天点选，真机及完整 AC02/I/V/R 仍待。
- 2026-10-08：M1 r10 暂停静止山院帧跳过整幅重绘；可见状态原地变化、点选/镜头/视口/素材/规划均失效重画，运行态继续绘制。合法密集档冻结对照 180→0 次清画、10440→0 次 drawImage，像素与主殿点选一致；独立定向 1/1、相邻 16/16。运行卡顿根因、真机及 AC02/I/V/R 门槛未关闭，公网浏览器受应用安全策略验证不可用限制未验。
- 2026-10-08：r14 默认倍率建筑缓存有界子批独立验收并发布；密集档画面回调改善但长帧与完整 SR003 继续。
- 2026-10-08：M1 r21 山外总览按钮按当前地点显示，青溪坊市和驻棚独立浏览器实点总览、选中建筑与返回近景，坊市保存刷新续读。根复跑镜头5/5、UI17/17；源码050a78f、Pages679dab3 built且162文本blob匹配。门位画稿和目标设备未验，AC02及整项状态不变。
- 2026-10-08：2026-10-08 r27 门道候位存读修复：正常公开新档建住宅、招三人、落成百工坊，完工后人物路线随几何更新被清空时，同步清理已失效候位，不再等加载才改变存档；林长风床位活动和真实脚步保留。根正常链1/1、原门道改路1/1、空间36/36，坏旧候位下一真实世界步清理、失效记录不留、精确存读。建筑网格宽测4/6，两失败（缩放选点、旧生产快照断言）在此前独立基线相同；首次空间宽测因本机缺Canvas依赖失败一项，按既有NODE_PATH重跑36/36。源码c8f71b8、Pages944f072 built，162文本blob及公网空间模块一致；本批未实点浏览器或目标设备。SR003-AC02门位画稿/触控与整项I/V/R继续。证据 tests/acceptance/ea-sr003-door-queue-reload-acceptance.mjs。
- 2026-10-08：2026-10-08 r36 门队列清理减负：单次调用共享门与在院人物集合，空队列早返回并避免重复识别行走者；逐人移动、候位与门独占规则未变。独立合法 40 建筑／30 人档 400 世界步终态 768336 字节、100/200/400 检查点、逐步门队列及读档与 r35 一致（345 步非空），门道人流 7/7、空间 Canvas 36/36。旧世界步 P95 两轮 28.01→24.35ms、27.23→23.80ms；本地 Chromium rAF P95 6.2/6.0→6.1/6.1ms 无稳定改善，整体卡顿继续。公开 r36 同档导入、运行、保存刷新续玩且控制台零错误；main 74e135d、Pages 47d4352 built、162 文本 blob 相符。门位画稿、完整 AC02 和真机仍未验，状态不提升。
- 2026-10-09：U-103：用户批准真实Godot 3D美术小院，一栋主殿、山石道路、两名人物已在本地WebKit实机运行，基础点选/行走/入殿后劳动/暂停/刷新及三个DPR1视口取得局部证据，独立Godot复核暂停骨骼和隐藏人物点选修复。地表/岩石/屋瓦质感仍有差距，用户实机美术确认、目标设备及正式玩法集成待完成。证据详见 docs/art/REALTIME-TRIAL-2026-10-09.md；本批未发布，完整AC及D/I/V/R状态保持。
- 2026-10-09：U-104：用户明确停止3D模型路线以控制制作工作量和网页性能预算。保留U-103试验工程及历史证据；Godot/Web方向保持，Godot 2D绘画素材与二维动画候选方案待确认。此次只同步约束，运行代码及完整SR/AC状态不变。
- 2026-10-09：U-104用户确认Godot 2D制作；绘画小院本地构建与WebKit鼠标操作、三视口DPR1局部复核完成。暂停出殿/双指锚点/拖动输入修复，最终拖动实点通过；人物辨识、动作观感、用户美术认可、殿后完整浏览器遮挡、真机/DPR2/真实触摸继续。正式SR/AC状态保持，未发布。证据 docs/art/PAINTED-COURTYARD-2026-10-09.md。
- 2026-10-09：2026-10-09 U-105 / R-32：当前需求更新为 1.2，山域设计关联 GROWTH-01、GROWTH-02、GROWTH-09、GROWTH-10。旧版 1.1 的标题、需求、AC原文/证据及D/I任务完成范围保存在 registry.json 的 version_history；当前重新记 not_run：SR-XF-003-AC-03。 当前D01继续补实施参数，D02及本版本I01待前置完成；development_status保留既有运行实现基线。未改变的已通过AC只沿用原行为及原运行环境证据，新增地域、布局与迁移流程按GROWTH另验。本批未执行运行时验收，未修改正式运行版本或发布状态。
- 2026-10-10：U-109 第一批本地预览：旧别院 3D 地形、镜头、建筑与地块点选已形成局部网页预览；装饰地标与人物导航体积碰撞仍待逐一对齐。此为局部证据，不提升完整 AC/SR 状态。
- 2026-10-11：2026-10-11 U-118 局部：米制山院自由行走约 3.16 米／秒；tests/acceptance/ea-sr-spatial-acceptance.mjs 36／36，tests/unit/web/ea-godot-bridge.test.mjs 的步速与存读用例通过；隔离 Chromium 连续五秒行走及暂停重载见 STATUS。完整七区与目标设备 AC 继续按原门槛。
- 2026-10-11：2026-10-11 U-118 转向校准：Godot 路径交界 4／4；本地 Chromium 两段路线及中途改道累计 5 次转向，行走中站立转身帧 0、移动停帧最长 0 毫秒；暂停存读一致。完整地域及目标设备 AC 状态不变。
- 2026-10-12：2026-10-12 U-123：山谷场景50米赴山门、8秒旅行、谷内行走与返院已在1440×960网页实走；山谷及场景投影定向5／5、5／5，目标设备及整项空间验收继续。 局部证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。
- 2026-10-12：2026-10-12 U-123 首战本地网页：最终本地战斗网页实走闪避脚点 y 4→1.2、撤退后谷内脚点（21.9332，35.7668）及返院路径；同一世界位置继续存档。完整空间与目标设备验收仍按原状态。 证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。
- 2026-10-12：2026-10-12 U-123 发布核验：运行源码 main 836ccb605a42e7c21c2aae8c5e2c4eee7e55c03e；gh-pages 4d6786da521f1ab92818c20f67c036a829469e6e；GitHub API Pages build=built。公开 mountain-courtyard 的14个交付文件（release/build/index、界面与加载模块、桥接及世界／战斗规则、三片场景包）HTTP 200，SHA与本地导出一致。公开浏览器百艺、导档、实际行走旅行与采集的操作证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；本记录仅是U-123局部发布证据，整项 D/I/V/R 与 AC 状态不变。
- 2026-10-13：U-126：用户要求从原型中断处继续，接入平涂地形、建筑、药田、人物和山谷；校准投影、脚点、透明命中、前景遮挡和田地绘制顺序。定向断言及网页点选、行走和保存刷新证据见本批 RUNTIME。仅登记局部实现与验证，整项 D/I/V/R、任务与 AC 状态不变。
- 2026-10-13：U-127/U-128：按用户要求先审核大场景多人即时战斗与画风原型，平台转为桌面。地图尺寸、人数上限、技能数值与最终画风未定；保留既有实现和验收事实，完整SR/AC及任务状态不变。
- 2026-10-15：U-147接续P0—P2：新增两人小院可操作供给成长和保存/事务保护，登记局部实现与Node证据；实际UI/桌面未验，完整状态不推进。
- 2026-10-15：U-149：接续远端main并完成当前山院管理和取消回收、保存恢复的局部桌面验证；完整状态保持。
- 2026-10-16：U-150/R-50：追加连续东路、实际分趟运料施工、四床启用与同源macOS存读往返局部证据。流程两段308.849秒，最终包阶段6项及往返9项，错误0；保留验收脚本中断记录。完整SR/AC与D/I/V/R状态保持。
- 2026-10-16：U-153：补充桌面正式空档到主殿完工的局部实现与同档实机证据；完整需求和AC状态保持。
- 2026-10-17：U-156 删除旧网页场景、下线线上旧网页并暂停发布；当前桌面及共用存档继续保留，历史网页证据限定于原版本。
- 2026-10-18：2026-10-18 U-164/U-165局部：多Agent完成林长风门籍规则及同窗交互首轮，规则8/8、相关11/11，主Agent联合供粮/操作33/33；亲传Electron专项9项，范围限当时人物交互。用户明确扩大主殿山域、整体绘制采伐场、所有建筑完全预设并由人物实际到场修建；院前临时营造入口与独立素材已撤下。下一步先确认整体场景和稳定建位，再接施工与三人同源长验。二十分钟、当前桌面包、Windows及完整SR/AC尚未完成，整项状态保持。
- 2026-10-18：U-166/R-54将金丹篇建筑纳入同一预设山域规划：25项设施、31处编号位置，覆盖14类现行类型及专门工位。完成目录核对、编号图与整体场景概念；布局待评看，米制校准、施工接入和运行验收继续推进，本SR及AC状态保持。
- 2026-10-18：U-167 GC03同源公开筹料91743→117712→167589→168109完成，前两段失败及自然人物成长保持。macOS Electron run01勘察途中身体边缘检查失败，实际168489原生档封存，页面错误0；道路中心修复已合入、实机接续待验。GC25/26在隔离副本制作，完整SR/AC状态保持。
- 2026-10-18：U-167 GC03北台路心与静态地面查询修复合入，主树5项及原168489实际94步/4次存读通过。桌面原勘察1170在168583完成，施工14仅扣60灵石40木25石一次；实际168803封存后定位林长风自主回床路线检查失败。run02离开建位缺步及run03热字段遗漏为验收脚本问题，全部实际来源、进度及失败保留。完整经营与SR/AC继续验收。
- 2026-10-18：U-167 GC03原施工14已在同源桌面完成；四蒲团/两检修位、180步炼气6→7层、有限供灵与四次关闭重开通过。北路返床/绕人修复主树8项及实际27步回路成立。现场货位目的地过滤已补；当前170563检修运输347续接核对主殿门槛圈样本，维护全链未完成。丹房四阶段四工位16项为隔离候选证据。完整SR/AC状态保持。
- 2026-10-18：U-167 GC03一级同源macOS源码桌面链完成：最终171973，run07为10/10、错误0、209.943秒，七段实际逐项合计777.710秒。勘察/施工、180步6→7层、有限供灵、原运输347与348送2木1石、80步维护均成立，携货及活动中多次精确重开。Lu门槛为外部脚圈检查室内边界遗漏，已按正式预约/holder/floor纠正且保留离路反例。整体建筑与完整SR/AC继续。
- 2026-10-19：U-167 GC25/26一级道路、四阶段、真实工位与四段炼丹已合入23源码/测试和14图，主树30项及工程检查通过；有限供料负坐标整档完成施工到唯一两份成药，正常桌面生产另验。求见链真实续至174422，首位来客到时离开、第二位入院，未新增收录；绕柱导航已修，北坡迎面互等继续验证。完整SR/AC状态保持。
- 2026-10-20：2026-10-20 收口到merchant-harvest-01：五门人/食物同档链停止在paused；真实food16入库、source304；未知尾段与整体exact保持null；不把pending当入住、不把补种成功当供粮恢复。历史更正：recovery-04失败人为陆知微，transport351/18属recovery-06而非run07新增。
- 2026-10-20：六居民同档日结与原生精确重开通过；living-03道路body失配保留tick191089，修复待living-04。院务奖励入口与容量边界规则检查通过，实际领取、GC25/26正常生产未验；GC21–23仅布局候选。完整SR/AC及任务状态保持。
- 2026-10-20：living-04从191089同档完成73/75实际床位、自主16粮采送、192000五门人日结与精确原生重开，118.716135秒、错误0；living-03失败保留。只更新局部证据，不提升完整SR/AC；funding-01及GC25/26正式生产待验。
- 2026-10-23：2026-10-23 GC15一级客院已接入：两张独立客床、当面自愿邀请、实际步行入住、原来访期限退房下山及原生存读。macOS源码Electron有限夹具入住ui-fixture-03通过7项（1656→3851、235.557720083秒），施工build-fixture-01通过3项（646→1700、114.379689209秒）；唯一工单3投入45灵石/40木/20石，两趟实际送达后于1683完成200施工步。两段错误0，来源、运行文件与原生重开均一致。GPT-6.1-sol独立读回6个原生检查点及12个核心源码通过。正常世界仍保留医庐tick261253原档；该世界的筹资建设、Windows和完整SR/AC保持待验。 详见docs/design/71-GUESTHOUSE-INTEGRATION.md。
- 2026-10-25：登记人物走近后台规划、原生实际通行和响应测量的局部证据，200ms目标未全部通过，整项与AC状态保持。

本文件由[registry.json](../registry.json)派生；更新台账后执行 `python scripts/requirements/sr-manager.py refresh`，不单独修改此派生页。
