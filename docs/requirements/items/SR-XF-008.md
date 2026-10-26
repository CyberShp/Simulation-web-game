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

决策来源：U-63, U-93, R-25, U-94, U-123, U-125, U-139, U-149, R-49, U-151, R-43, U-163, R-52, T-18, U-167, T-20, T-21, T-22, U-168, U-169, U-170, U-172。这是继承的U项和作者实施默认；具体新增名称/数值不得伪装成用户逐项批准。

规格：[01-CHARACTERS.md](../../../docs/design/01-CHARACTERS.md)、[07-ECONOMY-ORGANIZATION.md](../../../docs/design/07-ECONOMY-ORGANIZATION.md)、[08-LIVING-WORLD.md](../../../docs/design/08-LIVING-WORLD.md)、[14-EARLY-GAME-DETAILED-DESIGN.md](../../../docs/design/14-EARLY-GAME-DETAILED-DESIGN.md)、[03-SPATIAL-ART.md](../../../docs/design/03-SPATIAL-ART.md)、[41-COURTYARD-VALLEY-IMPLEMENTATION.md](../../../docs/design/41-COURTYARD-VALLEY-IMPLEMENTATION.md)、[42-CHARACTER-DIALOGUE.md](../../../docs/design/42-CHARACTER-DIALOGUE.md)、[51-COURTYARD-MANAGEMENT-INTEGRATION.md](../../../docs/design/51-COURTYARD-MANAGEMENT-INTEGRATION.md)、[45-SECT-IDLE-SLICE.md](../../../docs/design/45-SECT-IDLE-SLICE.md)、[53-COURTYARD-AUTONOMY-ACCEPTANCE.md](../../../docs/design/53-COURTYARD-AUTONOMY-ACCEPTANCE.md)、[56-COURTYARD-FOOD-SUPPLY.md](../../../docs/design/56-COURTYARD-FOOD-SUPPLY.md)、[61-RESIDENTIAL-INTEGRATION.md](../../../docs/design/61-RESIDENTIAL-INTEGRATION.md)、[62-EAST-SERVICES-INTEGRATION.md](../../../docs/design/62-EAST-SERVICES-INTEGRATION.md)、[64-NORTH-LIBRARY-INTEGRATION.md](../../../docs/design/64-NORTH-LIBRARY-INTEGRATION.md)、[69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md](../../../docs/design/69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md)、[71-GUESTHOUSE-INTEGRATION.md](../../../docs/design/71-GUESTHOUSE-INTEGRATION.md)、[72-DISCIPLE-EXPEDITIONS.md](../../../docs/design/72-DISCIPLE-EXPEDITIONS.md)、[74-DISCIPLE-DEVELOPMENT.md](../../../docs/design/74-DISCIPLE-DEVELOPMENT.md)、[75-SECT-SUSTENANCE.md](../../../docs/design/75-SECT-SUSTENANCE.md)、[76-DISCIPLE-CULTIVATION-PROGRESSION.md](../../../docs/design/76-DISCIPLE-CULTIVATION-PROGRESSION.md)、[77-DISCIPLE-BREAKTHROUGH-LOOP.md](../../../docs/design/77-DISCIPLE-BREAKTHROUGH-LOOP.md)、[79-DISCIPLE-WORK-SPECIALIZATION.md](../../../docs/design/79-DISCIPLE-WORK-SPECIALIZATION.md)、[80-EXPEDITION-RECOVERY.md](../../../docs/design/80-EXPEDITION-RECOVERY.md)、[81-DISCIPLE-ONBOARDING.md](../../../docs/design/81-DISCIPLE-ONBOARDING.md)、[82-EXPEDITION-PURPOSE.md](../../../docs/design/82-EXPEDITION-PURPOSE.md)、[83-ENCOUNTER-DISTANCE.md](../../../docs/design/83-ENCOUNTER-DISTANCE.md)、[84-EXPEDITION-MEDICINE.md](../../../docs/design/84-EXPEDITION-MEDICINE.md)、[85-MEDICINE-SUPPLY.md](../../../docs/design/85-MEDICINE-SUPPLY.md)、[86-MEDICINE-MATERIALS.md](../../../docs/design/86-MEDICINE-MATERIALS.md)、[87-PHARMACIST-DEVELOPMENT.md](../../../docs/design/87-PHARMACIST-DEVELOPMENT.md)、[88-SECT-CONCURRENCY.md](../../../docs/design/88-SECT-CONCURRENCY.md)、[89-DISCIPLE-CRAFT-REQUEST.md](../../../docs/design/89-DISCIPLE-CRAFT-REQUEST.md)、[90-DISCIPLE-ADVANCEMENT.md](../../../docs/design/90-DISCIPLE-ADVANCEMENT.md)、[91-EXPEDITION-GROWTH.md](../../../docs/design/91-EXPEDITION-GROWTH.md)、[92-EXPEDITION-COMPANIONS.md](../../../docs/design/92-EXPEDITION-COMPANIONS.md)、[93-COMPANION-OPERATIONS.md](../../../docs/design/93-COMPANION-OPERATIONS.md)、[94-EXPEDITION-RESPONSE.md](../../../docs/design/94-EXPEDITION-RESPONSE.md)、[95-GROUND-PANEL-RESPONSE.md](../../../docs/design/95-GROUND-PANEL-RESPONSE.md)、[96-NORTH-RECOVERY-PATH-RESPONSE.md](../../../docs/design/96-NORTH-RECOVERY-PATH-RESPONSE.md)。

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

SR-XF-008-AC-03证据：tests/acceptance/ea-sr-008-travel-interrupt-public-acceptance.mjs；tests/acceptance/ea-sr-008-material-interrupt-public-acceptance.mjs；tests/acceptance/ea-sr-008-injury-interrupt-acceptance.mjs；src/simulation/ea-facility-activities.mjs；docs/design/STATUS.md；docs/design/90-DISCIPLE-ADVANCEMENT.md；docs/design/91-EXPEDITION-GROWTH.md；docs/design/92-EXPEDITION-COMPANIONS.md；docs/design/93-COMPANION-OPERATIONS.md；docs/design/94-EXPEDITION-RESPONSE.md；docs/design/95-GROUND-PANEL-RESPONSE.md；docs/design/96-NORTH-RECOVERY-PATH-RESPONSE.md

2026-10-08 M2 首批：SR008-AC01 公开命令五阶段 accepted/repeated/unavailable/renewed/working 精确存读与原生导入一致；管理页在接受和停用同 tick 显示当前公开原因与有效承诺，浏览器独立只读导入核对。根 Agent 复跑 1/1，相关界面10/10、经济52/52。AC02/03和整项门槛仍未完成。
2026-10-08 M2 五人两工位验收：正常新档 128 条公开命令招至五人、建居舍并三趟搬运腾出木材缓存；五人分别获邀，两人实际占独立伐木工位，两人各在门外独立点等候，一人自主休憩；第28批仅两名执行者记贡献、只一条产出事实且库存增量等于产量。根 Agent 复跑1/1并看隔离桌面浏览器的执行者、等候者、建筑2/2三张截图；修正侧卡从投影人物误读旧休憩为真实身体活动。AC02 passed，真iPadOS/真人、AC03和整项门槛未关闭。
2026-10-08 r14 在正式schema6/content v1.2 每日供给已结算时，按人物/日号登记唯一来源事实，再一次更新信任；旧关系为既有基线，不反推旧日事实，坏来源拒载。正常公开有粮与缺粮链35命令/25次精确存读，新专项2/2，旧重复邀请和五人两工位2/2、世界21/21。源码307894b、Pages f3e0d63 built，162文本blob匹配。完整自主日程v2的迁移、承诺生命周期和正式决策尚未发布，I01继续；原AC与V/R状态不变。
2026-10-08 r15 有界 autonomy:v2 准备能力：从正常公开邀请原生档先验证原档，克隆迁移并保留旧承诺剩余期限和本人来源事实；到原截止世界步转 completed、设施停用或公开出行转 interrupted，逐阶段可精确存读；非法 speed=3 原档迁移前拒绝，低信任为可做但不愿做，设施不可用为硬阻塞。迁移专项正常来源37命令/24次存读，根合入后新增3/3、旧邀请/五人2/2、世界21/21、产权6/6；独立复核5/5，旧AC03三项缺外部来源检查点跳过。源码effc917、Pages a90fda6 built，162文本blob匹配。当前正式 tick/邀请仍走v1；v2其他活动、职责、意愿平衡、浏览器与目标设备未验，I01及整项V/R继续。

2026-10-12 U-123：陆知微照料首畦并在网页实收13.8份灵草；炼药专项含受伤门人私有药物自主取用，定向2／2。完整 NPC 日程仍按原状态。 局部证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。

2026-10-18 U-164/U-165局部：多Agent完成林长风门籍规则及同窗交互首轮，规则8/8、相关11/11，主Agent联合供粮/操作33/33；亲传Electron专项9项，范围限当时人物交互。用户明确扩大主殿山域、整体绘制采伐场、所有建筑完全预设并由人物实际到场修建；院前临时营造入口与独立素材已撤下。下一步先确认整体场景和稳定建位，再接施工与三人同源长验。二十分钟、当前桌面包、Windows及完整SR/AC尚未完成，整项状态保持。

2026-10-24 U-168 门人自主经营与一次山谷历练已完成开发和 macOS 源码 Electron 验收。裴照雪实际出院、从有限药丛取得6份药草，感知山魈风险后退回，tick263500实际交库，经验增加8、伤势0→0；留守陆清和与陆知微产生6条真实生产事实，伐木场木材17.870030169→163.39977615。desktop-04从保全准备现场261473续接至263635，388.786318708秒、错误0；准备261473、谷内261865、归院263538三次完整原生重开一致。21项定向与相邻回归通过，GPT-6.1-sol独立复核通过。434份冻结文件保持，本批8个运行文件与主树一致；早先失败与在途重开按原版本范围保留。Windows及完整SR/AC状态保持。 详见 docs/design/72-DISCIPLE-EXPEDITIONS.md。

2026-10-25 U-169 门人培养与宗门分工已接入并完成macOS源码桌面局部验收：正式院务选择经营侧重，近身推荐已有法门，保留本人意愿、原课和身体工位约束。顾听澜推荐后养元诀理解60→80；裴照雪保留旧护息印功课及引风术待执行建议；陆知微9批真实生产，木材163.39977615→303.078163692、百工37.44→42.84。同源desktop-02保存264262后由desktop-03续接至267998，5对分段原生存读一致；03错误0且正常关闭，早先脚本失败保留。68项集成、19项空间、1项DOM检查通过（分组有交叉）；独立审计17项通过。当前整合版200步完整状态等价及最终档零推进原生读回通过。Windows、完整SR/AC及发布状态保持。

2026-10-25 宗门供给与门人自主突破本批完成：补齐既有炼丹院务奖励入口、修复突破通勤互等及让行工位接缝；正常桌面源280680经实际补种/两批采粮交库至282724，再自主修炼、唯一扣24灵石/8灵草，于284309完成180工步升至炼气二层。最终284504，五人供给正常、饥荒0；准备及核心共5组原生保存/关闭重开一致，公开人物窗只读正确，两个成功段errors均0。原走近超时场景现点击3.72秒通过15秒门限，仍有明显等待。空间相邻37/37、根奖励/突破/通勤16/16通过；旧requester-clear基线失败、Windows、长期平衡、完整SR/AC及发布状态保持。 详见 docs/design/77-DISCIPLE-BREAKTHROUGH-LOOP.md。

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
| SR-XF-008-D01 | 设计补齐：交付：需要/志向/能力/关系/风险的候选过滤与效用参数表，保留不能做与不愿做区别。；承诺期限、改意阈值、重试退避、活动中断和恢复规则。；关键人物日程、岗位可用时间、关系记忆影响和隐私投影。；填实必需参数并标记U/R/T来源。 | done | 无 | Codex/root |
| SR-XF-008-D02 | 契约与内容审阅：审阅NPC日程、自主选择与职责参数与依赖契约（SR-XF-002、SR-XF-003）的字段、时序、失败及恢复；逐项核对本SR的REQ/AC。 | done | SR-XF-008-D01 | Codex/sr008_d02_review |
| SR-XF-008-I01 | 开发与集成：在人物模块实现NPC日程、自主选择与职责参数；交付SR-XF-008-REQ-01至REQ-03，接入相关数据、行为、素材、UI和恢复，提交关联SR。 | in_progress | SR-XF-008-D02 | Codex/sr008_schedule_v2 |
| SR-XF-008-V01 | 验收与兼容：执行SR-XF-008-AC-01至AC-03及SLOT-01、ECON-04；登记实际结果、兼容和设备证据边界。 | todo | SR-XF-008-I01 | 待分配 |
| SR-XF-008-R01 | 发布与关闭：完成所需源码/运行时发布核对、交接和未覆盖说明；本轮用户不要求上传QA过程产物。 | todo | SR-XF-008-V01 | 待分配 |

SR-XF-008-D01证据：docs/requirements/design/SR-XF-007-011-019-026-027.md; 2026-10-08 design revisions and independent D02 reviewer pass

SR-XF-008-D02证据：docs/requirements/design/SR-XF-007-011-019-026-027.md; independent reviewer report 2026-10-08

SR-XF-008-I01证据：tests/acceptance/ea-sr-008-invite-public-acceptance.mjs；src/simulation/ea-sr-persons.mjs；apps/web/ea-sr-ui.mjs；docs/design/STATUS.md；docs/requirements/design/SR-XF-007-011-019-026-027.md；2026-10-08 r14 在正式schema6/content v1.2 每日供给已结算时，按人物/日号登记唯一来源事实，再一次更新信任；旧关系为既有基线，不反推旧日事实，坏来源拒载。正常公开有粮与缺粮链35命令/25次精确存读，新专项2/2，旧重复邀请和五人两工位2/2、世界21/21。源码307894b、Pages f3e0d63 built，162文本blob匹配。完整自主日程v2的迁移、承诺生命周期和正式决策尚未发布，I01继续；原AC与V/R状态不变。；2026-10-08 r15 有界 autonomy:v2 准备能力：从正常公开邀请原生档先验证原档，克隆迁移并保留旧承诺剩余期限和本人来源事实；到原截止世界步转 completed、设施停用或公开出行转 interrupted，逐阶段可精确存读；非法 speed=3 原档迁移前拒绝，低信任为可做但不愿做，设施不可用为硬阻塞。迁移专项正常来源37命令/24次存读，根合入后新增3/3、旧邀请/五人2/2、世界21/21、产权6/6；独立复核5/5，旧AC03三项缺外部来源检查点跳过。源码effc917、Pages a90fda6 built，162文本blob匹配。当前正式 tick/邀请仍走v1；v2其他活动、职责、意愿平衡、浏览器与目标设备未验，I01及整项V/R继续。；2026-10-08 r18：正常来源92条公开命令、隔离迁移后10条邀请与至少66次精确存读；两名42分自愿到不同真实伐木工位，27分拒绝与身体硬阻塞、承诺到期、停用中断及150/300/600退避均复核。主线6/6，源码a7326da9b73f331567dbaa4fa6cfaba932f18a5d，Pages656f4b026bb917c54c070436218ecbbd39cc1981 built，162文本blob一致；浏览器、设备及完整v2未验。；2026-10-08 r19: mutual facility-route wait after the SR009 opening timing change was resolved with physical side-step; tests/acceptance/ea-sr-008-v2-work-public-acceptance.mjs 1/1, two real stations before the original 240-tick commitment expiry, exact-save yielding route; adjacent facility/door 17/17; source c9be1d476311a558e7a37a4e0305e5086b71a369；2026-10-08 M2 r32 v2 日相位子批：正常五人/两真实伐木工位来源链107+6公开命令、67次精确存读；两位自愿门人跨休整→生产偏好时保留原240步承诺、岗位和不同实际工位，停用营造后才中断。schedule.phase 在迁移、每世界步和只读人物页用同一 worldTick；不改生产结算或另建身体。根与独立新专项1/1、迁移1/1，旧邀请1/1、UI契约17通过/4待设备。旧v2-work硬编码缺失人物及旧five-workers精确小数坐标断言，在本提交父版本原样失败，不计回归通过；伤病/生产专项缺来源档跳过。源码2455d0b、Pages8c5621e built，162文本blob及公网入口/人物模块字节一致；r32未做浏览器游戏内交互和真机。完整v2/I/V/R继续。；docs/design/49-P0-P2-COURTYARD-PROGRESS.md；2026-10-15 U-147/R-47：院务/人物/工位/物资/研习操作、保存失败保护和疗伤收据重放；47/47 Node检查。浏览器内核缺失且官方下载失败，实际UI与桌面未验，完整P0—P2及SR/AC状态保持。；2026-10-18 U-167/T-20住宅接续：GC09–12沿固定建位建设，四院一级16实体床；独立床位模块10/10规则检查，含只读旧档、唯一床位、真实到床、途中存读与失效恢复。三院完工及空地母稿已制作，世界位置与升级占地待校准。正式运行接缝、近身有限交易筹资和同源桌面营建入住尚待完成；本条只登记住宅局部准备，不推进完整SR/AC状态。；2026-10-18 T-20 housing runtime: 27 scoped checks and 8 related opening/care regressions passed. Existing-hall source Electron UI: select bed, real arrival, shared person/building display, exact reopen: 6/6, errors 0. See docs/design/61-RESIDENTIAL-INTEGRATION.md section 11. Four-house normal construction and full SR/AC acceptance remain in progress.；docs/design/74-DISCIPLE-DEVELOPMENT.md；2026-10-25 U-169 门人培养与宗门分工已接入并完成macOS源码桌面局部验收：正式院务选择经营侧重，近身推荐已有法门，保留本人意愿、原课和身体工位约束。顾听澜推荐后养元诀理解60→80；裴照雪保留旧护息印功课及引风术待执行建议；陆知微9批真实生产，木材163.39977615→303.078163692、百工37.44→42.84。同源desktop-02保存264262后由desktop-03续接至267998，5对分段原生存读一致；03错误0且正常关闭，早先脚本失败保留。68项集成、19项空间、1项DOM检查通过（分组有交叉）；独立审计17项通过。当前整合版200步完整状态等价及最终档零推进原生读回通过。Windows、完整SR/AC及发布状态保持。

SR-XF-008-V01证据：tests/acceptance/ea-sr-008-invite-public-acceptance.mjs；src/simulation/ea-sr-persons.mjs；apps/web/ea-sr-ui.mjs；docs/design/STATUS.md；docs/design/49-P0-P2-COURTYARD-PROGRESS.md；2026-10-15 U-147/R-47：院务/人物/工位/物资/研习操作、保存失败保护和疗伤收据重放；47/47 Node检查。浏览器内核缺失且官方下载失败，实际UI与桌面未验，完整P0—P2及SR/AC状态保持。；2026-10-18 U-167/T-20住宅接续：GC09–12沿固定建位建设，四院一级16实体床；独立床位模块10/10规则检查，含只读旧档、唯一床位、真实到床、途中存读与失效恢复。三院完工及空地母稿已制作，世界位置与升级占地待校准。正式运行接缝、近身有限交易筹资和同源桌面营建入住尚待完成；本条只登记住宅局部准备，不推进完整SR/AC状态。；2026-10-18 T-20 housing runtime: 27 scoped checks and 8 related opening/care regressions passed. Existing-hall source Electron UI: select bed, real arrival, shared person/building display, exact reopen: 6/6, errors 0. See docs/design/61-RESIDENTIAL-INTEGRATION.md section 11. Four-house normal construction and full SR/AC acceptance remain in progress.；docs/design/74-DISCIPLE-DEVELOPMENT.md；2026-10-25 U-169 门人培养与宗门分工已接入并完成macOS源码桌面局部验收：正式院务选择经营侧重，近身推荐已有法门，保留本人意愿、原课和身体工位约束。顾听澜推荐后养元诀理解60→80；裴照雪保留旧护息印功课及引风术待执行建议；陆知微9批真实生产，木材163.39977615→303.078163692、百工37.44→42.84。同源desktop-02保存264262后由desktop-03续接至267998，5对分段原生存读一致；03错误0且正常关闭，早先脚本失败保留。68项集成、19项空间、1项DOM检查通过（分组有交叉）；独立审计17项通过。当前整合版200步完整状态等价及最终档零推进原生读回通过。Windows、完整SR/AC及发布状态保持。

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
- docs/design/65-COURTYARD-SEEKERS.md；2026-10-19 U-167/T-23：门人迎面互等、四米内退让和可见身体边缘检查已合入主树88ee118a，主树新4项、旧2项与工程检查通过，隔离11/11保留；run03只从174422验陆清和一次公开来访和两次原生重开，实际桌面日程/收录待验。局部合入不改变整项SR/AC。
- docs/design/65-COURTYARD-SEEKERS.md；2026-10-19 实际桌面run04：陆清和174884当面npc-accept并outer收录，但随后按自主研习日程（commitUntil 176900）行动，180秒入住窗口到176699时床位仍pending；第三位徐闻溪176280到院。该停点作为自主日程与入住时序证据，run05续接验证，不据此改源码。局部通过不改变整项SR/AC。
- docs/design/65-COURTYARD-SEEKERS.md；2026-10-19 run05卡顿修复保持NPC自主活动与入住偏好，不强制首次入住；recovery-01公开approach在互等处停路，报告failed；工具新增公开旁步重试、15秒UI截止与最后观测/native保全，尚未实际执行。局部不改变整项SR/AC。
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
- docs/design/72-DISCIPLE-EXPEDITIONS.md
- src/simulation/ea-disciple-expeditions.mjs
- src/simulation/ea-disciple-encounters.mjs
- tests/acceptance/courtyard-disciple-expeditions-desktop.mjs
- tests/unit/courtyard/courtyard-disciple-expeditions.test.mjs
- tests/unit/courtyard/courtyard-disciple-encounters.test.mjs
- tests/unit/courtyard/courtyard-disciple-expedition-boundaries.test.mjs
- tests/unit/courtyard/courtyard-disciple-expedition-visibility.test.mjs
- 2026-10-24 U-168 门人自主经营与一次山谷历练已完成开发和 macOS 源码 Electron 验收。裴照雪实际出院、从有限药丛取得6份药草，感知山魈风险后退回，tick263500实际交库，经验增加8、伤势0→0；留守陆清和与陆知微产生6条真实生产事实，伐木场木材17.870030169→163.39977615。desktop-04从保全准备现场261473续接至263635，388.786318708秒、错误0；准备261473、谷内261865、归院263538三次完整原生重开一致。21项定向与相邻回归通过，GPT-6.1-sol独立复核通过。434份冻结文件保持，本批8个运行文件与主树一致；早先失败与在途重开按原版本范围保留。Windows及完整SR/AC状态保持。
- 2026-10-25 U-169 门人培养与宗门分工已接入并完成macOS源码桌面局部验收：正式院务选择经营侧重，近身推荐已有法门，保留本人意愿、原课和身体工位约束。顾听澜推荐后养元诀理解60→80；裴照雪保留旧护息印功课及引风术待执行建议；陆知微9批真实生产，木材163.39977615→303.078163692、百工37.44→42.84。同源desktop-02保存264262后由desktop-03续接至267998，5对分段原生存读一致；03错误0且正常关闭，早先脚本失败保留。68项集成、19项空间、1项DOM检查通过（分组有交叉）；独立审计17项通过。当前整合版200步完整状态等价及最终档零推进原生读回通过。Windows、完整SR/AC及发布状态保持。
- docs/design/75-SECT-SUSTENANCE.md
- 2026-10-25 U-170留守供给与掌门外出：v1门人自主运回收成、桌面采寻入口及出行供给反馈已接入。普通源267998正常备粮，macOS源码Electron分段离院270016→实际归院272082，NPC实际送6粮、五人日结供给正常并继续成长；采6草返院实际交库，最终272332粮23。最后一段原生存读/正常关闭/来源及运行散列一致、错误0；早先脚本失败和精确续接证据保持。37项集成及4项采寻检查通过（有交叉）；独立审计10项、13对原生存读通过。并行美术署名弹窗不在本批冻结原生范围。长期供需平衡、Windows、完整SR/AC与发布状态保持，详见75。最终全仓check被并行署名CREDITS.md缺失阻塞；需求校验通过。
- docs/design/76-DISCIPLE-CULTIVATION-PROGRESSION.md
- tests/acceptance/courtyard-disciple-cultivation-desktop.mjs
- tests/acceptance/courtyard-disciple-cultivation-reopen.mjs
- 2026-10-25 宗门供给与门人自主突破局部：docs/design/77-DISCIPLE-BREAKTHROUGH-LOOP.md；普通源280680→桌面准备282724→桌面终档284504，唯一180工步升至二层、5组原生存读一致。完整SR/AC状态保持。
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
- 2026-10-27 地面查询与院务响应完成本批：精确坐标缓存及走廊预筛、单次面板渲染复用检查投影。同档暂停院务中位16.3→5.55ms、人物8.45→3.7ms，12份文本及完整世界相同；原生跨日食粮39→27即时刷新、人物筛选与保存读回通过。两轮经营分别7项、8项均通过，最大帧间隔89.1/80.2ms，仍有88/78ms路径长任务。独立几何626693查询零差异，10000步完整状态及200份view相同。定向15/15、相邻49/50，旧北路恢复失败保留；完整SR/AC与发布保持。 docs/design/95-GROUND-PANEL-RESPONSE.md
- 2026-10-27 六小时目标执行中：北路施工运料旧档200步停滞定位为恢复许可漏接正式施工材料流；补齐身份/订单/预留/目标验证后11步实际恢复，最大单步0.3168米，取消实际返料及无效许可边界通过，定向相邻37/37。原生与三轮性能对照待做，完整SR/AC状态保持。 docs/design/96-NORTH-RECOVERY-PATH-RESPONSE.md

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
- 2026-10-20：2026-10-20 收口到merchant-harvest-01：五门人/食物同档链停止在paused；真实food16入库、source304；未知尾段与整体exact保持null；不把pending当入住、不把补种成功当供粮恢复。历史更正：recovery-04失败人为陆知微，transport351/18属recovery-06而非run07新增。
- 2026-10-20：六居民同档日结与原生精确重开通过；living-03道路body失配保留tick191089，修复待living-04。院务奖励入口与容量边界规则检查通过，实际领取、GC25/26正常生产未验；GC21–23仅布局候选。完整SR/AC及任务状态保持。
- 2026-10-20：living-04从191089同档完成73/75实际床位、自主16粮采送、192000五门人日结与精确原生重开，118.716135秒、错误0；living-03失败保留。只更新局部证据，不提升完整SR/AC；funding-01及GC25/26正式生产待验。
- 2026-10-23：2026-10-23 GC15一级客院已接入：两张独立客床、当面自愿邀请、实际步行入住、原来访期限退房下山及原生存读。macOS源码Electron有限夹具入住ui-fixture-03通过7项（1656→3851、235.557720083秒），施工build-fixture-01通过3项（646→1700、114.379689209秒）；唯一工单3投入45灵石/40木/20石，两趟实际送达后于1683完成200施工步。两段错误0，来源、运行文件与原生重开均一致。GPT-6.1-sol独立读回6个原生检查点及12个核心源码通过。正常世界仍保留医庐tick261253原档；该世界的筹资建设、Windows和完整SR/AC保持待验。 详见docs/design/71-GUESTHOUSE-INTEGRATION.md。
- 2026-10-24：2026-10-24 U-168 门人自主经营与一次山谷历练已完成开发和 macOS 源码 Electron 验收。裴照雪实际出院、从有限药丛取得6份药草，感知山魈风险后退回，tick263500实际交库，经验增加8、伤势0→0；留守陆清和与陆知微产生6条真实生产事实，伐木场木材17.870030169→163.39977615。desktop-04从保全准备现场261473续接至263635，388.786318708秒、错误0；准备261473、谷内261865、归院263538三次完整原生重开一致。21项定向与相邻回归通过，GPT-6.1-sol独立复核通过。434份冻结文件保持，本批8个运行文件与主树一致；早先失败与在途重开按原版本范围保留。Windows及完整SR/AC状态保持。
- 2026-10-25：2026-10-25 U-169 门人培养与宗门分工已接入并完成macOS源码桌面局部验收：正式院务选择经营侧重，近身推荐已有法门，保留本人意愿、原课和身体工位约束。顾听澜推荐后养元诀理解60→80；裴照雪保留旧护息印功课及引风术待执行建议；陆知微9批真实生产，木材163.39977615→303.078163692、百工37.44→42.84。同源desktop-02保存264262后由desktop-03续接至267998，5对分段原生存读一致；03错误0且正常关闭，早先脚本失败保留。68项集成、19项空间、1项DOM检查通过（分组有交叉）；独立审计17项通过。当前整合版200步完整状态等价及最终档零推进原生读回通过。Windows、完整SR/AC及发布状态保持。
- 2026-10-25：登记正常供给与门人自主突破的局部实现/原生证据；保持整项与AC状态。
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
