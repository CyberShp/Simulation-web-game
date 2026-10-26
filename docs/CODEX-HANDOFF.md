# Codex 接手指南

2026-10-27 源码同步检查新增待办：默认测试199文件/1096项，1059通过、37失败、0跳过，完整日志在`/Volumes/Media/immortal-qa/source-sync-20261027/npm-test.log`。失败覆盖部分战斗兼容/界面、客舍、营造点、避让、访客、浮点断言及经营长链；尚未归因，不能以本轮战斗专项通过覆盖这些失败。用户本次要求本地提交全部成果并用GitHub API同步，未要求扩修；后续优先分组复现与基线对照，再修真实回归，保留当前失败证据。

战斗最终源码冻结为spatial `c95c8610107d4d24f470b1a855ea36372f73488bd9d09b6fcbd79b6ca32a8ae0`；domain022bdc/ground3f3d/presentation894及整帧保持。完整房间几何等价时共享纯线段结果，保留原局部缓存与公开参数语义；900步完整状态/路径逐字等价、44测试及7类路径对照通过。两轮`equivalent-rooms-lean-01/02`同120人物/5后台无注入90秒各901tick，输入p95 35.7/37.8ms、世界步94.4/93.2ms、rAF最大90.1/91.0ms、实际回调96.4/98.2ms，本场景性能门两轮通过。新同版三结局normal9/defeat5/retreat6及返院通过，source/runtime保持、窗口关闭；主已读报告、比较两长档落盘世界state，并看双方终帧。源码不再修改，后续整理证据与导航；下方七场属于旧spatialcd477，旧117.1ms失败保留，不能混成新版本失败。完整方向素材、Windows和真人听感另验，完整SR/AC不关闭。见[最终记录](art/combat-response-goal-20261027/README.md)。

冻结补验已结束：final-freeze-02新增startup7项/resume2项通过，原七场完整runtime与各自落盘世界state核对一致，全部关闭。主已看起步25/200ms、反向25ms和恢复收步25/100ms；普通起步4.3–10.4ms、自由移动平台0，恢复回拉/站姿滑0。当前索引63张活动PNG+6张终局/返院图，world117.1ms仍未达标。后续先保留本冻结版本与失败证据，不能把等待时间或更多微优化计数当成完成。

战斗04:55当前冻结交付依据为`combat-final-native-20261027/final-freeze-02/batch-summary.json`：同domain022bdc/spatialcd477/ground3f3d/presentation894完整764运行文件，normal12/defeat5/retreat6通过、action8项实际像素已由主检查；五场源档/运行散列保持、正常关闭、磁盘state与最终快照state一致。长档90.026秒/900tick，输入p95 35.7ms/最大38.9ms，世界步117.1ms/rAF最大114.7ms/回调121.8ms仍不合格；120原身份/5后台保持，原始峰值不剔除。04:48已提前冻结，后续小型索引/预筛等试验未接产品；当前补验同版本起步及暂停恢复，06:36截止不变。不要把动作与结局通过写成性能目标完成；完整SR/AC继续开放。

战斗04:22最新冻结：spatial `cd477bf1…`，domain022bdc、ground3f3d、presentation894及整帧源码保持。仅将A*无法改善g的边提前跳过，31项测试、7类查询、900步完整session和路径逐字等价通过。`astar-cost-lean-01`正式90.084秒/901tick已关闭，源档及运行散列保持；原120身份/5后台活动成立。输入p95 37.1ms/最大42.5ms，活动rAF p95 6ms/最大109.6ms，回调118.8ms，世界步112.8ms仍未达100ms目标。下一步只读评估剩余同步寻路重复工作；不得把下方旧五场冒充cd477完整同版验收，其战斗/帧源码未变且完整世界路径等价。05:36冻结、06:36截止不变。

战斗04:03最新冻结为domain `022bdc07…`、spatial `cb8538ac…`、presentation `89411772…`、ground `3f3d6740…`。仅新增北侧谓词整段证明，31项及900步完整状态/路径逐字等价通过，主独立4项与cmp通过。同版五场全部关闭、源/运行散列保持：final-normal-02 12项、final-defeat-02 5项、final-retreat-01 6项通过；final-action-pixels-01八项完成且四向/J/左右受击由主亲看。final-long-lean-01无注入90.019秒/900tick，输入p95 35.2ms/最大40.5ms；世界步132.1ms、rAF最大124.9ms/实际回调133.1ms仍未达标，120原身份与5后台活动成立。最慢仍266160，下一步评估同一次同步寻路中重复roomFrames/spatialRevision的成本，尚未改该处。此前三种缓存/预筛试验无收益已停，failed final-normal-01与修正后的原生鼠标验证分别保留。仍按05:36冻结、06:36截止，完整SR/AC保持。见[制作与证据](art/combat-response-goal-20261027/README.md)。

此前lean阶段证据：`combat-final-native-20261027/long-lean-01`同源90.0529秒/900tick，输入边沿p95为34.9ms、最大40.1ms；观察器最大0.5ms，活动rAF仍最大140.7ms、世界步142.8ms。`resume-01`跑动中暂停清键再恢复，两项检查通过，三段收步完整出现、回拉及站姿滑均为0；主Agent已看25/100ms实际像素，并独立复跑动作时钟与收步15项通过。两轮源档/运行散列保持、窗口正常关闭。随后已完成两轮266150–266170独立CPU采样与整段证明；这些早期数据不替代上方最新版本结论。

2026-10-27 单人战斗响应与动作收口执行中，原六小时窗口至06:36，05:36起冻结收口。正式Tab轻量投影后，真实长档90秒各类输入p95低于50ms、无超过100ms处理；原120人物身份保留，5后台活动推进，正式求师事件新增1人。侧向收步、移动攻击、Q接闪避及胜利/败退/撤离同一掌门返院三场12/5/6项通过；主Agent已看收步、闪避及0HP侧卧像素。暂停清键后的恢复收步最后补丁37项回归通过，原生复核待做。长档rAF p95为6.1ms但最大300ms、世界步151.8ms，流畅度未通过；下一步同源轻量观察对照，再对266160夜休返床路径采样。完整方向素材、听感、Windows与完整SR/AC仍开放。见[本轮证据](art/combat-response-goal-20261027/README.md)。

2026-10-27 北路恢复与工位响应本批验收完成：主树80/80，最终几何与10000步完整世界等价通过；三组原生寻路峰74→69、76→70、73→59ms，仍未达50ms。最终遇险8项、跨日食粮39→27、面板及经营档重开、北路送达13步/取消11步均通过，六窗口错误0/正常关闭，631源码散列稳定。npm check通过，完整SR/AC保持；下一步针对剩余工位尖峰继续优化，战斗长档另验。见[96最终汇总](design/96-NORTH-RECOVERY-PATH-RESPONSE.md)。

2026-10-27 地面查询与院务响应完成本批：精确坐标缓存及走廊预筛、单次面板渲染复用检查投影。同档暂停院务中位16.3→5.55ms、人物8.45→3.7ms，12份文本及完整世界相同；原生跨日食粮39→27即时刷新、人物筛选与保存读回通过。两轮经营分别7项、8项均通过，最大帧间隔89.1/80.2ms，仍有88/78ms路径长任务。独立几何626693查询零差异，10000步完整状态及200份view相同。定向15/15、相邻49/50，旧北路恢复失败保留；完整SR/AC与发布保持。 见[95](design/95-GROUND-PANEL-RESPONSE.md)。

2026-10-27 持剑单人战斗正式接入取得局部证据：新建单人山谷使用sword-study-v1，移动剑气、Q锁点重击与胜败返院沿正式模拟，旧无标记战斗保持。新增专项46项通过；旧冻结版四场26项功能通过，移动03记录19帧左右跑及释放后回跑，仍属诊断。120人/5后台活动长档原生265430→265471，未学剑Q拒绝且不扣气；来源/运行散列及关闭一致。精确缓存冷步219.23→143.05ms、热2.48→2.34ms，完整状态相同；原生世界步仍127.1ms、活动帧间隔125ms、Tab264.1ms，另有Node158ms慢步。完整动作、流畅度、听感、Windows与完整SR/AC及发布保持开放。 见[73](design/73-COMBAT-FRAME-PRODUCTION.md)。

2026-10-26 结伴经营响应优化完成本批：原生506ms长任务定位为留守门人工位寻路中的静态身体地面查询，新增保守内部单元证明并保留边界原判定。同初始档/视口/采样平安最大rAF间隔508.1→95.2ms、长任务506→90ms；p95与点击未改善，遇险最大109.3ms/长任务108ms。独立1168427点及1000路线零差异；两场景合计10000步完整状态、200份完整view一致。14项定向全过，相邻52项51过1项基线同样失败。两轮原生7/8项通过，QA档重开载入与关闭保存完整状态相等。剩余路径90–108ms、院务打开57ms、旧北路恢复失败保留；完整SR/AC及发布保持。 见[94](design/94-EXPEDITION-RESPONSE.md)。

2026-10-26 五人结伴与留守经营完成本批：谷口交叉中心距0.04→0.54米，补有限绕行和落点占位；修复有收获却持续种粮压过运粮。五门人两出三留，平安/遇险各四次日结供给成立，缺粮拒发、满库等待与正式腾库、唯一药、床休和双方返工通过。主树100项不同定向/相邻测试通过，最终经营4项重跑通过；独立复核及两轮macOS源码Electron7/8项检查通过、错误0。原生固定HEAD加本批代码，非全部并行改动集成。整轮仍见513/593ms长任务，归院后45秒静默最大帧间隔35.1ms且无长任务；性能根因、Windows、存读长链与长期平衡待验。完整SR/AC及发布状态保持。 见[93](design/93-COMPANION-OPERATIONS.md)。

2026-10-26 门人结伴历练完成本批：院务开放结伴机会，近身且同目的的两位门人分别自愿，至少一人留守；各自准备2粮8精力、独立身体与药囊。平安场景1925双人归院，各得8经验并各退1药，2400共同生产木21.384；遇险两人各伤10，陆知微1139–1158实际安全服唯一药，林长风等候19步，1424/1427分别归院，林1470到床养伤，陆1730产木、林1860产水。近距提醒与亲见分开；拒绝、失散120步独自返、死亡不复活及临时交接不可达恢复通过。修复两人公库互堵、观察脚点及返回入口接缝。主Agent54项定向/相邻测试、最终三场景12项检查通过，19源码散列一致、32完整快照、5实际Chromium组件截图，错误0。谷口有0.04米短暂交叉，通用身体净距未验；原生整局、Windows、存读长链及长期平衡未验，完整SR/AC与发布状态保持。 见[92](design/92-EXPEDITION-COMPANIONS.md)。

2026-10-26 历练收获反哺成长完成本批：真实采6草于1729归库，当面筹备一炉并保留本人旧承诺，2545实运材料到丹房，3428完成原四阶段780工步，4020成药归库，林长风4112收入随身、4120开始突破、4310完成180工步升至筑基。掌门正式搬40木腾库后，5080本人实际参与生产，贡献90%、百工增长0.54；灵草总账119+6−75−50=0。筹备可撤回，已接运输保留；修复休息续约饿死取丹机会、交库容量/产权检查及运输提示滞后。根116项定向/相邻测试、最终投影14项复验、三场景9项检查和实际Chromium人物窗组件通过；23源码散列一致、14完整快照、6截图及独立复核通过。按U-172配置初始条件；原生整局、Windows、存读长链与长期平衡未验，完整SR/AC及发布状态保持。 见[91](design/91-EXPEDITION-GROWTH.md)。

2026-10-26 剑气身体命中与SFX修复：可见发射/瞄准/28×4核心与12帧alpha≥64轮廓同源；主Chrome同点瞄头旧200/0→新175/1，上空不伤、静音躯干仍伤。几何/Q回归与20项音频生命周期检查通过，静音/音量/R停旧音已接；听感待用户试听，全部SR/AC状态保持。 见[本轮记录](art/combat-ranged-20261026/review-v002.json)。

2026-10-26 剑气/Q落点离线候选完成本批：移动普攻发真实飞行剑气，Q260ms短停脚后可走位/Space，锁点落击及轻重硬直/击退按位置结算；主Chrome审飞行/命中亮闪/接续与胜利，空地不伤已看、短落地瞬间未捕获。7项小检查与独立定向复核通过；持剑手/两帧斜攻仍粗，未接游戏，全部SR/AC状态保持。 见[本批记录](art/combat-ranged-20261026/README.md)。

2026-10-26 林间交手离线候选已可操作：WASD/鼠标独立，移动出剑、Space打断避拳、山魈追击与受击接续、胜负/R及倒地末帧均有主Chrome实操；6项小检查与独立定向复核通过。16人/8兽整帧可试，纵向两帧攻击/侧向闪避仍粗，未接游戏，全部SR/AC状态保持。 见[本批记录](art/combat-encounter-20261026/README.md)。

2026-10-26 四动作离线样板v002固定稳定站姿，接新兽反击与Space整帧后撤；主Chrome核站住反击玩家80、离圈玩家100，敌均75并可恢复。全画面与八帧已审；四帧跨度/细节差异仍为粗样，未接游戏，全部SR/AC状态保持。 见[本批样板](art/combat-minimum-20261025/README.md)。

2026-10-26 门人进阶需求与自主筑基完成本批：人物窗从缺丹需求导航到同门并预选筑基丹，正式自愿炼制780工步，2692本人运药归公库；另一门人2750自主取丹、2772收入随身，2780开启突破，2825实际炼化、2975完成180工步升至筑基，3150本人再参与生产并按贡献成长。近身和远取统一公药许可，保本人私药、旧承诺与实际身体；唯一丹竞争、满袋拒绝、炼化前后取消及执事继续成长通过。根77项不同定向/相邻单测、六场景12类检查及实际Chromium人物窗组件通过；main选中/走近薄接缝受控执行核验，16份散列前后与当前一致，13完整快照、6截图，浏览器错误0。主Agent发现首轮旧缺丹提示与在途冲突后修正，最终scenario-02通过，旧记录保留。按U-172配置初始条件；原生整局、Windows、存读长链和长期平衡未验，完整SR/AC与发布状态保持。 见[90](design/90-DISCIPLE-ADVANCEMENT.md)。

2026-10-25 当面商议炼丹与成药交付完成本批：统一人物窗选丹方、看实际费用与现场缺口，由门人按资格、意愿及原承诺答复。正式商议筑基丹后，本人完成四阶段780工步，2099现场成药1、2689实际运抵公库、2690登记交付；医理80→80.6、药理35.1→35.7。缺料/资格/承诺不足与本人不愿分别反馈，远距和隐藏药理禁止商议，重复请求不另开炉；重伤退款和途中中止保留实际投入与实物。共同生活成员的完整人物窗入口已补齐；阅读暂停下进度直接投影实际炉单与运单。根53项不同定向/相邻测试、末次8项投影相关复验、实际Chromium人物窗与七场景11类检查通过；16份散列前后及当前一致，浏览器错误0。按U-172配置初始条件；原生整局、Windows、存读长链及长期平衡未验，完整SR/AC与发布状态保持。 见[89](design/89-DISCIPLE-CRAFT-REQUEST.md)。

2026-10-25 最小四动作离线样板已可操作：D右行/松键停、J或左键出剑、H受击、R复位；主Chrome核远挥空/近靶单次25伤害/H恢复，八帧全身剑完整，独立五类交互复核通过。新剑击/受击仍为四帧粗样，姿态跨度及剑长细节待改；全无声、仅右向，未接游戏，全部SR/AC状态保持。 见[本批样板](art/combat-minimum-20261025/README.md)。

2026-10-25 三至五人并行经营完成本批：3/5名门人另加掌门，同钟生产、修行与历练均有实际进度；各跨三次日结，每日分别8/12粮，全程饥荒0。两档均炼2药于2168归库，三人实运11粮后余35；五人两次真实伤10→0服药并归院、本人返工，实运13粮后余23，药物总账1+2−2=1。修复未完功课和有效承诺被出游抢占，以及承诺到期先续约导致无法出游；既有夜休/恢复/突破优先。根61项定向及相邻单测、独立6项复核、最终两场景11类检查通过，17份散列前后及当前一致，工程检查通过。初始住宅非法入口和验收器遗漏夜休条件的失败报告保留；按U-172配置场景，原生整局、Windows、存读长链及长期平衡未验，完整SR/AC及发布状态保持。 见[88](design/88-SECT-CONCURRENCY.md)。

2026-10-25 药师实操成长与供给接续完成本批：实际完工唯一增加医理，已学药理通过实操加深；场景34.5→35.1达到原资格后真实炼成筑基丹1份。伤停、真实外出、半炉中断三种替补均另起自愿炉单并实际归库2药；半炉0.5草损耗及余料退款保持。修复替补赴炉与伤者返床的真实窄路互堵，退让不计工时。根69项不同定向/相邻单测、四场景11类检查、实际Chrome组件6类及原培养DOM1项通过；最终16份场景/7份组件散列一致，失败报告保留。自动储备仍为回春散；按U-172配置初始条件，原生整局、Windows、存读长链与长期平衡未验，完整SR/AC及发布状态保持。 见[87](design/87-PHARMACIST-DEVELOPMENT.md)。

2026-10-25 药物材料自主筹备与口粮保障完成本批：缺草/水通过既有生产候选、真实工位和运输补足；普通灵泉新增显式取洁水/凝灵晶选择，未完批次拒切。足粮场景从零公共草水经取水、种采、搬运、四阶段炼制，于4624公库入药2；低粮场景初始5粮，722实运30粮至35，727才开始药物任务，4909药2/粮41，全程饥荒0。缺人和旧承诺100步保持；61项独立定向/相邻单测、最终四场景10类检查、实际Chrome管理组件6类检查通过。修复首次洁水入库缺省键与种粮压过运粮的实际问题，原失败保留；最终场景14份/组件5份散列前后一致并匹配当前源码，错误为空。按U-172配置设施和初始物资，未做建井长链、原生整局、存读及长期供需平衡；完整SR/AC和发布状态保持。 见[86](design/86-MEDICINE-MATERIALS.md)。

2026-10-25 回春散供给闭环完成本批开发与针对性验收：正式院务设置0–10份公库目标，门人自愿搬运有限原料、完成四阶段280工步、成药实际归库，达标停产。场景陆知微耗10草/2水/1木及10灵石炼2份，tick2207归库；林长风2374领1份、2823安全处服药伤10→0、3103归院，公库余1。缺水实际补运后恢复、无人愿意、既有在制、防重复、关闭保留投入等通过。根61项单测，最后提示优先级修正后6项边界复验，四场景10类检查及实际浏览器组件通过，14文件散列一致、错误0。按U-172配置场景，未做原生整局或存读；完整SR/AC及发布状态保持。 见[85](design/85-MEDICINE-SUPPLY.md)。

2026-10-25 历练备药至恢复经营闭环完成：实际到公库按许可领一份回春散，个人随身药优先；受伤后退到安全处停20世界步服药，沿原路归院，未用公药实际归还。四场景均到真实工位产生新生产贡献：有药伤10→0；缺药/无许可归院伤10，实际到床恢复至4.9后返工；平安未用归库1。根新增及相邻39/39、四场景11类检查和实际浏览器组件通过；私药、每日限制、死亡、取消及旧行程兼容独立核验。完整SR/AC与发布状态保持。 见[84](design/84-EXPEDITION-MEDICINE.md)。

2026-10-25 历练距离修复完成：近身伤害恢复原3米，感知6米，应战交互9米各自独立。默认怪位置下正式探索在6米发现后撤退，1279步归院伤0；配置2米接触的行程实际伤10，589步归院后保留养伤意图。两场景7项、根距离10/10、目的与恢复16/16、原历练回归7/7通过。82记录的5.3米旧失败已修复；历史结果保持，完整SR/AC及发布状态保持。 见[83](design/83-ENCOUNTER-DISTANCE.md)。

2026-10-25 门人自主历练目的已接入：根据公库缺口、本人志向和本人既往风险见闻选择采药补给或探索修行。定向场景验证采6草返院与实际到点观察60步分别结算8经验；遇险未完成及新采药空药丛不发完成经验。新增及独立边界9/9、归院恢复回归7/7、三场景9项及实际浏览器组件通过。相邻19项18通过，唯一5.3米近身受伤断言在入口同样失败，保留待修。完整SR/AC及发布状态保持。 见[82](design/82-EXPEDITION-PURPOSE.md)。

2026-10-25 新门人安置与首次贡献针对性验证：普通求见工厂生成同一身份，正式收录提交唯一门籍与具体待入住床，本人实际到床才登记入住，随后自主到生产工位贡献并取得对应技艺成长。缺床/缺粮拒绝不改世界，本人拒绝及重复收录保持边界。现有产品逻辑成立，本批增加可复用夹具和专项场景；完整SR/AC与发布状态保持。 见[81](design/81-DISCIPLE-ONBOARDING.md)。

2026-10-25 历练归来恢复已接入：真实归院伤势大于5时保留养伤意图，有药按既有规则耗草，缺药自然调养，恢复后回到日常自主决策；健康同伴按现有供给与意愿接活。按U-172配置三场景验证归库、真实床位恢复及生产补位，饥饿可优先解决而保留恢复意图。完整SR/AC与发布状态保持。 见[80](design/80-EXPEDITION-RECOVERY.md)。

2026-10-25 门人生产专长已参与v1自主择业，最多12分软偏好；按U-172配置场景，正式世界步646→910验证不同专长择业、真实工位生产、两人对应技能80→80.6及下一次决策。同种子只交换技能，岗位随之互换。实际浏览器组件近身理由、远处保密和只读通过；修复v2日程字段过滤接缝。此为针对性模拟与组件证据，完整SR/AC及发布状态保持。 见[79](design/79-DISCIPLE-WORK-SPECIALIZATION.md)。

2026-10-25 人物走近已接入后台寻路，主线程保留正式身体校验与事务提交。macOS源码Electron两普通来源实际近身、途中及终点共4组原生保存/关闭重开通过，最终284802；首反馈约48–55ms。旧场景最长帧间隔206.5ms，最新经营档192.1ms，200ms响应目标尚未全部通过。根定向32/32；导航相邻9/10及命令相邻41/44的4项失败均在修前版本复现。原失败记录保留，完整流畅度、Windows、整项SR/AC及发布状态保持。 见[78](design/78-APPROACH-RESPONSE.md)。

2026-10-25 宗门供给与门人自主突破本批完成：补齐既有炼丹院务奖励入口、修复突破通勤互等及让行工位接缝；正常桌面源280680经实际补种/两批采粮交库至282724，再自主修炼、唯一扣24灵石/8灵草，于284309完成180工步升至炼气二层。最终284504，五人供给正常、饥荒0；准备及核心共5组原生保存/关闭重开一致，公开人物窗只读正确，两个成功段errors均0。原走近超时场景现点击3.72秒通过15秒门限，仍有明显等待。空间相邻37/37、根奖励/突破/通勤16/16通过；旧requester-clear基线失败、Windows、长期平衡、完整SR/AC及发布状态保持。 见[77](design/77-DISCIPLE-BREAKTHROUGH-LOOP.md)。

2026-10-25 门人学成后自主修炼：满理解术法/武学停止重复深化，当面显示修为、突破条件和材料缺口。macOS源码Electron分段验证成立：旧课完成后真实到位修炼，修为0→90.574848，五人正常日耗；最终280680独立零世界步公开读取与保存/关闭重开10项通过、错误0。两处实际路权死锁已回放恢复。此前三份失败报告保持；走近点击15秒响应问题、相邻测试32/33中的旧基线失败仍待处理。成长91/91、身体路径14/14、手动让路5/5通过（分组有交叉）。完整SR/AC、Windows、长期平衡和发布保持。 [76](design/76-DISCIPLE-CULTIVATION-PROGRESSION.md).

2026-10-25 Kling最新接续：返回收步片0–8落地、9–18再次蹬离大跨步，未达当前脚直接收步；原片保留，不批量抠底、不接D。无声展示版在`/Volumes/Media/immortal-qa/kling-stop-review-20261025-v001/silent-source.mp4`，0音轨、241压缩包/PTS保持，Chrome已加载可播。下一步frame52接地稳住仅收后脚，v2提示词未发Kling；见[review](art/kling-stop-supplement-20261025/review.json)。旧输入包与并行经营主线保留，全部SR/AC不推进。

2026-10-25 战斗美术接续：用户认可同标尺整体观感。55 B02的v6→v5单方向8帧、H0=500统一58逻辑像素、480ms候选，主Agent已在Chrome实际逐帧/播放跨圈并对照2/6支撑帧，源sheet/contact全8帧已看；仅通过离线可播放及视觉初审。持久包、spec、透明帧、实际尺寸GIF/contact/HTML与review在[run-cycle-v001](art/combat-motion-study-20261025/run-cycle-v001/review.json)，原pending报告和旧v1–v3失败保持。地面速度同步、起停、其余方向、阴影/原生像素规则及实机未验；SR007/013仅添局部证据，全部状态保持，无运行或存档修改。见[README](art/combat-motion-study-20261025/README.md)及[73](design/73-COMBAT-FRAME-PRODUCTION.md)，并行经营主线保持。

2026-10-25 战斗U-171旧运行记录：像素包在 `assets/courtyard/combat-pixel-v1/`，制作配方在 `scripts/art/combat-pixel-lpc/`。根已查看四向起停与双方实际受击。`/Volumes/Media/immortal-qa/combat-pixel-sample-20261025/native-01/report.json` 为failed：14项局部检查成功，署名读取失败且末尾显式保存等待超时，`nativeExact=false`；正常关闭保留tick265613、speed0、manualPause=true的原生档。host MIME修复及2项局部回归已完成；runtime-02仅在冻结runtime-01基础更新host及对应测试。独立`reopen-01/report.json`也为failed：三项暂停重开/保存/关闭检查成立，原档tick265613保持、`nativeExact/nativeClosed/closeBytesExact=true`；署名请求因非法user-agent header失败、`http=[]`，未通过署名验收。两份报告不合并，原动作/接触/性能未重跑。activity回调0.5–2.5ms，后台寻路350.8ms与首个预警描边49ms仍待处理；完整流畅度、场景美术、全动作/三规模目标及skill未完成。详见[73](design/73-COMBAT-FRAME-PRODUCTION.md)。

2026-10-25 U-170 留守供给与掌门外出已完成本批开发及macOS源码Electron分段验收：普通源267998正常备粮，离院270016→实际归院272082，门人实送6粮、五人日结供给正常并继续成长；掌门采6草返院实运入库，最终272332、公库粮23。37项集成及4项采寻检查通过（有交叉），最后一段原生存读/关闭/来源与运行散列一致、错误0。早先验收脚本失败及精确续接链保留；长期平衡、Windows、完整SR/AC与发布状态保持；最终全仓check被并行美术署名CREDITS.md缺失阻塞。详见[75 留守供给与掌门外出](design/75-SECT-SUSTENANCE.md)。

2026-10-25 战斗最新接续：`/Volumes/Media/immortal-qa/combat-stall-20261025/integrated-01/report.json` 已7项通过并正常关闭，265258→265600、active34.199秒，来源/运行/原生保存一致。首键1.1ms；232ms世界步、61ms窗口activity完整投影和正常技能26–29ms仍待修。跑步atlas无程序bob，但素材尺度/重心及左向旧待机接缝待处理。用户当前要求参考Game Art Style全站改美术并寻找开源动效，已完成37页104游戏目录及重点样例浏览，选型尚未定稿；保留现有素材，完整目标与skill未完成。详见[73](design/73-COMBAT-FRAME-PRODUCTION.md)首段及原生报告旁的three-run-comparison.md。下方各批证据保留各自时点。

2026-10-25 U-169 门人培养与宗门分工已接入并完成macOS源码桌面局部验收：正式院务选择经营侧重，近身推荐已有法门，保留本人意愿、原课和身体工位约束。顾听澜推荐后养元诀理解60→80；裴照雪保留旧护息印功课及引风术待执行建议；陆知微9批真实生产，木材163.39977615→303.078163692、百工37.44→42.84。同源desktop-02保存264262后由desktop-03续接至267998，5对分段原生存读一致；03错误0且正常关闭，早先脚本失败保留。68项集成、19项空间、1项DOM检查通过（分组有交叉）；独立审计17项通过。当前整合版200步完整状态等价及最终档零推进原生读回通过。Windows、完整SR/AC及发布状态保持。 详见[74 门人培养与宗门分工](design/74-DISCIPLE-DEVELOPMENT.md)。

本批普通档接续：`/Users/shepard/.codex/tmp/immortal-disciple-development-20261025/desktop-03/world/sect-save.json`，tick267998，SHA `4dfeb4f5df692ee8b9bc160373e907486d62c1e0a7adeb506e6f9f3dfab5090e`，手动暂停、经营均衡、新历练关闭。原263635来源保留；并行战斗工作与下方历史证据按各自范围接续。

2026-10-25 新场 victory-02 已完成19项 macOS Electron 流程检查：同源应战档265258→265778，128.990267秒；连续20.5秒WASD、移动剑气实际命中、术法停脚后移动/闪避、固定岩刺落点避让、一次胜利及原队返院/原生关闭重开成立。sourceUnchanged/runtimeUnchanged/nativeExact/nativeClosed全true，errors和finalizationErrors为空。当前代码与QA窗口均已冻结关闭。完整视觉、流畅度、动作库和skill未完成，SR/AC状态保持。 同源tick265439→265440的native worldPump从1001.5ms降至317.8ms；本轮p95为8.4ms，连续active rAF最大314.8ms、p95 6.2ms，Canvas回调p95 0.5ms。仍有298ms和256ms的其他长任务，具体子阶段未核实；不能将低平均耗时称为流畅。自动保存快照17.1ms、提交49.7ms，所在同步长任务83ms。FIFO环缓存和纯几何惰性计算保持200步/400完整session、全部路径与最终保存字节一致。 48×32米战场、22米跟随视口、10米剑气已接入；旧active保持原规则。详见73。下方历史停点按其日期和范围保留。

2026-10-25 user review checkpoint: user requested bounded iteration and viewing the current result. Code/script agents stopped; ownedSnapshot optimization and save-span instrumentation were not implemented. Current Electron preview uses the isolated /Volumes/Media/immortal-qa/combat-user-preview-20261025/preview-01 directory, copied from the attested party04 active source. Root opened the battle paused and raised the window; process27179 was verified live. Preserve this preview for the user. Next implementation scope is pending their review; do not resume gait/tool expansion automatically. Right-idle registration27 and its narrow move/guard fallback fix have29 component tests, with native continuity still pending. Full goal and skill remain incomplete.

2026-10-25 party12 passed17 native checks,265353->265721/182.90823s; source/runtime/native-save/closed all true, errors empty. Active QA status126 reads p95/max0.1ms, full reads0. rAF p95 6.2ms but max460.6ms remains unresolved; do not claim smoothness. Left spell and bilateral dodge registered; root saw actual left dodge in native capture. Calibrated jog repaint still has suspected foot slip; four right-idle frames prepared, registration requires protecting existing move/guard fallback. Complete sword sample and reusable skill remain in progress. See73; SR/AC unchanged.

2026-10-25 dodge sample: four explicit phases repacked and right clip registered; left four-frame asset prepared and registration pending. Root ran Blender foot measurement v2 successfully (measure02, inputs unchanged); original camera forward26.7324deg differs from formal30.3603deg, and measured sole motion still differs from ground. Repaint foot calibration remains unapproved. Remaining party11 long tasks correlate with pause/skills; QA readCombat hidden full query is being repaired before next performance run. See73; SR/AC unchanged.

2026-10-25 party11 native passed all 17 checks after the HUD repair: tick265353 to265721,179.475589s, source/runtime/native-save/closed all true, errors and finalizationErrors empty. WorldPump p50/p95/max1.3/16.3/42.7ms versus party09 15.5/107/195.4ms; rAF still peaks199.9ms, so full smoothness remains unproven. Root contact screenshot shows remaining close-body overlap. See73; full SR/AC unchanged.

2026-10-25 full-sword sample: root produced and inspected four right-dodge poses; source saved, external pack only. Formal phase probe found repeated playback when all frames use evade; preparing explicit windup/release/recovery/evade mapping without changing movement rules. HUD real-DOM regression reproduced before repair and passed after adding authoritative masterWound; full native rerun remains pending. See 73. SR/AC unchanged.

2026-10-25 user added a reusable-skill deliverable: first complete and verify one full sword-combat animation set, then distill the proven art/extraction/integration/repair workflow for other weapons and spells. Full solo/party/group goal remains. Root owns art and skill; code agents remain GPT-6.1-sol xhigh. Ground-preview inspection still suggests jogging foot slip; measurement is pending, runtime gait unchanged. See 73.

2026-10-25 party10 FAILED before ready: combat HUD still reads people.find from the new light projection. Real wound-field and DOM render regression fix is pending. Root closed the isolated QA window normally; lifecycle closed at 2026-10-24T18:19:00.899Z, process exited 1, source unchanged. Original failure report preserved; stale lock moved into the QA evidence directory. Lin left attack registered (23 clips), 556 direction/phase samples and 5 frame tests passed. Full SR/AC unchanged; see 73.

2026-10-25林长风左向六帧制作完成并复看222像素起收势，源与runtime候选已保存，registry及原生接触验证继续。成功移动输入采用即时战斗投影的短测已报告明显下降，尚待冻结、独立读回与同源桌面验证；暂停/恢复完整投影耗时仍待处理。详见73，SR/AC保持。

2026-10-25林长风右剑击六帧接入，registry22clips；正式阶段180采样、身份隔离及帧5项通过，根核对registry与8素材散列一致，原生群战待验。慢跑同标尺比对发现偏小，另制sourceHeight260外部候选，未替换运行素材。刷新优化短测发现耗时转移到combat-input，正在修正并复测，不能认定流畅。详见73；完整SR/AC保持。

2026-10-25掌门左右受击/倒地帧候选接入，registry21clips；右批24回归、左批840方向/阶段采样和直接帧5项通过，原生反应待验。慢跑16帧已离线评看，比例/滑步仍待验。性能只读定位每50ms完整山院投影及0tick重复刷新，正在限定main/sect-sim实施投影优化，权威世界活动与公开完整view保持。详见73；完整SR/AC保持。

2026-10-25 party09同源同行实机17项通过，265353→265725，180.965秒，来源/运行/保存/关闭均保持、错误为空；worldPump峰195.4ms，与party08接近，交战卡顿未解决。纯多边形索引已冻结，等价通过、相邻177/178且唯一失败在原基线复现。慢跑16帧底稿已渲染及重绘，仍为外部候选。详见73；完整SR/AC保持。

2026-10-25接缝修正：陆知微东北掌击末帧脚点重标为v002，离线浏览器首尾对齐、24项回归通过；暂停恢复显示相位与命中保持年龄修复，根针对6项通过、相关40项通过，原生待验。根实际导入慢跑FBX，52骨映射完整，初选63–87帧作待试循环，适配和最终像素帧未批准。见73制作记录；SR/AC保持。

2026-10-25快步制作：八帧生成候选因缺脚与腿相位问题未接入；已取得Hunyuan四秒连续慢跑FBX作为离线姿势参考，源文件散列与任务记录在73及外部QA。源动作检查、保留腾空的抽帧流程和暂停恢复显示相位修复正在进行，尚未作为正式动作验收；SR/AC保持。

2026-10-25动作续作：陆知微东北掌击六帧完成抽取、白底透明合成及222像素接触表检查，算法validate通过；已接入registry，18个阶段/方向采样及24项回归通过，native待验。最近角度选帧修复已应用、24项专项通过，原生待复验。16帧慢走候选核对发现原周期与3.3m/s移动不匹配，保持外部候选；详细证据见73。完整SR/AC状态保持。

2026-10-25战斗实机新增：party08同行17项、group03组件群战18项、solo01正常独战22项均完成胜利/返院/原生重开，来源及运行保持、窗口已关闭。完整视觉与流畅度仍待验；长档最大worldPump193.1ms，继续同源多边形查询优化及最近角度选帧。详见73制作记录。

战斗素材新候选（2026-10-25）：掌门东北剑击6帧、两守卫左受击各1帧/左倒下各3帧已入registry；反应误回退站姿已修，根帧/manifest专项21/21。新素材native与长档性能复验待执行；性能Agent正在同源等价优化view复制及路径资格查询，窗口当前均关闭，详见73制作记录。

2026-10-25 战斗继续：party-06短步已实际执行，QA漏读路径导致整段failed；世界推进出现最大296毫秒主线程阻塞，正定位。群战fixture-03已重建，三规模完整实机与帧动画质量仍待验。详见[73制作记录](design/73-COMBAT-FRAME-PRODUCTION.md)。

战斗续作检查点：`/Volumes/Media/immortal-qa/combat-native-party-20261024/party-04/final-world-native.json` 为实际保存的active战斗，tick265353，可由同目录report核对来源。掌门左右剑击、右施法及山魈左砸地各六帧进入registry候选；其连续动作、打击几何与完整桌面终态仍待验，详见73“续作检查”。

战斗目标批次正在接续：[73 单人、同行与群战帧动画制作](design/73-COMBAT-FRAME-PRODUCTION.md)。当前主 Agent 负责美术、素材处理与运行评看，代码／脚本由 GPT-6.1-sol xhigh 子 Agent 分模块实施；新素材与多人接缝仍在集成，完整目标尚未完成。后面的医庐／门人正常来源和原样板证据保留各自范围。

2026-10-24 U-168 门人自主经营与一次山谷历练已完成开发和 macOS 源码 Electron 验收。裴照雪实际出院、从有限药丛取得6份药草，感知山魈风险后退回，tick263500实际交库，经验增加8、伤势0→0；留守陆清和与陆知微产生6条真实生产事实，伐木场木材17.870030169→163.39977615。desktop-04从保全准备现场261473续接至263635，388.786318708秒、错误0；准备261473、谷内261865、归院263538三次完整原生重开一致。21项定向与相邻回归通过，GPT-6.1-sol独立复核通过。434份冻结文件保持，本批8个运行文件与主树一致；早先失败与在途重开按原版本范围保留。Windows及完整SR/AC状态保持。 详见[72 门人经营与山谷历练](design/72-DISCIPLE-EXPEDITIONS.md)。

当前本阶段原生接续档：`/Users/shepard/.codex/tmp/immortal-disciple-expedition-20261023/desktop-04/world/sect-save.json`，tick263635，SHA `4ba6821886da6e1b254bab2111a646c301497f9fbe52341e4c42fb4e69023ede`；手动暂停、新历练政策关闭，原医庐档保持。

2026-10-23 GC15一级客院已接入：两张独立客床、当面自愿邀请、实际步行入住、原来访期限退房下山及原生存读。macOS源码Electron有限夹具入住ui-fixture-03通过7项（1656→3851、235.557720083秒），施工build-fixture-01通过3项（646→1700、114.379689209秒）；唯一工单3投入45灵石/40木/20石，两趟实际送达后于1683完成200施工步。两段错误0，来源、运行文件与原生重开均一致。GPT-6.1-sol独立读回6个原生检查点及12个核心源码通过。正常世界仍保留医庐tick261253原档；该世界的筹资建设、Windows和完整SR/AC保持待验。 详见[71客院记录](design/71-GUESTHOUSE-INTEGRATION.md)。

2026-10-23 医庐正常营建与一次诊疗已完成：GC14三趟材料实际送达，254687落成；掌门与程问舟分别到医者／诊疗位，原工单6681累计80步，消耗1草1洁水，伤势35→31，261247唯一结算。最终原生档 `/Users/shepard/.codex/tmp/immortal-clinic-20261023/supplies-clinic-02/world/sect-save.json`，tick261253，SHA `528dd6cb30967438310afc15787ac57a4388e9a671e302ae21d8b27c6fe1ae56`，保存及关闭重开精确一致；supplies-clinic-02为passed，678.224527秒，source/runtime/nativeExact均true，errors及finalizationErrors均空。医庐本批局部成立，完整40项SR/AC、升级画层、Windows与慢帧边界保持。详见[62医庐记录](design/62-EAST-SERVICES-INTEGRATION.md)§14。

上一段西谷闭环证据：2026-10-23 西谷炼药闭环已通过：原499药草、503木料与504清水实际交付，原505四个真实工位累计280步，唯一产出2份回春散；506实际取药至随身，507实际送入HOME，最终保存及关闭重开精确一致。该段原生档 `/Users/shepard/.codex/tmp/immortal-workshops-20261021/heal-11/world/sect-save.json`，tick237899，SHA `97f83e7c9efbafb396ffae9829e3e310aa2e8d5ea61d36a1262965dc8d88d837`；HOME回春散2，随身及丹房0。最终heal-11为237275→237899、174.153025秒，source/runtime保持，errors及finalizationErrors均0。四工位原生停点分别来自heal-08阶段0及heal-09阶段1–3；506携货中途存读窗口未捕获，实际唯一取药及最终回库不受影响。各停止与失败分支保留各自范围，不拼接成一次连续运行。慢读性能、Windows真机及完整40项SR/AC继续开放。

## 2026-10-24 当前战斗完整姿势样板接续

2026-10-24 人形整帧blit生产路径已接入，同一原帧统一缩放；释放当步保留出手，下一世界步按已接受的moveIntent切整身walk，短步／受击／倒下优先，同一100毫秒时钟、位置插值和暂停冻结保持。新专项5/5、9组原PNG裁切／合成在95／112像素身高共18组RGBA对照一致（排除脚影）；反馈10/10含正式投射物方向回归。S01仍为原单母稿离线网格烘焙PNG，离线小样仅作为接续基线，完整动作样板未完成。qa-frames-08整体failed：763→776、11.06978秒，右普攻774实际命中25，但中心距0.790000079米未满足专项1–1.4米观察带，左动作、施法→走位→短步和斜剑未执行；source/runtime保持、收尾错误0、未录像且窗口关闭。根Agent有限目检右起手／释放，敌我重叠遮挡手掌与剑，尚不能验证其质量。内置imagegen左右各两次共4张六格步态候选均未形成反相支撑腿，已停止并留外部。当前欠完整反相步态、左右攻击收势／连续剑路、左闪避／受击专图与斜向攻击图，swordTrail为空、真实接触光效保留。旧06／07及03／04／05失败按原版本保留；非空buffer原生清理、当前控制存读／旧档／返院、用户视觉／声音认可、Windows、当前包和完整SR/AC继续待验，状态不提升。 详见[70桌面林间首战](design/70-COURTYARD-FIRST-COMBAT.md)。

### 前批动作与受击接续（2026-10-23）

2026-10-23 用户新续接聚焦掌门／山魈动作、命中特效与真实受击僵直，沿55动作库及同一100毫秒世界步实现。命中主事件补稳定编号、时步、双方身份、真实入射方向／接触点、伤害／护持／闪避／打断结果；人物提供只读动作阶段。作者试调 T-COMBAT-IMPACT-20261023：轻击僵直2步并保留蓄势，重击3步并取消未释放动作，站稳后保护12步，敌方打断后至少收势6步；已发射物继续，费用／冷却遵循真实释放。规则与相关回归25/25，三个规则模块语法检查通过；特效8种离线夹具重复像素一致且不回写世界。人物／山魈36姿离线检查8/8，已按只读动作阶段接入；388文件runtime-01冻结及6核心文件、规则报告5文件读回一致。macOS源码Electron三段分别通过：正常操作qa-run-01为33项（423→1087、108.629018秒），实际落败qa-defeat-01为3项（763→1333、64.839664秒），左右朝向停稳补帧qa-orientation-02为18项（763→881、42.211894秒）；各段错误0且source/runtime保持，分段证据不记为一次连续运行。补帧只调整检查脚本，251个功能／素材路径与首段一致。根Agent已独立目视最终画面，两份388文件清单仅检查脚本不同；仓库6核心源码及本批素材共40文件SHA与runtime-01一致。掌门左向受击为离线证据、实机受击为右向；完整僵直持续窗以规则证据覆盖，方向实机全矩阵另计。新控制下的存档、旧档入口与返院复验仍暂缓；生产／医庐沿各自来源，完整SR/AC状态保持。 细节与分层证据见[70 桌面林间首战](design/70-COURTYARD-FIRST-COMBAT.md)。

### 前批键鼠操作与分段实机证据

2026-10-23 本轮战斗采用独立林间战场：WASD持续走位，鼠标落点／方向配合1／2／3技能与Space短步，自动攻击仅执行射程内普通攻击，走位和技能由玩家操作。真实投射物碰撞后结算；暂停、模态与原生失焦清输入，后台世界规则保持。本轮直接相关规则28/28及主Agent工程检查通过；正常开局Node术法与自动普攻两条胜利链均只有一次结算，身体释放并恢复谷内行走。macOS源码Electron分段完成移动、原生失焦及后续技能操作：direct-run-01前8项局部通过、direct-run-03原生失焦清键且后台续进5步、direct-run-04后续9项通过（834→972、24.511037秒、错误0）；各段失败与两处界面修复分别保留，不拼作一次连续通过。新控制下的存档、旧档入口与返院复验暂缓。run-04按钮／存读链按历史版本保留。主Agent独立目视最终投射物／护持及此前探索截图，构图、空地脚点、敌预警与技能栏可辨，八个主战斗源码SHA与最终冻结一致；新素材用户美术评看与完整SR/AC另计。 规则、画面与历史证据见[70 桌面林间首战](design/70-COURTYARD-FIRST-COMBAT.md)。战斗QA来源 `/Users/shepard/.codex/tmp/immortal-combat-20261023/preparation-01/sect-save.json`（tick423）独立于上述生产／医庐接续源；各自来源保持。

历史导航更新于 2026-10-20，旧网页退役与发布暂停按 U-156，当前守阵画帧与访客沿路入院按 U-155，开局按 U-153/U-154，工程目录按 U-152。先读 [AGENTS.md](../AGENTS.md)，核对工作区、当前分支和未提交差异。本文负责当前导航；规则由设计规格定义，实际完成范围由 [STATUS](design/STATUS.md) 与 [需求台账](requirements/registry.json) 记录。

## 2026-10-20 历史接续记录：生活与首段筹资

以下保留living/funding/recover当时的状态、结论和失败证据；当前来源与完成范围以本文首段及69最新记录为准。

2026-10-20当时批次见[69 六居民生活与西谷生产](design/69-SIX-RESIDENTS-AND-WORKSHOPS-ACCEPTANCE.md)。living-04从living-03原生停点继续并通过：顾听澜在tick191090实际使用床1；裴照雪tick191170完成床4入住，191171观测为executing。掌门真实采粮368于191593取得16份，运输369于191626送入公库；192000日结5位门人均supplied且starvation=0。实测118.716135秒，原生暂停与关闭重开完整世界相等，来源及运行文件散列不变，错误0。

裴照雪继承的非法脚点在实际运行tick191090从(123.5,45)恢复至(123.5,45.1)，原活动、起始tick和床4预约继续；恢复后按严格身体、门槛与道路判据检查。living-03失败及原始快照继续保留。funding-01已在tick192003通过正式院务页领取三项既有奖励（260灵石、60木、40石、25草、40粮），并精确原生重开。随后renderer不响应，本段725.897205秒以failed保留；STOP未完成暂停保存，SIGTERM未退出后仅QA Electron树被SIGKILL。最后脚本观察为192200，当时保全的可恢复来源为`/Volumes/Media/immortal-qa/sol-production-20261020/funding-01/native-preserved-while-waiting.json`，tick192063，SHA `cf63afd0879a0669f46d3724adb3e27204e770433d0616612af6fc9367b93430`，manualPause=false、HOME食粮64。未落盘尾段时长及最终实际tick未知，不算连续成功。living-04既有通过保留；截至funding-01停机时，GC25/26正常筹料营建、纸胎实收和四段成药回库尚未完成；GC21–23仅布局候选，完整SR/AC保持。旧自动化继续PAUSED，本批按当前用户授权串行执行。

recover-01已从保全的原生192063运行态通过公开暂停按钮自然推进5步至192068，暂停保存及精确关闭重开通过；实测25.840198秒，来源和运行散列保持、错误0。当时接续启动档为`/Volumes/Media/immortal-qa/sol-production-20261020/recover-01/world/sect-save.json`，tick192068，SHA `796a659e63472a706606271077f0c77752d98421d46b8afec8d1bfbb8690f984`，manualPause=true。原report的sourceManualPause=null为字段误读，独立metadata-correction.json绑定原source哈希并校正为false，原报告保持。funding-01失败与未知未落盘尾段证据继续保留；截至recover-01停点，GC25/26正常筹料营建与生产待接续，完整SR/AC状态保持。

以下为上一求见批次的冻结来源与时间账，保留其原范围；当前源以上文为准。

此前2026-10-20求见批次：求见链已收口到merchant-harvest-01，自动化PAUSED，不再实跑。最终五门人：陆知微、林长风、陆清和、顾听澜(iv73)、裴照雪(iv75)；73/75床位仍pending，不称入住。最终native tick189867、SHA `e76e9dd8a5c9642e50fff100febadb04c49f2b0dbc11e87ad662cb9bff2218e6`、HOME food16、carried0、food source304。366采food16@189831，367 delivered16@189858。完整41.400066秒、later370.287718、sumMeasured2777.050227、currentChainLB2854.560517、floor2874.609517、7 IDs；unknownTail/overallExact为null，前者是feed01尾段未知，不是无缺口。190800日结、床位与持续供粮未验；完整SR/AC不提升。

该批停点为merchant-harvest-01原生：`/Volumes/Media/immortal/.qa-dsh-parallel/15-funding/runs/merchant-harvest-01/world/sect-save.json`，tick189867，SHA `e76e9dd8a5c9642e50fff100febadb04c49f2b0dbc11e87ad662cb9bff2218e6`，paused。5门人在册；HOME food16、carried0、food source304；73/75 beds pending。完整段41.400066秒，later370.287718，currentChainLB2854.560517，floor2874.609517；unknownTail/overallExact=null。历史更正：recovery-04失败人是陆知微`person:lu-zhiwei`，非陆清和；transport351的food18属于recovery-06最终源并在recovery-06完成，不是run07新增；run07新增352/6@178180、353/8@178436，HOME30→44。旧失败/停点report原样保留。下段171973为GC03历史最终源。 v9交接：`.qa-dsh-parallel/08-provenance/handoff-merchant-harvest-01.json` SHA `1a6d4b52ccca4dc44191235b6de4b14b4a3f5cbf7580b4a63fcfcf400418cf61`；`ledger-v9-merchant-harvest-01.json` SHA `23ae57dc1ef91f1f7e1fdc421629f9d75ff27f1e6e5cf55badec30e647e328d2`；MD `handoff-merchant-harvest-01.md` SHA `f4f63d479d8cb0a1179e08c392d9f5ebaff3c8913ff045a6c6550349eefc67e2`；30绑定0不符。 本轮交付检查：npm test 408/408、fail 0；npm run check 通过；requirements refresh/validate 通过（40/200/120，acyclic）；自动化保持 PAUSED，需用户显式新的 resuming 授权才可继续。

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

默认239/239及32项直接专项为住宅冻结版本既有证据；道路run02的9/9和最终代码道路run03的中断各保留范围。[62膳房与医庐](design/62-EAST-SERVICES-INTEGRATION.md)的31个选定文件已逐项校验SHA并接入主工程，GC13/14正式建位、有限洁水采购、实际炊事/用膳/诊疗及界面已实现。主工程检查通过；默认277项中276通过，1项目录旧数量预期已更新并单独5/5复验。经营14项及独立复核3项通过。住宅最终档经39条公开命令筹足膳房与炊食材料，同源macOS源码Electron营建、购水和用膳链已按62§12完成；医庐正常营建与一次桌面疗程已按62§14完成。整体25项设施/31处建位、升级画层、Windows、安装包和完整SR/AC保持接续。

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
