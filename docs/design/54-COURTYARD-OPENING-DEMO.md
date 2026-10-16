# 高清像素桌面开局与实机演示

更新于 2026-10-16。基础开局按 U-153 接入，连环画与包裹展开按 U-154 修订。使用当前 `apps/courtyard/` 桌面与共用模拟，从灭门雨夜接续到云岫落脚、疗伤择卷和首次主殿营造。

## 授权与范围

用户要求“录一段实机演示，从0开始”，明确选择“当前高清像素桌面，从灭门开始”，并确认接入上述开局后录制。剧情依据 [统一基准](00-BASELINE.md)、[开局传承](32-OPENING-INHERITANCE.md) 与 [开局验收](06-OPENING-ACCEPTANCE.md)；阅读暂停、真实活动、身份和存档依 [运行时契约](05-RUNTIME-CONTRACTS.md)。原山院同机位和封闭建筑外观继续按 U-101/U-144/U-150。

| 本批局部覆盖 | 设计与验证重点 |
| --- | --- |
| SR-XF-002-AC-02 | 公开命令改变唯一权威状态，失败或重复操作保持资源与既定选择 |
| SR-XF-003-AC-01、SR-XF-004-AC-01 | 临时落脚、地基、木架、收尾和完工映射真实主殿状态；未建药圃的底图与遮挡同步 |
| SR-XF-029-AC-01/02/03 | 桌面开局阅读、择卷、疗伤、营造与继续入口，实际窗口可操作 |
| SR-XF-030-AC-01/03 | 序章、择卷及施工阶段存读，沿用身份、位置、资源、工时、时钟和 RNG；旧山院档继续载入 |
| OPEN-01/03/05、CHAIN-02、PERSIST | 同一普通新档从序章到主殿完工；对应完整链条继续按原验收范围判断 |

这些是对应 SR/AC 的局部证据，完整需求与验收状态单独维护。

## 实现契约

- 无现存桌面存档时，以正式 `SIM.initial({sr:true,mountainOpening:true})` 建立世界；原有档位仍通过原恢复路径读取。
- 序章翻页、疗伤、五行遗卷选择及主殿营造都调用共用模拟已有公开操作。遗卷确认后形成唯一既定选择，消耗和施工材料以正式规则为准。
- 序章、落脚、择卷和营造确认显示阅读界面并暂停；调息和施工通过真实流逝时间推进。掌门自主经营在开局完成后接续。
- 场景根据同一个主殿实体的施工阶段显示，完工恢复批准母稿的完整主殿；未建药圃不提前显示田垄、围栏与工位。
- 演示使用仓库外独立 QA 存档目录。录屏捕获实际桌面页面和界面操作，保留同一世界连续时间与原始录制文件。

## 文件范围

桌面接入：`courtyard-main.mjs`、`courtyard.html`、`sect-sim.mjs`、`sect-opening.mjs`。开局界面：`courtyard-opening.mjs/.css` 与 `prologue-*` 素材。场景：`courtyard-renderer.mjs`、`courtyard-layers.mjs`、`courtyard-space.mjs` 与 `opening-*` 素材。验证位于 `tests/unit/courtyard/` 和 `tests/acceptance/`；运行证据位于 `/Volumes/Media/immortal-qa/opening-demo-20261016/`。

雨夜与遗卷图片由内置图像生成工具制作，均为 1672×941。`prologue-rain-v1.png` SHA-256 为 `25e08f5c31d061cbea92f3f261eb985208878f55d950e59b21fdd963a274492e`，`prologue-scroll-v1.png` 为 `9e8cc2910bba084ddac19f41173fdd9ae5919f211b21b0b77d73d5278eaa3658`。字体沿用 `assets/web/opening-serif.ttf`，桌面文件 `prologue-serif.ttf` 的 SHA-256 为 `bee378bf62ead97dd3c107c127aba042a125cbe88341fc0545c41fba5a945034`。

## U-153 验证记录

源码基点为 `249973aee190e1d62d97829f34b0cbb65f056d43`。本批保留进入任务前的 8 处已跟踪改动和原有未跟踪成果。

| 验证 | 结果与证据 |
| --- | --- |
| 根检查 | `npm run check` 通过：模块、资源引用、40 项 SR/120 条 AC 的台账检查及现有网页构建通过 |
| 默认测试 | `npm test` **133/133**，失败 0；其后新增的场景专项连同 renderer/east 回归 **16/16**；日志 `default-tests.log`、`scene-tests.log` |
| 独立只读复核 | 开局、空间、渲染专项 **19/19**；实际差异与正常玩家路径复核无阻断 |
| 源码桌面 | `source-2/report.json` **10/10**；69.022 秒。覆盖序章、待择卷、疗伤、营造、完工五处进程重启。该次未作为新场景的最终视觉证据 |
| 最终 macOS arm64 包 | `package-1/report.json` **10/10**；72.310 秒。相同新档操作及五处重启，并核对“稍后营造→查看营造”；页面/资源错误 0 |
| 旧存档兼容 | `old-save-1/report.json` **5/5**；来源为 U-151 手动补粮后的暂停档副本。四个管理入口、真实推进、保存与重启通过，来源文件字节不变，错误 0 |
| 构建 | `npm run build:desktop` 与 `codesign --verify --deep --strict` 通过；包内实际源码/运行素材与当前工作树逐文件哈希一致 |

运行目录统一位于 `/Volumes/Media/immortal-qa/opening-demo-20261016/`。最终包为 `dist/desktop/云岫山院·山院实景-darwin-arm64/云岫山院·山院实景.app`。五个施工阶段按最终包的 `03-shelter.png`、`07-foundation.png`、`08-structure.png`、`09-finishing.png`、`10-hall-complete.png` 核对；角色实际位置及未建药圃均随世界事实显示。序章与遗卷界面文字、确认按钮已实际检查。

集成时修复了三处具体问题：待择卷档保存必须保留正式暂停，同时另存手动暂停意图；关键开局选择使用持久化层支持的 `manual` 保存请求；主殿确认在同一临时会话中先执行疗愈剧情推进，再执行营造，任一步失败整批不提交。对应失败日志 `source-1/report.json` 保留，修后证据见上表。

连续录像已完成：`recording-2/report.json` **5/5**，实际操作 126.700 秒，错误 0。交付 `delivery/余烬立山-开局实机.mp4`，视频长 **126.900 秒**、1672×942、编码 30 fps（这是视频参数，不作为游戏性能测量）。从同一空档逐幕操作至主殿完工，最后保存；录制中未重启或换档。原始 WebM 保存在 `recording-2/raw-video/`。完整解码退出码 0，已抽查第 5、44、96、113 秒画面；文件及素材哈希在 `delivery/verification.json`。

复现录屏前运行 `npx playwright install ffmpeg` 安装当前 Playwright 对应编码器，再运行 `node tests/acceptance/courtyard-opening-desktop.mjs --app=/绝对路径/桌面.app --output=/仓库外新目录 --record`。第一次录制因本机只安装旧版编码器而在页面启动前超时，`recording-1/report.json` 保留；补齐官方 ffmpeg 1013 后，同一最终包连续录制通过。

Windows 真机、首次玩家体验、主殿之后的招募/生产/炼丹/出谷战斗完整链条和完整 SR/AC 仍按原范围接续。

## U-154 连环画与包裹展开

本批起点为 `4eb020b4c3bdcf0da5aae5cc43a294b9b9af004a`，局部关联 SR-XF-029-AC-01/02/03、SR-XF-030-AC-01/03，以及 OPEN-01、OPEN-03 和 PERSIST。用户要求开局采用多帧连环画、母子逃亡方向远离火宅，并增加打开包裹的动画画帧。

序章依次呈现六幅独立画面：雨夜破门、父亲守阵、母子下山、母亲托付诀别、主角独自流亡、四个月后抵达云岫。火宅位于逃亡人物的后方，脚步、身体朝向与山路均通向前方山下。每幕保留完整画幅，字幕与翻页按钮位于下方；人物服饰和包裹沿用同一参照。

首次成功开始疗伤后，玩家点击“打开包裹”，依次播放放下、解结、展布、露出单卷四幅关键帧，每帧约一秒；展开完成才出现五条传承预览与正式确认。重看展开只改变画面，药材、世界步和选择均保持。九张新增图像由内置 image_gen 制作，提示词、来源和哈希见 [序章素材记录](../../assets/courtyard/prologue-v2-art-source.md) 与 [包裹素材记录](../../assets/courtyard/bundle-v2-art-source.md)。图像是连环画关键帧；手部、布纹和包裹端点存在轻微逐帧差异。

桌面呈现保存 `courtyardPresentation.opening`（version 1）：六幕游标映射正式页码 `[0,0,1,1,2,2]`，包裹保存 `closed/playing/open` 与第 0–3 帧。重开恢复已保存画帧并继续呈现，不补算离线播放或世界进度。缺少新字段的旧档根据原正式页恢复；已确认传承继续保留。共用 schema 6、正式三页状态、疗伤消耗和施工规则沿用既有实现。

本批修改 `courtyard-opening.mjs/.css`、`courtyard-main.mjs`，新增 `courtyard-opening-presentation.mjs`、九张图像和来源记录，更新定向单测及实际桌面验收脚本。运行证据位于 `/Volumes/Media/immortal-qa/opening-comic-20261016/`。

- 呈现状态与正式开局定向测试 **11/11**；`npm run check` 通过。
- 源码桌面 `source-1/report.json` **17/17**，93.717 秒，运行错误 0；六幕图像加载、前后翻页、子帧 1/3/5 恢复、包裹中途恢复和重播、择卷及主殿营造均通过。八次进程重启保留对应进度；阅读期间世界冻结，首次草药消耗 22→16，展开与重播保持 16。
- 独立只读复核实际 UI 差异及全部六幕、开包、施工截图，未发现阻断；macOS arm64 包构建通过。
- 最终包连续录制 `recording-1/report.json` **7/7**，实际操作 160.104 秒，运行错误 0。同一新档从第一幕到主殿落成，全程连续录制。交付视频 `delivery/余烬立山-连环画开局实机.mp4` 长 **158.43 秒**，1672×942，H.264／30 fps 编码；完整解码退出码 0，已目视第 23、32、67、68、69、70、145 秒，包含逃亡、诀别、解结、展布、露卷、择卷和主殿完工。视频 SHA-256：`5d82a7e95c14548b3baa6d7aad04a52ffeb609313674c6034e65c4148b316ce3`。包内四个本批运行模块和九张新增图像与当前源码逐字节一致，签名验证通过。

当前艺术呈现供用户评看；Windows 真机与完整 SR/AC 状态保持原范围。
