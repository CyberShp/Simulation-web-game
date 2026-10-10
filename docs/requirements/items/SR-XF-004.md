# SR-XF-004 · 建筑预制件、室内与分层素材目录

来源：DB-2026-10-05 v1.2；需求版本：1.1；建档日期：2026-10-06。

| 字段 | 值 |
| --- | --- |
| 范围 / 模块 | 前期必需 / 空间 |
| 优先级 / 计划 | P0 / I1 |
| 设计 / 开发 | draft / in_progress |
| 验收 / 发布 | in_progress / not_released_for_this_sr |
| 责任人 / 复核人 | Codex/space_construction / Codex/root（集成） |

## 来源、依赖与范围

纳入云岫前期，按依赖推进。

决策来源：U-63, U-93, R-25, U-94, U-96, U-97, R-27, U-98, U-99, R-28, U-100, R-29, R-30, U-101, U-102, U-103, U-104, U-105, R-32, U-109。这是继承的U项和作者实施默认；具体新增名称/数值不得伪装成用户逐项批准。

规格：[03-SPATIAL-ART.md](../../../docs/design/03-SPATIAL-ART.md)、[01-CHARACTERS.md](../../../docs/design/01-CHARACTERS.md)、[14-EARLY-GAME-DETAILED-DESIGN.md](../../../docs/design/14-EARLY-GAME-DETAILED-DESIGN.md)、[17-INDOOR-LIFE-IMPLEMENTATION.md](../../../docs/design/17-INDOOR-LIFE-IMPLEMENTATION.md)、[18-SPATIAL-CONTINUITY-IMPLEMENTATION.md](../../../docs/design/18-SPATIAL-CONTINUITY-IMPLEMENTATION.md)、[GODOT-MIGRATION.md](../../../docs/GODOT-MIGRATION.md)、[ART-REALTIME-TRIAL.md](../../../docs/ART-REALTIME-TRIAL.md)、[SECT-GROWTH-PLAN.md](../../../docs/SECT-GROWTH-PLAN.md)。

依赖：[SR-XF-003](SR-XF-003.md)。

关联既有验收：SCENE-01, SCENE-03, GROWTH-01, GROWTH-02, GROWTH-05；本SR的AC细化这些目标，不代表旧版本已经通过。

## 现状与设计缺口

既有 JS 运行基线：主屋、居舍、医庐采用0.9×2.2米成人床，书案与工作台按统一室内布局放置。相同预制件服务家具、工位、通行与营造；床位及卧姿仍保存在真实活动中。按U-101，院景中封闭建筑保持完整外观，不绘制室内家具与人物；容量和活动由人物/建筑管理查看。 U-105 山域成长方案见 docs/SECT-GROWTH-PLAN.md；本批只登记设计与阶段原型，正式运行版本保持。

U-105 五阶段建筑用途、主峰仙宫和分峰生活容量方向已登记；分阶段预制件尺寸、真实工位容量与素材目录仍待冻结，并须在 U-104 Godot 二维场景逐项验证。

现状是适用旧能力的基线，不表示该SR完整目标已通过。

## 必须补齐的设计交付物

1. 五阶段各地域的建筑/设施目录，逐类定义尺寸、锚点、入口、真实床位/工位及等待位。
2. 预览、施工、成品、升级、损坏与阶段外观的素材版本及同源几何表；主峰和四峰维持统一绘画比例。
3. 封闭建筑外观、露天作业显示、容量启用和点击区域规则；升级/迁建与新建替代的身份关系分列。

## 需求行为

SR-XF-004-REQ-01：建筑与设施作为独立经营对象提供真实床位/工位；预设建位和阶段外观不直接增加容量，完工及可用条件成立后启用。

SR-XF-004-REQ-02：人物进入封闭建筑后按真实活动运行，院景保持完整外观；人物/建筑管理显示真实容量和占用，露天作业者按实际脚点显示和点选。

SR-XF-004-REQ-03：五阶段外观使用受支持素材和同一空间定义；升级、迁建保持原建筑身份，新设施接替旧用途时记录新旧关联。


## 验收标准

| ID | 情景 / 操作 | 必须看到的结果 | 状态 |
| --- | --- | --- | --- |
| SR-XF-004-AC-01 | 对五阶段对应建筑比较预览、工地、成品与升级形态 | 各阶段尺寸、锚点、入口和真实容量同源；施工不提前提供容量，封闭外观完整，主峰与分峰的建筑/人物比例一致。 | not_run |
| SR-XF-004-AC-02 | 屋内睡眠、研习和疗伤 | 人物实际到达床位/书案，封闭建筑保持完整外观；管理页可选择真实人物和活动，门道不作为执行工位。 | passed |
| SR-XF-004-AC-03 | 缺失/旧版资产 | 缺失或旧版素材回退为封闭建筑外观或真实露天工位，不出现假容量或更换人物身份。 | passed |

SR-XF-004-AC-02证据：qa/ea-indoor-activities-acceptance.mjs；qa/ea-courtyard-rest-render-acceptance.mjs；qa/ea-courtyard-visibility-acceptance.mjs；dist/ea-facility-slots.mjs；docs/design/STATUS.md

SR-XF-004-AC-03证据：dist/ea-estate-assets.mjs；dist/ea-courtyard-renderer.mjs；qa/ea-courtyard-visibility-acceptance.mjs；tests/ea-house-activity-art.test.mjs；tests/ea-outdoor-stage-art.test.mjs；docs/design/STATUS.md；dist/ea-estate-ground-art.mjs；tests/ea-closed-stage-fallback.test.mjs

2026-10-07本地小院批次：成人家具/单位格/空间定向检查48/48（8/6/34），正常公开命令接受/拒绝邀请两路完成营造、产出搬运、研习、到床休息与迁建取消/续建；分别60命令/36次精确存读和61命令/37次精确存读。六身份卧姿与预约前提2/2，生产Canvas卧姿加载/只读/身体点选/缺图回退4/4，已读图。旧v5完成档40建筑30门人保留资源、时间和return结局，全部入口可达，二次存读一致。各SR仅登记适用子情景；完整AC、真机触摸/FPS和真人首次体验状态分别保留。 浏览器DPR1鼠标在1366×900、1180×820、820×1180点选床上掌门通过；正常推荐营造经Enter和鼠标确认、实际施工落成。一次动态模块加载失败经页面重载恢复同档，原因待定位。I/V证据为沿既有可用契约实施的本批子范围；完整D01/D02及I/V关闭门槛保持原状态。

2026-10-07 M1 首批房屋资产：新增门人居预览、地基、主体、收尾、成品、升级、损坏七阶段同尺寸图集，正式渲染读取施工 progress 并在缺图时回退同源几何。新档正常公开命令到房屋地基/主体/收尾检查点，精确 JSON 存读；独立浏览器 QA 内存档观察三阶段与完成画面。资产/人物/室内定向 22/22。只覆盖门人居；其余 13 类建筑状态、室内整体和实际设备/真人视觉仍待验，AC 与 D/I/V/R 不据此关闭。
独立只读复核已确认首批三项房屋接缝修复：显示与点选同阶段、迁建旧址不误显升级、错尺寸图集回退；定向重跑 22/22，仍不等于完整 AC。
2026-10-07 M1目录核查：独立只读审计已核对14类一级占地、同源入口/等待位/容量、三张既有图集与两类生产田块；设计目录新增逐类型当前外观、版本、阶段和屏幕锚点。房屋专用图的门比例metadata尚未驱动实际米制门位，逐建筑视觉对齐未验；D01仍in_progress；独立审阅已核对当前目录事实和屋内退顶接线，但阶段素材与逐建筑状态未齐，D02保持todo。
2026-10-07 室内屋顶子情景：未选门人在室内时退顶显示同一身体并可命中；独立生产Canvas复核含离屋/悬停，相关定向48/48。正常五人存档在独立浏览器仅内存试读，实见屋内四人、家具及门人详情点选；未写正式档位。只覆盖该情景，AC01/03和D/I/V/R仍按原状态。
2026-10-07 M1 第七批：新档正式命令取得掌门调养、藏经阁研习、主屋休憩；三次暂停精确存读保持同一活动、预约与脚点，生产 Canvas 加载/绘制/退顶点选只读 1/1，门道不作执行位。隔离浏览器分别导入三份有来源档、实际点选人物，侧卡显示调养床1/书案1/床位3；研习旧动作误显示休憩已修复。独立只读复核同样用真实 Canvas 在未预选人物时点中研习/卧床掌门，确认 AC02 原文范围通过。浏览器为桌面鼠标，不代表目标真机、完整建筑阶段素材或整项 SR004 已完成。
2026-10-07 M1 第八批：有来源的正常公开命令门人居档 53 命令/37 次精确存读；隔离浏览器分别检验阶段图缺失、1×1 旧尺寸图、阶段图与旧房屋图同时缺失，房屋四床/四休息位及人物身份不变。全建筑图集缺失暴露伐木场空地仍报两个作业位；按权威预制件槽位补绘露天工位后，桌面浏览器实见两处原木，点选侧卡 0/2 与两个空闲位。真实 Canvas 逐槽覆盖伐木、采石、聚灵台、灵泉当前和旧布局，并检查无工位瞭望台，7/7；空间34/34。独立只读复核按 AC03 原文判 passed。仅限缺图/旧版资产 AC，完整阶段素材、SR004-AC01、目标真机及整项 D/I/V/R 继续。
2026-10-08 M1 第十批：主屋、医庐、藏经阁各七阶段图集补齐，现有4/14类；实际图集加载/点选/缺图回退和合并工作树定向46/46，仅作AC01子范围证据。十类建筑、逐类正常施工/浏览器及目标设备未覆盖，AC01和整项保持原状态。
2026-10-08 M1 第十一批：四类露天阶段图接入并保留真实田块动态作物，累计8/14类；生产Canvas/空间定向61/61及有来源档读图仅为AC01子范围，浏览器逐类施工、目标设备与余六类仍待验。
2026-10-08 M1 第十二批：剩余丹房、灵泉、灵稻田、膳房、百工坊、瞭望台各七阶段图已接入，14/14 类均有图集；根 Agent 读六张生产 Canvas，复跑阶段素材27/27和空间家具42/42。逐类正常施工网页、灵稻田避人物点选、灰地接缝及目标设备未验，SR004-AC01 保持 not_run，整项 D/I/V/R 不关闭。备份见 batch12-pre-construction manifest。
2026-10-08 U-101 改变院景显示口径：上述退顶、室内身体直点及相应 AC02/AC03 旧结论仅属历史版本。真实床位、工位、身份和活动仍保留；按新 AC 重新验收，独立浏览器和性能数据回填前不继续标记通过。
2026-10-08 U-101 定向通过：正常床位/研习和药田工位的生产 Canvas 5/5、空间34/34；旧完成档40建筑30门人同源桌面浏览器暂停1.3→113.2 FPS、运行108.1 FPS（1366×900/DPR1，帧P95分别15.1/15.3ms，处理P95均4.9ms），闭屋与露天点选实见。SR004-AC02仍需疗伤和管理页在新口径下逐态独立复核，AC03仍需缺图封闭回退浏览器复核；真机FPS未验。
2026-10-08 U-101 AC03 新口径独立验收：合法旧 v5 40建筑30人档 SHA256 b0522b6f15cbd5e9fdada0ae312cc782a99611cca66238f385c1e554785b8215；七类封闭建筑正常、缺图、错尺寸、同尺寸旧 v1 浏览器矩阵均保持封闭几何/外观、原身份/容量和点选；六类露天缺图真实工位仍绘制。五情形导出后新页试读再导出精确一致。最终背层版同源桌面 Chromium 快速复验地表/屋体叠层、缩放/平移、主屋和伐木场点选及存读，结论维持。QA 报告 /tmp/immortal-sr004-ac03-independent/report.json 与 /tmp/immortal-sr004-ac03-final-backlayer/report.json；定向9/9，相关回归40/40。选址预览保留半透明只读 ghost，不画内部。DPR1 桌面证据不等于目标真机；AC01 及整项仍待。
2026-10-08 M1 r33：合法 v5 40 建筑/30 人档公开主殿升级产生预览、施工、升级后三态，生产 Canvas 保持封闭外观，阶段档精确存读；正常新档与原堵门快照另经独立复核。空间36/36、补给专项通过。网页本批实际交互及目标设备未验，整项 I/V/R 不关闭。

2026-10-09 U-105 / R-32：当前需求更新为 1.1，山域设计关联 GROWTH-01、GROWTH-02、GROWTH-05。旧版 1.0 的标题、需求、AC原文/证据及D/I任务完成范围保存在 registry.json 的 version_history；当前重新记 not_run：SR-XF-004-AC-01。 当前D01继续补实施参数，D02及本版本I01待前置完成；development_status保留既有运行实现基线。未改变的已通过AC只沿用原行为及原运行环境证据，新增地域、布局与迁移流程按GROWTH另验。本批未执行运行时验收，未修改正式运行版本或发布状态。

## 开发任务

| 任务 | 工作 | 状态 | 前置 | 责任人 |
| --- | --- | --- | --- | --- |
| SR-XF-004-D01 | 设计补齐：当前版本设计补齐：补齐五阶段预制件、真实容量、资产版本及锚点表；成长原型只提供用途和外观方向。 原版本已完成范围和证据保存在 version_history。 | in_progress | 无 | Codex/root |
| SR-XF-004-D02 | 契约与内容审阅：在当前版本D01完成后，审阅建筑预制件、室内与分层素材目录与依赖契约的字段、时序、失败及恢复；核对本SR的REQ/AC和GROWTH-01、GROWTH-02、GROWTH-05。旧版审阅完成事实保存在 version_history。 | todo | SR-XF-004-D01 | Codex/sr010_contract_validation |
| SR-XF-004-I01 | 开发与集成：按当前版本设计在相关模块集成建筑预制件、室内与分层素材目录，接入真实数据、行为、素材、界面和存读。既有实现保留为运行基线；本版本在D02完成后进入集成。 | todo | SR-XF-004-D02 | Codex/courtyard-integration |
| SR-XF-004-V01 | 验收与兼容：执行本SR的AC-01至AC-03及GROWTH-01、GROWTH-02、GROWTH-05；分别记录正常、失败、存读、网页视口和适用真机证据。 | todo | SR-XF-004-I01 | Codex/courtyard-acceptance |
| SR-XF-004-R01 | 发布与关闭：完成所需源码/运行时发布核对、交接和未覆盖说明；本轮用户不要求上传QA过程产物。 | todo | SR-XF-004-V01 | 待分配 |

SR-XF-004-D01证据：docs/SECT-GROWTH-PLAN.md

SR-XF-004-I01证据：dist/ea-sr-spatial.mjs；dist/ea-character-art.mjs；dist/ea-courtyard-renderer.mjs；dist/assets/estate-v1/characters-rest-v1.png；docs/design/STATUS.md；asset-manifest.json；dist/assets/estate-v1/hall-stages-v1.png；dist/assets/estate-v1/clinic-stages-v1.png；dist/assets/estate-v1/library-stages-v1.png；tests/ea-hall-stage-art.test.mjs；dist/assets/estate-v1/farm-stages-v1.png；dist/assets/estate-v1/lumber-stages-v1.png；dist/assets/estate-v1/quarry-stages-v1.png；dist/assets/estate-v1/meditation-stages-v1.png；tests/ea-outdoor-stage-art.test.mjs

SR-XF-004-V01证据：qa/ea-indoor-furniture-acceptance.mjs；qa/ea-courtyard-rest-render-acceptance.mjs；qa/ea-courtyard-life-acceptance.mjs；docs/design/STATUS.md；dist/assets/estate-v1/hall-stages-v1.png；dist/assets/estate-v1/clinic-stages-v1.png；dist/assets/estate-v1/library-stages-v1.png；tests/ea-hall-stage-art.test.mjs；dist/assets/estate-v1/farm-stages-v1.png；dist/assets/estate-v1/lumber-stages-v1.png；dist/assets/estate-v1/quarry-stages-v1.png；dist/assets/estate-v1/meditation-stages-v1.png；tests/ea-outdoor-stage-art.test.mjs

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
- dist/ea-sr-spatial.mjs
- dist/ea-character-art.mjs
- dist/ea-courtyard-renderer.mjs
- dist/assets/estate-v1/characters-rest-v1.png
- qa/ea-indoor-furniture-acceptance.mjs
- qa/ea-courtyard-rest-render-acceptance.mjs
- qa/ea-courtyard-life-acceptance.mjs
- docs/CODEX-HANDOFF.md
- asset-manifest.json
- dist/ea-estate-assets.mjs
- dist/assets/estate-v1/house-stages-v1.png
- tests/ea-house-activity-art.test.mjs
- qa/ea-indoor-activities-acceptance.mjs
- dist/ea-life.mjs
- dist/ea-sr-persons.mjs
- dist/ea-ui.mjs
- tests/ea-scene-ui.test.mjs
- dist/ea-estate-ground-art.mjs
- dist/assets/estate-v1/hall-stages-v1.png
- dist/assets/estate-v1/clinic-stages-v1.png
- dist/assets/estate-v1/library-stages-v1.png
- tests/ea-hall-stage-art.test.mjs
- dist/assets/estate-v1/farm-stages-v1.png
- dist/assets/estate-v1/lumber-stages-v1.png
- dist/assets/estate-v1/quarry-stages-v1.png
- dist/assets/estate-v1/meditation-stages-v1.png
- tests/ea-outdoor-stage-art.test.mjs
- tests/ea-estate-remaining-stage-art.test.mjs
- qa/ea-courtyard-visibility-acceptance.mjs
- tests/ea-closed-stage-fallback.test.mjs
- docs/art/REALTIME-TRIAL-2026-10-09.md
- godot/art/art_courtyard.gd
- godot/art/actor_3d.gd
- tools/build-art-web.py
- docs/art/PAINTED-COURTYARD-2026-10-09.md
- docs/SECT-GROWTH-PLAN.md；2026-10-09 山域总图、五阶段迁移及统一原型的设计来源；当前运行验收待补。
- docs/design/STATUS.md；2026-10-10 U-109 旧别院 3D 本地预览局部网页证据；完整 AC 状态不变。

- 2026-10-06：由v1.2设计缺口审计建立SR；新增内容和参数遵循作者默认，不冒充用户逐项确认。
- 2026-10-06：用户授权目标模式、多agent并行开发与验收；启动D01，按现有契约展开模块设计，未将建档或局部实现标作交付。
- 2026-10-06：U-96/U-97将经营成长和同场可交互美术置于优先；按R-27消费已有米制/单时钟/存档契约实现局部模块，D/I/V/R完整门槛仍未关闭。本轮验证及发布待主集成回填，不更改旧AC事实。
- 2026-10-06：回填主集成/独立验收确认的本轮组件和正常公开命令旧档结果；保留浏览器不可用、床体过短、混合画风的视觉缺口；闭屋后墙及两类田地已修复，并经最终Canvas快照静态读图复核。上述局部通过不提升SR整体状态，gh-pages可试玩开发版已成功部署，本轮源码main待确认；完整SR门槛仍未通过。
- 2026-10-06：U-98改常态通用方格布局并暂缓院内铺路；沿用0.5米营造格、旧位置/工位/身份及导航，地面点选同源吸附。空间34、正常旧档9、grid6、UI/输入13均通过（生产Canvas/组件非browser），整项SR不关闭，发布证据单独登记。
- 2026-10-06：U-99将细网格更正为建筑单位格；R-28作者默认2米/格，一级伐木采石2×2、主屋4×4，导航仍0.5米连续移动。整格预制件、显示、摆放、冲突、工位与旧档一次映射共同调整；局部验证和发布分别登记，不关闭整项SR。
- 2026-10-07：U-100固定2.5D、旧云岫人物/建筑资源接回正式U-99主线；R-29山院扩96米，旧64档先校验仅登记extentVersion。人物6/6、扩图9/9、单位格6/6与正常公开链局部通过，真实网页/发布另记STATUS；完整SR保持in_progress，不冒称全动画或全体验完成。
- 2026-10-07：成人家具与现场交互本地批次：主屋、居舍、医庐采用0.9×2.2米成人床，书案与工作台按统一室内布局放置。相同预制件服务家具绘制、工位、通行与营造；正常到床休息可显示六身份静态卧姿。 已登记适用实现与独立复验证据，整体开发/验收保持in_progress，AC状态沿用已有范围。
- 2026-10-07：M1 战斗共同身体或房屋/人物画稿首批局部实现与独立验收；整项原门槛未关闭。
- 2026-10-07：M1补14类建筑当前资产/几何/阶段与视觉锚点目录，独立清单审计揭示其余13类画稿和视觉对齐缺口；设计与AC状态未提升。
- 2026-10-07：M1 第七批由公开命令得到调养/研习/休憩三份真实室内存档，生产 Canvas 与隔离浏览器三态点选、精确存读及独立只读复核按原文通过 AC02；SR004 整项仍未关闭。
- 2026-10-07：M1 第八批补齐全图集缺失时露天设施按真实槽位的可见回退；有来源档浏览器、逐槽 Canvas 与独立只读复核通过 AC03，整项 SR004 保持进行中。
- 2026-10-08：M1 第十批新增主屋、医庐、藏经阁七阶段图集并接入同一米制预制件及缺图回退，根 Agent 与实现 Agent 分别核对生产画布和素材，最终合并工作树相关定向 46/46。连同门人居现为 4/14 类；剩余十类、逐类正常施工与设备验收未完成，AC01 仍 not_run，D/I/V/R 不关闭。
- 2026-10-08：M1 第十一批新增灵草田、伐木场、采石场、聚灵台各七阶段图集，连同此前四类现为 8/14；有来源档与旧档迁移生产 Canvas、建筑点选/缺图回退及最终合并定向 61/61，根 Agent 独立读图复跑。剩余六类、逐类浏览器施工与目标设备、石基地色统一未完成，AC01 与整项 D/I/V/R 不关闭。
- 2026-10-08：2026-10-08 M1 第十二批：剩余丹房、灵泉、灵稻田、膳房、百工坊、瞭望台各七阶段图已接入，14/14 类均有图集；根 Agent 读六张生产 Canvas，复跑阶段素材27/27和空间家具42/42。逐类正常施工网页、灵稻田避人物点选、灰地接缝及目标设备未验，SR004-AC01 保持 not_run，整项 D/I/V/R 不关闭。备份见 batch12-pre-construction manifest。
- 2026-10-08：U-101 按用户决定改为封闭建筑外观及管理页查询，露天工人可见；修订 SR004 REQ/AC，旧退顶证据只作为历史，AC02/AC03 待当前版本独立重验。
- 2026-10-08：U-101 关闭院景室内显示并减少重复世界视图计算；同源40建筑30人桌面浏览器压力场景从旧暂停1.3 FPS到新暂停113.2/运行108.1 FPS，封闭外观和露天点选通过，SR004新口径其余AC仍待。
- 2026-10-08：U-101 最终封闭外观版 AC03 独立浏览器复验：旧 v5 40 建筑/30 人档在七类封闭建筑正常/缺图/错尺寸/同尺寸 v1 与六类露天缺图中保留身份、容量、点选和精确再读；背层性能改动后独立快速复验维持结论，定向9/9、相关最终回归40/40。AC03 passed；AC01 与真机、整体 D/I/V/R 仍待。
- 2026-10-08：SR-XF-004-D01更新为done；任务状态不自动改变SR整体状态。
- 2026-10-08：SR-XF-004-D02更新为done；任务状态不自动改变SR整体状态。
- 2026-10-08：M1 r33：合法 v5 40 建筑/30 人档公开主殿升级产生预览、施工、升级后三态，生产 Canvas 保持封闭外观，阶段档精确存读；正常新档与原堵门快照另经独立复核。空间36/36、补给专项通过。网页本批实际交互及目标设备未验，整项 I/V/R 不关闭。
- 2026-10-09：U-103：用户批准真实Godot 3D美术小院，一栋主殿、山石道路、两名人物已在本地WebKit实机运行，基础点选/行走/入殿后劳动/暂停/刷新及三个DPR1视口取得局部证据，独立Godot复核暂停骨骼和隐藏人物点选修复。地表/岩石/屋瓦质感仍有差距，用户实机美术确认、目标设备及正式玩法集成待完成。证据详见 docs/art/REALTIME-TRIAL-2026-10-09.md；本批未发布，完整AC及D/I/V/R状态保持。
- 2026-10-09：U-104：用户明确停止3D模型路线以控制制作工作量和网页性能预算。保留U-103试验工程及历史证据；Godot/Web方向保持，Godot 2D绘画素材与二维动画候选方案待确认。此次只同步约束，运行代码及完整SR/AC状态不变。
- 2026-10-09：U-104用户确认Godot 2D制作；绘画小院本地构建与WebKit鼠标操作、三视口DPR1局部复核完成。暂停出殿/双指锚点/拖动输入修复，最终拖动实点通过；人物辨识、动作观感、用户美术认可、殿后完整浏览器遮挡、真机/DPR2/真实触摸继续。正式SR/AC状态保持，未发布。证据 docs/art/PAINTED-COURTYARD-2026-10-09.md。
- 2026-10-09：2026-10-09 U-105 / R-32：当前需求更新为 1.1，山域设计关联 GROWTH-01、GROWTH-02、GROWTH-05。旧版 1.0 的标题、需求、AC原文/证据及D/I任务完成范围保存在 registry.json 的 version_history；当前重新记 not_run：SR-XF-004-AC-01。 当前D01继续补实施参数，D02及本版本I01待前置完成；development_status保留既有运行实现基线。未改变的已通过AC只沿用原行为及原运行环境证据，新增地域、布局与迁移流程按GROWTH另验。本批未执行运行时验收，未修改正式运行版本或发布状态。
- 2026-10-10：U-109 第一批本地预览：残败主屋、预留荒地、田地与伐木场及建筑级别从同一持久状态显示；完整容量和后续阶段外观仍待验。此为局部证据，不提升完整 AC/SR 状态。

本文件由[registry.json](../registry.json)派生；更新台账后执行 `python qa/sr-manager.py refresh`，不单独修改此派生页。
