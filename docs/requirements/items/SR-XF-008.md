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

决策来源：U-63, U-93, R-25, U-94。这是继承的U项和作者实施默认；具体新增名称/数值不得伪装成用户逐项批准。

规格：[01-CHARACTERS.md](../../../docs/design/01-CHARACTERS.md)、[07-ECONOMY-ORGANIZATION.md](../../../docs/design/07-ECONOMY-ORGANIZATION.md)、[08-LIVING-WORLD.md](../../../docs/design/08-LIVING-WORLD.md)、[14-EARLY-GAME-DETAILED-DESIGN.md](../../../docs/design/14-EARLY-GAME-DETAILED-DESIGN.md)、[03-SPATIAL-ART.md](../../../docs/design/03-SPATIAL-ART.md)。

依赖：[SR-XF-002](SR-XF-002.md)、[SR-XF-003](SR-XF-003.md)。

关联既有验收：SLOT-01, ECON-04；本SR的AC细化这些目标，不代表旧版本已经通过。

## 现状与设计缺口

已有自主行为、意愿和工位等候基础。

完整候选效用、日程、承诺、职责、记忆更新及规模参数需补齐。

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

SR-XF-008-AC-01证据：qa/ea-sr-008-invite-public-acceptance.mjs；dist/ea-sr-persons.mjs；dist/ea-sr-ui.mjs；docs/design/STATUS.md

SR-XF-008-AC-02证据：qa/ea-sr-008-five-workers-public-acceptance.mjs；dist/ea-ui.mjs；dist/ea-sr-persons.mjs；docs/design/STATUS.md

SR-XF-008-AC-03证据：qa/ea-sr-008-travel-interrupt-public-acceptance.mjs；qa/ea-sr-008-material-interrupt-public-acceptance.mjs；qa/ea-sr-008-injury-interrupt-acceptance.mjs；dist/ea-facility-activities.mjs；docs/design/STATUS.md


2026-10-08 M2 首批：SR008-AC01 公开命令五阶段 accepted/repeated/unavailable/renewed/working 精确存读与原生导入一致；管理页在接受和停用同 tick 显示当前公开原因与有效承诺，浏览器独立只读导入核对。根 Agent 复跑 1/1，相关界面10/10、经济52/52。AC02/03和整项门槛仍未完成。
2026-10-08 M2 五人两工位验收：正常新档 128 条公开命令招至五人、建居舍并三趟搬运腾出木材缓存；五人分别获邀，两人实际占独立伐木工位，两人各在门外独立点等候，一人自主休憩；第28批仅两名执行者记贡献、只一条产出事实且库存增量等于产量。根 Agent 复跑1/1并看隔离桌面浏览器的执行者、等候者、建筑2/2三张截图；修正侧卡从投影人物误读旧休憩为真实身体活动。AC02 passed，真iPadOS/真人、AC03和整项门槛未关闭。
2026-10-08 r14 在正式schema6/content v1.2 每日供给已结算时，按人物/日号登记唯一来源事实，再一次更新信任；旧关系为既有基线，不反推旧日事实，坏来源拒载。正常公开有粮与缺粮链35命令/25次精确存读，新专项2/2，旧重复邀请和五人两工位2/2、世界21/21。源码307894b、Pages f3e0d63 built，162文本blob匹配。完整自主日程v2的迁移、承诺生命周期和正式决策尚未发布，I01继续；原AC与V/R状态不变。
2026-10-08 r15 有界 autonomy:v2 准备能力：从正常公开邀请原生档先验证原档，克隆迁移并保留旧承诺剩余期限和本人来源事实；到原截止世界步转 completed、设施停用或公开出行转 interrupted，逐阶段可精确存读；非法 speed=3 原档迁移前拒绝，低信任为可做但不愿做，设施不可用为硬阻塞。迁移专项正常来源37命令/24次存读，根合入后新增3/3、旧邀请/五人2/2、世界21/21、产权6/6；独立复核5/5，旧AC03三项缺外部来源检查点跳过。源码effc917、Pages a90fda6 built，162文本blob匹配。当前正式 tick/邀请仍走v1；v2其他活动、职责、意愿平衡、浏览器与目标设备未验，I01及整项V/R继续。

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

SR-XF-008-I01证据：qa/ea-sr-008-invite-public-acceptance.mjs；dist/ea-sr-persons.mjs；dist/ea-sr-ui.mjs；docs/design/STATUS.md；docs/requirements/design/SR-XF-007-011-019-026-027.md；2026-10-08 r14 在正式schema6/content v1.2 每日供给已结算时，按人物/日号登记唯一来源事实，再一次更新信任；旧关系为既有基线，不反推旧日事实，坏来源拒载。正常公开有粮与缺粮链35命令/25次精确存读，新专项2/2，旧重复邀请和五人两工位2/2、世界21/21。源码307894b、Pages f3e0d63 built，162文本blob匹配。完整自主日程v2的迁移、承诺生命周期和正式决策尚未发布，I01继续；原AC与V/R状态不变。；2026-10-08 r15 有界 autonomy:v2 准备能力：从正常公开邀请原生档先验证原档，克隆迁移并保留旧承诺剩余期限和本人来源事实；到原截止世界步转 completed、设施停用或公开出行转 interrupted，逐阶段可精确存读；非法 speed=3 原档迁移前拒绝，低信任为可做但不愿做，设施不可用为硬阻塞。迁移专项正常来源37命令/24次存读，根合入后新增3/3、旧邀请/五人2/2、世界21/21、产权6/6；独立复核5/5，旧AC03三项缺外部来源检查点跳过。源码effc917、Pages a90fda6 built，162文本blob匹配。当前正式 tick/邀请仍走v1；v2其他活动、职责、意愿平衡、浏览器与目标设备未验，I01及整项V/R继续。

SR-XF-008-V01证据：qa/ea-sr-008-invite-public-acceptance.mjs；dist/ea-sr-persons.mjs；dist/ea-sr-ui.mjs；docs/design/STATUS.md

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
- qa/ea-sr-008-invite-public-acceptance.mjs
- dist/ea-sr-persons.mjs
- dist/ea-sr-ui.mjs
- docs/design/STATUS.md
- qa/ea-sr-008-five-workers-public-acceptance.mjs
- dist/ea-ui.mjs
- dist/ea-society.mjs
- qa/ea-sr-008-daily-relation-public-acceptance.mjs
- dist/ea-sr-persons.mjs
- qa/ea-sr-008-v2-migration-acceptance.mjs

- 2026-10-06：由v1.2设计缺口审计建立SR；新增内容和参数遵循作者默认，不冒充用户逐项确认。
- 2026-10-06：用户授权目标模式、多agent并行开发与验收；启动D01，按现有契约展开模块设计，未将建档或局部实现标作交付。
- 2026-10-08：M2 首批按原文通过 SR-XF-008-AC-01：正常开局公开邀请、同条件重复不重掷、停用后拒绝、恢复后重评估与实际工位执行；五阶段 33–41 正式命令、22–26 次精确存读。修正管理页同世界步旧日程理由/承诺计时误报，独立根 Agent 复跑公开链、审读实现及隔离桌面浏览器接受/停用页面。AC02/03、完整日程职责设计与整项 D/I/V/R 未关闭。
- 2026-10-08：2026-10-08 M2 五人两工位验收：正常新档 128 条公开命令招至五人、建居舍并三趟搬运腾出木材缓存；五人分别获邀，两人实际占独立伐木工位，两人各在门外独立点等候，一人自主休憩；第28批仅两名执行者记贡献、只一条产出事实且库存增量等于产量。根 Agent 复跑1/1并看隔离桌面浏览器的执行者、等候者、建筑2/2三张截图；修正侧卡从投影人物误读旧休憩为真实身体活动。AC02 passed，真iPadOS/真人、AC03和整项门槛未关闭。
- 2026-10-08：2026-10-08 M2 自主日程候选、效用、承诺、中断、人物计划及隐私字段完成设计；D02 独立复核指出的知识来源与旧档关系迁移边界已修正。此项仅为设计，I/V/R 继续。
- 2026-10-08：2026-10-08 独立契约复核 PASS：逐项核对知识可见范围、关系事实来源、身体工位、岗位、出行与 SR008 REQ/AC；两项初审阻断修正后复审通过。仅关闭设计审阅。
- 2026-10-08：2026-10-08 D01/D02 通过后进入 v2 实现；现有 v1 验收证据保留，尚未关闭完整 I01。
- 2026-10-08：r14 每日供给关系来源事实子批独立复核、主线回归并发布；I01 继续 v2 决策路径。
- 2026-10-08：r15 v2 日程克隆迁移、承诺到期/中断和只读意愿候选经独立复核及主线回归发布；正式决策仍为 v1，I01 继续。

本文件由[registry.json](../registry.json)派生；更新台账后执行 `python qa/sr-manager.py refresh`，不单独修改此派生页。
