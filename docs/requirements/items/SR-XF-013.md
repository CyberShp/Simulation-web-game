# SR-XF-013 · 三路战斗动作、同行战术与敌人配置

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

决策来源：U-63, U-66, R-25, R-26, U-94, U-114, R-37, U-123, U-124, U-127, U-128, U-129, U-130, U-149, R-49, U-158, R-51, T-17, U-159, U-160, U-161, U-162。这是继承的U项和作者实施默认；具体新增名称/数值不得伪装成用户逐项批准。

规格：[02-EQUIPMENT-ARTS.md](../../../docs/design/02-EQUIPMENT-ARTS.md)、[05-RUNTIME-CONTRACTS.md](../../../docs/design/05-RUNTIME-CONTRACTS.md)、[10-CRISES-RESCUE-DEATH.md](../../../docs/design/10-CRISES-RESCUE-DEATH.md)、[14-EARLY-GAME-DETAILED-DESIGN.md](../../../docs/design/14-EARLY-GAME-DETAILED-DESIGN.md)、[06-OPENING-ACCEPTANCE.md](../../../docs/design/06-OPENING-ACCEPTANCE.md)、[20-ARTS-GROWTH-COMBAT.md](../../../docs/design/20-ARTS-GROWTH-COMBAT.md)、[41-COURTYARD-VALLEY-IMPLEMENTATION.md](../../../docs/design/41-COURTYARD-VALLEY-IMPLEMENTATION.md)、[51-COURTYARD-MANAGEMENT-INTEGRATION.md](../../../docs/design/51-COURTYARD-MANAGEMENT-INTEGRATION.md)、[70-COURTYARD-FIRST-COMBAT.md](../../../docs/design/70-COURTYARD-FIRST-COMBAT.md)、[55-CHARACTER-ACTION-LIBRARY.md](../../../docs/design/55-CHARACTER-ACTION-LIBRARY.md)、[73-COMBAT-FRAME-PRODUCTION.md](../../../docs/design/73-COMBAT-FRAME-PRODUCTION.md)、[README.md](../../../docs/art/combat-response-goal-20261027/README.md)、[player-down-prompt.md](../../../docs/art/combat-response-goal-20261027/player-down-prompt.md)。

依赖：[SR-XF-002](SR-XF-002.md)、[SR-XF-003](SR-XF-003.md)、[SR-XF-007](SR-XF-007.md)、[SR-XF-012](SR-XF-012.md)。

关联既有验收：CHAIN-04, INTRO-01；本SR的AC细化这些目标，不代表旧版本已经通过。

## 现状与设计缺口

已有固定攻击、青岚术、闪避与守御的旧战斗。

三路动作空间差异、NPC战术、boss配置及伤害预算待详细定义。

现状是适用旧能力的基线，不表示该SR完整目标已通过。

## 必须补齐的设计交付物

1. 每个动作的起手/执行/收势、目标、范围、视线、消耗、冷却和效果层。
2. 剑路追击、药用救治、阵节点部署的同场可行方案与反制。
3. 韩厉川/邢烈/邵衡及普通敌人配置、自愿同行者集结/护卫/撤退策略。

## 需求行为

SR-XF-013-REQ-01：暂停只排计划，服药/换装/施法恢复后实际耗时结算。

SR-XF-013-REQ-02：生活与战斗共用伤势、精力、装备与知识；大境界差距不可常规堆装备抹平。

SR-XF-013-REQ-03：各动作空间条件合法，同行者自主执行约定战术。


## 验收标准

| ID | 情景 / 操作 | 必须看到的结果 | 状态 |
| --- | --- | --- | --- |
| SR-XF-013-AC-01 | 三路以同合理准备挑战同境界关键遭遇 | 有不同可观察手段与取舍，各自有获胜/补足路径。 | not_run |
| SR-XF-013-AC-02 | 暂停连续点击服药/部署并恢复 | 动作依阶段执行，耗用/冷却一次，不能暂停无敌。 | not_run |
| SR-XF-013-AC-03 | 障碍、撤退、击倒或装备损坏 | 距离与视线条件有效，身体/物品结果返回山院仍一致。 | not_run |

SR-XF-013-AC-01证据：docs/art/combat-minimum-20261025/README.md；docs/art/combat-minimum-20261025/review.json；docs/art/combat-minimum-20261025/review-v002.json；docs/art/combat-encounter-20261026/README.md；docs/art/combat-encounter-20261026/review.json；docs/art/combat-ranged-20261026/README.md；docs/art/combat-ranged-20261026/review.json；docs/art/combat-ranged-20261026/review-v002.json

SR-XF-013-AC-02证据：局部：docs/design/70-COURTYARD-FIRST-COMBAT.md（本批动作／接触事件／受击恢复，Node25/25；macOS正常33项、落败3项、左右朝向补帧18项分别通过；完整AC情景另计）；2026-10-24局部进度／未通过：docs/design/70-COURTYARD-FIRST-COMBAT.md；规则33、反馈9、山魈3分别检查，macOS源码Electron 03/04/05原failed保留；用户反馈手部变形，visual-failed、正在返工，非空短预输入暂停／失焦清理待验；本AC状态保持。；2026-10-24手修06局部：docs/design/70-COURTYARD-FIRST-COMBAT.md；离线4/4、缓存90采样／4绘制对照，根Agent有限目检。原失败及qa-hand-06失焦失败保持；新原生手部／buffer、用户视觉／声音与最大射程视觉距离继续待验，AC状态保持。；2026-10-24整帧局部：docs/design/70-COURTYARD-FIRST-COMBAT.md；整帧5/5与18组RGBA忠实性对照、反馈10/10。qa-frames-08右击774命中25，但0.79米未满足1–1.4米观察带、整体failed，其余方向／连续操作未执行；4步态候选均未通过，样板与用户认可未完成，AC状态保持。

SR-XF-013-AC-03证据：局部：docs/design/70-COURTYARD-FIRST-COMBAT.md（本批动作／接触事件／受击恢复，Node25/25；macOS正常33项、落败3项、左右朝向补帧18项分别通过；完整AC情景另计）；2026-10-24局部进度／未通过：docs/design/70-COURTYARD-FIRST-COMBAT.md；规则33、反馈9、山魈3分别检查，macOS源码Electron 03/04/05原failed保留；用户反馈手部变形，visual-failed、正在返工，非空短预输入暂停／失焦清理待验；本AC状态保持。；2026-10-24手修06局部：docs/design/70-COURTYARD-FIRST-COMBAT.md；离线4/4、缓存90采样／4绘制对照，根Agent有限目检。原失败及qa-hand-06失焦失败保持；新原生手部／buffer、用户视觉／声音与最大射程视觉距离继续待验，AC状态保持。；2026-10-24整帧局部：docs/design/70-COURTYARD-FIRST-COMBAT.md；整帧5/5与18组RGBA忠实性对照、反馈10/10。qa-frames-08右击774命中25，但0.79米未满足1–1.4米观察带、整体failed，其余方向／连续操作未执行；4步态候选均未通过，样板与用户认可未完成，AC状态保持。

2026-10-12 U-123：谷内山魈、攻击／护持／躲避／撤退及伤势结算的正式规则定向6／6；实际战斗网页链仍在核验，整项 AC 状态保持。 局部证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。

2026-10-12 U-123 首战本地网页：最终本地网页近山魈应战；青岚术敌血160→123、护息承伤掌门血143→140、剑式敌血123→98、闪避维持血140；撤退后retreated、伤14.6853。活动战斗存读保持双方血灵和脚点；完整三路战斗 AC 状态保持。 证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。

2026-10-23 本轮战斗采用独立林间战场：WASD持续走位，鼠标落点／方向配合1／2／3技能与Space短步，自动攻击仅执行射程内普通攻击，走位和技能由玩家操作。真实投射物碰撞后结算；暂停、模态与原生失焦清输入，后台世界规则保持。本轮直接相关规则28/28及主Agent工程检查通过；正常开局Node术法与自动普攻两条胜利链均只有一次结算，身体释放并恢复谷内行走。macOS源码Electron分段完成移动、原生失焦及后续技能操作：direct-run-01前8项局部通过、direct-run-03原生失焦清键且后台续进5步、direct-run-04后续9项通过（834→972、24.511037秒、错误0）；各段失败与两处界面修复分别保留，不拼作一次连续通过。新控制下的存档、旧档入口与返院复验暂缓。run-04按钮／存读链按历史版本保留。主Agent独立目视最终投射物／护持及此前探索截图，构图、空地脚点、敌预警与技能栏可辨，八个主战斗源码SHA与最终冻结一致；新素材用户美术评看与完整SR/AC另计。

2026-10-23 用户新续接聚焦掌门／山魈动作、命中特效与真实受击僵直，沿55动作库及同一100毫秒世界步实现。命中主事件补稳定编号、时步、双方身份、真实入射方向／接触点、伤害／护持／闪避／打断结果；人物提供只读动作阶段。作者试调 T-COMBAT-IMPACT-20261023：轻击僵直2步并保留蓄势，重击3步并取消未释放动作，站稳后保护12步，敌方打断后至少收势6步；已发射物继续，费用／冷却遵循真实释放。规则与相关回归25/25，三个规则模块语法检查通过；特效8种离线夹具重复像素一致且不回写世界。人物／山魈36姿离线检查8/8，已按只读动作阶段接入；388文件runtime-01冻结及6核心文件、规则报告5文件读回一致。macOS源码Electron三段分别通过：正常操作qa-run-01为33项（423→1087、108.629018秒），实际落败qa-defeat-01为3项（763→1333、64.839664秒），左右朝向停稳补帧qa-orientation-02为18项（763→881、42.211894秒）；各段错误0且source/runtime保持，分段证据不记为一次连续运行。补帧只调整检查脚本，251个功能／素材路径与首段一致。根Agent已独立目视最终画面，两份388文件清单仅检查脚本不同；仓库6核心源码及本批素材共40文件SHA与runtime-01一致。掌门左向受击为离线证据、实机受击为右向；完整僵直持续窗以规则证据覆盖，方向实机全矩阵另计。新控制下的存档、旧档入口与返院复验仍暂缓；生产／医庐沿各自来源，完整SR/AC状态保持。

2026-10-24 流畅度返工按T-COMBAT-FEEL-20261023接入：持键保存移动意图，施法起手停脚、释放后恢复走位，合法短步接起手／收势，单槽2步预输入；真实结算仍用100毫秒世界步。规则33/33（新增8＋直接回归25）、反馈模块9/9、山魈模块3/3分别记录。人物离线6条及focused5条检查与公开规则时钟预览属离线证据。macOS源码Electron qa-feel-03、qa-feel-04、qa-buffer-05均保留failed，各已完成10、2、2项局部检查：03持键术法777释放、778恢复位移及释放后短步／接触／暂停等成立；05证明目标冻结与一次消费。非空短预输入的暂停／失焦清理尚未完成。用户明确反馈手部变形，qa-review.json冻结为visual-failed，QA窗口已关闭，当前手掌／腕／肘正在返工，不声明视觉通过或交付。证据根目录 /Users/shepard/.codex/tmp/immortal-combat-feel-20261023/，范围限macOS源码Electron；绘制JS耗时及rAF回调间隔不称实际显示FPS。修后视觉、完整存读／旧档／返院、用户评看与Windows继续待验，完整SR/AC及任务状态保持。

2026-10-24 旧拆件rig版本手修06历史记录：固定手掌比例、24／21臂骨与70度腕限，校准贴图腕／握柄锚点、肘分支和左向施法层级，剑轨迹渐隐，完整动作bounds缓存保留剑尖。专项4/4、90个量化采样及4个Canvas draw对照通过，86项预热约27.29MiB，96项／40MiB上限，1000次闲置新增miss为0；根Agent及Astra完成有限离线复核。851／1001的0.381／0.259像素接触距离属于旧场景离线重绘。该版登记为hand-repair-offline-checked/native-pending；qa-hand-06在移动准备时原生失焦，以failed保留，未取得手部或buffer新证据，来源／运行文件保持、窗口已关闭。原03／04／05 failed及visual-failed汇总保持。右剑痕约领先可见剑尖3.8像素、最大水平1.9米处约10–30像素可达差仍open；用户视觉／声音认可、Windows、当前包与完整SR/AC仍待验。规则33、反馈9、山魈3的既有模块证据各自保留。详见70规格及 /Users/shepard/.codex/tmp/immortal-combat-feel-20261023/hand-fix-06/；该段当时登记离线修复，当前整帧证据另列。

2026-10-24 人形整帧blit生产路径已接入，同一原帧统一缩放；释放当步保留出手，下一世界步按已接受的moveIntent切整身walk，短步／受击／倒下优先，同一100毫秒时钟、位置插值和暂停冻结保持。新专项5/5、9组原PNG裁切／合成在95／112像素身高共18组RGBA对照一致（排除脚影）；反馈10/10含正式投射物方向回归。S01仍为原单母稿离线网格烘焙PNG，离线小样仅作为接续基线，完整动作样板未完成。qa-frames-08整体failed：763→776、11.06978秒，右普攻774实际命中25，但中心距0.790000079米未满足专项1–1.4米观察带，左动作、施法→走位→短步和斜剑未执行；source/runtime保持、收尾错误0、未录像且窗口关闭。根Agent有限目检右起手／释放，敌我重叠遮挡手掌与剑，尚不能验证其质量。内置imagegen左右各两次共4张六格步态候选均未形成反相支撑腿，已停止并留外部。当前欠完整反相步态、左右攻击收势／连续剑路、左闪避／受击专图与斜向攻击图，swordTrail为空、真实接触光效保留。旧06／07及03／04／05失败按原版本保留；非空buffer原生清理、当前控制存读／旧档／返院、用户视觉／声音认可、Windows、当前包和完整SR/AC继续待验，状态不提升。 证据见docs/design/70-COURTYARD-FIRST-COMBAT.md。

## 开发任务

| 任务 | 工作 | 状态 | 前置 | 责任人 |
| --- | --- | --- | --- | --- |
| SR-XF-013-D01 | 设计补齐：交付：每个动作的起手/执行/收势、目标、范围、视线、消耗、冷却和效果层。；剑路追击、药用救治、阵节点部署的同场可行方案与反制。；韩厉川/邢烈/邵衡及普通敌人配置、自愿同行者集结/护卫/撤退策略。；填实必需参数并标记U/R/T来源。 | in_progress | 无 | Codex/equipment_growth |
| SR-XF-013-D02 | 契约与内容审阅：审阅三路战斗动作、同行战术与敌人配置与依赖契约（SR-XF-002、SR-XF-003、SR-XF-007、SR-XF-012）的字段、时序、失败及恢复；逐项核对本SR的REQ/AC。 | todo | SR-XF-013-D01 | 待分配 |
| SR-XF-013-I01 | 开发与集成：在成长模块实现三路战斗动作、同行战术与敌人配置；交付SR-XF-013-REQ-01至REQ-03，接入相关数据、行为、素材、UI和恢复，提交关联SR。 | todo | SR-XF-013-D02 | 待分配 |
| SR-XF-013-V01 | 验收与兼容：执行SR-XF-013-AC-01至AC-03及CHAIN-04、INTRO-01；登记实际结果、兼容和设备证据边界。 | todo | SR-XF-013-I01 | 待分配 |
| SR-XF-013-R01 | 发布与关闭：完成所需源码/运行时发布核对、交接和未覆盖说明；本轮用户不要求上传QA过程产物。 | todo | SR-XF-013-V01 | 待分配 |

SR-XF-013-D01证据：docs/design/20-ARTS-GROWTH-COMBAT.md（抗性与平衡首稿，逐招配置继续）；docs/design/31-ARTS-SAMPLE-COFORMATION-DIVINE.md（局部动作与时序试算，非完整D01）；docs/design/47-GOLDEN-CORE-ARTS-CATALOGUE-DRAFT.md；2026-10-15 U-145/R-45：169项修行内容草案、五脉续篇、获取替代、百艺阵法、暗线与特效；仅补设计证据，金丹运行与完整D/I/V/R、AC状态保持。；docs/design/48-GOLDEN-CORE-WORLD-ARTS-V02.md；2026-10-15 U-146/R-46：720项玩家/NPC世界修行库、72新增来源谱系，符箓蛊道心法攻防及获取特效补齐；仅设计字段、来源与引用检查，运行及完整D/I/V/R、AC状态保持。

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
- docs/design/20-ARTS-GROWTH-COMBAT.md（物抗法抗、异常积累与同境平衡首稿；D01动作和敌人配置继续）
- docs/art/kling-stop-supplement-20261025/README.md
- 2026-10-25 收步返回片审看：主Agent审21点全片与首2秒49帧，首次落地后9–18又蹬离大跨步，未达当前脚直接收步；身份/剑保留，不整段加速、不批量抠底、不接D。用户要求无声，AVFoundation视频轨透传导出0音轨，241压缩视频包/PTS保持，Chrome加载可播；新提示候选从原frame52接地稳住仅收后脚，尚未发Kling。详见本目录review.json，旧输入包保持，全部D/I/V/R、AC及任务状态不推进。
- 2026-10-25 55 B04收步补片输入：主Agent审原185–210全部26帧，185–197仍续原跑步半步、198后才连续回正，未见独立另一半步收步链。选原RGB48→240备单条Kling首末帧与提示词，两940图保持原字节/水印、来源与SHA随小ZIP留存；仅输入准备，新视频尚未返回，无动作或实机验收。原片/D样板/前批包保留，未接入运行；全部D/I/V/R、AC及任务状态保持。
- docs/art/kling-motion-review-20261025/README.md
- 2026-10-25 55 B03/B04右向离线样板：仅D，复用87帧，连续3.3m/s标尺与22m投影取证；contact只拟合5个人工水平端点，仍19帧480ms、保留equal。主Chrome实查keyup位置保持、A禁用及stop203→run63被新D打断；独立只读76边界/114矩阵通过、累计距离不随动画圈归零。正式100ms世界步/.045m预显/35–100ms收敛未改，任意相位视觉仍有腾空转站腿、腿位收缩与衣发回跳，不称整圈无滑步。QA页面与review留存，未接入runtime或改存档，不新增87帧ZIP；全部D/I/V/R、AC及任务状态保持。
- 2026-10-25 Kling起停组合候选：用户确定19帧跑步480ms，新增待机/起跑/收步/回稳68帧；87原生RGB保持，H650/root[580,825]/BOX58。主Agent审13页68帧，Chrome观察idle11→start15、自动停240/110of110及滑块24→58、61→198，接受本批离线候选；独立只读核对87帧RGB/BOX/atlas、200散列、110帧序与197个GIF编码帧图像及时长通过，未做UI美术。小灰残点/浅边、任意相位起停/脚速与实机未验；PNG/GIF/HTML/ZIP留QA，未接入运行。全部D/I/V/R、AC及任务状态保持。
- 2026-10-25 Kling透明跑步候选：用户选择脚本逐帧分离背景，frame48–66共19张940×940原生RGBA的RGB逐像素保持；固定H0=650/root[580,825]，BOX统一58逻辑像素、nearest呈现，人工衣物保护范围明记。主Agent审dark01–04全19帧，在Chrome播放观察52→57后暂停，切校准场景检查全身/比例，接受本轮透明跑步候选。轻微浅边仍在，闪烁完全消除、接缝/脚速和实机未验；PNG/atlas/GIF/HTML与ZIP留QA，未接入运行。全部D/I/V/R、AC及任务状态保持。
- 2026-10-25 Kling原片接续：用户返回940×940/约24fps视频，实际解码241帧并保全原SHA和QA原字节备份。主Agent在Chrome播放/seek看原画面，另审21点全片表、跑步25帧及起停13/25帧密集表后，判断可继续帧制作；人工分段与frame48–66的19帧周期仅为候选。软化像素、RGB背景、接缝/滑步及实际尺度待验，未去背景或接入运行；全部D/I/V/R、AC及任务状态保持。
- docs/art/kling-motion-input-20261025/PROMPTS.md
- 2026-10-25 Kling接续：用户自行使用Kling制作动作；本批仅备提示词、1254×1254浅灰底首帧及身份/尺度/循环参考输入包，复制SHA一致。尚无Kling视频或动作验收，未上传、未操作账号或运行游戏；全部D/I/V/R、AC及任务状态保持。
- 2026-10-25 U-171 / 55 B02：用户认可同标尺整体观感；v6四帧→v5四帧为首个单方向8帧候选，固定H0=500、统一58/500、60ms×8=480ms。主Agent已看源sheet/contact全8帧，在Chrome播放/暂停/下一帧、跨圈回1并对照2/6支撑，仅通过离线逐帧、播放器可播放和视觉初审。地面速度同步、起停、其余方向、完整动作及实机仍未验；源SHA/透明裁边/atlas一致与禁止覆盖失败检查通过，存读不适用。本批只补局部素材，D/I/V/R、AC及任务状态保持，详见docs/art/combat-motion-study-20261025/README.md及run-cycle-v001/review.json。
- docs/art/combat-field-study-20261025/README.md
- docs/art/combat-motion-study-20261025/README.md
- 2026-10-25 U-171最新接续：用户认可整体美术方向并授权校准后制作帧动画，非新尺度/动作/实机验收。40逻辑像素/米同网格静态图人101px/兽164px，主Agent审看可继续，用户新比例未评；阴影及原生像素密度一致性未验。跑步v1–v3均未通过，v3后半圈换腿不足且帧8左手变剑诀，停止生成；原RGBA及诊断输出保留，未完成连续播放或实机验收。仅离线局部证据，运行素材registry与全部D/I/V/R、AC及任务状态保持。
- 2026-10-25 U-171静态美术候选：网站真实global prompt起步，三次内置image_gen生成/定向修订后展示1536×1024第三稿，主Agent已审图、用户评看待定；人物超过108px预算、严格像素网格未验，22米精确比例未锁定。原LPC人物、通用兽人及重复草地成品已被用户否决，原包和运行引用保留。本批无动作库、运行替换、性能或游戏存档操作。native-01与独立reopen-01均保持failed，后者存读/关闭局部成立但署名请求失败，不合并动作/接触/性能证据；D/I/V/R与全部AC状态保持，详见73。
- docs/design/31-ARTS-SAMPLE-COFORMATION-DIVINE.md（Y-201护撤与Y-144行动权的动作、反制和存读试算；三路及敌人配置继续）
- docs/design/33-ARTS-INITIAL-CALIBRATION.md（Y-001–067逐项反制校准；未实战定标）
- docs/art/COURTYARD-VALLEY-2026-10-12.md
- tests/unit/web/ea-mountain-first-combat.test.mjs
- tests/unit/web/ea-godot-valley-projection.test.mjs
- docs/art/OPENING-CHAIN-2026-10-12.md；2026-10-12 U-124：同一普通新档引风术、护持、受伤撤退与归院用药；战斗收势阶段存读保持。 仅增局部证据，完整 SR/AC 状态保持。
- docs/art/desktop-style-review-20261013/README.md；2026-10-13 U-127/U-128：五种画风、战场总览及交战近景共七张静态原型待用户审核；桌面交付方向为Windows主力、macOS先验证。仅设计与原型证据，桌面迁移及新战斗未实施。
- 2026-10-13 U-129/U-130：独立 Three.js/Electron 双画风自动样板用于空间、人物与特效评看；范围及实际证据见 docs/art/DESKTOP-RUNTIME-SAMPLES-2026-10-13.md。正式玩法、Windows 与完整 SR/AC 状态保持。
- 2026-10-14 U-135 / R-41 / T-14：用户认可 U-134 高清像素实机并要求保持设计，以目标模式接续独立桌面演武。普攻及剑气／火诀／护阵接入消耗、冷却、范围、遮挡、落点失手和真实伤害；规则 14／14、最终打包应用集成 13／13 覆盖忙碌拒绝不重复消费、组队胜利、单挑失败、结果冻结与收招离场。原生键鼠剑气使敌方气血 100→66，护阵 50、持续及冷却倒数可见。局部证据见 docs/art/hd-pixel-20261014/ARENA-RUNTIME.md；最终记录 /Volumes/Media/immortal-qa/pixel-arena-20261014/ 下 final-run-3/metrics.json、restart-final/ 与 native-final/。源码与素材随本批源码检查点保存；正式规则完整移植、大地图、正式人物与存档、Windows 和完整 SR/AC 另验，D/I/V/R 与 AC 状态保持。
- 2026-10-14 U-136/U-137，R-42/T-15：独立近山行程扩为同一1672×2823图像空间，山院→溪桥→林道→谷地会武→实际返院；16/32人稳定身份、只控掌门、同一时钟和独立存读。组件45/45；最终可见macOS包run-3检查22/22、运行错误0；16人实际返院胜利，32人到谷后采样15.00秒（其中交战13.08秒）再公开退出。原生输入、存读及画面差距见 docs/art/hd-pixel-trail-20261014/RUNTIME.md，设计见 docs/design/44-PIXEL-TRAIL-SLICE.md。源码与素材随本批检查点保存；当前画面认可、正式世界与存档接入、Windows及完整SR/AC另验；D/I/V/R及AC状态保持。
- docs/design/47-GOLDEN-CORE-ARTS-CATALOGUE-DRAFT.md；2026-10-15 U-145/R-45：169项修行内容草案、五脉续篇、获取替代、百艺阵法、暗线与特效；仅补设计证据，金丹运行与完整D/I/V/R、AC状态保持。
- docs/design/48-GOLDEN-CORE-WORLD-ARTS-V02.md；2026-10-15 U-146/R-46：720项玩家/NPC世界修行库、72新增来源谱系，符箓蛊道心法攻防及获取特效补齐；仅设计字段、来源与引用检查，运行及完整D/I/V/R、AC状态保持。
- docs/design/51-COURTYARD-MANAGEMENT-INTEGRATION.md；2026-10-15 U-149/R-49：四页与共用详情、单趟40份留苗搬运、落地回收和保存恢复接通；组件与相邻回归57/57，同一检查点真实桌面387.845秒13/13、最终包页面8/8、恢复链9/9，原生选择文件/预检/恢复及手动暂停已验。完整新档、规模、对话/突破、跨区施工、20分钟自主与Windows待接；完整D/I/V/R和AC状态保持。
- docs/design/55-CHARACTER-ACTION-LIBRARY.md
- docs/design/character-actions/WEAPONS-AND-SUPERNATURAL.md
- docs/design/character-actions/CRAFTS.md
- docs/design/character-actions/craft-coverage.json
- docs/art/character-actions-20261017/README.md
- docs/art/character-actions-20261017/review.json
- assets/characters/shen-yan/cast-study-v1/README.md
- assets/characters/shen-yan/cast-study-v1/review.json
- assets/characters/shen-yan/guard-study-v1/README.md
- assets/characters/shen-yan/guard-study-v1/review.json
- docs/design/70-COURTYARD-FIRST-COMBAT.md
- apps/courtyard/sect-combat.mjs
- apps/courtyard/courtyard-combat.mjs
- tests/unit/courtyard/courtyard-combat-direct-controls.test.mjs
- tests/acceptance/courtyard-combat-direct-desktop.mjs
- assets/courtyard/valley-battlefield-v1.provenance.json
- assets/courtyard/valley-shanxiao-actions-v1.provenance.json
- src/simulation/ea-combat-impact.mjs
- apps/courtyard/courtyard-combat-actors.mjs
- apps/courtyard/courtyard-combat-effects.mjs
- tests/unit/courtyard/courtyard-combat-impact.test.mjs
- assets/courtyard/combat-actors-v1/provenance.json
- apps/courtyard/courtyard-combat-presentation.mjs
- apps/courtyard/courtyard-combat-rig.mjs
- apps/courtyard/courtyard-combat-beast-rig.mjs
- apps/courtyard/courtyard-combat-audio.mjs
- tests/unit/courtyard/courtyard-combat-feel.test.mjs
- tests/unit/courtyard/courtyard-combat-feedback.test.mjs
- tests/unit/courtyard/courtyard-combat-beast-rig.test.mjs
- tests/acceptance/courtyard-combat-feel-desktop.mjs
- tests/acceptance/courtyard-combat-observations.mjs
- tests/unit/courtyard/courtyard-combat-rig.test.mjs
- apps/courtyard/courtyard-combat-frame-metadata.mjs
- tests/unit/courtyard/courtyard-combat-frames.test.mjs
- docs/art/combat-sword-study-integration-20261026/README.md
- docs/design/73-COMBAT-FRAME-PRODUCTION.md
- 2026-10-27 持剑单人战斗正式接入取得局部证据：新建单人山谷启用sword-study-v1，WASD/鼠标、移动剑气、已学剑法Q锁点重击、胜败确认与返院沿正式模拟；旧无标记战斗保持原规则。本批新增专项46项通过（规则11/音频13/插值7/呈现9/公开命令6）；旧冻结版四场26项功能检查通过，最终移动03有19帧左右跑及出手后回跑诊断。长档120人/5后台活动原生265430→265471，Q因未学剑正式拒绝且不扣气；源/运行散列与关闭均一致。精确坐标缓存同源冷步219.23→143.05ms、热2.48→2.34ms，完整状态字节一致；原生该步仍127.1ms、活动帧间隔125ms、Tab264.1ms，另有Node158ms慢步。旧失败/限定记录保留，完整动作、流畅度、听感、Windows与完整SR/AC及发布状态保持开放。
- docs/art/combat-response-goal-20261027/README.md；2026-10-27 局部动作接缝：Space按正式dodgePath贯穿四整帧并保持落地末帧，左右受击按面向镜像；掌门三段同身份倒地按downedTick在0/150/300ms选帧并保持侧卧，源图与完整提示词见player-down-prompt.md。主已看正式Q/J接Space及0HP侧卧，三场原生12/5/6项通过；上下独立收步、受击与倒地素材仍缺，最后恢复收步补丁37项相关回归及resume-01原生两项通过，回拉0/idle滑0，完整SR/AC状态保持。
- docs/art/combat-response-goal-20261027/README.md；2026-10-27 局部动作补验：894版纵向run-tail到位后切cast07/11双脚戒备，62项相关测试及vertical-down-02正式4项通过；真实敌击后的downedTick=780在0/151.9/300ms抓到down00/01/02，主已亲看跪/撑/卧。action-pixels-01移动J与左右真实hit取得实际像素，完整方向动作库与整项SR/AC状态保持；倒地源及提示词见docs/art/combat-response-goal-20261027/player-down-prompt.md。
- docs/art/combat-response-goal-20261027/README.md；2026-10-27 最终同版本动作/战斗复核：移动出剑、Q释放后移动/Space、真实受击及胜败撤离返院由正式规则产生；final-normal-02、final-defeat-02、final-retreat-01分别12/5/6项通过，final-action-pixels-01八项observed且主已亲看四向/J/左右hit及0HP终帧。894呈现、be81采样与98ac元数据五场一致；初轮final-normal-01验收器失败保留，修正等冷却误长跑及HUD指针遮挡后02通过，完整SR/AC状态保持。
- docs/art/combat-response-goal-20261027/README.md；2026-10-27 当前spatial cd477bf1仅调整A*排序成本计算，a-star-cost-gate的31项/7场景与900步完整状态/路径等价通过；domain022bdc、ground3f3d、presentation894、framesbe81、data98ac保持。五场功能/视觉原生证据仍为先前spatial cb8538冻结版本；新长档性能112.8ms尖峰未达标，完整动作与SR/AC状态不推进。
- docs/art/combat-response-goal-20261027/README.md；2026-10-27 当前domain022/spatialcd477/ground3f3d/presentation894/framesbe81/data98ac五场及两probe完整runtime一致。normal/defeat/retreat正式12/5/6项通过，八项动作像素observed已由主看四向、移动出剑、左右hit、稳定戒备及0HP胜败终帧；Q像素范围为Q→Space接续。七份原生落盘state与最终session.state一致；恢复收步203/206/209在真实轨迹齐全，回拉0、standingSkid0，100/200ms稳定action03。早期failed保留；本轮04:48提前冻结，原06:36截止保持，完整SR/AC状态不推进。
- docs/art/combat-response-goal-20261027/README.md；2026-10-27 c95版仅共享完整等价房间几何的纯segment boolean，strict public indoor资格独立；44项测试、7场景、900步完整session及92MB路径逐字等价，根cmp为0。新normal9/defeat5/retreat6正式胜败撤离返院通过，五场源/运行及落盘state复核一致；主已看当前双方终帧。旧cd477七场动作像素单列，当前presentation894、framesbe81、data98ac保持，不将旧运行散列改称新版本同批证据。新限定场景两轮性能门通过，完整SR/AC状态不推进。

- 2026-10-06：由v1.2设计缺口审计建立SR；新增内容和参数遵循作者默认，不冒充用户逐项确认。
- 2026-10-06：用户授权目标模式、多agent并行开发与验收；启动D01，按现有契约展开模块设计，未将建档或局部实现标作交付。
- 2026-10-11：按U-114/R-37补物抗法抗、异常积累、条件克制和复合动作预算首稿；具体敌人及逐招动作仍待设计和实战验证。
- 2026-10-11：补Y-201多人阵与Y-144神通动作过程试算；D01、动作定标、敌人配置和实机验证仍未完成。
- 2026-10-11：Y-001–067逐项复评神通、复合技与失效条件；五套开局攻守仅接既有战斗预算，物抗法抗、异常与同境平衡仍待实现和实战验证。
- 2026-10-12：2026-10-12 U-123：谷内山魈、攻击／护持／躲避／撤退及伤势结算的正式规则定向6／6；实际战斗网页链仍在核验，整项 AC 状态保持。 局部证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。
- 2026-10-12：2026-10-12 U-123 首战本地网页：最终本地网页近山魈应战；青岚术敌血160→123、护息承伤掌门血143→140、剑式敌血123→98、闪避维持血140；撤退后retreated、伤14.6853。活动战斗存读保持双方血灵和脚点；完整三路战斗 AC 状态保持。 证据见 docs/art/COURTYARD-VALLEY-2026-10-12.md；整项 D/I/V/R 与 AC 状态不变。
- 2026-10-13：U-127/U-128：按用户要求先审核大场景多人即时战斗与画风原型，平台转为桌面。地图尺寸、人数上限、技能数值与最终画风未定；保留既有实现和验收事实，完整SR/AC及任务状态不变。
- 2026-10-15：U-145授权起草至金丹复仇收束的修行目录；R-45是作者提案。本批仅文档与同源JSON，不推进实现、验收或发布状态。
- 2026-10-15：U-146纠正169项过少，扩写至720项的R-46作者草案；玩家与NPC共用，补符蛊完整路线与散修来源，不推进运行或验收状态。
- 2026-10-15：U-149：接续远端main并完成当前山院管理和取消回收、保存恢复的局部桌面验证；完整状态保持。
- 2026-10-17：U-158/R-51/T-17：登记人物动作设计稿及兵器神通、百艺分册，100动作组区分姿势、手位、物件、作用事件及中断收势；172项百艺草案按工序和阵法组对应。本批只检查设计覆盖、引用与同源时钟/身体活动/封闭建筑/知情等契约。具体姿势、八向建议与制作批次待评看，新动作素材和正常/失败/存读及设备验证待后续；完整SR/AC与任务状态保持。
- 2026-10-17：U-159：按用户确认制作引诀、护持、落旗、撑阵、放蛊、掷符和操偶七组关键姿势图，每组四格，共28格；原像素外观、双手分工、承力与实物去向已逐张静态评看并独立复核。图片、完整提示词、来源与散列已保存。供用户美术评看；尺寸与脚点对齐、透明拆层、过渡帧、111像素辨识、连续动画及正常/失败/存读接入另行完成，完整SR/AC与任务状态保持。
- 2026-10-18：U-160：完成S01引诀点发12帧、1.28秒的分层动画小样与本地Electron播放器。人物、剑、法术独立；12帧靴部像素相同、首尾像素差0，49项资源散列一致。最终素材三档尺寸、播放/暂停/步进/单次/循环/半速/效果开关20项通过，页面错误0；收诀袖口、释放手腕与握剑经独立静态复核。用户美术认可、深草/工位背景、更多方向及正式释放/存读接入继续接续，完整SR/AC和任务状态保持。
- 2026-10-18：U-161：用户确认沿用S01人物外观，完成S04双掌护持12帧、1.76秒分层动画小样。双掌、袖口、腰侧剑鞘及护障已复核；全部靴区像素一致、首尾差0、61项资源散列一致。门前对照将本小样人物标尺校到80母稿像素，阶前脚点落在平地；人物与环境共同缩放。最终macOS Electron正常27项、缺失素材4项检查通过，页面错误0，六张场景截图经独立复核。S04用户画面认可、其他朝向、破障/取消、正式护持事件与存读接入继续推进；正式桌面比例和完整SR/AC、任务状态保持。
- 2026-10-18：U-162：S04按护盾作用修订为掐诀护身，12帧、1.76秒涵盖胸前结诀、脚边升盾、合顶包身、持诀、盾面受击及收诀消散；沿用S01人物与U-161的80母稿像素标尺。成盾帧全部人物/装备可见像素在盾内，12帧靴区相同、首尾差0，61项资源散列一致。实际macOS Electron正常30项、缺失清单4项检查通过，页面错误0；整套姿势及场景截图复核。用户美术认可、其他朝向、破盾/取消、正式护持事件和存读接入分别推进，完整SR/AC与任务状态保持。
- 2026-10-23：2026-10-23 本轮战斗采用独立林间战场：WASD持续走位，鼠标落点／方向配合1／2／3技能与Space短步，自动攻击仅执行射程内普通攻击，走位和技能由玩家操作。真实投射物碰撞后结算；暂停、模态与原生失焦清输入，后台世界规则保持。本轮直接相关规则28/28及主Agent工程检查通过；正常开局Node术法与自动普攻两条胜利链均只有一次结算，身体释放并恢复谷内行走。macOS源码Electron分段完成移动、原生失焦及后续技能操作：direct-run-01前8项局部通过、direct-run-03原生失焦清键且后台续进5步、direct-run-04后续9项通过（834→972、24.511037秒、错误0）；各段失败与两处界面修复分别保留，不拼作一次连续通过。新控制下的存档、旧档入口与返院复验暂缓。run-04按钮／存读链按历史版本保留。主Agent独立目视最终投射物／护持及此前探索截图，构图、空地脚点、敌预警与技能栏可辨，八个主战斗源码SHA与最终冻结一致；新素材用户美术评看与完整SR/AC另计。
- 2026-10-23：2026-10-23 用户新续接聚焦掌门／山魈动作、命中特效与真实受击僵直，沿55动作库及同一100毫秒世界步实现。命中主事件补稳定编号、时步、双方身份、真实入射方向／接触点、伤害／护持／闪避／打断结果；人物提供只读动作阶段。作者试调 T-COMBAT-IMPACT-20261023：轻击僵直2步并保留蓄势，重击3步并取消未释放动作，站稳后保护12步，敌方打断后至少收势6步；已发射物继续，费用／冷却遵循真实释放。规则与相关回归25/25，三个规则模块语法检查通过；特效8种离线夹具重复像素一致且不回写世界。人物／山魈36姿离线检查8/8，已按只读动作阶段接入；388文件runtime-01冻结及6核心文件、规则报告5文件读回一致。macOS源码Electron三段分别通过：正常操作qa-run-01为33项（423→1087、108.629018秒），实际落败qa-defeat-01为3项（763→1333、64.839664秒），左右朝向停稳补帧qa-orientation-02为18项（763→881、42.211894秒）；各段错误0且source/runtime保持，分段证据不记为一次连续运行。补帧只调整检查脚本，251个功能／素材路径与首段一致。根Agent已独立目视最终画面，两份388文件清单仅检查脚本不同；仓库6核心源码及本批素材共40文件SHA与runtime-01一致。掌门左向受击为离线证据、实机受击为右向；完整僵直持续窗以规则证据覆盖，方向实机全矩阵另计。新控制下的存档、旧档入口与返院复验仍暂缓；生产／医庐沿各自来源，完整SR/AC状态保持。
- 2026-10-24：2026-10-24 流畅度返工按T-COMBAT-FEEL-20261023接入：持键保存移动意图，施法起手停脚、释放后恢复走位，合法短步接起手／收势，单槽2步预输入；真实结算仍用100毫秒世界步。规则33/33（新增8＋直接回归25）、反馈模块9/9、山魈模块3/3分别记录。人物离线6条及focused5条检查与公开规则时钟预览属离线证据。macOS源码Electron qa-feel-03、qa-feel-04、qa-buffer-05均保留failed，各已完成10、2、2项局部检查：03持键术法777释放、778恢复位移及释放后短步／接触／暂停等成立；05证明目标冻结与一次消费。非空短预输入的暂停／失焦清理尚未完成。用户明确反馈手部变形，qa-review.json冻结为visual-failed，QA窗口已关闭，当前手掌／腕／肘正在返工，不声明视觉通过或交付。证据根目录 /Users/shepard/.codex/tmp/immortal-combat-feel-20261023/，范围限macOS源码Electron；绘制JS耗时及rAF回调间隔不称实际显示FPS。修后视觉、完整存读／旧档／返院、用户评看与Windows继续待验，完整SR/AC及任务状态保持。
- 2026-10-24：2026-10-24 手修06已完成有限离线检查：固定手掌比例、24／21臂骨与70度腕限，校准贴图腕／握柄锚点、肘分支和左向施法层级，剑轨迹渐隐，完整动作bounds缓存保留剑尖。专项4/4、90个量化采样及4个Canvas draw对照通过，86项预热约27.29MiB，96项／40MiB上限，1000次闲置新增miss为0；根Agent及Astra完成有限离线复核。851／1001的0.381／0.259像素接触距离属于旧场景离线重绘。当前为hand-repair-offline-checked/native-pending；qa-hand-06在移动准备时原生失焦，以failed保留，未取得手部或buffer新证据，来源／运行文件保持、窗口已关闭。原03／04／05 failed及visual-failed汇总保持。右剑痕约领先可见剑尖3.8像素、最大水平1.9米处约10–30像素可达差仍open；用户视觉／声音认可、Windows、当前包与完整SR/AC仍待验。规则33、反馈9、山魈3的既有模块证据各自保留。详见70规格及 /Users/shepard/.codex/tmp/immortal-combat-feel-20261023/hand-fix-06/；本次先登记离线修复，最终refresh／validate／check待新原生结果后统一执行。
- 2026-10-24：2026-10-24 当前实施现有完整姿势PNG／图集的整帧blit样板，按只读动作阶段切换，人物运行时绕过IK、mesh变形及切腿；保留已批准的施法停脚→释放恢复走位→短步、权威100毫秒规则、位置插值与山魈呈现。旧S01共12张PNG，来源为单母稿离线二维网格，复用metadata须保留该来源；06拆件修复烘帧不计为本次新素材制作。补图范围为内置imagegen生成左右各6相完整步态候选，图审通过前不进入正式项目。样板实现、批准步态与连续运行／用户评看证据尚待记录。06有限离线及07的9项原生局部检查按旧版保留，07整体failed；原03／04／05／qa-hand-06失败与visual-failed汇总不改。右剑痕约领先可见tip3.8像素、最大水平1.9米处约10–30像素可达差仍open。用户视觉／声音认可、非空buffer暂停／失焦清理、存读／旧档／返院、Windows、当前包和完整SR/AC待验；不关闭需求或推进AC状态，最终refresh／validate／check待最终证据统一执行。
- 2026-10-25：战斗帧制作继续：新标尺/1.2米接近规则与守卫、陆知微完整攻击帧进入候选；party-06原生动作记录确认短步执行，整段因QA观察漏读仍failed，世界推进最大296毫秒阻塞待定位。group-01初始状态契约失败后已生成修正fixture-03，仍为组件来源。完整动作、三规模实机终态及视觉质量尚未完成，SR/AC状态保持。详见docs/design/73-COMBAT-FRAME-PRODUCTION.md。
- 2026-10-25：party-07完成17项正常来源同行战斗/原队返院/原生重开；group-02完成18项三对二组件群战/救人唯一结算/返院/重开。两轮来源、运行、完整保存、关闭均保持，错误为空。组件群战不代替正常成长；根目检仍有近战遮挡与动作方向缺图，正常长档worldPump最大319.9毫秒，完整目标与SR/AC保持进行中。证据见73制作记录。
- 2026-10-25：主Agent制作并抽帧：两守卫各hit-left1帧/down-left3帧，掌门attack-up-right6帧；原源和提示词摘要留在人物素材目录，均列运行候选。hit/down错误回退idle修复，根帧/manifest专项21/21；完整连续视觉与新native待验。正常长档同源投影性能优化在逐步等价验证中，未宣称最终实机改善。SR/AC状态保持，详见73制作记录。
- 2026-10-25：party08同源实机17项通过，worldPump最大319.9→193.1ms，仍未达流畅目标；group03新反应素材18项通过并实见伏地；solo01正常独自出谷至返院22项通过，四项来源/运行/保存/关闭标志均true。甲衣右攻击6帧/待机1帧候选接入，完整16帧步态重绘候选仍外部待审。三规模功能证据不等于完整视觉交付，SR/AC保持。详见73制作记录。
- 2026-10-25：2026-10-25动作续作：陆知微东北掌击六帧完成抽取、白底透明合成及222像素接触表检查，算法validate通过；已接入registry，18个阶段/方向采样及24项回归通过，native待验。最近角度选帧修复已应用、24项专项通过，原生待复验。16帧慢走候选核对发现原周期与3.3m/s移动不匹配，保持外部候选；详细证据见73。完整SR/AC状态保持。
- 2026-10-25：2026-10-25快步制作：八帧生成候选因缺脚与腿相位问题未接入；已取得Hunyuan四秒连续慢跑FBX作为离线姿势参考，源文件散列与任务记录在73及外部QA。源动作检查、保留腾空的抽帧流程和暂停恢复显示相位修复正在进行，尚未作为正式动作验收；SR/AC保持。
- 2026-10-25：2026-10-25接缝修正：陆知微东北掌击末帧脚点重标为v002，离线浏览器首尾对齐、24项回归通过；暂停恢复显示相位与命中保持年龄修复，根针对6项通过、相关40项通过，原生待验。根实际导入慢跑FBX，52骨映射完整，初选63–87帧作待试循环，适配和最终像素帧未批准。见73制作记录；SR/AC保持。
- 2026-10-25：2026-10-25 party09同源同行实机17项通过，265353→265725，180.965秒，来源/运行/保存/关闭均保持、错误为空；worldPump峰195.4ms，与party08接近，交战卡顿未解决。纯多边形索引已冻结，等价通过、相邻177/178且唯一失败在原基线复现。慢跑16帧底稿已渲染及重绘，仍为外部候选。详见73；完整SR/AC保持。
- 2026-10-25：2026-10-25掌门左右受击/倒地帧候选接入，registry21clips；右批24回归、左批840方向/阶段采样和直接帧5项通过，原生反应待验。慢跑16帧已离线评看，比例/滑步仍待验。性能只读定位每50ms完整山院投影及0tick重复刷新，正在限定main/sect-sim实施投影优化，权威世界活动与公开完整view保持。详见73；完整SR/AC保持。
- 2026-10-25：2026-10-25林长风右剑击六帧接入，registry22clips；正式阶段180采样、身份隔离及帧5项通过，根核对registry与8素材散列一致，原生群战待验。慢跑同标尺比对发现偏小，另制sourceHeight260外部候选，未替换运行素材。刷新优化短测发现耗时转移到combat-input，正在修正并复测，不能认定流畅。详见73；完整SR/AC保持。
- 2026-10-25：2026-10-25林长风左向六帧制作完成并复看222像素起收势，源与runtime候选已保存，registry及原生接触验证继续。成功移动输入采用即时战斗投影的短测已报告明显下降，尚待冻结、独立读回与同源桌面验证；暂停/恢复完整投影耗时仍待处理。详见73，SR/AC保持。
- 2026-10-25：2026-10-25 party10 FAILED before ready: combat HUD still reads people.find from the new light projection. Real wound-field and DOM render regression fix is pending. Root closed the isolated QA window normally; lifecycle closed at 2026-10-24T18:19:00.899Z, process exited 1, source unchanged. Original failure report preserved; stale lock moved into the QA evidence directory. Lin left attack registered (23 clips), 556 direction/phase samples and 5 frame tests passed. Full SR/AC unchanged; see 73.
- 2026-10-25：2026-10-25 user added a reusable-skill deliverable: first complete and verify one full sword-combat animation set, then distill the proven art/extraction/integration/repair workflow for other weapons and spells. Full solo/party/group goal remains. Root owns art and skill; code agents remain GPT-6.1-sol xhigh. Ground-preview inspection still suggests jogging foot slip; measurement is pending, runtime gait unchanged. See 73.
- 2026-10-25：2026-10-25 full-sword sample: root produced and inspected four right-dodge poses; source saved, external pack only. Formal phase probe found repeated playback when all frames use evade; preparing explicit windup/release/recovery/evade mapping without changing movement rules. HUD real-DOM regression reproduced before repair and passed after adding authoritative masterWound; full native rerun remains pending. See 73. SR/AC unchanged.
- 2026-10-25：2026-10-25 party11 native passed all 17 checks after the HUD repair: tick265353 to265721,179.475589s, source/runtime/native-save/closed all true, errors and finalizationErrors empty. WorldPump p50/p95/max1.3/16.3/42.7ms versus party09 15.5/107/195.4ms; rAF still peaks199.9ms, so full smoothness remains unproven. Root contact screenshot shows remaining close-body overlap. See73; full SR/AC unchanged.
- 2026-10-25：2026-10-25 dodge sample: four explicit phases repacked and right clip registered; left four-frame asset prepared and registration pending. Root ran Blender foot measurement v2 successfully (measure02, inputs unchanged); original camera forward26.7324deg differs from formal30.3603deg, and measured sole motion still differs from ground. Repaint foot calibration remains unapproved. Remaining party11 long tasks correlate with pause/skills; QA readCombat hidden full query is being repaired before next performance run. See73; SR/AC unchanged.
- 2026-10-25：party12 passed17 native checks, source/runtime/native-save/closed all true; root saw new left-dodge frame. Active status126 reads p95/max0.1ms, full reads0; rAF max460.6ms remains unresolved. Left spell registered; right-idle four-frame candidate prepared, fallback repair pending. Calibrated jog repaint still needs contact correction. Complete sword sample and reusable skill remain in progress; SR/AC unchanged. See73.
- 2026-10-25：用户要求参照鬼谷八荒改为远程斗法及大场地。48×32米林间、跟随镜头、10米移动剑气已接入；victory-02原生19项流程通过，实际命中/施法接闪避/避岩刺/胜利返院与原生重开成立，来源和运行保持。同源worldPump尖峰1001.5→317.8ms，仍不流畅；跑步帧及整体美术未完成，完整SR/AC保持，详见73。
- 2026-10-25：战斗integrated-01原生7项通过，265258→265600、active34.199秒，来源/运行/保存/正常关闭一致。首键1.1ms，保存同步42.7/40.5ms；世界步232ms、窗口activity完整投影61ms仍未解决，完整流畅度未通过。用户当前要求改美术并调研开源动效，单人/同行/群战及完整SR/AC保持开放。详见73。

本文件由[registry.json](../registry.json)派生；更新台账后执行 `python scripts/requirements/sr-manager.py refresh`，不单独修改此派生页。
