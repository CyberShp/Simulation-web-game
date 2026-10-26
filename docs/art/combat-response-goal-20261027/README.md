# 单人战斗响应与动作收口

本轮工作预算为北京时间2026-10-27约00:36至06:36，最后一小时停止扩功能并收口。对应SR-XF-007、SR-XF-013、SR-XF-029及73的正式实时战斗范围，遵守05身份/世界步/结果契约与U-172针对性验证。

## 目标与实际证据

1. 同一真实长档、同一1672×941窗口与22米镜头，分别记录输入、世界步、Canvas绘制和rAF。目标常用输入p95≤50ms，无超过100ms的同步阻塞；活动rAF p95≤20ms，无超过100ms尖峰。正式后台活动持续，不能通过减少人物、暂停世界或改变碰撞精度达标。
2. 复用整帧素材，查看四向移动、松键停步、移动攻击、Q释放后移动/闪避、受击与倒地的实际画面。规则位移、选帧名称与实际像素分别验证。
3. 直接回归胜利、败退、主动撤离、同一掌门返院及已受影响的既有入口。必要的兼容与存读证明保留，不扩大存档功能。
4. 更新制作记录、需求台账与接手导航，保留失败和未达标项目。无提交、推送、发布或演示录像。

## 05:32最终源码冻结

正式spatial已精确接入`c95c8610107d4d24f470b1a855ea36372f73488bd9d09b6fcbd79b6ca32a8ae0`，domain022bdc、ground3f3d、presentation894及整帧源码保持。仅在完整有序房间几何与五项地形开关相同时复用纯线段布尔结果；原对象局部缓存优先，公开route仅严格`indoor===true`具备共享资格，保留原判定、动态碰撞及门禁。主Agent已独立核对产品与候选逐字相同。

候选修正版900步的266160/266330完整session及92,269,748字节路径与冻结对照逐字相同，主独立三次cmp均exit0；14项专属隔离、30项相邻测试及7类路径对照通过，接入后44项全过。证据位于`combat-world-step-20261027-v001/rest-switch-profile/equivalent-room-segments/final-validation.json`和`product-freeze.json`。先前13a0隔离查询回放约省6–7ms仅为局部测量，最终c95c性能以以下原生结果为准。

正式同120人物/5后台活动、1672×941窗口、22米镜头，两轮各90秒无profile/响应注入复测成立。证据目录均位于`/Volumes/Media/immortal-qa/combat-final-native-20261027/final-freeze-02/`，独立汇总为`equivalent-rooms-summary.json`，以下保留两轮原峰：

| c95c长档 | 输入p95 / 最大 | 活动rAF p95 / 最大 | 实际帧回调最大 | 世界步最大 | 绘制最大 |
| --- | --- | --- | --- | --- | --- |
| equivalent-rooms-lean-01，90.101秒/901tick | 35.7 / 40.7ms | 6.0 / 90.1ms | 96.4ms | 94.4ms | 14.4ms |
| equivalent-rooms-lean-02，90.056秒/901tick | 37.8 / 44.3ms | 6.1 / 91.0ms | 98.2ms | 93.2ms | 12.6ms |

两轮各94输入边沿，观察器最大均0.5ms；原120人物身份及5后台活动保持，正式新增第121人事实保留，均未提前终局。两轮源档/运行散列保持、错误为空、正常关闭；主已独立读取报告并比较磁盘世界state与最终快照，均一致。仅本场景的输入与活动帧目标两轮通过；最慢回调仍距100ms仅1.8ms，不能推为全场景、Windows或物理显示帧率保证。暂停及检查边界的原始间隔仍在报告中。

新同版`equivalent-rooms-normal-01`9项、`defeat-01`5项、`retreat-01`6项通过，同一掌门经真实出口与旅行返院分别794→973、746→915、764→858tick，伤势约6.993%、100%、0%。三场均正常关闭、源档/运行散列保持、错误为空。主已读取三场报告，亲看胜利山魈0HP侧卧与败退掌门0HP侧卧实际像素；音效为正式cue到WebAudio的自动化证据，听感仍待真人判断。

最终五场完整运行文件映射相同，和旧七场仅spatial一项不同；主独立四次完整映射cmp及五场磁盘世界state比较均exit0。两长档峰均266159→266160，附近±500ms无输入或检查调用，活动帧均在前台；5后台人物各累计真实位移约19.49/87.71/87.50/81.39/83.25米。原人物身份零差异，新增徐闻溪来源、出发与到达事实在落盘状态保留。主独立14项专项测试和`npm run check`通过；保存一致证据不替代重开加载验收。

下方七场完整画面与结局证据对应此前spatialcd477版本；战斗与整帧源码未变，其四向、停步、移动攻击、重击接闪避、受击、暂停恢复像素证据保留各自版本范围。05:36起只做冻结验证与记录，06:36截止保持。全部方向素材库、Windows、音效听感与完整SR/AC仍开放；后续建议单列纵向受击/倒地素材与Windows真实运行验收。

## 04:55版本回归

当前产品保持domain022bdc、spatialcd477、ground3f3d、presentation894、sampler be81/data98ac。完整证据在`/Volumes/Media/immortal-qa/combat-final-native-20261027/final-freeze-02/batch-summary.json`和`screenshot-index.json`。五场764份完整运行文件映射一致，主Agent独立比较成立；各场源档/前后运行散列保持、错误为空、正常关闭，磁盘`.state`等于最终快照`.session.state`。只证明本轮保存，不称重开验收。

| 范围 | 本轮结果 |
| --- | --- |
| 胜利、败退、撤离及返院 | normal12/defeat5/retreat6项通过；真实击杀862tick、胜利返院1028tick；败退746→915，撤离764→858，均同一掌门 |
| 四向、停步与移动攻击 | action8项完成；主看W/S各150/350ms不同跑姿、A/D跑姿、J蓄势→剑气释放→回跑、W/S100ms双脚戒备。normal收步203/206/209无回拉或站姿滑 |
| 重击与闪避、受击与倒地 | normal真实Q三tick锁点、释放后移动和Q/J→Space通过；主看Q→Space接续，未称独立Q起手像素。左右真实受击和双方0HP侧卧末帧已亲看；完整方向素材仍有限 |
| 120人/5后台真实长档 | active90.026秒、265430→266330共900tick，无提前终局；原120身份零差异，5后台活动及正式新增人物事实保留、落盘 |
| 输入 | 94边沿p95 35.7ms、最大38.9ms，Tab最大38.9ms；本项达标，长档未学剑Q为拒绝路径，已学剑Q由normal覆盖 |
| 整屏流畅度 | rAF p95 6.1ms、最大114.7ms，实际回调121.8ms；世界步117.1ms，观察器0.6ms、绘制2.7ms。仍未通过100ms目标，不使用较快旧轮替换 |
| 峰值归属 | 266159→266160单步，附近±500ms无输入、截图或暂停；17,704活动帧均前台 |

本批补验后共63张活动Canvas PNG及6张终局/返院图已核来源散列。主亲看normal25/100ms收步和Q闪避、双方终局、四向/J/受击/纵向站稳，未把输出脚本成功当美术完成。同版本起步/反向/失焦/暂停/墙边界短检查7项通过，普通起步及反向首可见位移4.3–10.4ms、自由移动脚点平台0；主已看25/200ms及反向25ms跑姿。失焦段10ms与墙边停住186.1ms平台单列，不混成自由移动停顿。

暂停恢复补验2项通过：暂停时呈现尚欠0.2475米已确认尾步，恢复后依203/206/209整帧收步，回拉0、站姿滑0，100/200ms稳定idle。主已读轨迹并亲看25/100ms实际像素。两短probe也保持完整runtime及保存世界state，更新索引现覆盖同冻结版七场，全部正常关闭。旧字段`maximumDisplayLeadMeters`是呈现与权威脚点的无符号距离，不应解释为提前位移。上述局部响应通过仍不关闭117.1ms世界步尖峰。

## 本轮起点

`main`，HEAD `4a7bd32d8a9413723691df08aeb0528ac73e2640`。当前工作区含上一批战斗整帧接入及其他会话的经营、地面查询、面板响应增量，全部保留。新增95的地面查询与院务响应证据需纳入当前复测，不能把上轮127.1ms自动当作当前基线。

可追溯实档为 `combat-native-party-20261025/solo-01/forest-approach.json` 的session，120人物、5后台设施活动；上一批衍生QA初始档为 `/Volumes/Media/immortal-qa/combat-long-save-perf-20261026/native-source-265430-v001/sect-save.json`。既有native-short-02显示Tab264.1ms、世界步127.1ms、活动rAF125ms。以上为旧版本证据，本轮先复测再判断。

上一批已修释放后恢复期选帧，movement-diagnostic-03有17张实际活动像素。移动启动存在约75–90ms呈现停顿的定位线索，须核对实际脚点和时钟。完整方向和倒地仍有素材缺口，不以规则测试通过代替。

## 分工与文件边界

- 主Agent：范围、视觉判断、结果复核及记录。
- motion_verify：世界步热点，只读当前并行空间改动后提出最小文件范围，保留几何与完整世界等价。
- formal_combat_qa：Tab命令路径，限定sect-combat、sect-sim与ea-opening-sim相关部分；维护独立原生验证器，运行统一串行。
- art_scope_audit：combat presentation、新整帧sampler与study actor的移动时钟和动作接缝；保留弹道插值与现有整帧。

全部代码/脚本Agent使用GPT-6.1-sol xhigh。共享文档在每批实际证据成立后最小追加；不得改其他会话的完成口径或覆盖其源码。

## 第一批局部证据（仍在执行）

- 选敌：`/Volumes/Media/immortal-qa/combat-long-save-perf-20261026/native-target-01/report.json`。同一120人物长档，暂停与运行各20次Tab、5次清选，输入p95分别26.8ms与22.6ms；50次目标结果正确。源档未改、窗口正常关闭、运行文件未漂移。世界步仍124.3ms、活动rAF最大120.3ms，整屏目标尚未成立。
- 起步：`/Volumes/Media/immortal-qa/combat-sword-study-native-20261026/startup-native-01/report.json`。7项原生检查、15张活动像素；主Agent查看25ms与200ms截图，确有不同跑姿。非墙移动首可见位移3.1–10ms，约5ms采样下未观察到起步脚点平台；墙边停住单列。此为小场景，不能替代长档流畅度验证。松键后的呈现位置回归尚需单独检查。
- 倒地：主Agent查看`/Volumes/Media/immortal-qa/combat-sword-study-motion-20261027-v001/down-candidate-contact.png`。旧素材浅青繁纹宽袖、金色绑带挂坠和大体积散发，与当前深蓝简服、束发、素白袖口不一致，未接入。当前整帧倒地缺口保留，不能用站姿宣称倒地完成。
- 后续：修复闪避尾段重复起帧，验证世界步局部优化的几何及完整世界等价，再以冻结版本执行长档原生复测。

## 第二批定位与候选

- 闪避sampler已改用正式`dodgePath.startedTick/durationTicks`贯穿释放与恢复，落地后保持末帧；主Agent独立运行动作时钟与镜头夹具共15项通过。实际Q/普攻接Space像素验证待最终冻结批次。
- 松键缺陷成立：`startup-native-01`实际rAF轨迹中，包含下一帧补结旧路径的峰值后，D与A分别回拉0.165m/0.279409m，约12.54/21.24px。第一版起步修复仍须调整，不能把起步无停顿外推为停步合格。只追真实位置的候选内存重放消除了这两段回拉，但停止呈现尚需检查。
- 地形候选：`/Volumes/Media/immortal-qa/combat-world-step-20261027-v001/north-terrain-proof-v001/report.json`。仅当单个不可变多边形覆盖完整小格及身体余量时提前返回；其余保留原16点与实时冥想区分支。三对同模块Node对照中，冷265440步280.01–285.91ms降至233.61–237.23ms；热路径无稳定改善。12份最终session及各步活动/路径逐字一致，非归属区域字节不变。主Agent独立复跑12项几何测试通过。此处不代表原生帧间隔已达标。

## 04:22最新性能复测（尚未完成）

`/Volumes/Media/immortal-qa/combat-final-native-20261027/astar-cost-lean-01/report.json`与`peak-attribution.json`记录spatial cd477版正式无注入复测：90.084秒/901tick，94输入p95 37.1ms/最大42.5ms，活动rAF p95 6ms/最大109.6ms、实际回调118.8ms，世界步112.8ms、观察器0.5ms、绘制2.3ms。原120身份及5后台活动保持，17,709活动帧均前台，源档和前后运行散列保持、错误为空、窗口正常关闭。主Agent已读报告与峰值：仍为266159→266160单步，附近±500ms无输入、截图或暂停。性能目标仍未通过；132.1→112.8ms是两轮同场景观测，不是精确输入tick重放或稳定收益承诺。

相较下方04:03批次仅spatial改变。三结局/动作保留原版本范围，战斗与帧源码保持；另由900步完整状态和路径等价验证A*调整，不将旧五场改称当前完整runtime验收。

主Agent另以排序JSON流独立cmp磁盘`world/sect-save.json`的`.state`与`final-world.json`的`.session.state`，完全相等；关闭生命周期记录包含close-requested/closed。该证据只确认本轮关闭保存的世界状态，不称重开验收；磁盘另含桌面呈现元数据，不称整文件相等。当前文档/台账refresh、validate及npm run check通过，40 SR/200任务/120 AC状态保持。

## 04:03收口检查表（后续性能见上方，尚未完成）

| 要求 | 当前证据与待办 |
| --- | --- |
| 真实长档120人物、5后台活动持续 | final-long-lean-01无注入90.019秒/900tick，原120身份外观、5后台活动推进及正常求师新增来源成立。旧固定人数断言failed保留，未冻结世界来迎合断言 |
| 常用输入p95≤50ms、无>100ms同步阻塞 | 本版94输入边沿p95为35.2ms、最大40.5ms，Tab最大37ms；按键达标，但世界步132.1ms仍有超过100ms同步阻塞。长档Q为原未学剑角色拒绝，已学剑Q由同版final-normal-02覆盖 |
| 活动rAF p95≤20ms、无>100ms尖峰 | 本版rAF p95为6.1ms、最大124.9ms，实际回调最大133.1ms，世界步132.1ms，观察器0.6ms、绘制2.8ms；不合格。17,728活动帧均在前台；慢步附近无输入、截图或暂停，仍为266159→266160 |
| 四向完整帧移动、停步、移动攻击 | 同版final-action-pixels-01八项检查完成，主亲看W/S各两张不同跑姿、A/D跑姿、J蓄势/释放/回跑和左stop206；final-normal-02侧停步无回拉及站姿滑。vertical-down-02的894尾步→双脚戒备与固定落点证据保留 |
| Q释放后移动与闪避接续 | 同版final-normal-02的Q三tick锁点、释放后移动、Q→Space/J→Space完整两tick时钟通过，主已看中段及末段实际像素 |
| 受击、倒地实际画面 | 同版final-action-pixels-01左右真实受击整帧已亲看；final-defeat-02为0HP侧卧，主已看图。894版vertical-down-02另有真实倒地0/151.9/300ms跪/撑/卧。独立上下受击/倒地素材未齐，不能称完整方向动作库 |
| 胜利、败退、撤离、同一掌门返院 | 同版final-normal-02 12项、final-defeat-02 5项、final-retreat-01 6项通过，三窗口正常关闭、源档/运行散列保持；normal胜利像素采用0HP的terminal-pose，非HUD仍为8HP的早期combat-result |
| 身份、存档与并行修改保留 | 本版五场QA源档/运行散列保持且全部关闭，完整runtimeBefore映射相同；900步完整session/路径逐字等价，主独立cmp；未改持久层，未提交推送发布 |
| 制作、需求、接手记录 | 本文、倒地提示词、registry、STATUS与接手导航已追加分批证据，refresh/validate通过；完整SR/AC状态不变，最终收口继续更新 |

## 并行采样协调

已从会话`01a17881-f072-7380-bef8-f0c803c6e32b`读取用户“允许协调修改范围和测试时段”的明确回复。北京时间01:10–01:35由该会话独占本机原生及重CPU采样，本会话继续轻量编辑和静态审查。其`northYieldGroundPoint`/索引cellSize、南院地面缓存及身体线段中心证明与本会话的`northWalkPointOpen`/北阁地形完整框证明分段持有；禁止整文件覆盖。完成后以含双方改动的冻结运行版本验正式战斗。当前96及施工恢复改动继续保留。

后续经明确协调延至01:45：隔壁静态复核发现非number坐标可能在写入Float64缓存后丢失类型，需补缓存写入守卫并固定版本重测；主Agent允许其只给本会话`northWalkPointOpen`增加该守卫，其他片段不变。当前北阁身体框证明入口已用`Number.isFinite`分别校验两坐标和radius，helper没有旁路。双方等待明确交还，不以时间到点自行撞测。

## 单项素材缺口补齐

确认现有同身份原sheet均没有掌门倒地姿势后，主Agent仅生成一张三姿势候选，并实际查看身份、服饰与姿势。来源、完整提示词、初步判断见[player-down-prompt.md](player-down-prompt.md)。源已保存在`assets/courtyard/combat-sword-study-v1/source/player-down-v001.png`，与生成原文件字节一致；等尺度联系图、根点、提取及正式败退画面尚待验证。该候选不能提前关闭上表的倒地项。

后续已完成同H650等尺度选择及正式三帧注册；主Agent查看`/Volumes/Media/immortal-qa/combat-final-native-20261027/defeat-01/terminal-pose.png`确认侧卧姿势、身份与比例，实际失败返院5项通过。早期`combat-result.png`在终局边界抓到跪姿但HUD仍为上一更新的1HP，不能当作最终0HP证据；13tick后的terminal-pose显示0HP与侧卧。当前完整81帧、原12份兽alpha mask保持，单元/相邻56项通过；这不等于所有方向素材齐全。

四场证据根：`/Volumes/Media/immortal-qa/combat-final-native-20261027/`。三终局通过，90秒长档failed原报告保留。长档源与运行散列不变、窗口正常关闭；`person:yunxiu:120`的正式来源事实为`fact:courtyard-seeker:person:yunxiu:120:source`，266173生成、266280到达。性能问题仍在处理，目标未完成。01:55已明确将重测时段交回经营会话进行其7–10分钟最终验证，本会话仅只读归因及轻量编辑，等待明确交还。

## 暂停恢复与长档复测准备

恢复补丁随后完成正式`resume-01`复核：D仍按住、画面仍为run时Esc暂停并清键，暂停期间keyup，恢复时没有held输入。完整轨迹出现stop203/206/209，反向位移0、idle滑动0；25ms抓到stop203、60ms脚点已落稳且为stop209，100/200ms稳定idle。主Agent实际查看25/100ms图，并独立运行动作时钟与收步15项全部通过。报告两项检查通过、状态observed，源/运行散列未变且正常关闭。

经营会话02:04明确交还采样时段，三份共享空间源码保持其最终冻结版本。02:11继续沿用06:36截止，不重计六小时。

暂停前正在跑动、暂停清键后恢复的纯呈现复现中，权威位置始终为12.33，旧呈现以idle从12.18750滑到12.33，约10.83px。最小修复复用侧向stop203→206→209：恢复0/20/40ms分别显示三段收步，40ms抵达权威位置，60ms才进入idle；相应37项通过。证据为`combat-sword-study-motion-20261027-v001/resume-tail-before.json`与`resume-tail-after.json`。最后presentation散列前后缀为`56604808…78edc745`，原生恢复复核待做。

长档最慢世界步为266159→266160，151.8ms；同一步陆知微、陆清和、顾听澜新建返床活动，恰逢一天0.8相位转入夜休。这是定位线索，尚未通过CPU采样归因。300ms rAF间隔期间世界泵仍推进，不能把它直接算在该慢步或异步存档上。

下一轮同源90秒采用轻量观察：每rAF保留原始时钟、回调入口/结束、观察开销、焦点与可见性；完整语义仅在世界tick变化和输入边界采样。原120人物身份、5后台活动推进与新增人物正式来源事实分别核验。保留全部原始尖峰与旧failed报告，不从总耗时扣除观察器成本来宣称流畅。

`combat-final-native-20261027/long-lean-01/report.json`随后完成90.0529秒、900tick测量，状态`observed`表示采样完成。源档、运行散列未变，正常关闭，错误为空；原120身份与5后台活动以及新增求师三事实核验通过。94条输入边沿p95为34.9ms、最大40.1ms，各类均低于50ms。活动rAF p95为6.1ms、最大140.7ms，实际回调入口间隔最大144.4ms，世界泵最大142.8ms；观察器最大0.5ms、绘制最大2.3ms。本轮仍未通过100ms尖峰门，不能仅以观察开销下降宣布流畅。focus事件仅记录初始可见/聚焦/hostActive为true，逐帧状态待核。下一步使用正式原生窄窗口CPU采样定位慢步；旧输入trace缺少每200ms续租的正式combat-input请求，不能声称已能精确重放完整世界。

独立`rest-switch-native-01`同源采样已正常关闭，源/运行散列保持，错误和关闭错误均为空。仅在266150–266170附近启用CPU profiler，实际开始确认266151、停止266170，完整2471样本保存在`combat-world-step-20261027-v001/rest-switch-profile/native-window-01/window.cpuprofile`。确切单步266159→266160再次耗时151.1ms；该轮用于调用栈诊断，不作为性能门通过。归因分析进行中。文档refresh/validate通过，主Agent随后运行`npm run check`通过；40项SR、200任务、120 AC状态保持。

QA随后逐帧核对lean的17,745个active样本，全部visible/hasFocus/hostActive为true，无切后台记录。完整观察文件仍为64,535,703字节，含901个tick快照、188个输入前后快照及上限12,000条drawImage记录，不能称为零开销。lean/resume/profile三轮运行散列完全相同；旧rich轮与它们还差最后presentation恢复补丁，因此300→140.7ms不能只归因于观察器变化。当前仍以lean实测超过100ms判未达标。

CPU归因：`rest-switch-profile/analysis/caller-breakdown.json`中，保守确定属于慢步的197样本有172经`lifeFacility`，16经`prepareFacilityActivity`；165样本明确为`lifeFacility → chooseResidentialBed → availability → routeReachable → pathExists → scenicFindPath`。主Agent已读调用链与相应源码。页面与CDP时钟对齐有6.7ms边界区间，样本份额不等于精确独占毫秒。两处`pathExists`在V8树中合并，当前证据不能分清重连旧origin和目标床位证明；下一步仅QA模块响应注入分支计时，不修改产品可达算法或几何规则。

`route-branch-native-01`随后完成独立QA模块响应注入，正常关闭、错误为空。实际一次HTTP响应原1729字节、SHA`25a03f…fcac`，交付2479字节、SHA`bc18c8…ed03`，磁盘产品未改；磁盘散列保持不表示实际模块字节相同。266160的四次记录分别为陆知微target 91.6ms、陆清和join-origin 31.1ms、顾听澜join-origin 1.3ms、裴照雪join-origin 0.9ms，均返回true且无throw。主Agent已读完整记录与响应账本。首要成本是陆知微从(-17.1,29.2)到(24.95,7)的目标路径证明，不能将全部成本归为重连旧origin。

动作证据范围补核：normal/defeat/retreat-01采用恢复补丁前的`a98e5c5d…`presentation；随后`56604808…`已验恢复收步。两阶段sampler均为`b3a7b11a…`，data均为`26ee0a5e…`，不同于后续894阶段的`be81f9cc…`/`98ac47c8…`。旧`moving-attack.png`元数据为idle/action03，故其文件名不作为出剑姿势证明；J正式命令/弹体结果保留原范围。四向、移动release及左右真实hit补查见后续action-pixels-01。

`action-pixels-01`随后在566版本完成20.37秒原生检查，8项通过，窗口关闭、源与运行散列保持。主Agent亲看W/S各两张不同跑姿、左右跑姿、J蓄势/释放/回跑、左右受击各两张及左stop206。真实J脚点继续推进，release两时点使用同一整帧，未称为两个不同姿态；两次正式敌击分别使HP143→133→123，左右镜像符合朝向。

主Agent同时发现上下停步缺陷：W/S松键25ms仍有约0.12/0.107米尾差，却已选idle；100ms抵达后仍使用player05/09的悬腿跑姿。该组上下停步只采集、未判通过。已亲看现有cast07/cast11，选择其双脚落地的正背剑指戒备作为待机候选；尾差完成前继续原方向整帧跑步，落稳后进入戒备。此修复待当前性能冻结轮完成后单独实现，无新图生成。

南院地面仅新增保守AABB预筛，范围内仍原inPolygon，原typed cache/corridor/north及采样间距保持。`south-aabb-candidate`冻结对照：14,519点及异常输入零差异；目标冷路线三对85.35→71.32、91.40→71.95、89.06→69.73ms，第二路线有退化样本，未声称稳定获益。20项相关测试通过，主Agent独立复跑3项原算法oracle通过。base/candidate各900正式步至266330，两个完整session检查点及900步路径trace全部逐字一致；这不是原90秒输入重放。产品ground SHA为`3f3d6740702f29a47cb161c6149d5d853fd78e0773d4799b3dd8725653546697`，原生无注入长档复测进行中。

`long-aabb-01`无注入原生随后完成90.0766秒/901tick，正常关闭且源/运行散列保持。94输入边沿p95为37.6ms、最大42.2ms；活动rAF p95为6.1ms、最大135ms，实际回调最大143.2ms，世界步最大138.6ms仍在266160，观察器0.5ms、绘制2.4ms。全程前台可见，原身份/后台/正常新增证明通过。该结果未达100ms尖峰目标，Node局部收益不能替代正式表现。继续同源分支探针，分别看目标证明、旧origin重连及wrapper之外的剩余耗时。

上下收步窄修已冻结：`idleByDirection`复用cast07/11，纵向已确认尾差完成前维持原run循环与方向，到位才进入戒备；暂停清键恢复、新键及技能/受击优先均覆盖，不改物理位移和PNG。首轮发现新方向只写direction未同步呈现moveIntent，已修并保持旧profile行为。62项相关测试通过，主Agent独立复跑15项动作/收步及5项纵向专项通过。presentation新SHA为`8941177253263ce42207be12f915e1d1129b898a75ae7e2cccd8b7729aae0b45`；正式纵向尾步、戒备和倒地中段像素复核待做。builder同步，避免重新生成元数据恢复旧idle选帧。

`route-branch-aabb-01`正式诊断总pump137.8ms，目标查询87.6ms，三次join合32.2ms，pathExists总119.8ms，未覆盖的scenicSweep与其余世界工作残差18.0ms；不能把该残差归为绘制。四条查询参数/返回值与前轮相同，磁盘及实际注入模块分别记账，正常关闭。

`vertical-down-02`在894版本完成4项正式检查，源/运行散列保持、窗口正常关闭。主Agent亲看W/S松键25ms仍为原方向跑姿、100ms双脚戒备，100→200ms脚点保持；实际落点误差约1e-8米。真实敌击使预置1HP掌门倒地，canonical downedTick=780，0/151.9/300ms分别抓到down00/01/02，主Agent已看跪/撑/卧三张活动PNG，身份与比例成立。初轮01将cast07误写player07而提前failed，保留；02普通W/S元数据的downedTick误用了普通motion.startedTick，只是采集字段错误，不是倒地事实，后续harness已限制仅down状态回填。真正倒地三条均为780并有canonical核对。

内部格预判实验：对南院单多边形完整覆盖的16px格作positive证明，岩石/边界/407楼梯门槛均保留原fallback。30,314点零差异、21项相关通过、900步完整世界/路径逐字一致，启动预计算约2.14–3.28ms，表6,195字节。候选产品1988版本的`long-positive-01`无注入正式90.070秒/901tick仍见世界步135.8ms、rAF129.9ms/实际回调136.8ms，首冷78.8ms、输入最大39.5ms。相对AABB版138.6ms没有明确实质收益，部分冷步变慢；未达标。

因此仅撤回本次positive新增import、初始化块及early return，ground恢复完整AABB基线SHA`3f3d6740702f29a47cb161c6149d5d853fd78e0773d4799b3dd8725653546697`，其它并行修改、测试及失败/候选证据保留。下一步先在QA统计visibleBodyAt的精确重复查询比例，再判断整体结果缓存是否值得实验，不直接追加产品缓存。

精确重复查询仅约一成，整体结果缓存未接入。随后4m房间候选预筛仅在QA实验：候选数下降98.48%/97.52%，三对target冷路线76.21→76.12、71.17→74.44、68.62→68.72ms，join仅改善2.5%–5.3%，未达15%收益门槛，停止。两路线冷暖路径及六轮查询前后完整session相同；未进一步跑900步或原生，也未修改产品。该结果仅否决本次索引方案，不能据此断言原房间扫描没有成本。证据为`rest-switch-profile/room-candidates/README.md`、`comparison.json`和`counts.json`。当前转向3f3d/43bc/894正式版本的窄CPU复采，避免继续依据旧栈猜优化。

`rest-switch-current-01`随后在3f3d地面、43bc空间及894呈现版本采样，正常关闭、源/运行散列保持、错误为空。266159→266160仍耗142.0ms；仅266150–170附近启用profiler，完整2487样本另存`native-window-current-01/window.cpuprofile`。时钟偏移交集宽5.6ms，确定属于慢步的186样本中178经正式step、167经meterFindPath；northLibraryYieldPointClear self为16、inclusive为50。主Agent已读报告、归因与当前源码；采样比例不换算成精确独占毫秒，也不作为无诊断性能验收。当前只在QA比较固定有限格的懒计算Uint8表与原字符串Map，地面谓词、身体采样和世界活动保持。

北侧62,805字节懒表候选随后淘汰：44,072项边界/异常/重复正负对照零差异，但三对target冷路线73.22→78.74、69.33→64.50、70.87→74.84ms，无稳定收益；join变化也仅约±1.5%。冷暖路径及六轮完整session保持，未再跑900步或原生，产品domain仍为e22aed版本。证据见`rest-switch-profile/north-yield-cell-typed/`。当前停止此类换键微优化，静态评估严格整段几何证明是否能省去大批肯定合法的样点；同时串行回归894正式版三结局与Q/Space接续。

894版`final-normal-01`失败保留：侧停步、移动J、Q锁点释放后移动/Space与J/Space整段时钟通过，后续连续普通攻击结束仍为active而非won。窗口正常关闭，源/运行散列保持。主Agent实际看stop25/100、Q闪避中段、J闪避末段及failure图；失败图中瞄准虚线朝西北、敌人在东南底部HUD附近，输入与脚本取点原因待核，不能称最终胜利回归通过。

同版`final-defeat-01`5项通过，主Agent已读报告并查看terminal-pose：正式敌击在746tick造成1→0HP、伤势100%，唯一lost事实成立，同一掌门经实际出口/旅程在915tick返院；侧卧尺度与0HP画面相符。源/运行散列保持，错误为空，窗口正常关闭。

`final-normal-01`失败归因随后由原始输入记录确认：JSpace检查在等待冷却前按住W，共持续3.089秒，使玩家y22.4365→12.2065；胜利阶段30次脚本aim-css都未更新实际pointer，pointer始终inside:false，攻击沿用旧2技能的西北目标。源码仅Canvas pointermove更新瞄点；截图中敌人躯干位于HUD下，与遮挡解释相符，旧轮未采elementFromPoint，不能称直接DOM取证。只修harness的冷却等待顺序和可见alpha瞄点检查；全遮挡/超射程时沿正式WASD走近，不增加30次攻击上限、不写HP或成功结果、不改产品规则。该失败与后续重跑分开保存。

整段证明的QA覆盖统计改变了下一步选择：最终输出路径不足以估计A*内部试探成本。target实际段内50,451次north调用中，35,236次可由单一不可变多边形完整覆盖整段框及身体余量证明；其中复杂范围内33,320/39,275次（84.84%）可省，原north判定无矛盾。join复杂范围仅38/2,371次（1.60%），不预期普遍提速。仅将该north谓词提升到段级证明，south/east/internal/continuous及所有原样点保持；未证明的段回原逐点判定，无新缓存、无capsule算法。

`north-predicate-hoist/comparison.json`的三对同模块冷路线target减少8.4–12.3ms（12.2%–17.0%），join无稳定收益，冷暖路径和六轮完整查询session相同。主Agent已读完整候选diff及比较报告，批准先验边界和900步再进入产品；没有将局部收益写成原生达标。随后QA对2,243个真实miss段重放，1,631个proven段的44,972中心/偏移样点全部符合原north判定，另5,080边界、48异常/±1024/巨大值及真实union接缝fallback通过。完整世界与正式原生复测继续。

约03:57整段证明批次冻结：domain SHA `022bdc073dee8eb3221b1dcc8de1d1c9c2794b69e099e06dedc310ef79ff9f50`、spatial SHA `cb8538aca27d9ce0a502eaf7be57b57102f7a7037f381e7b348f628e0c8c5782`，ground仍3f3d、presentation894、sampler be81/data98ac。仅精确增加helper/import/north flag，原院及隔壁恢复增量保留。新增`courtyard-north-yield-segment-proof.test.mjs`4项及相邻共31项通过，主Agent独立4项与diff check通过；900步两份完整session（266160/266330）及92,269,748字节路径trace由主Agent独立cmp均相同。该900步不含原生输入重放。随后同冻结版串行运行三结局、完整动作像素及90秒长档；原先138.6ms属于段级证明加入前的版本，不冒充本版性能结论。

同版五场完成，索引`combat-final-native-20261027/final-batch-01.json`。主Agent独立比较五份完整runtimeBefore映射，逐键相同；各自源档、前后运行散列保持，错误为空、窗口全部关闭。final-normal-02 12项通过，862tick真实击杀、1025tick同掌门返院；主已看0HP山魈侧卧的terminal-pose，combat-result仍为刷新前8HP故不作最终视觉证据。final-defeat-02 5项、final-retreat-01 6项通过，主已读真实受击/唯一结果/实际旅程和0HP掌门侧卧。

final-action-pixels-01状态observed、8项检查完成；主亲看W/S各两张不同跑姿、A/D跑姿、J的player00蓄势→player02释放→run058回跑、左右action04/05受击及左stop206。J呈现脚点12.33→12.99→13.31米，出手期间移动成立；release+30仍同一player02，不称新增帧。所有图片为活动Canvas拷贝。

final-long-lean-01无profile/模块注入，新增的原生鼠标可见性检查明确计入测试范围。原120身份、5后台推进与正常新增来源成立；265430→266330共900步、实际active90.019秒，未提前终局。94输入边沿p95 35.2ms、最大40.5ms，rAF p95 6.1ms、最大124.9ms/实际回调133.1ms，世界泵132.1ms，观察器0.6ms、绘制2.8ms，性能门仍未通过。17,728活动标量帧全部前台；峰值仍单步266159→266160，附近±500ms无输入边沿、协议截图或暂停。保留原始尖峰，不扣观察开销；上一轮138.6ms与本轮132.1ms不包装成稳定百分比结论。

本批registry/manifest和派生007/013/029已追加实际证据，refresh/validate通过；40 SR/200任务/120 AC状态签名保持，96及其它导航键保留。主随后运行npm run check通过（194模块、656引用、110文档入口），源码/文档diff check通过。下一步仅只读评估同一次同步寻路中的重复roomFrames/spatialRevision计算，当前仍使用上述冻结产品；05:36停止扩功能、06:36截止不变。

04:09，knownRooms复用仅QA比较后停止：target三对61.19→56.29、60.24→63.21、58.33→63.40ms，join仅改善1.7%–3.5%，无稳定实质收益；冷暖路径及六轮完整查询session一致。未改产品、未再跑900步或原生。证据见`rest-switch-profile/known-rooms/comparison.json`。

主Agent随后直接检查A*邻居循环，发现当前先执行昂贵的sweep，再判断新g是否改善已有cost。对无法改善的边，后者原本必定continue；因此下一候选仅将原g表达式及原比较提前到sweep之前，保边界/closed检查、邻居顺序、heap、parents和结束条件。先QA核对纯查询契约、实际省去的检查次数及路径/完整状态等价，未提前写入产品。

`a-star-cost-gate`的独立计数轮显示target sweep1692→825，join646→406，分别省51.24%/37.15%；减少次数恰等于无法改善g而跳过的867/240条边。未带计数的三对冷路线target62.26→43.21、69.27→44.75、63.05→45.18ms，join71.20→56.99、72.14→57.66、71.70→58.09ms。全部冷暖路径字节和六轮完整查询session相同；主Agent完整审过单处顺序调整，未混入已淘汰knownRooms方案。已批准继续900步全状态/路径与相邻可达、失败、窄门和斜边验证，通过后仅精确接入这处顺序调整；当前正式132.1ms结论尚未被新原生证据替代。

04:17该序列已精确接入，spatial SHA `cd477bf14c9d7dde2acb8925e5ed9eaf555a73f17a3472f6285838839144f61b`，domain022bdc、ground3f3d和全部战斗/帧源码保持。新增3项旧控制版路径oracle及相邻共31项通过，主独立复跑3项与diff check通过；7类独立控制/候选查询、900步266160/266330完整session及92,269,748字节路径逐字相同，主独立cmp确认。可达/不可达、同目标、出界、井旁绕行、斜向障碍及不同半径窄室均覆盖。随后仅同源90秒无注入原生性能复测；上批三结局/动作保留原版本范围，不重复声称同一完整runtime hash。

04:29，`rest-switch-profile/a-star-node-clear/`仅QA测试单个展开节点的lazy clear复用：target节点检查772→360，join281→94，零调用节点仍9/8。三对冷路线target43.06→43.19、46.37→42.96、51.62→45.17ms，join57.62→57.36、57.58→57.30、57.70→58.23ms；基线波动下未取得稳定实质收益，停止候选。六轮查询session及全部冷暖路径相同，未跑900步/原生、未改产品。主已读完整diff及比较报告；随后对当前cd477版安排266150–266170窄窗CPU采样，以新热点证据决定下一项，不重复已淘汰roomFrames方案。

`rest-switch-astar-profile-01`当前cd477版本原生窄窗已正常关闭，源档/运行散列保持、错误为空。CPU文件`rest-switch-profile/native-window-astar-01/window.cpuprofile`共2480样本；目标266160单步114.9ms只作带profiler诊断，不替代无采样112.8ms验收。开始/结束页时钟与Profiler时钟对齐交集宽6.1ms，certain149、possible166，certain中GC4/program2保留。`analysis-astar`显示meterFindPath含132样本，主链仍lifeFacility→chooseResidentialBed→routeReachable；coversBox自身9样本，其中5来自段级north证明。样本数不是毫秒。主已读时间锚、调用分布与报告；下一候选仅评估完全位于north谓词生效框外的段是否可直接证明，先QA计数和对照，不提前修改产品。

`north-outside-proof`仅QA试验后停止：target805段中71段完全在判定框外，join339段中291段在框外；可省coversBox调用17,844/198,715及36,178/46,658。但三对冷路线target48.75→44.75、43.89→50.18、46.09→42.68ms，join58.84→56.32、56.99→59.99、58.04→56.51ms，收益不稳定。路径和查询session一致，未接产品、未做900步或原生。主已读比较报告，下一隔离候选仅将coversBox自身的严格边界框包含必要条件放到调用前，幸存者仍调用原函数；不混入outside候选。

`north-proof-bounds`也暂不接入：caller严格边框预筛将coversBox调用198,715→709、46,658→231，但多边形遍历次数未减少。target三对44.78→40.75、45.67→43.21、44.15→43.65ms，join57.24→56.45、58.31→56.94、57.24→58.30ms；target有所改善但收益幅度小且join不稳定。所有查询路径/session一致，未更广验证或产品改动。主读原函数及比较报告后，将本轮最后一个微优化候选限定为不可变多边形的粗空间候选筛选：包含box者必包含box中心，候选保持原顺序并调用原coversBox；不改通用几何模块、不混其它试验，先实测收益。

04:48停止本轮微优化并提前冻结。`north-segment-index`的4米候选索引127格/605引用，构建0.18–0.25ms，target遍历198,715→1,011、join46,658→1,065。三对target45.57→43.56、43.79→40.89、44.70→40.49ms，有一致的2.0–4.2ms局部收益；join56.53→56.60、56.96→56.28、57.10→56.72ms近乎不变。主已读比较报告，判断收益尚不足以支撑当前加入新索引，保留QA成果、不接产品、不谎称零收益。路径和六轮查询session一致，但未做更广验证及900步；当前domain022/spatialcd477及其它冻结源码保持。随后`final-freeze-02`串行重跑正式三结局、完整动作像素及90秒长档，所有失败/峰值照实保留。

05:00后源码复核转向跨状态缓存归属，未重开前述微优化。纯730世界步`cross-state-segments`只有1个rooms、6293个不同段miss，目标1153次miss跨state重复0；完整session/74.4MB路径与控制相同。该轮没有玩家命令，不能外推原生按键。继续追踪确认`dispatchOwnedCombatCommand`虽减少重复校验，仍调用完整cloneState并提交新state；原线段缓存按rooms对象隔离。

`cross-state-native/native-01`实际原生按键计数证实：29rooms/29states、仅1组完整相同几何；266160泵内1423次miss中474次曾在更早tick的等价rooms/state算过（body:true277/1167、planning19/75、east178/181），结果矛盾0。全轮8507次miss中1572次跨state复算。该轮只注入只读记录，原check、返回和游戏缓存照常执行；原spatial cd477，实际交付6b7fac7d，两hook/prelude逆去逐字还原原版。源档保持、正常关闭、落盘世界state相等。主已独立读summary与原生报告；注入耗时不作性能验收。

该新证据允许在05:36硬冻结前仅验证一批语义相同的线段结果共享。候选保留原rooms私有Map及local hit；仅local miss、完整有序bounds/door和五个flags合法、端点均有限数值时查询共享桶，再写回原local。非合法输入不发布到共享层，保同rooms旧key碰撞行为；不共享可变rooms，不旁路外层连续碰撞、权限、队列及真实半径。当前仍为QA候选，正式产品未改；需实际记录逐条等价、几何隔离、完整世界/路径和无注入原生复测才接续状态。
