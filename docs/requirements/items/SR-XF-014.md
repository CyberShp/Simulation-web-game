# SR-XF-014 · 学习、转修与炼气至筑基配置

来源：DB-2026-10-05 v1.2；需求版本：1.0；建档日期：2026-10-06。

| 字段 | 值 |
| --- | --- |
| 范围 / 模块 | 前期必需 / 成长 |
| 优先级 / 计划 | P1 / I2 |
| 设计 / 开发 | draft / in_progress |
| 验收 / 发布 | in_progress / not_released_for_this_sr |
| 责任人 / 复核人 | Codex/equipment_growth / Codex/root（集成） |

## 来源、依赖与范围

纳入云岫前期，按依赖推进。

决策来源：U-63, U-65, U-73, R-25, R-26, U-94, U-114, R-37, U-123, U-149, R-49, U-158, R-51, T-17, U-166, R-54, T-22。这是继承的U项和作者实施默认；具体新增名称/数值不得伪装成用户逐项批准。

规格：[01-CHARACTERS.md](../../../docs/design/01-CHARACTERS.md)、[02-EQUIPMENT-ARTS.md](../../../docs/design/02-EQUIPMENT-ARTS.md)、[05-RUNTIME-CONTRACTS.md](../../../docs/design/05-RUNTIME-CONTRACTS.md)、[14-EARLY-GAME-DETAILED-DESIGN.md](../../../docs/design/14-EARLY-GAME-DETAILED-DESIGN.md)、[06-OPENING-ACCEPTANCE.md](../../../docs/design/06-OPENING-ACCEPTANCE.md)、[19-FIVE-CONTINENT-ARTS.md](../../../docs/design/19-FIVE-CONTINENT-ARTS.md)、[20-ARTS-GROWTH-COMBAT.md](../../../docs/design/20-ARTS-GROWTH-COMBAT.md)、[41-COURTYARD-VALLEY-IMPLEMENTATION.md](../../../docs/design/41-COURTYARD-VALLEY-IMPLEMENTATION.md)、[51-COURTYARD-MANAGEMENT-INTEGRATION.md](../../../docs/design/51-COURTYARD-MANAGEMENT-INTEGRATION.md)、[58-GOLDEN-CORE-PRESET-BUILDINGS.md](../../../docs/design/58-GOLDEN-CORE-PRESET-BUILDINGS.md)、[64-NORTH-LIBRARY-INTEGRATION.md](../../../docs/design/64-NORTH-LIBRARY-INTEGRATION.md)。

依赖：[SR-XF-002](SR-XF-002.md)、[SR-XF-009](SR-XF-009.md)、[SR-XF-012](SR-XF-012.md)。

关联既有验收：EARLY-02, CHAIN-02；本SR的AC细化这些目标，不代表旧版本已经通过。

## 现状与设计缺口

已有功法、主辅修、导师及旧筑基来源。

理解/熟练分离、成长曲线、转修和突破阶段配置未完整。

现状是适用旧能力的基线，不表示该SR完整目标已通过。

## 必须补齐的设计交付物

1. 青岚基础/筑基续篇与三路法门的章节、前置、冲突、教学和来源表。
2. 修为积累、理解、熟练、授业资格与有效实践收益曲线。
3. 筑基丹委托/自制两条路径；预留、炼化、完成、中断恢复阶段及成本。

## 需求行为

SR-XF-014-REQ-01：持有、理解、练成、授业分开，不复制旧knowledge为双满级。

SR-XF-014-REQ-02：满足积累、材料和已定义条件可突破，无干扰不加临时悟道骰子。

SR-XF-014-REQ-03：转修有可查成本和可靠转回途径，普通资质仍可经技艺成长。


## 验收标准

| ID | 情景 / 操作 | 必须看到的结果 | 状态 |
| --- | --- | --- | --- |
| SR-XF-014-AC-01 | 拒绝一种支线或改走另一修行路 | 仍有可靠基础能力与筑基材料来源。 | not_run |
| SR-XF-014-AC-02 | 炼化前后各取消、重载、再继续 | 按阶段只消耗已经发生的成本，不重复扣丹/奖励境界。 | not_run |
| SR-XF-014-AC-03 | 授课、低难重复练习和转修 | 资格真实、无空转成长，无限自伤治疗/重复换装不刷满熟练。 | not_run |

SR-XF-014-AC-03证据：局部：docs/art/SYSTEM-UI-2026-10-10.md（真实研习、拒绝授业、暂停取消与资源回退；转修和熟练收益仍待）

2026-10-12 U-123：五条开局攻守在山谷首战专项中经正式规则定向6／6；战斗网页及完整学习成长 AC 仍待验。 局部证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。

2026-10-12 U-123 首战本地网页：最终本地网页实点青岚术、剑式与护息，效果读取正式战斗结算；五条开局攻守的定向6／6仍属局部，完整学习／转修与成长 AC 状态保持。 证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。

## 开发任务

| 任务 | 工作 | 状态 | 前置 | 责任人 |
| --- | --- | --- | --- | --- |
| SR-XF-014-D01 | 设计补齐：交付：青岚基础/筑基续篇与三路法门的章节、前置、冲突、教学和来源表。；修为积累、理解、熟练、授业资格与有效实践收益曲线。；筑基丹委托/自制两条路径；预留、炼化、完成、中断恢复阶段及成本。；填实必需参数并标记U/R/T来源。 | in_progress | 无 | Codex/equipment_growth |
| SR-XF-014-D02 | 契约与内容审阅：审阅学习、转修与炼气至筑基配置与依赖契约（SR-XF-002、SR-XF-009、SR-XF-012）的字段、时序、失败及恢复；逐项核对本SR的REQ/AC。 | todo | SR-XF-014-D01 | 待分配 |
| SR-XF-014-I01 | 开发与集成：在成长模块实现学习、转修与炼气至筑基配置；交付SR-XF-014-REQ-01至REQ-03，接入相关数据、行为、素材、UI和恢复，提交关联SR。 | todo | SR-XF-014-D02 | 待分配 |
| SR-XF-014-V01 | 验收与兼容：执行SR-XF-014-AC-01至AC-03及EARLY-02、CHAIN-02；登记实际结果、兼容和设备证据边界。 | todo | SR-XF-014-I01 | 待分配 |
| SR-XF-014-R01 | 发布与关闭：完成所需源码/运行时发布核对、交接和未覆盖说明；本轮用户不要求上传QA过程产物。 | todo | SR-XF-014-V01 | 待分配 |

SR-XF-014-D01证据：docs/design/19-FIVE-CONTINENT-ARTS.md（分类与云岫首批机制初稿，章节等继续）；docs/design/20-ARTS-GROWTH-COMBAT.md（成长与数值首稿，实机调校继续）；docs/design/29-ARTS-SAMPLE-QINGLAN-REALM-STOP.md（青岚与止步心法样例，非完整D01）；docs/design/30-ARTS-SAMPLE-LINEAGE-PERSONAL-ARRAY.md（跨境传承与个人阵样例，非完整D01）；docs/design/47-GOLDEN-CORE-ARTS-CATALOGUE-DRAFT.md；2026-10-15 U-145/R-45：169项修行内容草案、五脉续篇、获取替代、百艺阵法、暗线与特效；仅补设计证据，金丹运行与完整D/I/V/R、AC状态保持。；docs/design/48-GOLDEN-CORE-WORLD-ARTS-V02.md；2026-10-15 U-146/R-46：720项玩家/NPC世界修行库、72新增来源谱系，符箓蛊道心法攻防及获取特效补齐；仅设计字段、来源与引用检查，运行及完整D/I/V/R、AC状态保持。；docs/design/50-COURTYARD-UI-DESIGN-AUDIT.md；2026-10-15 U-148/R-48：四页及关联入口30项设计审查与7条后续场景；两处物流问题由正常命令复现，运行代码未修，实际UI未验，完整状态保持。

SR-XF-014-I01证据：docs/design/49-P0-P2-COURTYARD-PROGRESS.md；2026-10-15 U-147/R-47：院务/人物/工位/物资/研习操作、保存失败保护和疗伤收据重放；47/47 Node检查。浏览器内核缺失且官方下载失败，实际UI与桌面未验，完整P0—P2及SR/AC状态保持。

SR-XF-014-V01证据：docs/design/49-P0-P2-COURTYARD-PROGRESS.md；2026-10-15 U-147/R-47：院务/人物/工位/物资/研习操作、保存失败保护和疗伤收据重放；47/47 Node检查。浏览器内核缺失且官方下载失败，实际UI与桌面未验，完整P0—P2及SR/AC状态保持。

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

- docs/requirements/design/SR-XF-012-014-018-024-028-033.md
- docs/requirements/IMPLEMENTATION-2026-10-06.md
- docs/design/19-FIVE-CONTINENT-ARTS.md（四千九百种分类规划与云岫六十七种机制初稿；D01未完成）
- docs/design/20-ARTS-GROWTH-COMBAT.md（修炼收益、品质与抗性数值首稿；D01仍未完成）
- docs/design/29-ARTS-SAMPLE-QINGLAN-REALM-STOP.md（青岚与筑基止步心法的取得、供给和转修试算；D01仍未完成）
- docs/design/30-ARTS-SAMPLE-LINEAGE-PERSONAL-ARRAY.md（跨境传承与个人阵的取得、供给和存读试算；D01仍未完成）
- docs/design/32-OPENING-INHERITANCE.md（五选一开局局部实现；四条非青岚筑基续篇未通）
- docs/design/33-ARTS-INITIAL-CALIBRATION.md（Y-001–067逐项品相与机制复评）
- docs/design/28-FIVE-CONTINENT-ARTS-LEDGER.md（目录草稿更新至Y-347；运行实装另计）
- docs/art/COURTYARD-VALLEY-2026-10-12.md
- tests/unit/web/ea-mountain-first-combat.test.mjs
- docs/design/47-GOLDEN-CORE-ARTS-CATALOGUE-DRAFT.md；2026-10-15 U-145/R-45：169项修行内容草案、五脉续篇、获取替代、百艺阵法、暗线与特效；仅补设计证据，金丹运行与完整D/I/V/R、AC状态保持。
- docs/design/48-GOLDEN-CORE-WORLD-ARTS-V02.md；2026-10-15 U-146/R-46：720项玩家/NPC世界修行库、72新增来源谱系，符箓蛊道心法攻防及获取特效补齐；仅设计字段、来源与引用检查，运行及完整D/I/V/R、AC状态保持。
- docs/design/49-P0-P2-COURTYARD-PROGRESS.md；2026-10-15 U-147/R-47：院务/人物/工位/物资/研习操作、保存失败保护和疗伤收据重放；47/47 Node检查。浏览器内核缺失且官方下载失败，实际UI与桌面未验，完整P0—P2及SR/AC状态保持。
- docs/design/50-COURTYARD-UI-DESIGN-AUDIT.md；2026-10-15 U-148/R-48：四页及关联入口30项设计审查与7条后续场景；两处物流问题由正常命令复现，运行代码未修，实际UI未验，完整状态保持。
- docs/design/51-COURTYARD-MANAGEMENT-INTEGRATION.md；2026-10-15 U-149/R-49：四页与共用详情、单趟40份留苗搬运、落地回收和保存恢复接通；组件与相邻回归57/57，同一检查点真实桌面387.845秒13/13、最终包页面8/8、恢复链9/9，原生选择文件/预检/恢复及手动暂停已验。完整新档、规模、对话/突破、跨区施工、20分钟自主与Windows待接；完整D/I/V/R和AC状态保持。
- docs/design/55-CHARACTER-ACTION-LIBRARY.md
- docs/design/character-actions/WEAPONS-AND-SUPERNATURAL.md
- docs/design/character-actions/CRAFTS.md
- docs/design/character-actions/craft-coverage.json
- docs/design/58-GOLDEN-CORE-PRESET-BUILDINGS.md
- docs/art/golden-core-domain-20261018/README.md
- docs/design/64-NORTH-LIBRARY-INTEGRATION.md
- docs/design/66-NORTH-MEDITATION-INTEGRATION.md
- docs/design/68-WEST-WORKSHOPS-INTEGRATION.md

- 2026-10-06：由v1.2设计缺口审计建立SR；新增内容和参数遵循作者默认，不冒充用户逐项确认。
- 2026-10-06：用户授权目标模式、多agent并行开发与验收；启动D01，按现有契约展开模块设计，未将建档或局部实现标作交付。
- 2026-10-11：按U-112建立约七百部五洲功法目录规划，补云岫首批四十部机制初稿；SR-XF-014其余设计交付物及实现验收继续。
- 2026-10-11：按U-113重定为约四千九百种独立可学项目，区分心法、武学、术法、身法、神通和百艺；扩展云岫首批至五十五种并补青岚攻伐关系，D01保持进行中。
- 2026-10-11：按U-114/R-37扩充魔道、妖道、毒道及复合分支，重排类型预算并写出六十七种；补六类修炼收益和品质、抗性方案，D01继续。
- 2026-10-11：补Y-001/041/068/107/007的完整评看样例；旧档映射、三路章节、筑基丹两条路径和定标仍缺，D01继续。
- 2026-10-11：U-115五条入门线索接入新档疗伤、暂停、选法、攻守与存读；旧档保留。校准前67项后用三agent写至Y-347。四条非青岚筑基续篇、独立授业、同境平衡及完整SR验收继续待办。
- 2026-10-12：2026-10-12 U-123：五条开局攻守在山谷首战专项中经正式规则定向6／6；战斗网页及完整学习成长 AC 仍待验。 局部证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。
- 2026-10-12：2026-10-12 U-123 首战本地网页：最终本地网页实点青岚术、剑式与护息，效果读取正式战斗结算；五条开局攻守的定向6／6仍属局部，完整学习／转修与成长 AC 状态保持。 证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。
- 2026-10-15：U-145授权起草至金丹复仇收束的修行目录；R-45是作者提案。本批仅文档与同源JSON，不推进实现、验收或发布状态。
- 2026-10-15：U-146纠正169项过少，扩写至720项的R-46作者草案；玩家与NPC共用，补符蛊完整路线与散修来源，不推进运行或验收状态。
- 2026-10-15：U-147接续P0—P2：新增两人小院可操作供给成长和保存/事务保护，登记局部实现与Node证据；实际UI/桌面未验，完整状态不推进。
- 2026-10-15：U-148：记录四页及关联入口设计审查、操作断点和R-48重整提案；未修运行代码，完整D/I/V/R与AC状态保持。
- 2026-10-15：U-149：接续远端main并完成当前山院管理和取消回收、保存恢复的局部桌面验证；完整状态保持。
- 2026-10-17：U-158/R-51/T-17：登记人物动作设计稿及兵器神通、百艺分册，100动作组区分姿势、手位、物件、作用事件及中断收势；172项百艺草案按工序和阵法组对应。本批只检查设计覆盖、引用与同源时钟/身体活动/封闭建筑/知情等契约。具体姿势、八向建议与制作批次待评看，新动作素材和正常/失败/存读及设备验证待后续；完整SR/AC与任务状态保持。
- 2026-10-18：U-166/R-54将金丹篇建筑纳入同一预设山域规划：25项设施、31处编号位置，覆盖14类现行类型及专门工位。完成目录核对、编号图与整体场景概念；布局待评看，米制校准、施工接入和运行验收继续推进，本SR及AC状态保持。
- 2026-10-18：U-167 GC03同源公开筹料91743→117712→167589→168109完成，前两段失败及自然人物成长保持。macOS Electron run01勘察途中身体边缘检查失败，实际168489原生档封存，页面错误0；道路中心修复已合入、实机接续待验。GC25/26在隔离副本制作，完整SR/AC状态保持。
- 2026-10-18：U-167 GC03北台路心与静态地面查询修复合入，主树5项及原168489实际94步/4次存读通过。桌面原勘察1170在168583完成，施工14仅扣60灵石40木25石一次；实际168803封存后定位林长风自主回床路线检查失败。run02离开建位缺步及run03热字段遗漏为验收脚本问题，全部实际来源、进度及失败保留。完整经营与SR/AC继续验收。
- 2026-10-18：U-167 GC03原施工14已在同源桌面完成；四蒲团/两检修位、180步炼气6→7层、有限供灵与四次关闭重开通过。北路返床/绕人修复主树8项及实际27步回路成立。现场货位目的地过滤已补；当前170563检修运输347续接核对主殿门槛圈样本，维护全链未完成。丹房四阶段四工位16项为隔离候选证据。完整SR/AC状态保持。
- 2026-10-18：U-167 GC03一级同源macOS源码桌面链完成：最终171973，run07为10/10、错误0、209.943秒，七段实际逐项合计777.710秒。勘察/施工、180步6→7层、有限供灵、原运输347与348送2木1石、80步维护均成立，携货及活动中多次精确重开。Lu门槛为外部脚圈检查室内边界遗漏，已按正式预约/holder/floor纠正且保留离路反例。整体建筑与完整SR/AC继续。

本文件由[registry.json](../registry.json)派生；更新台账后执行 `python scripts/requirements/sr-manager.py refresh`，不单独修改此派生页。
