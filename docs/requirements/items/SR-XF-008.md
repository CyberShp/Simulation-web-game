# SR-XF-008 · NPC日程、自主选择与职责参数

来源：DB-2026-10-05 v1.2；需求版本：1.0；建档日期：2026-10-06。

| 字段 | 值 |
| --- | --- |
| 范围 / 模块 | 前期必需 / 人物 |
| 优先级 / 计划 | P1 / I1 |
| 设计 / 开发 | ready / in_progress |
| 验收 / 发布 | in_progress / not_released_for_this_sr |
| 责任人 / 复核人 | Codex/economy_people / Codex/root（集成） |

## 来源、依赖与范围

纳入云岫前期，按依赖推进。

决策来源：U-63, U-93, R-25, U-94, U-123, U-125, U-139, U-149, R-49, U-151, R-43, U-163, R-52, T-18, U-167, T-20, T-21, T-22。这是继承的U项和作者实施默认；具体新增名称/数值不得伪装成用户逐项批准。

规格：[01-CHARACTERS.md](../../../docs/design/01-CHARACTERS.md)、[07-ECONOMY-ORGANIZATION.md](../../../docs/design/07-ECONOMY-ORGANIZATION.md)、[08-LIVING-WORLD.md](../../../docs/design/08-LIVING-WORLD.md)、[14-EARLY-GAME-DETAILED-DESIGN.md](../../../docs/design/14-EARLY-GAME-DETAILED-DESIGN.md)、[03-SPATIAL-ART.md](../../../docs/design/03-SPATIAL-ART.md)、[41-COURTYARD-VALLEY-IMPLEMENTATION.md](../../../docs/design/41-COURTYARD-VALLEY-IMPLEMENTATION.md)、[42-CHARACTER-DIALOGUE.md](../../../docs/design/42-CHARACTER-DIALOGUE.md)、[51-COURTYARD-MANAGEMENT-INTEGRATION.md](../../../docs/design/51-COURTYARD-MANAGEMENT-INTEGRATION.md)、[45-SECT-IDLE-SLICE.md](../../../docs/design/45-SECT-IDLE-SLICE.md)、[53-COURTYARD-AUTONOMY-ACCEPTANCE.md](../../../docs/design/53-COURTYARD-AUTONOMY-ACCEPTANCE.md)、[56-COURTYARD-FOOD-SUPPLY.md](../../../docs/design/56-COURTYARD-FOOD-SUPPLY.md)、[61-RESIDENTIAL-INTEGRATION.md](../../../docs/design/61-RESIDENTIAL-INTEGRATION.md)、[62-EAST-SERVICES-INTEGRATION.md](../../../docs/design/62-EAST-SERVICES-INTEGRATION.md)、[64-NORTH-LIBRARY-INTEGRATION.md](../../../docs/design/64-NORTH-LIBRARY-INTEGRATION.md)。

依赖：[SR-XF-002](SR-XF-002.md)、[SR-XF-003](SR-XF-003.md)。

关联既有验收：SLOT-01, ECON-04；本SR的AC细化这些目标，不代表旧版本已经通过。

## 现状与设计缺口

已有自主行为、意愿和工位等候基础。

v2 日相位已随唯一世界时钟更新且不打断有效工作承诺；完整候选效用、日程活动切换、职责、记忆更新及 3–5/24–32 人规模参数仍需补齐。

现状是适用旧能力的基线，不表示该SR完整目标已通过。

## 必须补齐的设计交付物

1. 需要/志向/能力/关系/风险的候选过滤与效用参数表，保留不能做与不愿做区别。
2. 承诺期限、改意阈值、重试退避、活动中断和恢复规则。
3. 关键人物日程、岗位可用时间、关系记忆影响和隐私投影。

## 需求行为

SR-XF-008-REQ-01：掌门提供机会，NPC自己接受，不以批量按钮强制工作、学法或参战。

SR-XF-008-REQ-02：同一人物不能同时巡护、授课与外出；长期承诺受伤或危险时可合法中断。

SR-XF-008-REQ-03：理由只显示公开/本人说法，隐藏动机不从UI泄露。


## 验收标准

| ID | 情景 / 操作 | 必须看到的结果 | 状态 |
| --- | --- | --- | --- |
| SR-XF-008-AC-01 | 重复邀请同条件NPC | 接受结果不靠点击重掷；条件变化后才合法重评估。 | passed |
| SR-XF-008-AC-02 | 五人竞争两个工位 | 两人实际执行，其他等待或改做其他事，入口不叠人假生产。 | passed |
| SR-XF-008-AC-03 | 出行或受伤打断工作 | 生产停止，预约合理释放；恢复先重验身体、目标和材料。 | passed |

SR-XF-008-AC-01证据：tests/acceptance/ea-sr-008-invite-public-acceptance.mjs；src/simulation/ea-sr-persons.mjs；apps/web/ea-sr-ui.mjs；docs/design/STATUS.md

SR-XF-008-AC-02证据：tests/acceptance/ea-sr-008-five-workers-public-acceptance.mjs；apps/web/ea-ui.mjs；src/simulation/ea-sr-persons.mjs；docs/design/STATUS.md

SR-XF-008-AC-03证据：tests/acceptance/ea-sr-008-travel-interrupt-public-acceptance.mjs；tests/acceptance/ea-sr-008-material-interrupt-public-acceptance.mjs；tests/acceptance/ea-sr-008-injury-interrupt-acceptance.mjs；src/simulation/ea-facility-activities.mjs；docs/design/STATUS.md

2026-10-08 M2 首批：SR008-AC01 公开命令五阶段 accepted/repeated/unavailable/renewed/working 精确存读与原生导入一致；管理页在接受和停用同 tick 显示当前公开原因与有效承诺，浏览器独立只读导入核对。根 Agent 复跑 1/1，相关界面10/10、经济52/52。AC02/03和整项门槛仍未完成。
2026-10-08 M2 五人两工位验收：正常新档 128 条公开命令招至五人、建居舍并三趟搬运腾出木材缓存；五人分别获邀，两人实际占独立伐木工位，两人各在门外独立点等候，一人自主休憩；第28批仅两名执行者记贡献、只一条产出事实且库存增量等于产量。根 Agent 复跑1/1并看隔离桌面浏览器的执行者、等候者、建筑2/2三张截图；修正侧卡从投影人物误读旧休憩为真实身体活动。AC02 passed，真iPadOS/真人、AC03和整项门槛未关闭。
2026-10-08 r14 在正式schema6/content v1.2 每日供给已结算时，按人物/日号登记唯一来源事实，再一次更新信任；旧关系为既有基线，不反推旧日事实，坏来源拒载。正常公开有粮与缺粮链35命令/25次精确存读，新专项2/2，旧重复邀请和五人两工位2/2、世界21/21。源码307894b、Pages f3e0d63 built，162文本blob匹配。完整自主日程v2的迁移、承诺生命周期和正式决策尚未发布，I01继续；原AC与V/R状态不变。
2026-10-08 r15 有界 autonomy:v2 准备能力：从正常公开邀请原生档先验证原档，克隆迁移并保留旧承诺剩余期限和本人来源事实；到原截止世界步转 completed、设施停用或公开出行转 interrupted，逐阶段可精确存读；非法 speed=3 原档迁移前拒绝，低信任为可做但不愿做，设施不可用为硬阻塞。迁移专项正常来源37命令/24次存读，根合入后新增3/3、旧邀请/五人2/2、世界21/21、产权6/6；独立复核5/5，旧AC03三项缺外部来源检查点跳过。源码effc917、Pages a90fda6 built，162文本blob匹配。当前正式 tick/邀请仍走v1；v2其他活动、职责、意愿平衡、浏览器与目标设备未验，I01及整项V/R继续。

2026-10-12 U-123：陆知微照料首畦并在网页实收13.8份灵草；炼药专项含受伤门人私有药物自主取用，定向2／2。完整 NPC 日程仍按原状态。 局部证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。

2026-10-18 U-164/U-165局部：多Agent完成林长风门籍规则及同窗交互首轮，规则8/8、相关11/11，主Agent联合供粮/操作33/33；亲传Electron专项9项，范围限当时人物交互。用户明确扩大主殿山域、整体绘制采伐场、所有建筑完全预设并由人物实际到场修建；院前临时营造入口与独立素材已撤下。下一步先确认整体场景和稳定建位，再接施工与三人同源长验。二十分钟、当前桌面包、Windows及完整SR/AC尚未完成，整项状态保持。

## 开发任务

| 任务 | 工作 | 状态 | 前置 | 责任人 |
| --- | --- | --- | --- | --- |
| SR-XF-008-D01 | 设计补齐：交付：需要/志向/能力/关系/风险的候选过滤与效用参数表，保留不能做与不愿做区别。；承诺期限、改意阈值、重试退避、活动中断和恢复规则。；关键人物日程、岗位可用时间、关系记忆影响和隐私投影。；填实必需参数并标记U/R/T来源。 | done | 无 | Codex/root |
| SR-XF-008-D02 | 契约与内容审阅：审阅NPC日程、自主选择与职责参数与依赖契约（SR-XF-002、SR-XF-003）的字段、时序、失败及恢复；逐项核对本SR的REQ/AC。 | done | SR-XF-008-D01 | Codex/sr008_d02_review |
| SR-XF-008-I01 | 开发与集成：在人物模块实现NPC日程、自主选择与职责参数；交付SR-XF-008-REQ-01至REQ-03，接入相关数据、行为、素材、UI和恢复，提交关联SR。 | in_progress | SR-XF-008-D02 | Codex/sr008_schedule_v2 |
| SR-XF-008-V01 | 验收与兼容：执行SR-XF-008-AC-01至AC-03及SLOT-01、ECON-04；登记实际结果、兼容和设备证据边界。 | todo | SR-XF-008-I01 | 待分配 |
| SR-XF-008-R01 | 发布与关闭：完成所需源码/运行时发布核对、交接和未覆盖说明；本轮用户不要求上传QA过程产物。 | todo | SR-XF-008-V01 | 待分配 |

SR-XF-008-D01证据：docs/requirements/design/SR-XF-007-011-019-026-027.md; 2026-10-08 design revisions and independent D02 reviewer pass

SR-XF-008-D02证据：docs/requirements/design/SR-XF-007-011-019-026-027.md; independent reviewer report 2026-10-08

SR-XF-008-I01证据：tests/acceptance/ea-sr-008-invite-public-acceptance.mjs；src/simulation/ea-sr-persons.mjs；apps/web/ea-sr-ui.mjs；docs/design/STATUS.md；docs/requirements/design/SR-XF-007-011-019-026-027.md；2026-10-08 r14 在正式schema6/content v1.2 每日供给已结算时，按人物/日号登记唯一来源事实，再一次更新信任；旧关系为既有基线，不反推旧日事实，坏来源拒载。正常公开有粮与缺粮链35命令/25次精确存读，新专项2/2，旧重复邀请和五人两工位2/2、世界21/21。源码307894b、Pages f3e0d63 built，162文本blob匹配。完整自主日程v2的迁移、承诺生命周期和正式决策尚未发布，I01继续；原AC与V/R状态不变。；2026-10-08 r15 有界 autonomy:v2 准备能力：从正常公开邀请原生档先验证原档，克隆迁移并保留旧承诺剩余期限和本人来源事实；到原截止世界步转 completed、设施停用或公开出行转 interrupted，逐阶段可精确存读；非法 speed=3 原档迁移前拒绝，低信任为可做但不愿做，设施不可用为硬阻塞。迁移专项正常来源37命令/24次存读，根合入后新增3/3、旧邀请/五人2/2、世界21/21、产权6/6；独立复核5/5，旧AC03三项缺外部来源检查点跳过。源码effc917、Pages a90fda6 built，162文本blob匹配。当前正式 tick/邀请仍走v1；v2其他活动、职责、意愿平衡、浏览器与目标设备未验，I01及整项V/R继续。；2026-10-08 r18：正常来源92条公开命令、隔离迁移后10条邀请与至少66次精确存读；两名42分自愿到不同真实伐木工位，27分拒绝与身体硬阻塞、承诺到期、停用中断及150/300/600退避均复核。主线6/6，源码a7326da9b73f331567dbaa4fa6cfaba932f18a5d，Pages656f4b026bb917c54c070436218ecbbd39cc1981 built，162文本blob一致；浏览器、设备及完整v2未验。；2026-10-08 r19: mutual facility-route wait after the SR009 opening timing change was resolved with physical side-step; tests/acceptance/ea-sr-008-v2-work-public-acceptance.mjs 1/1, two real stations before the original 240-tick commitment expiry, exact-save yielding route; adjacent facility/door 17/17; source c9be1d476311a558e7a37a4e0305e5086b71a369；2026-10-08 M2 r32 v2 日相位子批：正常五人/两真实伐木工位来源链107+6公开命令、67次精确存读；两位自愿门人跨休整→生产偏好时保留原240步承诺、岗位和不同实际工位，停用营造后才中断。schedule.phase 在迁移、每世界步和只读人物页用同一 worldTick；不改生产结算或另建身体。根与独立新专项1/1、迁移1/1，旧邀请1/1、UI契约17通过/4待设备。旧v2-work硬编码缺失人物及旧five-workers精确小数坐标断言，在本提交父版本原样失败，不计回归通过；伤病/生产专项缺来源档跳过。源码2455d0b、Pages8c5621e built，162文本blob及公网入口/人物模块字节一致；r32未做浏览器游戏内交互和真机。完整v2/I/V/R继续。；docs/design/49-P0-P2-COURTYARD-PROGRESS.md；2026-10-15 U-147/R-47：院务/人物/工位/物资/研习操作、保存失败保护和疗伤收据重放；47/47 Node检查。浏览器内核缺失且官方下载失败，实际UI与桌面未验，完整P0—P2及SR/AC状态保持。；2026-10-18 U-167/T-20住宅接续：GC09–12沿固定建位建设，四院一级16实体床；独立床位模块10/10规则检查，含只读旧档、唯一床位、真实到床、途中存读与失效恢复。三院完工及空地母稿已制作，世界位置与升级占地待校准。正式运行接缝、近身有限交易筹资和同源桌面营建入住尚待完成；本条只登记住宅局部准备，不推进完整SR/AC状态。；2026-10-18 T-20 housing runtime: 27 scoped checks and 8 related opening/care regressions passed. Existing-hall source Electron UI: select bed, real arrival, shared person/building display, exact reopen: 6/6, errors 0. See docs/design/61-RESIDENTIAL-INTEGRATION.md section 11. Four-house normal construction and full SR/AC acceptance remain in progress.

SR-XF-008-V01证据：tests/acceptance/ea-sr-008-invite-public-acceptance.mjs；src/simulation/ea-sr-persons.mjs；apps/web/ea-sr-ui.mjs；docs/design/STATUS.md；docs/design/49-P0-P2-COURTYARD-PROGRESS.md；2026-10-15 U-147/R-47：院务/人物/工位/物资/研习操作、保存失败保护和疗伤收据重放；47/47 Node检查。浏览器内核缺失且官方下载失败，实际UI与桌面未验，完整P0—P2及SR/AC状态保持。；2026-10-18 U-167/T-20住宅接续：GC09–12沿固定建位建设，四院一级16实体床；独立床位模块10/10规则检查，含只读旧档、唯一床位、真实到床、途中存读与失效恢复。三院完工及空地母稿已制作，世界位置与升级占地待校准。正式运行接缝、近身有限交易筹资和同源桌面营建入住尚待完成；本条只登记住宅局部准备，不推进完整SR/AC状态。；2026-10-18 T-20 housing runtime: 27 scoped checks and 8 related opening/care regressions passed. Existing-hall source Electron UI: select bed, real arrival, shared person/building display, exact reopen: 6/6, errors 0. See docs/design/61-RESIDENTIAL-INTEGRATION.md section 11. Four-house normal construction and full SR/AC acceptance remain in progress.

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
- tests/acceptance/ea-sr-008-invite-public-acceptance.mjs
- src/simulation/ea-sr-persons.mjs
- apps/web/ea-sr-ui.mjs
- docs/design/STATUS.md
- tests/acceptance/ea-sr-008-five-workers-public-acceptance.mjs
- apps/web/ea-ui.mjs
- src/simulation/ea-society.mjs
- tests/acceptance/ea-sr-008-daily-relation-public-acceptance.mjs
- src/simulation/ea-sr-persons.mjs
- tests/acceptance/ea-sr-008-v2-migration-acceptance.mjs
- 2026-10-08 M2 r32 v2 日相位子批：正常五人/两真实伐木工位来源链107+6公开命令、67次精确存读；两位自愿门人跨休整→生产偏好时保留原240步承诺、岗位和不同实际工位，停用营造后才中断。schedule.phase 在迁移、每世界步和只读人物页用同一 worldTick；不改生产结算或另建身体。根与独立新专项1/1、迁移1/1，旧邀请1/1、UI契约17通过/4待设备。旧v2-work硬编码缺失人物及旧five-workers精确小数坐标断言，在本提交父版本原样失败，不计回归通过；伤病/生产专项缺来源档跳过。源码2455d0b、Pages8c5621e built，162文本blob及公网入口/人物模块字节一致；r32未做浏览器游戏内交互和真机。完整v2/I/V/R继续。
- docs/art/COURTYARD-VALLEY-2026-10-12.md
- tests/unit/web/ea-mountain-alchemy.test.mjs
- 2026-10-12 U-125：42 人物交谈及关联契约定义统一立绘聊天窗、身份叠加、知情、距离、意愿、暂停和持久规则；DIALOGUE-01–10 为 not_run。本批为设计与静态原型，运行接入及完整 SR/AC 状态保持。
- 2026-10-14 U-139 设计确认：宗门模拟经营支持自主生活；桌面后台继续运行、关闭停止且重开不补离线进度；掌门按玩家设定的发展目标、预算和风险偏好选择修炼、出行和经营。见 docs/design/DECISIONS.md、docs/design/01-CHARACTERS.md、docs/design/05-RUNTIME-CONTRACTS.md。当前仅落档，运行接入与新行为验收待实施；既有 SR/AC 状态和历史证据范围保持。
- docs/design/49-P0-P2-COURTYARD-PROGRESS.md；2026-10-15 U-147/R-47：院务/人物/工位/物资/研习操作、保存失败保护和疗伤收据重放；47/47 Node检查。浏览器内核缺失且官方下载失败，实际UI与桌面未验，完整P0—P2及SR/AC状态保持。
- docs/design/50-COURTYARD-UI-DESIGN-AUDIT.md；2026-10-15 U-148/R-48：四页及关联入口30项设计审查与7条后续场景；两处物流问题由正常命令复现，运行代码未修，实际UI未验，完整状态保持。
- docs/design/51-COURTYARD-MANAGEMENT-INTEGRATION.md；2026-10-15 U-149/R-49：四页与共用详情、单趟40份留苗搬运、落地回收和保存恢复接通；组件与相邻回归57/57，同一检查点真实桌面387.845秒13/13、最终包页面8/8、恢复链9/9，原生选择文件/预检/恢复及手动暂停已验。完整新档、规模、对话/突破、跨区施工、20分钟自主与Windows待接；完整D/I/V/R和AC状态保持。
- docs/design/53-COURTYARD-AUTONOMY-ACCEPTANCE.md
- tests/acceptance/courtyard-autonomy-desktop.mjs
- tests/acceptance/courtyard-autonomy-audit.py
- docs/design/56-COURTYARD-FOOD-SUPPLY.md
- tests/unit/courtyard/sect-food.test.mjs
- tests/acceptance/courtyard-food-desktop.mjs
- docs/design/57-THREE-RESIDENT-COURTYARD.md
- docs/design/61-RESIDENTIAL-INTEGRATION.md
- 2026-10-18 U-167/T-20住宅接续：GC09–12沿固定建位建设，四院一级16实体床；独立床位模块10/10规则检查，含只读旧档、唯一床位、真实到床、途中存读与失效恢复。三院完工及空地母稿已制作，世界位置与升级占地待校准。正式运行接缝、近身有限交易筹资和同源桌面营建入住尚待完成；本条只登记住宅局部准备，不推进完整SR/AC状态。
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

- 2026-10-06：由v1.2设计缺口审计建立SR；新增内容和参数遵循作者默认，不冒充用户逐项确认。
- 2026-10-06：用户授权目标模式、多agent并行开发与验收；启动D01，按现有契约展开模块设计，未将建档或局部实现标作交付。
- 2026-10-08：M2 首批按原文通过 SR-XF-008-AC-01：正常开局公开邀请、同条件重复不重掷、停用后拒绝、恢复后重评估与实际工位执行；五阶段 33–41 正式命令、22–26 次精确存读。修正管理页同世界步旧日程理由/承诺计时误报，独立根 Agent 复跑公开链、审读实现及隔离桌面浏览器接受/停用页面。AC02/03、完整日程职责设计与整项 D/I/V/R 未关闭。
- 2026-10-08：2026-10-08 M2 五人两工位验收：正常新档 128 条公开命令招至五人、建居舍并三趟搬运腾出木材缓存；五人分别获邀，两人实际占独立伐木工位，两人各在门外独立点等候，一人自主休憩；第28批仅两名执行者记贡献、只一条产出事实且库存增量等于产量。根 Agent 复跑1/1并看隔离桌面浏览器的执行者、等候者、建筑2/2三张截图；修正侧卡从投影人物误读旧休憩为真实身体活动。AC02 passed，真iPadOS/真人、AC03和整项门槛未关闭。
- 2026-10-08：2026-10-08 M2 自主日程候选、效用、承诺、中断、人物计划及隐私字段完成设计；D02 独立复核指出的知识来源与旧档关系迁移边界已修正。此项仅为设计，I/V/R 继续。
- 2026-10-08：2026-10-08 独立契约复核 PASS：逐项核对知识可见范围、关系事实来源、身体工位、岗位、出行与 SR008 REQ/AC；两项初审阻断修正后复审通过。仅关闭设计审阅。
- 2026-10-08：2026-10-08 D01/D02 通过后进入 v2 实现；现有 v1 验收证据保留，尚未关闭完整 I01。
- 2026-10-08：r14 每日供给关系来源事实子批独立复核、主线回归并发布；I01 继续 v2 决策路径。
- 2026-10-08：r15 v2 日程克隆迁移、承诺到期/中断和只读意愿候选经独立复核及主线回归发布；正式决策仍为 v1，I01 继续。
- 2026-10-08：I01 有界 v2 工作邀请候选批：正常新档92条公开命令取得五人、居所和伐木两工位来源，隔离迁移后10条正式邀请命令与66次精确存读；两人42分接受并到不同实体工位，一人27分可做但不愿做，另两人被正在执行的身体工序阻塞。承诺经真实世界步到原240步截止，停用设施中断并释放预约，条件变化的连续拒绝按150/300/600步退避。该批仍待主线独立复核与发布；v1仍为默认，v2其余候选/职责/关系事实及完整I/V/R继续。
- 2026-10-08：r18 有界 v2 公开工作邀请子批经独立复核、主线 6/6 定向回归并发布；正式新档仍默认 v1，其他候选、职责与整项 I/V/R 继续。
- 2026-10-08：opt-in v2 work invitations are implemented in a bounded public chain; other v2 activities, responsibilities and full acceptance remain open
- 2026-10-08：r32 v2 日相位随世界时钟更新，在有效工作承诺下仅改变偏好展示；根与独立复核后发布，完整自主日程继续。
- 2026-10-12：2026-10-12 U-123：陆知微照料首畦并在网页实收13.8份灵草；炼药专项含受伤门人私有药物自主取用，定向2／2。完整 NPC 日程仍按原状态。 局部证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。
- 2026-10-15：U-147接续P0—P2：新增两人小院可操作供给成长和保存/事务保护，登记局部实现与Node证据；实际UI/桌面未验，完整状态不推进。
- 2026-10-15：U-148：记录四页及关联入口设计审查、操作断点和R-48重整提案；未修运行代码，完整D/I/V/R与AC状态保持。
- 2026-10-15：U-149：接续远端main并完成当前山院管理和取消回收、保存恢复的局部桌面验证；完整状态保持。
- 2026-10-16：U-151/R-43：同一东台完成档实际自主1200.036秒，后台180.857秒、接管、预算风险、生产搬运及关闭重开。原脚本末段分类失败保留，同轮证据补核验38项；同档手动补粮恢复5项。持续公库供给仍有缺口，完整SR/AC与D/I/V/R状态保持。
- 2026-10-18：U-163/R-52/T-18：口粮目标、有限采粮与实际送库、保留生活粮的付费补种、预算与旧策略兼容已接入。供粮8项、相关17项、默认核心152/152通过。macOS源码Electron同源实际自主1200.016秒，实采送库80、消费40、公库3→43，解除饥荒后持续为0；长验11/11、证据核对12/12、界面7/7、macOS包同档短复验6/6，暂停关闭重开精确恢复。成功付费补种实机、三至五人、Windows及完整SR/AC状态保持。
- 2026-10-18：2026-10-18 U-164/U-165局部：多Agent完成林长风门籍规则及同窗交互首轮，规则8/8、相关11/11，主Agent联合供粮/操作33/33；亲传Electron专项9项，范围限当时人物交互。用户明确扩大主殿山域、整体绘制采伐场、所有建筑完全预设并由人物实际到场修建；院前临时营造入口与独立素材已撤下。下一步先确认整体场景和稳定建位，再接施工与三人同源长验。二十分钟、当前桌面包、Windows及完整SR/AC尚未完成，整项状态保持。
- 2026-10-18：U-167 GC03同源公开筹料91743→117712→167589→168109完成，前两段失败及自然人物成长保持。macOS Electron run01勘察途中身体边缘检查失败，实际168489原生档封存，页面错误0；道路中心修复已合入、实机接续待验。GC25/26在隔离副本制作，完整SR/AC状态保持。
- 2026-10-18：U-167 GC03北台路心与静态地面查询修复合入，主树5项及原168489实际94步/4次存读通过。桌面原勘察1170在168583完成，施工14仅扣60灵石40木25石一次；实际168803封存后定位林长风自主回床路线检查失败。run02离开建位缺步及run03热字段遗漏为验收脚本问题，全部实际来源、进度及失败保留。完整经营与SR/AC继续验收。
- 2026-10-18：U-167 GC03原施工14已在同源桌面完成；四蒲团/两检修位、180步炼气6→7层、有限供灵与四次关闭重开通过。北路返床/绕人修复主树8项及实际27步回路成立。现场货位目的地过滤已补；当前170563检修运输347续接核对主殿门槛圈样本，维护全链未完成。丹房四阶段四工位16项为隔离候选证据。完整SR/AC状态保持。
- 2026-10-18：U-167 GC03一级同源macOS源码桌面链完成：最终171973，run07为10/10、错误0、209.943秒，七段实际逐项合计777.710秒。勘察/施工、180步6→7层、有限供灵、原运输347与348送2木1石、80步维护均成立，携货及活动中多次精确重开。Lu门槛为外部脚圈检查室内边界遗漏，已按正式预约/holder/floor纠正且保留离路反例。整体建筑与完整SR/AC继续。
- 2026-10-19：U-167 GC25/26一级道路、四阶段、真实工位与四段炼丹已合入23源码/测试和14图，主树30项及工程检查通过；有限供料负坐标整档完成施工到唯一两份成药，正常桌面生产另验。求见链真实续至174422，首位来客到时离开、第二位入院，未新增收录；绕柱导航已修，北坡迎面互等继续验证。完整SR/AC状态保持。

本文件由[registry.json](../registry.json)派生；更新台账后执行 `python scripts/requirements/sr-manager.py refresh`，不单独修改此派生页。
