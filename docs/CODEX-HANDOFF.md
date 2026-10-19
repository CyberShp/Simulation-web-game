# Codex 接手指南

更新于 2026-10-19，旧网页退役与发布暂停按 U-156，当前守阵画帧与访客沿路入院按 U-155，开局按 U-153/U-154，工程目录按 U-152。先读 [AGENTS.md](../AGENTS.md)，核对工作区、当前分支和未提交差异。本文负责当前导航；规则由设计规格定义，实际完成范围由 [STATUS](design/STATUS.md) 与 [需求台账](requirements/registry.json) 记录。

## 当前主线

2026-10-20：求见链已收口到merchant-harvest-01，自动化PAUSED，不再实跑。最终五门人：陆知微、林长风、陆清和、顾听澜(iv73)、裴照雪(iv75)；73/75床位仍pending，不称入住。最终native tick189867、SHA `e76e9dd8a5c9642e50fff100febadb04c49f2b0dbc11e87ad662cb9bff2218e6`、HOME food16、carried0、food source304。366采food16@189831，367 delivered16@189858。完整41.400066秒、later370.287718、sumMeasured2777.050227、currentChainLB2854.560517、floor2874.609517、7 IDs；unknownTail/overallExact为null，前者是feed01尾段未知，不是无缺口。190800日结、床位与持续供粮未验；完整SR/AC不提升。

当前停点已续至merchant-harvest-01原生：`/Volumes/Media/immortal/.qa-dsh-parallel/15-funding/runs/merchant-harvest-01/world/sect-save.json`，tick189867，SHA `e76e9dd8a5c9642e50fff100febadb04c49f2b0dbc11e87ad662cb9bff2218e6`，paused。5门人在册；HOME food16、carried0、food source304；73/75 beds pending。完整段41.400066秒，later370.287718，currentChainLB2854.560517，floor2874.609517；unknownTail/overallExact=null。历史更正：recovery-04失败人是陆知微`person:lu-zhiwei`，非陆清和；transport351的food18属于recovery-06最终源并在recovery-06完成，不是run07新增；run07新增352/6@178180、353/8@178436，HOME30→44。旧失败/停点report原样保留。下段171973为GC03历史最终源。 v9交接：`.qa-dsh-parallel/08-provenance/handoff-merchant-harvest-01.json` SHA `1a6d4b52ccca4dc44191235b6de4b14b4a3f5cbf7580b4a63fcfcf400418cf61`；`ledger-v9-merchant-harvest-01.json` SHA `23ae57dc1ef91f1f7e1fdc421629f9d75ff27f1e6e5cf55badec30e647e328d2`；MD `handoff-merchant-harvest-01.md` SHA `f4f63d479d8cb0a1179e08c392d9f5ebaff3c8913ff045a6c6550349eefc67e2`；30绑定0不符。 本轮交付检查：npm test 408/408、fail 0；npm run check 通过；requirements refresh/validate 通过（40/200/120，acyclic）；自动化保持 PAUSED，需用户显式新的 resuming 授权才可继续。

GC03批次记录：一级连续桌面链已完成，该批最终源 `/Volumes/Media/immortal-qa/meditation-desktop-20261018/run-07/meditation-complete.json`，tick171973，SHA `1b9bcbee52bbcf241bf44c98aee15ef7d2569ae45aba9f1291486fdb754dd931`。run07为10/10、错误0、209.943秒；七段逐项墙钟合计777.710秒，原各段报告与递归时间字段保留。原施工14已建成、突破5完成180步/6→7层、有限供灵提升修为、运输347/348送2木1石、检修1256完成80步并恢复1539毫单位设施余量；灵源储量与设施余量分别记账。原生携货/施工/突破/修行/维护/最终存读覆盖，运行131文件冻结读回。run06的Lu门槛圈误报已在外部检查器按真实房间、入门预约和门口持有权修正；源码路径及室外地面未放宽。其后的正常求见已沿原字节继续，最新活动源见上文；GC25/26一级主树接入证据见68。详见[66](design/66-NORTH-MEDITATION-INTEGRATION.md)、[68](design/68-WEST-WORKSHOPS-INTEGRATION.md)。

当前可运行主线是纯 2D 高清像素桌面山院，Windows 为主力平台，macOS 用于前期验证。`apps/courtyard/` 使用 Electron / Canvas 2D 展示原山院、东路与首处东台门人居，并读取 `src/simulation/` 的共用规则。`apps/web/` 仅保留界面组件，旧场景与启动入口已删除；历史 Godot 工程与独立样板位于 `archive/`。

原山院实机与东台 v2 母稿已获用户批准。当前山院管理、供苗/劳动/搬运、修行与物资操作、保存恢复和东台实际扩建有迁移前 macOS 证据。同一东台完成档已实际自主运行 1200.036 秒，原生最小化 180.857 秒并继续推进；其中持续口粮供给不足，之后使用同源存档手动采粮恢复。完整范围与原验收脚本失败的处理见 [53 长验记录](design/53-COURTYARD-AUTONOMY-ACCEPTANCE.md)。

U-152 工程整理覆盖结构、命令、构建、测试与文档导航，保持既有游戏逻辑和存档标识。干净检出安装、根检查、默认核心测试 124/124、桌面暂存、最终 macOS 包同档复验 5/5 和真实网页操作 8/8 已完成，独立审计无阻断。扩展套件 623 项中 560 通过、60 失败、3 跳过；60 项失败均在迁移前基点逐名重现，当前失败名称没有新增。源码已推送，远端三平台检查、三个桌面包及现有网页发布已核对，具体证据见 [工程迁移记录](engineering/MIGRATION-20261016.md)。

U-153 将当前桌面的空存档入口接通灭门序章、云岫落脚、疗伤择卷与首次主殿营造。阶段读取正式共用状态，同一人物与物资持续保存；详细实现、最终包验证和连续录像见 [54 开局演示](design/54-COURTYARD-OPENING-DEMO.md)。主殿之后的完整前期流程继续按原验收范围接续。

U-154 将序章细分为六幕连环画，母子沿下山动线逃离火宅，并在首次开始疗伤时播放包裹展开的四幅关键帧。实际画面、呈现进度存读和新录像继续记录在 54；整体前期需求状态按台账保持。

U-155 修正守阵、下山与诀别三张画帧，四类当前访客共用南侧山路真实入离场。最终 macOS 包序章 17/17、普通新档访客 4/4，途中暂停重启精确恢复，基础测试 143/143。实机演示与视频仅在用户本次明确要求时生成。详细边界与证据见 [54 开局记录](design/54-COURTYARD-OPENING-DEMO.md)。

## 当前接续：U-167住宅一级收口与东台服务

GC13同源源码Electron链已完成：两批各10份饭食、掌门实际到席吃2份、次日日结抵扣及三次精确重开，run07为12/12、错误0，最终tick75625；前六段失败与续接记录保留。GC02北台与阁内整理/研习已合入，正常链正接续该档筹料。筹资中陆知微176点跨区路径触发旧上限，已修复并从原tick78738失败档精确续接；直接18项通过。详见[62](design/62-EAST-SERVICES-INTEGRATION.md)§12–13及[64](design/64-NORTH-LIBRARY-INTEGRATION.md)。

目标模式已验证GC-17/18/19/24一级批，先读[60西谷接入](design/60-WEST-VALLEY-INTEGRATION.md)。四处预设施工、显式扩谷、有限石层、种粮作物、公库库存与场景阶段层已接入。完整macOS源码Electron run03使用未改原始来源，31/31、1219.061秒、7次精确关闭重开、错误0；四址营建、18.4石与35.2593256粮实际入新库、两田各留2种粮。证据在 `/Volumes/Media/immortal-qa/west-valley-desktop-20261018/run-03/`，源码/素材SHA随报告封存。此前公开命令检查点与两次脚本失败保留各自范围。远路邀请使用有限通勤、到岗后计劳动承诺；公库口粮纳入实际回运供给。当前接续[61住宅](design/61-RESIDENTIAL-INTEGRATION.md)：住宅正式运行27项与相关旧路径8项已通过；既有主殿桌面选床与真实入住6/6，精确重开、错误0。三院阶段层与新域空间已接入，空间及直接回归34/34；正常筹资已备齐181.4灵石、164木、80石，分存在HOME与新公库。四院一级连续营建已从筹资run02最终档完成，结论见下段。商人补货耗尽后的断访已修复，原失败档真实复访/成交/回运及12项定向检查通过。整体目标保持进行。

住宅一级同源链已完成：run04先完成GC09的5项检查，run05从其原生关闭档tick32606精确续接，后段28/28、错误0；合计墙钟2242.176秒，最终tick46427。四院实际投入180灵石、160木、80石，16床加主殿4床共20张可用床；掌门实际迁入GC12新床后释放旧床，陆知微原住处保留。5次关闭重开均保持完整世界状态，来源及101个运行源码/素材SHA一致。证据 `/Volumes/Media/immortal-qa/residential-build-desktop-20261018/run-05/report.json` 与 `sealed-readback.json`，详见61§20。

默认239/239及32项直接专项为住宅冻结版本既有证据；道路run02的9/9和最终代码道路run03的中断各保留范围。[62膳房与医庐](design/62-EAST-SERVICES-INTEGRATION.md)的31个选定文件已逐项校验SHA并接入主工程，GC13/14正式建位、有限洁水采购、实际炊事/用膳/诊疗及界面已实现。主工程检查通过；默认277项中276通过，1项目录旧数量预期已更新并单独5/5复验。经营14项及独立复核3项通过。住宅最终档经39条公开命令筹足膳房与炊食材料，同源macOS源码Electron营建、购水和用膳链已按62§12完成；医庐正常解锁和桌面疗程仍待接续。整体25项设施/31处建位、升级画层、Windows、安装包和完整SR/AC保持接续。


## U-167金丹篇预设建位与西林

用户已批准[58总图](design/58-GOLDEN-CORE-PRESET-BUILDINGS.md)：25项设施、31处预设位置。先读[59西林接入](design/59-WEST-FOREST-INTEGRATION.md)。当前总图31号可查看，原殿/原药圃/东台沿用旧身份；西林采伐场已接通真实行走、运料、施工、两个露天工位、现场生产及搬回公库。其余27处待分区接入。旧east档只在显式启用后扩西。

默认170/170；最终macOS源码Electron从同一两人暂停档完成10/10，实际100.894秒，三次存读与页面/运行错误检查通过。证据`/Volumes/Media/immortal-qa/west-forest-20261018/run-03/`。后续按总图继续采石场、稻田与公库，并接续林长风正式入门和三人长验；升级画层、Windows及当前安装包另验。源码、美术与文档均在当前工作区，保留既有增量。

## U-165主殿山域与预设采伐场

用户确认所有建筑位置完全预设，主殿世界需向外扩展，将采伐场与山路、林木、地形整体绘制；人物实际到场运料、修建。总图已由U-167批准，西林一级接入与验证见59。林长风门籍、统一人物窗与多居民邀请成果保留；院前临时营造入口和独立素材已撤下，三人长验尚未完成。读取[57三人山院与预设采伐场](design/57-THREE-RESIDENT-COURTYARD.md)，不要把此前短验作为新场地验收。

## 当前接续：U-163持续供粮

用户已确认恢复主线，第一批两人小院持续供粮已接入：口粮目标、有限采集与实际搬回、保留生活粮的付费补种及旧策略兼容。定向25/25、默认核心152/152通过；macOS源码Electron同源实际自主1200.016秒，5批采粮并送库80份、日常消费40份，公库3→43，解除饥荒后持续为0。长验11/11、证据独立核对12/12、界面7/7及macOS包同档短复验6/6通过，暂停与关闭重开精确恢复。成功付费补种的实际桌面操作、Windows与更大人数仍待验；详见[56持续供粮](design/56-COURTYARD-FOOD-SUPPLY.md)。

## 读取顺序

2026-10-18 **U-162** 当前[掐诀护身小样](../assets/characters/shen-yan/guard-study-v1/README.md)为12帧、1.76秒：胸前结诀、周身升盾合顶、持诀、盾面涟漪及收诀消散。沿用认可的S01人物和U-161校准的80母稿像素，院中／阶前平地共同缩放复看。成盾时全部人物及装备像素包在盾内；最终Electron正常30项、缺失素材4项检查通过，页面错误0。S04美术认可、正式护持和存读接入分别推进，正式桌面仍为111标尺。

2026-10-18 **U-160** 已完成[引诀点发完整动画小样](../assets/characters/shen-yan/cast-study-v1/README.md)：12帧、1.28秒、人物／剑／法术三层，本地Electron播放器支持三档尺寸与逐帧检查。最终素材窗口20项检查通过、错误0，脚点和首尾像素一致；人物外观已由用户在U-161确认沿用。后续动作和正式运行接入按各自范围推进。

2026-10-17 动作设计按 **U-158／R-51／T-17** 接续[55 人物动作库](design/55-CHARACTER-ACTION-LIBRARY.md)及兵器神通、百艺分册。已形成100个动作组的姿势和收势方案，并将现有172项百艺草案对应工序与阵法组。**U-159** 首批[七组关键姿势](art/character-actions-20261017/README.md)已出图，每组四格，供用户评看动作轮廓和持物关系；连续动画需统一尺寸与脚点、拆层补帧和实际尺寸复看。行走小样的制作和验证事实按下一段独立记录，正式运行与完整SR/AC状态保持。

2026-10-17 人物素材接续按 **U-157**：固定视角、人物近景立绘；用户在对照中选定现行蓝白衣装、长发持剑的像素外观与已生成的行走动作。当前评看入口为[原像素形象行走小样](../assets/characters/shen-yan/pixel-walk-study-v1/README.md)：原站立图的二维网格受真实骨架投影驱动，16帧、1.366667秒，动作幅度适配为0.6倍。原外观、左右脚交替、剑发完整经独立静态复核；最终111/150/222像素本地桌面加载、播放与步进通过。第008–011帧裤腿仍有单图拉伸感，需补袍下腿部独立图层；用户画面批准、更多动作与换装复用分别接续。[首轮三维行走](../assets/characters/shen-yan/walk-study-v1/README.md)、[精细模型v2](../assets/characters/shen-yan/hunyuan-v2/README.md)和[建模参考](art/shen-yan-model-reference-20261017/README.md)作为来源保留。当前桌面主线、正式运行接入与完整SR/AC状态保持。

1. [设计入口](design/README.md)、[统一基准](design/00-BASELINE.md)、[决策登记](design/DECISIONS.md)、[当前状态](design/STATUS.md)。
2. [共同运行契约](design/05-RUNTIME-CONTRACTS.md)、[开局验收](design/06-OPENING-ACCEPTANCE.md)、[前期详细设计](design/14-EARLY-GAME-DETAILED-DESIGN.md)，再读取本次分系统。
3. [需求管理](requirements/README.md)、[总表](requirements/BACKLOG.md)、[台账](requirements/registry.json) 和对应 `items/SR-XF-xxx.md`。
4. 当前空间与经营任务读取 [45 自主经营](design/45-SECT-IDLE-SLICE.md)、[46 连续山域](design/46-CONTINUOUS-DOMAIN-FOUNDATION.md)、[51 山院管理](design/51-COURTYARD-MANAGEMENT-INTEGRATION.md)、[52 东台](design/52-EAST-TERRACE-INTEGRATION.md)、[53 长验](design/53-COURTYARD-AUTONOMY-ACCEPTANCE.md)。
5. 美术按 [原山院母稿](art/pixel-courtyard-prototype-20261014/README.md)、[保真要求](art/pixel-courtyard-prototype-20261014/FIDELITY.md) 和 52 的东台批准依据核对。山域规划另读 [成长章程](SECT-GROWTH-PLAN.md) 与 [山域试游](MOUNTAIN-DOMAIN.md)。

当前设计为 DB-2026-10-05 v1.2。U 表示用户确认，R/T 表示作者建议或可调参数。U-93 暂停主动远期世界观问答；未答的神道两项保留未定，按现有依赖继续前期工作。

## 根目录命令

安装需要 Node.js 22.12 或以上与 npm；台账及部分历史工具使用 Python 3。

```sh
npm ci
npm start
npm test
npm run check
npm run build:desktop
```

网页预览、构建与发布按 U-156 停用。生成目录与各命令范围见 [工程说明](engineering/REPOSITORY.md)。QA 日志、截图、测试存档与临时产物写到仓库外；桌面验收使用独立 `--qa-dir`，网页验收使用 `acceptance=qa-*`，保护用户正式存档。

台账由 JSON 生成派生文档：

```sh
python3 scripts/requirements/sr-manager.py refresh
python3 scripts/requirements/sr-manager.py validate
```

## 关键文件

| 工作 | 当前路径 |
| --- | --- |
| 桌面窗口与生命周期 | `apps/courtyard/courtyard-host.cjs`、`courtyard-preload.cjs` |
| 山院界面与操作 | `apps/courtyard/courtyard-main.mjs`、`courtyard-panels.mjs`、`courtyard-panel-state.mjs` |
| 场景、坐标与东台 | `apps/courtyard/courtyard-renderer.mjs`、`courtyard-space.mjs`、`courtyard-east-layout.mjs` |
| 桌面读档与恢复 | `apps/courtyard/courtyard-persistence.mjs`、`courtyard-recovery.cjs`、`sect-storage.cjs` |
| 山院对共用模拟的接入 | `apps/courtyard/sect-sim.mjs`、`sect-seed.mjs` |
| 模拟、活动与自主 | `src/simulation/ea-sim.mjs`、`ea-opening-sim.mjs`、`ea-sr-runtime.mjs`、`ea-sr-persons.mjs` |
| 空间、物流与持久化 | `src/simulation/ea-sr-spatial.mjs`、`ea-sr-economy.mjs`、`ea-persistence.mjs` |
| 网页退役与发布暂停 | [U-156 记录](engineering/WEB-RETIREMENT-20261017.md) |
| 运行素材 | `assets/courtyard/`、`assets/web/` |
| 单元与实际验收 | `tests/unit/`、`tests/acceptance/`、`tests/fixtures/` |
| 构建与发布 | `scripts/build/`、`scripts/release/`、`.github/workflows/` |
| 历史工程 | `archive/godot/`、`archive/prototypes/` |

历史源码和证据中的旧路径可按 [迁移说明](engineering/MIGRATION-20261016.md) 追溯。`dist/` 是构建产物，源码修改在上述目录进行。

## 每批执行与验收

每批开始建立四项对应关系：

```text
本批需求：SR-XF-xxx / 对应 AC，以及尚未完成的部分
设计依据：U/R/T 编号和当前规格条款
预计修改：文件、模块和受影响的身份、空间、活动或存档接口
验收：正常公开操作 → 可见结果 → 失败/中断恢复 → 精确存读 → 相关界面
```

先验证本次基本功能，再做直接相关回归。正常流程保持同一来源档，记录真实资源、时间和状态变化。正式世界规则、人物身份、NPC 意愿、空间事实和时钟由共用模拟裁定；UI 与只读检查不推进世界。当前后台继续、关闭不补时遵守 U-139。

迁移保持 schema 6、桌面应用身份、用户数据目录、存档命名空间和存档文件名；不得因目录整理创建一个看似空白的新用户档。旧档按现有加载器校验，失败保留原文。组件检查、屏幕交互、旧档矩阵和目标设备分别记证据。

交付前由另一个 Agent 只读复核；主 Agent 再核对实际差异、公共命令与接缝。独立复核不可用时明确记录。更新台账和 STATUS，执行 refresh / validate；源码提交、远端核对、网页部署与桌面应用交付分别报告。

## 当前未完成事项

1. 接续三至五人正常持续经营。U-163两人持续供粮已通过同源桌面长验；当前供给能力受真实来源、材料、资金、整备额度与玩家许可约束。
2. 当前桌面从普通新档完整走到炼丹、出谷首战、撤退返院与恢复；正式人物交谈、突破和独立演武整合分别接续。
3. 东台接入后的实机画面评看、更大山域、跨区成长与完整迁移矩阵。
4. Windows 真机、系统睡眠/唤醒、足额自主整备成功支出的实际桌面操作、目标规模性能与完整 SR/AC。

40 项 SR 继续按现有依赖推进；当前 120 条 AC 为 31 通过、88 未运行、1 阻塞，整项通过的是需求管理。720 项修行库属于作者内容草案，运行接入、动作数值、效果与平衡另验。

## 历史与发布

迁移开始时工作区基点为 `e5f0d78358ab42fefbd2b5e3c516465bff115f8b`，既有未提交成果备份于 `/Volumes/Media/immortal-delivery-backups/engineering-20261016-202844`。最新提交与远端状态须重新核对；这个基点只用于本次迁移追溯。

入口文档的旧全文按原路径保存在 [历史快照](history/README.md)，历史验收记录与失败原文继续保留。只提交必要源码、素材、设计和可复用测试；运行日志、截图、个人测试存档与生成物留在仓库外。

U-156 要求线上旧网页下线。用户重构网页版并明确恢复发布前，只同步源码，禁止重新启用 Pages、运行网页发布或提交运行产物触发部署。实际下线与验证见 [退役记录](engineering/WEB-RETIREMENT-20261017.md)。源码推送失败时可使用已授权的 GitHub API 路径，更新分支须核对预期 HEAD 并保持 `force:false`。

2026-10-18 住宅筹资接缝：统一人物窗当面交易已接入，物资页可实际取货至掌门随身。专项5/5，本地源码Electron独立连续轨道11/11、两次精确重开、错误0；20石换18灵石，买10粮支出10，余8灵石实际回运。详见61§10。住宅床位运行、三院空间与四院连续营建仍在推进；该交易轨道不替代西谷最终来源的后续营建验收。
