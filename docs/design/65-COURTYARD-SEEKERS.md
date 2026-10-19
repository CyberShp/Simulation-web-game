# 65 · 山门求见与正式收录

状态：U-167 建筑成长所需的实施契约，已由本批根代理核对；当前主工程运行与美术保持冻结。作者参数记为 **T-23**，来源为 U-63。本文对应 [63 §3C](63-NORMAL-GROWTH-FACILITY-PATH.md)，接通 GC14 医庐现行五门人门槛的正常人物来源。

## 1. 范围与依据

采用 U-111 的当面收录、三级门籍和明确师承，U-155 的南路实际到访，U-125 的统一人物交谈窗，以及 01、05、07、08–12 的持久身份、本人意愿、生活条件和唯一时钟。39 仍为整体草案；本批只采用其已被 63 引用的基础求见原则。

同一来源世界先正式收录林长风，再接待普通求道者；实际达到五名在籍门人后，按原有故事、知识与材料条件营造医庐。人数不含掌门。人物进入名册、取得床位承诺与门籍事实须在本人同意后一次提交。现有 `recruit`、陆知微和林长风的故事、费用与身份保持兼容。

## 2. 已有实现与最小接缝

| 现行接口 | 本批用途 |
| --- | --- |
| `ea-sim.addDisciple` 的字段构造与 RNG | 抽出同源人物构造函数；原包装继续执行原名册、日志与记忆行为。新求见者使用独立登记，不先写入名册 |
| `personsById`、`society.nextPersonId` | 每名求见者一次创建、永久编号；外观、资质、关系与人格随后持续保存 |
| `beginCourtyardVisit / advanceCourtyardVisitor / departCourtyardVisitor` | 从既有南路入口实际入院、停留、原路离开；单一身体与碰撞规则继续适用 |
| `courtyardAdmissionView / commitCourtyardAdmission` | 延伸同一门籍主表和 `courtyard-admission` 事实，按 consentSource 区分开局与普通求见 |
| `residentialAdmissionView / reserveResidentialBed` | 当面收录前核可达空床，接受时承诺具体床号，后续实际到床才形成入住 |
| `foodDemand`、现有库存/每日供给 | 接待前核新增一人后的实际口粮；入籍后的生活消费沿既有日结 |

`addDisciple` 当前会直接加入门人列表、写 joining 记忆与“愿意留下”日志。本批抽取仅改变代码复用方式，旧招募的随机调用顺序、字段和结算结果须逐值对照。

## 3. T-23 作者参数与内容来源

以下数值是本批可调作者参数，最终数值随实现和正常验证登记；没有逐项冒称为用户指定。

| 参数 | 首版值及用途 |
| --- | --- |
| 显式来源版本 | `courtyard-seekers:yunxiu:v1`，只由正式“开启接待”命令建立 |
| 地方来源 | 云岫南麓散居的普通求道者，经既有南山道拜访；创建事实记录来源、人物 ID、世界步和当前随机状态的来源标识 |
| 开启条件 | SR 正式世界、主殿已建成、南路到接待点有实际合法路径、至少一张可达空床、主殿公库可用粮足够当前居民加一人一日需求；开启不产生人物 |
| 首次等待 | 开启后 600 世界步；到期仍须重验接待与生活条件 |
| 后续机会 | 每 1800 世界步最多一次；同一时刻最多一名未入籍的求见者正在入院、停留或离院。拒绝、暂缓和切换接待均不缩短已排定间隔 |
| 到院停留 | 真正抵达后 1200 世界步。掌门可当面暂缓一次，延长 600 步；同一来访反复暂缓返回已保存答复 |
| 再访 | 已实际离场后至少 2400 步，且与上次答复有关的传承、床位、口粮或实际关系条件发生变化；同一人保留原 ID、全部答复和来访序号。符合条件的旧来客优先于创建新人物 |
| 人物构造 | 复用现有姓名、灵根、肖像、人格/志向和资质构造，资质使用原 RNG；创建时不筛除不愿者，不为人数目标重抽 |
| 入籍判断 | 身体、到场、距离、床位、粮食和门籍归属为硬前提。意愿评分沿已有工作邀请的 `0.3×自律 + 0.1×善意 + 0.4×对掌门信任`，首版门槛 50；与本人志向相合的已开放、可到达传承机会且实际教师满足现有授业资格（理解 65、熟练 60），加 8。数值只用于规则，不直接展示隐藏人格分数 |
| 传承机会对应 | 精研草木：开放 spring/wood/alchemy；求取长生：开放本人主修，尚无主修时任一现有基础心法；守成护道：开放 earth/array；求索奇法：开放任一已有术法。教师必须为实际在院存活者；条件读取同源公开知识与真实学习场所 |
| 拒绝解释 | 本人当面给出可知理由，例如希望有更成熟、相合的传承机会；结果引用实际条件签名。相同条件再次请求返回同一答复，不重新抽取或加信任 |
| 接待成本口径 | 开启接待本身无费用；收录前核一日粮与实体空床，入籍后沿正式日结消费。来源不附公共资源或招募奖励 |

普通求见是可信日常交往，不计作新的重要谋局根链。人物公开理由和作者持久人格分开；UI 只披露本人已表述的来意、答复及可观察状态。人格、资质、意愿均不由可选 AI 裁定。

## 4. 命令、事实与时序

新增 `setCourtyardReception({enabled})`：只改变接待政策及首次排期。停办保留历史与已有排期，已经在路上的人完成当前到访流程；再次开启不能提前下一机会。

新增 `answerCourtyardSeeker({personId,answer:'defer'|'decline'})`：掌门必须与已经抵达的存活来客近身，身体能交谈。掌门可从自主休息、修炼或闲谈转入当面交谈；实际工作、研读、治疗、服务与营造活动须先处理。暂缓或婉拒记录本人、掌门、来访序号、世界步及事实；婉拒后按原路离场。离场或未到院时不允许隔空答复。

正式入籍继续使用 `admitCourtyardVisitor({personId,rank,affiliationId,mentorId})`。普通求见分支先核硬条件，再记录本次本人意愿；不愿意是已发生的正常答复，返回 `accepted:false`，不会加入名册或占床。接受才承诺具体床号、加入当前名册并写同一门籍事实。亲传使用现有明确掌门师承约定；已有师承冲突按原规则拒绝。开局林长风仍执行原故事收录分支。

只读接口为 `courtyardReceptionView(s)` 和 `courtyardSeekerView(s,personId)`；现有 `courtyardAdmissionView` 增加 `canRequestAdmission`（硬条件成立）与已知答复投影。普通求见的当面邀请按钮使用前者，`canAdmit` 仍表示当前预计愿意且能收录。查看、渲染和恢复页面不创建来客或答复。

可选根记录 `courtyardSeekers` 保存版本、启用时刻、政策、排期、人物来源及逐次来访/答复引用；人物仍只存在于 `personsById`。每次到访引用原 `courtyardVisit` 的实际入离场事实，门籍继续只在 `courtyardAdmissions` 登记。唯一世界步推进排期和行走；关闭、显式暂停和读取不补时间。

## 5. 兼容与严格读取

旧档缺 `courtyardSeekers` 时保持原文事实，只有显式开启才建立字段。启用前后人物、随机状态、资源和时钟均应守恒；创建人物的正式世界步才消费原随机序列。规则不得在 hydration/只读投影中补来客、安排新访问或重置答复。

读取核对版本、来源事实、人物唯一编号、时刻顺序、当前来访引用、答复主体与条件签名、门籍事实和床位记录。删来源标记但保留事实、悬空人物、未知版本、重复入籍及篡改答复均拒绝并保留原档。来客死亡、离宗或收录历史继续引用原人物，不复用身份。已有开局门籍与旧招募实例按原分支校验。

## 6. SR/AC、文件及验证映射

| 需求与条款 | 文件归属 | 正常、失败与存读证据 |
| --- | --- | --- |
| SR-XF-002 AC-01/02/03；05 稳定身份与事务；U-155 | 新 `ea-courtyard-seekers.mjs`；`ea-sim.mjs` 工厂抽取；`ea-state-v6.mjs` 持久注册 | 开启不生人；世界步创建一次并实际沿南路到院；途中精确存读；坏版本/引用/来源拒绝；旧招募同 seed 逐值对照 |
| SR-XF-008 AC-01；CHAR-01/05；U-111 | `ea-courtyard-admission.mjs`、新 seeker 模块 | 未到院、远距、忙碌不收录；愿意与拒绝均有实际原因；重复请求/读档答复保持；暂缓、离场、条件变化后同人再访 |
| SR-XF-026 AC-01/02/03 局部；07 供给；61 真实床 | admission、新 seeker 模块及既有 housing 查询 | 有粮有床正式收录，唯一床号承诺；无粮/无床/已入籍失败不改状态；实际到床和入籍后存读；林长风旧语义保留 |
| SR-XF-007 AC-01/03 局部；U-125 | 桌面 `sect-sim`/统一人物窗由根接入 | 同一人到访、答复、收录与定位；场景身份/活动/门籍可读；按钮与正式命令条件一致 |
| SR-XF-032 AC-01/02 局部；63 §3C | `ea-opening-sim.mjs` 命令、tick、validate 引线；新 `courtyard-seekers.test.mjs` | 同源公开操作收录至五门人并保留原知识/境界；暂停/重开不生成机会；床位、资源、随机状态及既定答复精确恢复 |

实施在新独立 QA 源码副本进行，复制当前已合入 GC02、路线和服务缓存的主树，以 HEAD 与逐文件 SHA 绑定基线。模拟归属上述文件；桌面接入由根负责。先跑新增来源/收录基本用例，再跑直接受影响的开局访客、门籍、住宅及旧招募回归。正常桌面成长链、规则夹具和完整 SR/AC 分别登记，局部通过不关闭整项需求。

## 7. 隔离实现与当前证据

实现副本为 `/Volumes/Media/immortal-qa/courtyard-seekers-implementation-20261018`，基线 HEAD 为 `f891f4cd7abedbac5755cb6d2943af0355364383`，逐文件来源见该目录 `base-manifest.json`。目前模拟定向 7 项及访客、收录、住宅直接回归 19 项通过。三个固定随机种子的原 `recruit` 命令与候选实现整世界、返回值逐值一致，证据为 `recruit-parity.json`；该项使用受控物资夹具，证明兼容而非正常筹资。

新增用例验证了正式世界步出现、南路每步脚点、创建及途中精确存读、实际当面拒绝、答复重复保持、暂缓一次、原路离场、下一位愿意者正式承诺实体床并实际入住。条件改变后同 ID 再访使用明确标记的边界夹具，已核对旧答复保留。存读用例覆盖来源丢失、事实与评分篡改、孤立名册身份、阶段不符及未知版本，失败保留输入原文。

当前证据尚未包含正常来源世界收录至五门人的完整成长链或新增求见桌面实机；这些与规则夹具分别记录。桌面投影与控制器由根代理在同一副本接入并独立验证，主工程整项 SR 状态不因本批局部通过而关闭。

## 8. 同源桌面接续：接待与南路来访

从GC03最终171973原档启动。run01在同一世界步正式开启接待，生成唯一政策事实；外部脚本过早读取同一步的前次原生保存，按失败封存。后续磁盘与完整世界读回相等，修正检查器为等待完整状态一致后，run02从run01原字节续接。

run02实际171973→174422、287.382秒、页面错误0，两次原生关闭重开保持完整世界。陶静初`person:yunxiu:70`从南路实际到院，于172683点击走近；掌门停在北台维护位，来客173880按时离开。第二位陆清和174373出现，封存时正在入院。没有提交收录，也没有改写这些既定来访结果。

走近失败定位到聚灵台阶西柱：屏幕路线合法，但身体扫掠碰撞，`residentialMovementWaypoints`返回空路而未发正式移动。独立副本将碰撞路段交给现有正式寻路绕行，再核每段身体、投影地面和三米命令长度；实际结果继续沿原174422档验证。

唯一活动源：`/Volumes/Media/immortal-qa/seekers-desktop-20261018/run-02/stopped-world.json`，SHA `a95ea5946d7d7471bd75835c9b0a5d55714c168e528a5f2d60224e6ccc414751`。根代理独立核对两段原来源字节、所有封存文件、完整restore/view只读、原生关闭态和131文件一致，结果在`root-readback-run02.json`。正常五门人成长链继续，完整SR/AC保持原状态。

2026-10-19 合入与run03准备：迎面互等与让路身体边缘修复补丁已按原`minimal-repair.patch`合入主树HEAD `88ee118a…`，仅四个文件——`src/simulation/ea-sect-domain.mjs`、`ea-sr-spatial.mjs`、新`ea-north-yield-ground.mjs`、新`tests/unit/courtyard/courtyard-mutual-yield.test.mjs`；四文件SHA与隔离候选一致，原7份修改与194个未跟踪项保留，未提交、未推送。主树新规则4/4、旧路径定向2/2、`npm run check`通过；此前隔离复验11/11（新4、旧2、公开重放5）继续作为独立证据。run03工具与目录在`.../dsh-supervision-20261019/desktop/`，仍只从上述174422原字节续接，冻结当前主树149个运行文件（run02为131，新增18、变更14、删除0）；只读预检通过，未启动Electron、未做桌面收录。run03只验陆清和一人：公开走近、当面答复、按意愿收录、真实床位承诺与入住，途中和最终两次原生关闭重开，不运行原脚本的五门人循环，也不以Node重放终点替代原档。整项SR/AC不因局部合入或预检改变。

2026-10-19 实际桌面 run04：从174422原字节续接，tick 174422→176699，实际墙钟253.176秒，继承累计554.127秒；`approach-midway` 原生关闭重开1次（174501）。陆清和174480实际到院，174884当面答复`npc-accept`并以outer门籍收录，承诺`building:yunxiu:7/slot:bed:3`。随后本人按既定自主日程进入研习（`commitUntil` 176900），180秒入住等待到界时停在176699，床位仍为`pending`、`home`为空，未把停留写成入住；第三位徐闻溪`person:yunxiu:72` 176280已到院并在场。run04封存为`stopped`，报告在`desktop/run-04/report.json`，原生保存`desktop/run-04/world/sect-save.json` SHA `eea60b99…`，保留presentation。run05准备从该原生保存续接，目标5门人在籍（含掌门6居民），已用自然来访3/6、继承墙钟554.127秒，只做末次原生关闭重开，不预创建`run-05`。这一停点是入住时序证据，不是规则失败；是否需改源码待run05复现后再判。整项SR/AC仍不因局部通过提升。

2026-10-19 run05 卡顿、性能修复与恢复停点：root正常环境从run04原生启动run05；报告最后观测tick177153/wall97.434，未答复徐闻溪，随后Renderer约100% CPU近5分钟无响应，SIGKILL；`recovery`现场保全在`desktop/run05-hang-preservation/`。`run-05__world__sect-save.json` tick176960、SHA `57187d2f…` 是唯一可恢复native；177153仅是最后观测，没有完整恢复档。CPU profile显示`northSurfacePoint`/`inPolygon`主导：阻塞身体在连续帧重复重算同一几何，且`northPassageRoad.slice(1)`每次分配。最小修复仅`src/simulation/ea-sect-domain.mjs`：有界点缓存、去掉每调用slice，SHA `ac8761e4…`；未改活动、道路/身体边界、碰撞、预约、资源、时钟或NPC自主入住。相关9项、旧路径2项和`npm run check`通过；600帧泵探针最高1.705秒、稳定24–84毫秒/帧，未再出现无界追帧。

恢复批次recovery-01已实际启动：176960→176975经正式暂停UI取得恢复点（+15 tick），继续至177171时公开approach因master↔陆清和互等停路而失败；边界重开的状态相同但route-failure投影不同，报告保持`failed`。native `desktop/recovery-01/world/sect-save.json` tick177171、SHA `4c0f52e3…`，与最终checkpoint state一致，是新的真实保存停点，但不是通过档。下一批recovery-02必须从该native原字节继续，累计墙钟继承987.764004秒（1200秒边界剩余212.235996秒），使用公开旁步重试；未获单次运行许可前不再启动Electron。整项SR/AC不因局部修复提升。

2026-10-19 recovery-02 实际停点：从177171 native原字节启动，启动/暂停UI加载完全一致（+0 tick）。公开approach再次停路后触发旁步尝试，但当时候选点全部未被`moveArt`接受，仍停在177361；报告`failed`，边界重开route-failure投影不同。native `desktop/recovery-02/world/sect-save.json` tick177361、SHA `a117dcca…`，与checkpoint state一致；累计1026.201004秒，1200秒边界剩余173.798996秒。旁步已改为按实际等待者（master↔陆清和）取候选并记录每次尝试，尚未执行；recovery-03从177361原字节准备，等待单次许可。整项SR/AC保持原状态。

2026-10-19 recovery-03 实际停点：从177361 native继续，公开旁步被接受并移动master，但落点43.61,9.47未通过身体边缘可见地面检查；`until`以`person:master remains on active visible ground`中止。徐闻溪在旁步/路线处理期间已到时离院，未能答复。world停在177595，报告`failed`，边界重开完成；native `desktop/recovery-03/world/sect-save.json` SHA `57186e92…`，与checkpoint一致。累计1070.922004秒，原1200秒接待边界仅余129.078秒。整项SR/AC保持原状态。

2026-10-19 返工修正：`hang-repair/lotus-crop.png` 实际显示泥路、植物和石柱，没有莲纹；`stop-point.png` 的相机会话也不是177581同机位。按渲染器关系 `screen=(toArt(world)-toArt(cameraWorld))*fit*zoom+center`，177581 master 的 art 1326.25,222.5 在同存相机下投影到 (1452,-29)，落在1672×941截图外；因此不能用该截图证明该点是铺地，10.5 art-px“莲纹 inset”无素材依据，已撤回。实测地面多边形仍判定三个0.26m身体采样越界，这是真越界，不是观察器放宽问题。保留原十六点身体、门口逐点 floor/meterSweep 和路肩拒绝；修复改在正式公开移动：`apps/courtyard/courtyard-navigation.mjs` 新增 `bodyGroundClear`，对落点及整段路径逐点检查0.26m身体是否都在实测可见地面上（不再只在recheck/偏移时执行），越界则返回“当前落点身体会越出可见地面，请重新选点”。有界研究：从177595原native独立副本以正式公开移动命令走到(40,6)，18个正常世界步、0身体失败，陆清和活动/预约保持；177581落点被拒、合法退点(40,6)接受；19项导航/道路/互让回归通过，工程检查通过。QA脚本 `courtyard-seekers-recovery4.mjs` 已恢复原十六点检查（SHA `19cb3b12…`）；此段写于recovery-04实机前，实际结果见下段（177626）。五门人/GC26生产需另立预算与来源。

2026-10-19 recovery-04 实际结果：从177595原native启动，加载一致；`foodBuffer` 等待中在177602发现陆知微（`person:lu-zhiwei`，NPC自主移动）位于(42.112568,7.425976)，五个0.26m身体采样在实测地面外，`until`报`person:lu-zhiwei remains on active visible ground`。world停于177626，报告`failed`；native `desktop/recovery-04/world/sect-save.json` SHA `91bfbb3e…`，与checkpoint一致。累计1097.878004秒，原1200秒边界余102.122秒。master公开路线门禁研究已通过（177595→40,6，18步0失败，陆知微活动/预约保持），但本次实机暴露的是NPC自主路径仍可把身体带出实测地面；需把同一身体地面门禁接入NPC/互让路径，不能靠只挡master落点。recovery-04未答复/未招募，五门人和GC26生产未完成。

2026-10-19 NPC/互让路线修复：recovery-04 的失败人是陆知微（`person:lu-zhiwei`），不是陆清和；177602 时陆知微仍在前往藏经阁书案途中，旧路径首段44.5,9.5→40.16,5.73已不满足0.26m完整可见身体，随后在42.112568,7.425976被观察器抓到。修复只在`ea-scenic.mjs`：仅在目标在北侧(y<1)、当前/下一步不在室内且中心属于北侧地面时，迈步前以`northLibraryYieldRouteClear`检查下一段；失败则清空旧路径，让原活动用既有寻路重算目标。没有把北侧过滤加到通用`meterFindPath`，避免把主殿/正y房间和后方台阶合法路线清空。研究验证：从177595原native独立副本按正常世界步145步，陆知微走到书案并`executing`，全程0身体失败，书案预约保持；从最新177626原native独立副本104步同样到达书案、0身体失败。177602已陷入旧路径的离地口袋，不能靠局部退步脱出；这正是必须阻止旧路径续接的原因。最终本轮源码SHA：`ea-scenic.mjs` `8bc90b32…`；`ea-sr-spatial.mjs` `51b07c01…` 仅保留既有路径核心，未加通用北侧过滤；另加正y主殿门口回归，主殿门口(28,12.6)5步正常到达，室内/正y门禁未被清空。19项导航/道路/互让回归（npc-route-regression-4）和工程检查通过。recovery-05 已从177626原字节准备，累计1097.878004秒、余102.121996秒，等待单次Electron许可。

2026-10-19 recovery-05 实际结果：从177626原native启动，加载一致；但在`foodBuffer`前置检查处停在“Master body needs its current activity completed”——掌门仍有`activity:manual-harvest:349` food采集正在moving，尚未走到177626后的新NPC路线/门人招待段。world停于177626，报告`stopped`；native `desktop/recovery-05/world/sect-save.json` SHA `97769b91…`，与checkpoint一致。累计1118.589004秒，原1200秒边界余81.411秒。NPC研究仍为：从177595原native 145正常步、177626副本104步均到书案executing、0身体失败、预约保持；主殿门口(28,12.6)5步到达；但本轮Electron未验证NPC段，不能把研究当实机。下一步需在正常公开活动中先完成掌门当前采集，再进入NPC路线验收。

2026-10-19 恢复流程修正与下一批准备：`research-resume-active.json` 从177626独立副本按正常世界步218步（21.8秒）让已有掌门`activity:manual-harvest:349`自然完成，携带食物0→16，目标(23,17.6)真实到达；同场陆知微177730到达书案并`executing`，0身体失败，书案预约保持；没有重发采集或取消重建。恢复工具`prepareMaster`已改为对既有`sr-harvest`/`sr-replenish`执行“继续世界步直到完成”，不再立即StopPoint；新脚本`courtyard-seekers-recovery6.mjs`从recovery-05 native177626续接，单列300秒有界批次，历史累计1118.589004秒相加，不沿用旧81.411秒余量。recovery-06尚未运行，等待单次许可。

2026-10-19 recovery-06 实际结果：从recovery-05 native177626启动，既有掌门采集经正常世界步完成（`Existing master activity completed`、`Finite food harvested into carried stock`），陆知微到达书案并executing；随后在`transferFood`把携带食物转回HOME时，177964发现掌门在(25.236225,15.363775)身体越出实测地面，`until`报`person:master remains on active visible ground`。world停于177979，报告`failed`；native `desktop/recovery-06/world/sect-save.json` SHA `065e0950…`，与checkpoint一致。本批300秒预算从1118.589004累计到1186.906004秒（用68.317秒），剩余231.683秒；旧1200秒接待记录仍按停点保留。恢复流程前置已修好，但食物转移的master路径仍缺身体地面门禁；五门人/GC26未完成。

2026-10-19 transferFood 修复与 recovery-06/07 实机：正式运输路径新增可选`visibleBody`寻路，`advanceTransport`对旧路径先做北侧完整身体校验并在失效时重算。transport351的food18属于recovery-06最终源（177979）并在recovery-06实际完成，HOME 12→30，不是recovery-07新增；recovery-07新增的是transport352的6粮@178180与transport353的8粮@178436，使HOME 30→44。recovery-07自然收录顾听澜person:yunxiu:73为第四名门人（outer，178134答npc-accept，床位承诺）；累计1300.159004秒，本批113.253秒/300秒，余186.747秒。随后在等待下一位来访时，陆知微rest前往building:yunxiu:1/slot:bed:1的路径在178680(42.944230,12.790354)出现身体越界，报告failed；这是新的正y床位路径问题，不是transferFood。native `desktop/recovery-07/world/sect-save.json` SHA `dcd9be70…`，与checkpoint一致。transferFood原问题已实机闭环；五门人/GC26未完成。

2026-10-20 收口停点：自动化PAUSED，游戏时间不再推进。最终接受源为`merchant-harvest-01` native tick189867、SHA `e76e9dd8a5c9642e50fff100febadb04c49f2b0dbc11e87ad662cb9bff2218e6`，paused；5门人为陆知微、林长风、陆清和、顾听澜(iv73)、裴照雪(iv75)，73/75的bed仍pending，不称入住。HOME food16、carried0、food source304；366采food16于189831，367 delivered16于189858。完整段41.400066秒，later370.287718，sumMeasured2777.050227，当前链下限2854.560517，floor2874.609517，applied 7 segment IDs。`unknownTailSeconds=null`表示feed01保存关闭尾段未知（不是无缺口），`overallExactSeconds=null`；190800日结、床位真实到达/入住与持续供粮未验，整项SR/AC不提升。

历史归属更正（原始report不改）：recovery-04在177602的失败人是陆知微`person:lu-zhiwei`，不是陆清和；transport351的food18属于recovery-06最终源、于recovery-06实际完成，不是recovery-07新增。recovery-07新增的是352的6粮@178180与353的8粮@178436，使HOME 30→44；其停点为178693。此前“351/18为run07新增”的表述撤回。recovery-05停点177626；recovery-08为53.072秒失败分支且之后已计入累计，recovery-09为从07源重放分支，二者均保留原证据。 v9交接：`.qa-dsh-parallel/08-provenance/handoff-merchant-harvest-01.json` SHA `1a6d4b52ccca4dc44191235b6de4b14b4a3f5cbf7580b4a63fcfcf400418cf61`；`ledger-v9-merchant-harvest-01.json` SHA `23ae57dc1ef91f1f7e1fdc421629f9d75ff27f1e6e5cf55badec30e647e328d2`；MD `handoff-merchant-harvest-01.md` SHA `f4f63d479d8cb0a1179e08c392d9f5ebaff3c8913ff045a6c6550349eefc67e2`；30绑定0不符。 本轮交付检查：npm test 408/408、fail 0；npm run check 通过；requirements refresh/validate 通过（40/200/120，acyclic）；自动化保持 PAUSED，需用户显式新的 resuming 授权才可继续。
