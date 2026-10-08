# Codex 接手指南 · 2026-10-08

最新 M2 r22 已发布 SR011 公物跨场景订单及玩家明确划拨：预留、取货、运输、取消、收款保持来源权限，转入掌门私物需完成订单卡上指定数量。根复跑公开链 12/12、旧单 1/1、库存 4/4、产权 6/6、界面 17/17；独立本地 Chromium 实点划拨、购粮、返院。源码 `main` `980fa93dc71325171e3d37f48456bfa108654b50`，网页 `gh-pages` `53c38b2771dcd064a73c745e9454ac212aacc871`，Pages `built`、162 文本 blob 匹配，公网入口 HTTP 200 及改动模块字节一致。完整 SR011 AC、目标设备和公网浏览器操作待验；**36 passed、83 not_run、1 blocked**。最新状态见 [STATUS](design/STATUS.md) 与 [台账](requirements/registry.json)。

最新 M1 r21 已发布山外“此地总览”交互标签。公开来源档在本地 Chromium 的青溪坊市与驻棚实点总览、建筑点选和近景返回，坊市保存刷新续读保持场景与资源；根复跑镜头 **5/5**、界面 **17/17**。源码 `main` `050a78fa3fd33d73478401a4a733373cd8870cc1`，网页 `gh-pages` `679dab3b53c8571807f84cda36ac9b3edc6ce695`，Pages `built`、162 文本 blob 匹配。门位画稿、真机触控和真人辨识待验，SR003-AC02 保持 `not_run`；40 SR/120 AC 为 **36 passed、83 not_run、1 blocked**。最新状态见 [STATUS](design/STATUS.md) 和 [台账](requirements/registry.json)。

最新 M2 r12 已发布“百工用材”同院订单账本：正常新档真实采料入库，接单一次预留木 20、石 10，商人实际到院且掌门近身后交付，灵石 30、名声 2 仅结算一次；账本可见货、款、名声。根执行者独立重跑专项 1/1、界面 17 pass / 4 pending、顾氏相邻 1/1，本地浏览器有来源原生档保存刷新保持订单与账本。源码 `main` `833415505f4620ad23206ebb24fe261d3520be1c`，网页 `gh-pages` `016b0653ae7673c01e524eeb339532f4105a003d`，标记 `ea-160-courtyard-20261008-r12`，Pages `built`，162 个打包文本 blob 与发布树一致。公开网页浏览器因应用安全策略验证不可用未验；跨场景订单 `market-order:v2` 及 SR011 完整 AC 待实现/验收。旧经济综合脚本的旧初始化档版本失败已在合入前主线复现，见 [STATUS](design/STATUS.md) 首节。40 SR/120 AC 为 **35 passed、84 not_run、1 blocked**。

最新 M2 r11 顾氏药材互助子情景已发布：公开口信说明木架与行粮补给，玩家正常开局到青溪坊市见顾婉仪、核原单、用真实木粮换取有限 8 份灵草。根执行者独立复跑专项 1/1、相邻世界内容 9/9、地方产业 8/8、界面 17 pass / 4 pending；本地浏览器实点到人、核单、交货，294 请求全 200，控制台无错误。源码 `main` `0d6df5037c394cf0c1fa2a59df32b8704df2b716`，网页 `gh-pages` `18d8bf4e9ed8d1f8c29f8f919bcf32342918acab`，标记 `ea-160-courtyard-20261008-r11`，Pages `built`，162 个打包文本 blob 与发布树一致。公开网页浏览器因应用安全策略验证不可用未验；完整七组织 AC、目标设备和真人仍待，SR017-AC01 保持 `not_run`。下一批 SR011 同地订单在独立工作树推进，见 [STATUS](design/STATUS.md) 首节；40 SR/120 AC 为 **35 passed、84 not_run、1 blocked**。

最新 M1 r10 源码 `main` `542b3502bd33055d62ac963f7ae1c06bdd6b4707`，游戏网页 `gh-pages` `f57c25079de2693e3625fce136f170b1de306042`，标记 `ea-160-courtyard-20261008-r10`，Pages `built`。暂停且画面输入未变时保留上一帧；合法 40 建筑/30 人档约 3 秒清画 180→0、`drawImage` 10,440→0，像素与主殿点选一致，运行态照常绘制。独立定向 1/1、相关回归 16/16；短样本不能证明运行中卡顿解决。发布包 162 个文本文件与远端 Pages 树逐项一致；公网浏览器因应用安全策略验证不可用未验，见 [STATUS](design/STATUS.md) 首节。40 SR/120 AC 仍 **35 passed、84 not_run、1 blocked**，M2 两个无冲突子批继续。

最新 M1 r9 运行源码 `main` `976619f2486328de1d4f8b64d7c1a3dfeaad7d05`、游戏网页 `gh-pages` `39ad10e34c6afa44821745cf6d7433ee4ebaedf7`、标记 `ea-160-courtyard-20261008-r9`，Pages `built`。SR007 三人肖像、当前动作及重叠点选候选同步到同一真实人物投影；模拟、存档和封闭/露天画面规则未改。正常公开命令 37 条/精确存读 24 次，生产 Canvas 1/1、界面/图集 17/17；独立本地 Chromium 实点三人、列表/档案及刷新续档通过。公网独立首载、隔离档续玩及三人来源档内存试读点选通过，198 请求全部 200、控制台 0 错误；详见 [STATUS](design/STATUS.md) 首节。AC01 真人辨识、真 iPadOS、完整动作和整项 I/V/R 继续；40 SR/120 AC 仍 **35 passed、84 not_run、1 blocked**。r8 单页剖析见 [STATUS](design/STATUS.md)：暂停静止画面每帧整幅重绘，未证实为持续卡顿根因，后续独立优化；SR003 门人居画稿门位实测超容差且未更换生产素材。

最新 M1 r8 运行源码 `main` 为 `b661f15b7ad06b622bf56b5f0a1ab6abc71ab292`，游戏网页 `gh-pages` 为 `5cf58022ef328a6a7d9bb32ea384533f192e71f3`，标记 `ea-160-courtyard-20261008-r8`，Pages 已构建。SR003 门道排队、避让与 SR006 取消返料、施工断路重求已发布；封闭建筑仅画外观，真实室内活动照旧，露天人物继续可见。公开命令/存读专项 **16/16**、相邻回归 **57/57**，独立只读复核过室内脚点。本地 40 建筑/30 人合法旧档外观与露天点选通过；r7 浏览器冻结基线连接重置，性能 A/B 无法判定，整幅画面卡顿仍待优化。独立公开页首载、新档保存续玩、合法旧档封闭屋顶与露天人物点选通过，198 请求全 200、控制台零错误；试读命令曾等满 5 秒，持续性能仍待，见 [STATUS](design/STATUS.md) 首节；台账 **35 passed、84 not_run、1 blocked**，SR003/006 I/V/R 和总目标未关闭。SR007-AC01 下一子批在独立工作树开发。以下保留历史记录。

最新 M1 r7 已发布药田/谷仓画面缓存与 SR006 同设施正常施工串行 QA：缓存专项 **1/1**、相邻画稿/场景/世界 **21/21**；三组合法旧档浏览器 A/B 显示局部减负，帧间隔 P95 未稳定下降，整幅画面卡顿未解决。SR006 真实公开操作 93 命令、62 次精确存读，建造→升级→迁建→拆除及草药库存/返料一次结算专项 **1/1**；取消/失效、完整网页串行和目标设备仍待。源码 `main` `024898c4a6290d138eb428c0139ca7b2d8fcb781`、网页 `gh-pages` `c6dab928a8ae50c7f750a3cafa6c729723e85ef9`、标记 `ea-160-courtyard-20261008-r7`，Pages `built`；公网隔离浏览器复验见 [STATUS](design/STATUS.md) 首节。台账保持 40 SR/120 AC：**35 passed、84 not_run、1 blocked**，仅 SR001 整项通过。SR003 门道让行仍在 `/Volumes/Media/immortal` 未提交工作树开发，下一批需从 r7 基点隔离合入并独立验收。

最新 M1 SR003 山外局部镜头子批 r6 已发布：局部场景使用 64×48 米、45° 投影与四角地物绘制；封闭驻棚屋顶遮住室内人物并选中建筑，地点卡可按姓名打开邢烈，谷地露天青萝可见可点。本地独立专项 **5/5**，相邻 SR003 **3/3**、输入 **13/13**、世界 **21/21**；两视口浏览器合法档通过。源码 `main` `6617b8670fd396a488469a864ba170b4f2681425`、网页 `gh-pages` `a6fd4838ff0ba998a7f1bb20b97016aa298ddf37`、标记 `ea-160-courtyard-20261008-r6`，Pages `built`，公开四个脚本与发布树一致。公网首载模块 HTTP 503 导致一次页面失败；一次重载后隔离档新建/保存/刷新续档及合法驻棚试读通过，失败记录仍在 [STATUS](design/STATUS.md)。SR003-I01 进行中、AC02 `not_run`，V/R 与整项待完整验收；40 SR/120 AC 仍 **35 passed、84 not_run、1 blocked**。下一批处理田地绘制卡顿和 SR006 同设施施工串行证据。

以下为较早批次记录。

M1 SR006 安全营造交互子批已发布：设计 D01/D02 独立复核通过；迁建候选/取消/显式确认、拆除具名影响、升级扩地预查及施工取消/拆除床位复核均已接入。正常公开命令 **4/4**、空间 **36/36**、室内 **8/8**，本地合法占床住宅档的升级/迁建下单与保存刷新经独立 Chromium 复核。源码 `main` `d4bd7483b1e03adb0fedd9982a9f50fc348bb6e3`，网页 `gh-pages` `62605de80065fafcef99d084dcdac2e6ae2d28e7`，标记 `ea-160-courtyard-20261008-r5`，Pages 已构建；公开网页新建/保存/刷新和合法住宅迁建确认通过，控制台无错误。实际完工、拆除执行、真机及真人仍待，SR006 I/V/R 不关闭；40 SR/120 AC 为 **35 passed、84 not_run、1 blocked**，仅 SR001 整项通过。当前下一批 SR003 山外 45° 镜头与物件投影接缝已启动，详见 [STATUS](design/STATUS.md) 与 [台账](requirements/registry.json)。

最新 M1 SR002 知识投影子批已发布：观察者的消息证据、核实程度、实际收件时刻、位置和危机/旧案结果按本人真实取得的事实投影。独立专项 **5/5、7/7、6/6、7/7**，相邻世界 **21/21**、契约 **24/24**；本地合法传闻档试读不落盘，新建保存刷新续档通过。源码 `main` `56639dc8925a5697782edd41db37e7fa49fb5035`，网页 `gh-pages` `03d3e30cd6c618e12958351afa5afaf845f382b5`，标记 `ea-160-courtyard-20261008-r4`，Pages 已构建，公开契约模块哈希与源码一致；独立公开 Chromium 合法传闻试读、刷新不落盘、新建/保存/续档通过，控制台 0 错误/0 警告。8080 静态服务模块连接重置，本地 UI 验收由同一 dist 的 8177 刷新后完成。广义集成脚本 4 处开局运输断言在上一源码也复现。权威边界见 [STATUS](design/STATUS.md) 和 [台账](requirements/registry.json)；40 SR/120 AC 为 **35 passed、84 not_run、1 blocked**，仅 SR001 整项通过。SR002 I/V/R、历史来源完整矩阵、真 iPadOS 和全玩家链继续。下文首段起为上一批记录。

本批 M1 子批已发布：SR002/030 版本组合和隔离迁移门禁、逐人实际送达时刻、SR005 选址预览与显式确认。独立版本 9/9、送达 5/5、共同契约 24/24、空间 35/35、选址 6/6。运行源码 `main` `729d24a148f744c535b2abbe93cbec7429c482e0`、网页 `gh-pages` `73f716cddf1464658730066cfb093c0e13c41324`，标记 `ea-160-courtyard-20261008-r3`，Pages 已构建；公开 Chromium 新建/保存/刷新续玩、合法档点地改选/冲突/取消/一次确认扣料与工单均通过，控制台零错误。旧仓库外 QA 档因孤立收据字段被拒，公开选址复验使用完整校验后的规范化副本；见 [STATUS](design/STATUS.md)。真 iPadOS、知识权限逐字段、历史来源全矩阵和整项 I/V/R 继续。下文首段起为上一批记录。

M1 最新窄项：SR002 历史离宗档不再生成活跃身体或可传话对象，SR003 竖屏主殿完整外观和触点缩放在真实 820×1180 画稿及定向测试通过，SR005 两个排他施工位共享真实进度/材料且动态占位与伪造存档拒载。合并定向 46/46，独立复核通过；三项整项仍未关闭，边界见 [STATUS](design/STATUS.md) 与台账。运行源码 `main` `e4bc0907f6cd9da2406e7653ca0081a12395ff33`、游戏网页 `gh-pages` `8e734f6efd149bc9435336b52d3ee0d6058c595b` 已发布，Pages 构建成功；公开 Chromium 的独立验收档已新建、保存、刷新并续入同一世界，控制台 0 错误。缓存标记 `ea-160-courtyard-20261008-r2`；QA 截图与档案仍在仓库外。

SR002 设计与独立审阅 D01/D02 已通过：共同字段、命令事务、作者卡编译与版本矩阵见 [共同契约设计](requirements/design/SR-XF-002-030.md)，台账状态 `ready`。旧离宗 `compatibilityMode`/`recordScope` 接缝已在本批窄范围验收并发布；I01 下一步是版本组合门禁、历史外观/日程来源和知识消息实际送达时间，分别用坏组合/旧档/延迟转述验收。原 AC、I/V/R 不因单项修复关闭。

设计接续补充：SR005-D01/D02 选址、预览确认、施工位、材料与安全完工契约已补齐并通过独立审阅，设计状态 `ready`；I/V/R 与目标设备验收继续。SR003-AC02 的竖屏选中建筑安全区已在本批窄范围修复并核对，门洞画稿未替换，AC02 仍待验。每批运行代码或素材独立验收后，按 [交付计划](DELIVERY-PLAN.md) 推送源码并更新现有游戏网页。当前运行时发布检查点见首节。

上一发布检查点（历史记录）：源码 `main` 检查点 `9e39ae959f7cc4a430e05cd22cda964af197d947` 已推送，现有 [游戏网页](https://cybershp.github.io/Simulation-web-game/) 的 `gh-pages` 检查点 `603a3a821e253c57e74e3ddd1dcbf9ed7bb154ca` 已构建；公开网页独立验收档完成新建、山院、保存与刷新读回。U-101 按用户确认采用封闭建筑显示外观、室内真实活动照常运行、露天工人可见可选；缺图施工按地基、开放木架、封闭收尾分阶段回退，六类 18 个生产 Canvas 快照独立通过。SR004-AC01/02/03 均按现行口径独立复验为 `passed`，但 SR004 整项 I/V/R 继续。SR003/004/011 的 D01/D02 设计审阅已完成；SR003-AC02 的门高及竖屏详情遮挡仍待修复，真 iPadOS/目标设备与真人视觉未验。40 SR/120 AC 当前为 35 passed、84 not_run、1 blocked，整项仅 SR001 通过。详细证据与发布边界见 [STATUS](design/STATUS.md) 首节；后文保留各批形成时的记录。

最新 M2 首批：SR008-AC01 从正常开局经正式公开命令完成接受、同条件重复不重抽、设施停用拒绝、恢复后重评估和真实工位执行；五阶段精确存读、原生导入及隔离桌面浏览器管理页复验后，根 Agent 独立按原文登记 `passed`。`dist/ea-sr-persons.mjs` 修正同世界步旧活动理由和承诺倒计时误报；不改结算。完整证据见 [STATUS](design/STATUS.md) 首节和 [registry](requirements/registry.json)。120 AC 现为 26 passed、93 not_run、1 blocked；SR008-AC02/03 与整项 D/I/V/R 继续，本地未提交、推送或发布。

M1 第十批：SR007-AC02 的同一掌门换衣、真实制作法器、三场战斗和返院，在五份有来源档精确存读、生产画布与隔离桌面浏览器复验后获独立只读复核 `passed`；战斗状态现据真实身体活动显示“临敌交锋”。并行修复 SR006 迁建时建筑足迹内携货人被锁而施工等待货物的相互等待，公开操作 4/4、空间及家具 42/42，原 SR006 三条 passed AC 保持有效。主屋、医庐、藏经阁新增七阶段画稿后共有 4/14 类，阶段/空间定向 46/46；SR004-AC01 继续 `not_run`。详细来源、截图、未覆盖项见 [STATUS](design/STATUS.md) 首节和 [registry](requirements/registry.json)；第十批工作树、来源档与浏览器证据备份在 `/Volumes/Media/immortal-delivery-backups/2026-10-08/immortal-m1-batch10-working-tree.tar.gz`、同目录 `immortal-m1-batch10-evidence.tar.gz`。该批结束时 120 AC 为 25 passed、94 not_run、1 blocked，整项仅 SR001 passed；SR007-AC01 的真人辨识、真 iPadOS、其余十类阶段建筑与整项 D/I/V/R 未完成。本地未提交、推送或发布。

最新 M1 第九批：同一掌门由公开命令在真实床位 3 休憩、书案 1 研习、四批采木后满包等候，三态各自精确存读，身份稳定。`dist/ea-life.mjs`/`dist/ea-ui.mjs` 修正满包暂停被旧 `master.action=rest` 误写为主屋休憩；浏览器画布点选及研习图集缺失回退保持真实书案详情和基础同身份人物。独立只读复核按原文给 SR007-AC03 `passed`；连续动画、真人辨识、iPadOS 与 SR007-AC01/02、整项 D/I/V/R 继续。证据见 [STATUS](design/STATUS.md) 首节与 [台账](requirements/registry.json)；第九批工作树/证据另存 `/Volumes/Media/immortal-delivery-backups/2026-10-08/immortal-m1-batch9-working-tree.tar.gz`、同目录 `immortal-m1-batch9-evidence.tar.gz`。本地成果未提交、推送或发布。

最新 M1 第八批：SR004-AC03 的缺图/旧尺寸图三种门人居回退在有来源档的隔离浏览器通过；全图集缺失暴露伐木场“空地仍报两个工位”，现已按权威预制件槽位补齐露天回退。修复后实际点选伐木场侧卡为 0/2，Canvas 覆盖伐木、采石、聚灵台、现行与旧版灵泉工位。独立只读复核按原 AC 登记 `passed`，SR004-AC01 与整项 D/I/V/R、13 类完整阶段素材和真机视觉仍未完成。证据见 [STATUS](design/STATUS.md) 首节与 [台账](requirements/registry.json)；第八批工作树与证据另存 `/Volumes/Media/immortal-delivery-backups/2026-10-07/immortal-m1-batch8-working-tree.tar.gz`、同目录 `immortal-m1-batch8-evidence.tar.gz`。本地成果仍未提交、推送或发布。

最新 M1 第七批：SR004-AC02 的调养、研习、休憩已从正常公开命令到实际室内床位/书案，逐份精确存读、生产 Canvas 与隔离桌面浏览器画布点选，独立只读复核后按原文登记 `passed`。研习中的旧休憩字段误导侧卡与姿态已修复；到位前的详情也不再误称山外。SR007-AC03 只取得研习子情景证据，保持 `not_run`；SR004/007 整项、其余 13 类阶段画稿、完整动作及目标 iPadOS 验收未关闭。详见 [STATUS](design/STATUS.md) 首节与 [台账](requirements/registry.json)。第七批工作树和三份来源档/截图另存 `/Volumes/Media/immortal-delivery-backups/2026-10-07/immortal-m1-batch7-working-tree.tar.gz`、同目录 `immortal-m1-batch7-evidence.tar.gz`。本地成果继续保持未提交、未推送、未发布，先保护完整工作树再变更基点。

最新 M1 第六批：SR003 的总览→近景按钮放大已保持当前选中人物/建筑在画布内，明确滚轮/双指触点仍保持同一世界点；残留悬停与同号建筑/门人不会错聚焦或错显姓名标签。隔离真实浏览器以有来源返院档复验 820×1180、1200×843 两视口，生产 Canvas 34/34、输入 13/13，独立只读复核通过。真 iPadOS 双指、逐建筑人物/门视觉比例及详情遮挡仍未验，SR003-AC02 保持 `not_run`。详细证据见 [STATUS](design/STATUS.md) 首节和 [台账](requirements/registry.json)。第六批工作树与浏览器证据分别另存 `/Volumes/Media/immortal-delivery-backups/2026-10-07/immortal-m1-batch6-working-tree.tar.gz`、同目录 `immortal-m1-batch6-evidence.tar.gz`；本地仍未提交、推送或发布，继续 M1 建筑与人物动作及目标设备验收。

最新 M1 第五批：SR002-AC01 已从 `/tmp/immortal-m1-well-realm11-earned.json` 的有来源山院档以公开命令续跑并逐点存读，覆盖出发前、途中、抵达、受伤实战和返院；独立复核 18 个阶段档、同一掌门与装备实例、三战三死、双结局，按原 AC 运行时口径登记 passed。战斗预留身体内的玩家指令与胜利同世界步确认结算已修复。约 3.5 MB 的首战档在隔离真实浏览器导入、保存、刷新续玩并再次连续保存成功；本地较大存档和三份备份采用同步压缩，导出仍为普通 JSON。35/35 持久层测试和 5 MiB 模拟配额下真实结局档连续保存复核通过。全 40 项 SR 尚未完成；M1 继续 SR003–007、029/030 的未通过门槛，真实设备、触控、真人与发布按台账逐项验收。详细证据见 [STATUS](design/STATUS.md) 首节和 [台账](requirements/registry.json)。工作树与验收证据分别另存 `/Volumes/Media/immortal-delivery-backups/2026-10-07/immortal-m1-batch5-working-tree.tar.gz`、同目录 `immortal-m1-batch5-evidence.tar.gz`；源码及素材仍是未提交本地成果，保留原工作区。

最新 M1 第四批：SR007 装备实例的肖像/山院/山外及战斗挂点已统一，陆知微新档借剑同行返院 10 公开命令、5 次精确存读通过，独立只读复核与 Canvas 定向通过；完整自然实战和浏览器视觉仍未验。SR010 掌门搬运结束残留行走动作造成下一正式命令被存档校验拒绝，修复后经济 52/52，独立完成/取消检查通过。SR002 正常公开链已由实际采石、招募恢复五人、在世界步 439776 正式建成灵泉，并出现有来源公库晶石；整条复仇实战返院仍在补验。SR030-AC02 以旧布局冲突/无处安置和未知引用的实际档位迁移/拒载、原文导出与备份恢复证据通过 Node 契约验收；整项 SR030 未完成。详细证据及边界见 [STATUS](design/STATUS.md) 首节和 [台账](requirements/registry.json)。59 个当前修改/新增文件另存 `/Volumes/Media/immortal-delivery-backups/2026-10-07/immortal-m1-batch4-working-tree.tar.gz`。未提交、未推送、未发布，保留当前全部未提交成果。

## 任务与交付边界

最新 M1 第三批：SR003-AC01 已用新档公开操作验证门道进出、堵门原子拒绝、绕行与精确存读；SR004 的屋内门人显示/点选已由独立生产 Canvas 复核与浏览器内存试读，14 类建筑目录已审阅，完整阶段素材仍仅门人居具备。商人空闲精力恢复修复后，从正常档实得两批工坊收货及付款守恒；成长链公开操作达到第 11 境，但晶石采购在有限现货下受阻，SR002 完整旅行→实战→返院仍未验。准确证据和未覆盖边界见 [STATUS](design/STATUS.md) 首节及 [台账](requirements/registry.json)。未提交、未推送、未发布，先保护整个工作区再切换模型或基点。

2026-10-07 目标模式接续：M1 的 SR002 战斗共同身体/伤势子链已实现，独立复核发现并修复同 tick 致胜与致命反噬竞争；战斗定向及旧回归合计 30/30。SR004/007 首批门人居七阶段、六身份等待/研习静态画稿已接入；独立复核三处绘制/点选/回退接缝修后，相关定向 22/22。正常新档工坊/匠人链最新复跑 510 公开命令、250 次精确存读通过；房屋地基/主体/收尾及完工在独立浏览器内存档观察。SR002 完整同档旅行→实战→返院、其余建筑/动作、真机/真人与适用发布均未完成，原 AC 和整项 D/I/V/R 未关闭。第 8 境正常检查点可恢复，但长期成长脚本仍未跑通；初始“无资源来源”判断已由异地公库真实搬运推翻，后续生产安排/成本需继续核对。权威细节见 [STATUS](design/STATUS.md) 与 [台账](requirements/registry.json)。本地仍未提交，原始备份保留。

2026-10-07 M0→M1 首批已在当前未提交工作区执行：M0 仓库外快照、SR002 字段/缺口对照与新档公开旅行身份存读子链、SR003/029 缩放接线、SR005 自由营造镜头 NaN 修复和鼠标新档两次营造、SR030 旧完成档旅行脚本恢复。输入 13/13、空间 34/34（含生产 Canvas）、共同契约 19/19、旧档旅行 7/7、新档旅行子链 1/1，独立只读复核及实际浏览器重载已记录于 [STATUS](design/STATUS.md) 首段；台账按适用子情景更新，完整 AC/D/I/V/R 没有被局部结果替代。当前目标仍为 M1 未完成项，先补 SR002 实战同一身体与生命值契约，再续 SR003–007、029/030。开工前 40 个未提交文件可从 `/Volumes/Media/immortal-delivery-backups/2026-10-07/immortal-m0-20261007-working-tree.tar.gz` 恢复；本批 44 个当前修改/新增文件另存为同目录的 `immortal-m1-batch1-working-tree.tar.gz`，尚未提交或发布。

用户已要求继续开发及验收。本文是导航和接续检查点；详细规则与权威任务状态仍归各设计文档和 SR 台账。此前成人家具、静态卧姿、现场交互及活动中断画面修正已本地实现，发布状态与已验证范围分别记录于 [STATUS](design/STATUS.md)：采集／来源恢复暂停时不再显示劳动，当前人物画稿不再被标为完整动画；伤势／低精力／包裹满、存读与恢复 3/3，离位仍待单独验收，SR-XF-007/009 仍未整项通过。

仓库：`CyberShp/Simulation-web-game`。当前在 `/Volumes/Media/immortal` 的 **main** 工作区继续，先读取并保留全部已存在的未提交增量；远端 main 尚不包含本地最新一批。需要迁移到其他工作区时，先明确保存并带上这些源文件、美术、文档和测试。源码在 `dist/`，`gh-pages` 是独立发布产物分支。

全量执行顺序见 [40项SR交付计划](DELIVERY-PLAN.md)：M0接续、M1完整小院，随后按依赖完成经营、成长、世界与分支、前期验收及其余8项，最后做40项总交付。该计划的第5节是Sol首批任务，第9节可直接用作执行指令；实际状态继续查SR台账。

## Sol 高／极高接续执行约定

本约定同样适用于所有接手模型与委派 Agent。模型或推理强度切换不改变既定设计，也不降低完整交付与验收门槛。根入口 [AGENTS.md](../AGENTS.md) 的跨模型规则必须先读。

每批开始用下面四行建立可检查的工作范围；已授权范围内直接执行，不把交接记录变成重复确认流程：

```text
本批需求：SR-XF-xxx / 对应 AC；已具备的前置契约与尚未完成部分
设计依据：U/R/T 编号 + 当前规格的具体章节
预计修改：文件或模块，以及影响到的身份、空间、活动或存档接口
验收：正常公开操作 → 可见结果 → 失败/拒绝或中断恢复 → 精确存读 → 相关界面
```

如果设计条款与当前实现不同，把差异记为待实现或缺陷；不能反向修改 AC 以迎合已有代码。确需改变已确认原则或范围时，先列清原约束、新需求、影响及选择，等待用户确认；作者已获授权的具体内容和数值按R/T补齐，并同步受影响规格。

### 每批都要守住的设计事实

| 约束 | 接续要求 | 权威来源 |
| --- | --- | --- |
| 体验重点与美术 | 优先经营、人物成长、场景交互；固定正交2.5D，沿用云岫绘画素材，标题与正文均须可辨认 | U-95–100；[03](design/03-SPATIAL-ART.md) |
| 统一空间 | 96×96米山院，2米营造格、0.5米导航；成人床0.9×2.2米；预览/工地/成品/入口/工位/碰撞/命中来自同一空间定义 | R-27–30；[03](design/03-SPATIAL-ART.md) |
| 人物自主与身份 | 仅直接控制掌门；门人根据意愿、材料、路程和空位行动；地图、肖像、成长、装备、出行使用同一持久人物 | U-02；[01](design/01-CHARACTERS.md)、[05](design/05-RUNTIME-CONTRACTS.md) |
| 时钟与结算 | 单一模拟时钟，暂停/后台/关闭不推进；UI与渲染只读；到场、有效预约和材料齐备才执行，扣费/退款/产出结算一次 | [05](design/05-RUNTIME-CONTRACTS.md) §§4–8、13 |
| 存档与兼容 | 先校验原档，再隔离转换；保留身份、投入、资源、时间、随机结果、既定事件和结局；失败保留原档；schema6与已登记布局版本按实际代码处理 | [05](design/05-RUNTIME-CONTRACTS.md) §11；[14](design/14-EARLY-GAME-DETAILED-DESIGN.md)；R-28–30 |
| 世界与故事 | 前期炼气至筑基、固定有限责任人的复仇真正收束；永久死亡有过程与有限知情；救援须实际行动；重要真相与稀世暗线预先写定 | [04](design/04-WORLD-STORY.md)、[08–12入口](design/README.md)、[14](design/14-EARLY-GAME-DETAILED-DESIGN.md) |
| 运行时AI | 可选、默认关闭，不能裁定世界真相、伤害、奖励或生死；无API仍能完整玩已实现内容 | [11](design/11-AI-CONTENT-CONTRACT.md) |
| 证据与完成 | 正常链不注资或改境界；组件、Canvas、浏览器视口、真机、真人、FPS分别记；SR全部必需AC满足后才宣告整项验收通过 | [06](design/06-OPENING-ACCEPTANCE.md)、[需求门槛](requirements/README.md) |

先按下文“已知差距及下一步”继续完整小院，再推进供给、成长和分支；该顺序不是缩减U-94的40项总目标。接手第一步是读取现有差异、把本批剩余AC与实现逐一对应，不重新开发已经通过且仍有效的成人家具/静态卧姿链。偶发启动加载失败保留待定位，不能把重载成功当作根因已修复。

交付前另一个 Agent 按上述依据只读复核实际差异和证据；主 Agent 处理发现的问题、确认公共命令与模块接缝，再更新各项状态。复核无法独立完成时明确记录，不用“高/极高”设置或自评代替验收。

## 版本检查点

| 项目 | 已核实基点 |
| --- | --- |
| 设计 | DB-2026-10-05 v1.2；最新方向 U-100，单位格 U-99/R-28，扩容 R-29，成人家具 R-30 |
| 运行时 | EA 1.6.0-dev / schema 6 |
| 已发布游戏源码提交 | `eb5cca59b226c49c184a2082bcdda5ebd64de3fb` |
| 本批本地接续基点 | `1b28260007c3049d077dfce424d0db2c6e8cbd60` |
| 本批状态 | 成人家具/静态卧姿/现场交互已本地实现，尚未提交或发布本批 |
| 已部署 gh-pages | `809d5bb8aecfbfc2a4681fd706e6597ed62297b3` |
| 部署任务 | `37541344563`，completed/success |
| 缓存标记 | `ea-160-yunxiu-2d-20261007-r1` |

[正式开发版](https://cybershp.github.io/Simulation-web-game/?v=ea-160-yunxiu-2d-20261007-r1)。接手时重新核对分支头；以上是检查点，不要覆盖后续其他人的提交。

## 必读与权威来源

1. 根目录 `AGENTS.md`。
2. `docs/design/README.md`、`00-BASELINE.md`、`DECISIONS.md`、`STATUS.md`。
3. `docs/design/05-RUNTIME-CONTRACTS.md`、`06-OPENING-ACCEPTANCE.md`、`14-EARLY-GAME-DETAILED-DESIGN.md`，再按任务读对应分系统规格。
4. `docs/requirements/README.md`、`BACKLOG.md`、`registry.json` 和对应 `items/SR-XF-xxx.md`。
5. `docs/HANDOFF.md` 最新段；更早段落仅是各版本历史证据，不把其中“当前”误作最新。

修改台账后运行 `python3 qa/sr-manager.py refresh`；不要只改派生 Markdown。U 是用户确认，R/T 是作者默认或可调参数，不能混淆。未答的神道王朝所在地/宗门安排保留未定，不继续主动追问或阻塞前期。

按问题选择权威：用户指令与决策登记确定方向，分系统规格及05确定行为契约，当前源码与STATUS最新证据确定实际实现，registry确定SR状态。本文和README负责导航，不能覆盖上述领域依据。05中的目标字段与历史迁移说明须对照当前加载器，保持现有兼容；不能根据局部示例另建平行状态或重做已经有效的实现。

## 已实现与真实进度

- 正式主线此前已通过正常公开命令贯通开局经营、伤匠装备、筑基三层、固定三人复仇、双结局和返院继续经营；不需要重做开局，也不能据此宣称所有系统完整验收。
- 固定正交 2.5D，沿用原 12 类独立建筑外观及 6 列精细人物图集。人物身份、spriteIndex、配色和外观配方稳定，地图/肖像/斗法同源。新增草地与透明竹松山石沿用旧画风。
- 山院 64×64 → 96×96 米，面积 2.25 倍。营造单位格 2 米，48×48 格；导航精度 0.5 米，人物连续移动。伐木场/采石场 2×2 格，主屋 4×4 格，不恢复铺路。
- 同 schema 6 增加 `spatial.extentVersion='courtyard-96-1'`。未标记旧档先按 64 米校验再登记扩容；非法位置或未知版本拒绝。保留人物/建筑坐标、身份、物资、工序、时钟与 RNG。
- 本批新增 `adult-furniture-1` 室内布局：0.9×2.2米成人床、匹配书案和工作台、带版本的旧工位/脚点迁移。六身份静态卧姿在真实到床后显示，支持床面身体点选和缺图回退。建筑侧卡显示实际容量及现场人物头像，指针抬起防误点与推荐营造确认已修正。
- 台账：40 SR / 200 子任务 / 120 AC。开发 8 implemented、32 in_progress；整项验收仅管理 SR001 passed。AC 为 18 passed、101 not_run、1 blocked。不要换算成“游戏完成百分比”。

## 必须保持的契约

仅直接控制掌门，NPC 自主；所有玩法共用同一持久实体、身份、空间和模拟时钟。关闭/后台不推进，渲染与只读 UI 不发奖励、不推进生产。迁移不能重抽人物或静默清空旧档；正常流程验收不能注入资源、位置或境界冒充实际游玩。

UI、路径、占地、工位、命中与投影使用同源事实；新可见障碍必须与碰撞一致。只针对 iPadOS、Windows、macOS 网页尺寸适配，网页视口不等于实机。

## 关键代码与美术位置

- 启动与主循环：`dist/ea-game.mjs`、`ea-opening-sim.mjs`、`ea-sr-runtime.mjs`。
- 空间/导航/存档范围：`dist/ea-sr-spatial.mjs`、`ea-scene-geometry.mjs`、`ea-building-grid.mjs`。
- 场景/人物/UI：`dist/ea-courtyard-renderer.mjs`、`ea-character-art.mjs`、`ea-ui.mjs`。
- 地形与资产注册：`dist/ea-estate-ground-art.mjs`、`ea-estate-assets.mjs`、`asset-manifest.json`。
- 原人物：`dist/yunxiu-courtyard/assets/characters.webp`；静态卧姿：`dist/assets/estate-v1/characters-rest-v1.png`；原远景：`dist/assets/map.webp`；建筑及草地/植被：`dist/assets/estate-v1/`。

## 已有证据与复验

本批本地：成人家具/单位格/空间定向检查48/48（8/6/34），六身份卧姿与预约前提2/2；正常公开命令接受/拒绝邀请两路通过（60命令/36次精确存读与61命令/37次精确存读）；覆盖营造、生产搬运、研习、到床休息、暂停与迁建取消/续建。生产Canvas4/4覆盖8项素材加载、身体点选、暂停帧/存档只读和真实缺图回退。旧v5完整档40建筑/30门人保留资产、时间和return结局，全入口可达、二次存读一致。独立验收档在1366×900、1180×820、820×1180三个DPR1鼠标视口均通过实际卧床人物点选；推荐营造经Enter及鼠标确认、扣除木石、实际施工落成。指针离开画布挤移营造按钮的问题已修复。一次动态模块加载失败经页面重载恢复同档，原因待定位，随后流程无新增错误。相关组件59项通过，发布打包使用既有python3临时入口重跑1/1，开局引导12/12。当前完整记录见 [STATUS](design/STATUS.md) 首段。

上一实现轮：人物/扩图/单位格/UI/输入 60/60，空间 34/34，打包 1/1，共 95 项局部自动检查。正常新开局接受/拒绝邀请分别完成 33 个公开命令、22 次精确存读；这些与注资组件夹具分开记录。发布树 160 个文本文件和 7 张 WebP 与本地逐项相同。

真实网页检查：1363×936，独立验收存档恢复、人物实际走出主屋、素材加载、缩放、拖动、暂停和主屋详情点选。没有测真实 iPad 触屏、目标设备 FPS 或完整玩家首次体验。完整旧档测试使用仓库既有 `qa/ea-reference-world.json`，不要恢复对缺失历史 dump 的依赖。

仓库根目录可执行：

```bash
python3 qa/sr-manager.py validate
python3 -m http.server 8080 --directory dist
```

另一个终端执行最近改动的定向检查（Node 需支持 `node:test`；Canvas 测试需能解析 `@napi-rs/canvas`，纯浏览器运行不依赖该测试包）：

```bash
node --test tests/ea-character-atlas.test.mjs tests/ea-scene-ui.test.mjs tests/ea-narrative-ui.test.mjs tests/map-input.test.mjs qa/ea-building-grid-acceptance.mjs qa/ea-estate-extent-acceptance.mjs
node --test qa/ea-sr-spatial-acceptance.mjs
node --test tests/ea-release-package.test.mjs
node --test qa/ea-indoor-furniture-acceptance.mjs
node qa/ea-courtyard-life-acceptance.mjs --output-dir /tmp/immortal-courtyard-life
node --test qa/ea-courtyard-rest-render-acceptance.mjs tests/ea-rest-pose.test.mjs
```

本机已有Canvas依赖位于 `/Users/shepard/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules`，运行Canvas测试时可设置 `NODE_PATH` 指向该目录；其他环境按实际依赖路径配置。依赖缺失应明确报环境阻塞，不跳过后宣称通过。浏览器使用 `?acceptance=qa-codex-handoff` 等独立验收空间，不能覆盖正式三个档位。测试日志/截图/新测试存档留在仓库外，不提交。

## 已知差距及下一步

1. **完整小院：SR003–007/029。** 优先收口营造、工位、室内、遮挡与实际交互；旧建筑屋外精细，室内仍有代码绘制风格差异。成人床及六身份静态卧姿已本地实现；完整坐姿、劳动、疗伤、斗法动作及服饰装备完整分层仍待补。地形仍偏重复草地与边缘植被，旧水面形状规则，不能称最终美术验收完成。
2. **自主经营：SR008–011。** 围绕真实供给、搬运、预约和工作位做连续正常经营验收，补齐短缺、堵路、暂停/重载和设施变化后的恢复。
3. **人物成长：SR012–014/018。** 三路装备与修行成长分别完成正常公开链，不以单条路径贯通代表三路全部完成。
4. **危机与分支：SR023/024。** 救援、母子篇完整分支与持续后果仍需逐项验证。
5. **兼容与体验：SR030–032。** 完整旧档矩阵、真实触屏/设备性能和真人首次体验继续验收。本批浏览器出现过一次动态模块加载失败，页面重载后恢复同档；其原因仍需定位。

以上是优先顺序，不取消其余已授权 40 项 SR。逐项读 AC、实现、复验、回填，不为了关闭状态删减验收要求。

## 发布与交接规则

只推送必要源码、美术、设计/进度文档和可复用测试。用户明确不要上传验收截图、过程日志、测试存档与临时产物。普通 Git 推送若阻塞，可用 GitHub API 创建 blob/tree/commit，并使用 `expected_sha` + `force:false` 更新分支；冲突先重新读取，不能强推覆盖。

运行时变更经验证后再发布 `gh-pages`；`qa/package-pages-release.py --tag <新缓存标记> --output <仓库外路径>` 只打包文本，不自动上传新增二进制美术。根入口和 `ea-preview/` 一起核对，记录部署成功及真实网页结果。仅改本文等文档不重发 Pages。完成后更新 STATUS、HANDOFF 和对应 SR 证据。
