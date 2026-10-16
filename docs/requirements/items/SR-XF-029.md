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

决策来源：U-63, U-93, R-25, U-94, U-95, U-96, U-97, R-27, U-100, R-29, R-30, U-102, U-103, U-104, U-105, R-32, U-109, U-120, U-123, U-125, U-124, U-126, U-127, U-128, U-129, U-130, U-131, U-132, U-139, U-142, U-144, U-149, R-49, U-150, R-50, U-151, R-43, U-154。这是继承的U项和作者实施默认；具体新增名称/数值不得伪装成用户逐项批准。

规格：[01-CHARACTERS.md](../../../docs/design/01-CHARACTERS.md)、[03-SPATIAL-ART.md](../../../docs/design/03-SPATIAL-ART.md)、[06-OPENING-ACCEPTANCE.md](../../../docs/design/06-OPENING-ACCEPTANCE.md)、[14-EARLY-GAME-DETAILED-DESIGN.md](../../../docs/design/14-EARLY-GAME-DETAILED-DESIGN.md)、[GODOT-MIGRATION.md](../../../docs/GODOT-MIGRATION.md)、[ART-REALTIME-TRIAL.md](../../../docs/ART-REALTIME-TRIAL.md)、[SECT-GROWTH-PLAN.md](../../../docs/SECT-GROWTH-PLAN.md)、[41-COURTYARD-VALLEY-IMPLEMENTATION.md](../../../docs/design/41-COURTYARD-VALLEY-IMPLEMENTATION.md)、[42-CHARACTER-DIALOGUE.md](../../../docs/design/42-CHARACTER-DIALOGUE.md)、[51-COURTYARD-MANAGEMENT-INTEGRATION.md](../../../docs/design/51-COURTYARD-MANAGEMENT-INTEGRATION.md)、[46-CONTINUOUS-DOMAIN-FOUNDATION.md](../../../docs/design/46-CONTINUOUS-DOMAIN-FOUNDATION.md)、[52-EAST-TERRACE-INTEGRATION.md](../../../docs/design/52-EAST-TERRACE-INTEGRATION.md)、[45-SECT-IDLE-SLICE.md](../../../docs/design/45-SECT-IDLE-SLICE.md)、[53-COURTYARD-AUTONOMY-ACCEPTANCE.md](../../../docs/design/53-COURTYARD-AUTONOMY-ACCEPTANCE.md)。

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

## 开发任务

| 任务 | 工作 | 状态 | 前置 | 责任人 |
| --- | --- | --- | --- | --- |
| SR-XF-029-D01 | 设计补齐：当前版本设计补齐：补齐地域总览、预设项目、迁居和供给状态的逐页交互，保留现有输入原则与设备门槛。 原版本已完成范围和证据保存在 version_history。 | in_progress | 无 | Codex/r35-input-design |
| SR-XF-029-D02 | 契约与内容审阅：在当前版本D01完成后，审阅统一操作流程、窄屏与人物触控与依赖契约的字段、时序、失败及恢复；核对本SR的REQ/AC和GROWTH-10、GROWTH-12。旧版审阅完成事实保存在 version_history。 | todo | SR-XF-029-D01 | Codex/r35-input-design |
| SR-XF-029-I01 | 开发与集成：按当前版本设计在相关模块集成统一操作流程、窄屏与人物触控，接入真实数据、行为、素材、界面和存读。既有实现保留为运行基线；本版本在D02完成后进入集成。 | todo | SR-XF-029-D02 | Codex/courtyard-integration |
| SR-XF-029-V01 | 验收与兼容：执行本SR的AC-01至AC-03及GROWTH-10、GROWTH-12；分别记录正常、失败、存读、网页视口和适用真机证据。 | todo | SR-XF-029-I01 | Codex/courtyard-acceptance |
| SR-XF-029-R01 | 发布与关闭：完成所需源码/运行时发布核对、交接和未覆盖说明；本轮用户不要求上传QA过程产物。 | todo | SR-XF-029-V01 | 待分配 |

SR-XF-029-D01证据：docs/SECT-GROWTH-PLAN.md；docs/design/50-COURTYARD-UI-DESIGN-AUDIT.md；2026-10-15 U-148/R-48：四页及关联入口30项设计审查与7条后续场景；两处物流问题由正常命令复现，运行代码未修，实际UI未验，完整状态保持。

SR-XF-029-I01证据：apps/web/ea-ui.mjs；apps/web/map-input.mjs；apps/web/ea-game.mjs；docs/design/STATUS.md；apps/web/ea.css；apps/web/ea-courtyard-renderer.mjs；docs/design/49-P0-P2-COURTYARD-PROGRESS.md；2026-10-15 U-147/R-47：院务/人物/工位/物资/研习操作、保存失败保护和疗伤收据重放；47/47 Node检查。浏览器内核缺失且官方下载失败，实际UI与桌面未验，完整P0—P2及SR/AC状态保持。

SR-XF-029-V01证据：tests/unit/web/ea-scene-ui.test.mjs；tests/unit/web/map-input.test.mjs；tests/acceptance/ea-courtyard-rest-render-acceptance.mjs；docs/design/STATUS.md；tests/acceptance/ea-sr-spatial-acceptance.mjs；docs/design/49-P0-P2-COURTYARD-PROGRESS.md；2026-10-15 U-147/R-47：院务/人物/工位/物资/研习操作、保存失败保护和疗伤收据重放；47/47 Node检查。浏览器内核缺失且官方下载失败，实际UI与桌面未验，完整P0—P2及SR/AC状态保持。

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

本文件由[registry.json](../registry.json)派生；更新台账后执行 `python scripts/requirements/sr-manager.py refresh`，不单独修改此派生页。
