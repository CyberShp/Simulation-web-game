# 云岫山院与山谷 · U-123 实玩记录

当前开局收口证据见[同一普通新档连续实玩](OPENING-CHAIN-2026-10-12.md)与[开局指引及携药入口](OPENING-GUIDANCE-2026-10-13.md)。本文保留 U-123 分段实玩的原记录。

日期：2026-10-12。实施顺序与玩法范围见[41 号实施记录](../design/41-COURTYARD-VALLEY-IMPLEMENTATION.md)。本页记录美术、界面、玩家操作及发布核对证据；目标设备和玩家美术评看分别登记。

## 三段画面与操作入口

| 阶段 | 当前本地画面 | 玩家入口 |
| --- | --- | --- |
| 山院第一炉 | [丹房完整外观](../../archive/godot/estate_2d/assets/mountain-alchemy-house-v1.png)，百艺卷册的丹炉、方子、材料来源、单炉进度和成丹位置 | 山院营造丹房；田边／公库送料；掌门开炉；取药、入库与服药 |
| 山谷往返 | [谷地底图](../../archive/godot/estate_2d/assets/valley-ground-v1.png)、[桥](../../archive/godot/estate_2d/assets/valley-bridge-v1.png)、[洞口](../../archive/godot/estate_2d/assets/valley-cave-v1.png)、[药丛](../../archive/godot/estate_2d/assets/valley-herb-patch-v1.png)、[青萝](../../archive/godot/estate_2d/assets/qing-luo-v1.png)；场景由 `valley_scene.gd` 呈现 | 山外路线与可见出口、谷内点地行走、药丛采集、近处会面、返院 |
| 谷内首战 | [山魈](../../archive/godot/estate_2d/assets/valley-shanxiao-v1.png)、谷内战斗场景、动作与受击反馈 | 走近山魈应战，选择攻击、护持、躲避或撤退，返院治疗 |

丹房、药丛、桥、洞口和人物切图按固定斜俯视的分层绘画接入；场景坐标、身份和库存由正式世界投影驱动。山魈气血 160、基础伤害 10、起手 18 步、收势 20 步，以及丹房建位（46，26）等具体值是作者试调；U-123 确认的是三段可玩闭环和先后顺序。

## 已实际操作：山院首收与第一炉

隔离 QA 浏览器从实际新档推进到首畦，陆知微照看后，药田卷册显示首收 **13.8 份灵草**，眼前之事转向丹房。另一独立 QA 档从已落成丹房的合法存档导入，经百艺页选择灵草田作为来源，发出正式搬运工单，田边 **10 份**送达炉边后掌门开炉。炉事完成得回春散 **2 份**；一份搬至掌门随身，一份送回公库。保存、读取后，行囊仍显示随身 **1**／公库 **1**。

本地截图均来自实际 Godot 网页，保存在未发布的 QA 目录：

- 首收后的药田卷册：`output/playwright/u123-farm-first-harvest-ui.png`。实走后暂停，田边近况显示收得 13.8 份，目标切到筑炉炼药。
- 第一炉桌面画面：`output/playwright/u123-craft-desktop-complete.png`。1200×855，显示炉事完成、炉边成丹。
- 第一炉窄屏画面：`output/playwright/u123-craft-820x1180-complete.png`。820×1180，同一百艺页面可阅读并操作。

三张截图已目视检查，所述数字另由实际按钮回执与保存读取核对。该证据覆盖本机浏览器和上述操作链，未覆盖目标设备。

## 已实际操作：山谷往返

独立 QA 浏览器 **1440×960** 视口通过正式界面导入存档，掌门沿山院实走约 **50 米**到山门，经过 **8 秒**行程进入 `scene:valley`。谷内药丛存量 **18→12**，队伍灵草 **0→6**，院中公库灵草维持 **4**；随后走到青萝约 **2.2 米**内交谈，出现公开事实 `fact:rain:guardian`。掌门再走约 **34 米**到返程出口，经过 **8 秒**回院。

回院后正式工单 `work:transport:15` 运送灵草 **6** 与食粮 **3**，共 **9** 份；途中送库按钮禁用，完成时公库灵草 **4→10**，队伍灵草、食粮均为 **0**。谷内保存并读取后，人物 ID 与 `scene:valley` 保持；本次浏览器控制台 **0 error／0 warning**。

本地实际网页截图位于 QA 目录，未随文档发布：`output/playwright/u123-valley-scene-walk.png`、`u123-valley-gathered.png`、`u123-valley-qingluo.png`、`u123-valley-returning.png`、`u123-valley-delivered.png`。这组山谷截图早于字体修正；最终场景包的文字显示见下方首战截图。

## 已实际操作：谷内首战与回院治疗

战斗验收场景包 `output/u123-integrated-preview/scene-318a425f5971.pck` 的 **1440×960** 网页中，掌门走近山魈应战。青岚术使敌血 **160→123**；护息承伤时掌门血 **143→140**；剑式使敌血 **123→98**。闪避把本地 y 脚点 **4→1.2**，掌门血维持 **140**。后续承伤撤退，结果为 `retreated`，留在谷内脚点（21.9332，35.7668），伤势 **14.6853**。

确认战报后掌门走 **17.3 米**至归院道，按当时天气旅行约 **9 秒**回到山院，伤势 **14.6153**。服下先前同炉随身回春散一份，随身药 **1→0**、已知总量 **2→1**、伤势 **14.6153→0**、精力 **85.45→100**；保存读取仍在山院，零伤势，另有一份丹药。活动战斗中也实点保存读取：世界步 **5974**、掌门血 **140**／灵力 **80**、敌血 **98**及人物脚点均保持，战斗页面的存档按钮可用。

本地截图：`output/playwright/u123-battle-desktop.png`、`u123-battle-portrait.png`、`u123-battle-retreat.png`、`u123-battle-return-healed.png`。桌面 **1440×960** 与窄屏 **820×1180** 已目视，字体完整且没有横向溢出；本次浏览器控制台 **0 error**，其余为 Godot 4 日志。此为本地网页及视口证据，不等于目标设备或用户最终画面认可。

## 交付边界

三段本地操作证据与局部自动检查见[实施记录](../design/41-COURTYARD-VALLEY-IMPLEMENTATION.md)；完整 SR/AC 状态仍由[状态台账](../design/STATUS.md)核对。源码与 Pages 发布记录见下方；公开操作与本地完整操作链分别记录。

## 在院人物一致性

最终构建 `scene-ca0d89209e7e.pck` 补入公开在场人物逐一绘制，其余战斗规则与上述验收版本一致。1440×960 QA 导入合法丹房档后，院景中的林长风已可见；直接点击其身体打开同一 `person:lin-changfeng` 的详情。山外人物位置和院景点选对应同一身份，室内人物继续按建筑遮挡规则处理。截图 `output/playwright/u123-home-people-final.png` 记录实际院景。

## 发布加载

网页导出将原场景包按 16 MiB 分段，逐片核对长度与 SHA-256，合并后再次校验整包，再经 Godot 的 `preloadFile(ArrayBuffer, path)` 启动。加载失败时显示重试提示，世界时钟尚未启动。`tests/unit/web/ea-scene-pack-loader.test.mjs` 3／3 覆盖完整重组、缺片与损坏拒绝、普通导出兼容；本地实际浏览器已下载三个分片、正常进入山院并显示字体，控制台零错误。该检查追加于玩法 18 项之外。

## 公开版本

运行源码 `main` `836ccb605a42e7c21c2aae8c5e2c4eee7e55c03e` 已推送；[公开山院试玩](https://cybershp.github.io/Simulation-web-game/mountain-courtyard/) 的 `gh-pages` 为 `4d6786da521f1ab92818c20f67c036a829469e6e`，Pages 构建为 `built`。公开入口、版本记录、构建清单、八个界面／规则模块与三个场景分片共 **14 个文件**均返回 HTTP 200，SHA-256 与最终本地导出一致。发布场景包为 `scene-772e4d90182e.pck`，按三个分片加载，构建清单 SHA-256 为 `111069c4fdec82d0428621e85d3a74e83101735ed999b741db56597fac30851d`。

公开 Chromium 独立 QA 档（1440×960）已实际启动新山院、打开百艺，并经正式存档界面导入合法丹房档。掌门实走约 **35.5 米**至出口，途中保持山院行走状态；随后 `travel:sr:1` 剩余 79 步并最终抵达山谷，人物仍为 `person:master`。直接点击谷内药丛、走近并采集后，药丛 **18→12**、随行灵草 **0→6**、公库灵草维持 **4**。三个场景分片均成功加载；该次运行控制台 **0 error／0 warning**。首访 `base-ui.mjs` 曾返回一次 HTTP 503，正常刷新恢复，随后上述操作完成。

公开实机截图已目视：`output/playwright/u123-public-crafting.png`、`u123-public-valley-scene.png`、`u123-public-gathered.png`；图片保留在本地 QA 目录。公开复核覆盖启动、百艺入口、导档、实际出谷旅行与采集；炼丹、首战、撤退、返院服药和对应存读的完整操作证据见上文本地记录。
