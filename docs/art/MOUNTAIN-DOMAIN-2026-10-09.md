# 宽庭院与山域试游 · 2026-10-09

依据U-107制作，直接验收见[山域规格](../MOUNTAIN-DOMAIN.md)。受验场景为`mountain-domain-v2`，近景素材`founding-ground-v3.png`，源图1448×1086，人物高47像素。该记录对应独立Godot Web试游。

## 实际布局与交互

主殿居中靠后，门人居与膳房分居两侧，各有独立院落；宽阔主庭、两段台阶与前庭拉开山门纵深。按相同人物身高比较，主殿至山门的图面距离由U-106的3.60个成人身高增至12.14个，约为原来的3.37倍。这是画面尺度比较，不能换算为正式存档米数。

主殿锚点(729,245)、古松(490,206)、山门(751,815)、灵泉(1090,695)。人物初始点(744,476)，观瀑台(1210,855)；石桥与观瀑步道中心线398.66图面像素。观瀑行程经主庭、台阶及石桥，南侧山门前后通行由完整巡游单独验证。所有位置属于美术试游的图面坐标。

近景以完整院落与观瀑步道为最远档，放大至2.6倍，支持拖动与跟随；继续缩小进入约6×6公里规划总览，总览1–2.2倍查看，继续放大回到近景。全景、近观、跟随仅改变镜头。两名人物延续同一位置和临时计时；暂停和后台冻结，刷新复位。

## 素材与构建

- [宽庭院素材](../../godot/painted_courtyard/assets/founding-ground-v3.png)与[完整生成提示词](../../godot/painted_courtyard/assets/founding-v3-production.json)：内置imagegen生成。
- [山域总览素材](../../godot/painted_courtyard/assets/domain-overview-v1.png)与[完整生成提示词](../../godot/painted_courtyard/assets/domain-overview-production.json)：内置imagegen生成，作为规划绘景。
- [布局](../../godot/painted_courtyard/assets/layout.json)定义道路、阻挡和绘画遮挡分片；[山域定义](../../godot/painted_courtyard/assets/domain-layout.json)定义总览及近景范围。
- 构建命令：`python3 tools/build-painted-web.py --check`；构建只打包当前使用素材，既有源码与历史素材保留。

## 验证记录

Godot 4.6.3实际导入、启动及Web导出通过。人物43/43、实际庭院193/193、山域20/20通过，覆盖入/出殿、劳动、34段巡游、障碍拒绝、山门遮挡与同深度点选、暂停/后台、观瀑往返和镜头定位。无头场景单程495帧、返程497帧；该数据是受控推进，真人行走用时另由网页记录。

浏览器、独立复核、公开发布及受验哈希在本记录后续段和[构建记录](mountain-domain-build.json)登记。目标真机、用户美术认可、完整山域精细通行、御物/遁法、正式经营与存档迁移各自保留后续验收。40 SR/120 AC的整项状态不由本试游推进。

独立代码与素材复核确认：两份v3布局完全一致，建筑间距、主庭纵深与左右独立院落对应新画稿；路线入口、终点与中心线一致。`scene-d28daeedaaa0.pck`及7个导出文件哈希匹配，场景包仅含3张活动图片、3份配置与所需场景脚本。正式经营源码未改，试游没有正式存档读写调用。复核发现的路径描述已按实际主庭、台阶、石桥、观瀑台与南门巡游分支更正。

### 本地浏览器 · 2026-10-10

独立Chromium 154验收使用隔离页面`acceptance=qa-mountain-domain-v2`，实际加载`scene-d28daeedaaa0.pck`。桌面1440×900 DPR1，以及iPad横屏1024×768、竖屏768×1024 DPR2模拟完成以下范围：

- 近景主庭、左右独立院落、山门纵深及规划总览完整；鼠标/触摸点选两人和主殿、拖动、双指缩放与两级切换通过。按钮最小44 CSS像素，DPR2画布分别2048×1536、1536×2048，无页面横向溢出，七地标可操作。
- 桌面公开地面点击到观瀑台、返回按钮折返，完整巡游覆盖上下台阶、山门后/洞内/门前及石桥。实际采样最大速度77.416图面像素/模拟秒，符合47像素人物比例；末端停止稳定。根Agent查看了全景、门前后、石桥、观瀑台及横竖屏实际截图。
- 水域与岩石拒绝通行；劳动稳定帧、入/出殿、暂停冻结、恢复、刷新复位通过。镜头切层不改变暂停中的两人位置、动作及临时时钟，localStorage/sessionStorage前后均空。
- 两人场景在桌面与横竖屏短样本显示约60 FPS、最近300帧P95约16.7ms；这是本机Chromium模拟视口数据，不能外推目标设备或150人负载。控制台0错误、0警告。

证据留在本地`output/playwright/mountain-domain/`：`load-camera.json`、`walk-outbound.json`、`walk-return.json`、`tour.json`、`guards.json`、`ui-matrix-final.json`、`final-short.json`、`hall-visible-click.json`及实际截图。验收图片与过程输出不上传。

初次劳动检查取到到站首帧，后续稳定劳动检查通过；旧QA主殿取点落在图外或导航覆盖处，改用当前图中可见前墙(729,243)后，横竖屏实际点选通过。这两项为验收取样修正，未改运行代码。当前自动化环境打开另一标签后`document.hidden`仍为false，因此浏览器真实切后台没有有效证据，继续待验；无头场景冻结检查只证明对应处理分支。iPadOS/Windows/macOS目标真机和用户美术认可仍待验。

### 公开发布 · 2026-10-10

[公开试游](https://cybershp.github.io/Simulation-web-game/painted-courtyard/?v=d28daeedaaa0)对应源码`2ea41759944a229e0f6b6c2233cf4224c70aae34`，网页`32d2c270010a3a325b70de75ac0f3f89d88f7f2f`。GitHub Pages状态built，8个公开文件均HTTP 200且SHA-256与受验构建一致。

本次网页提交仅变动`painted-courtyard/index.html`、`build.json`与新增哈希场景包；正式首页blob仍为`350e2e5e463ece24d89668babd6dbdb86a35cc65`，其他正式/历史预览内容保留。源码、素材与本记录已同步；验收截图和过程输出仅保留本地。

公网隔离Chromium已实际加载本批哈希场景包，并完成近观→总览→近观、公开按钮前往观瀑台到达、暂停冻结；5项直接检查均通过，控制台0错误、请求0失败，localStorage/sessionStorage均空。实际公开画面为本地`output/playwright/mountain-domain/public-home.png`，交互证据`public-short.json`；根Agent已复核这张公开截图与结果。
