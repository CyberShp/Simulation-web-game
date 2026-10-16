# 云岫山院 · 高清像素桌面演武

2026-10-14，U-135。用户已认可上一批实际场景，并要求保持设计、以目标模式接续。本批沿用全部四份像素素材，把庭中演武接成可游玩的独立流程。实施契约与示例数值见 [43](../../design/43-PIXEL-ARENA-SLICE.md)。

## 直接体验

- 本机应用：[云岫山院·演武.app](/Volumes/Media/immortal-qa/pixel-arena-20261014/云岫山院·演武.app)。打开后可选十六人演武、一对一切磋或观看自动演武。
- 实际运行录像：[56 秒演武流程](/Volumes/Media/immortal-qa/pixel-arena-20261014/final-run-3/arena-playthrough.webm)。录像直接采集运行画布，包含像素场景、动作和技能；HUD、按钮和结果窗口另见截图。
- 实际界面：[十六人交手](/Volumes/Media/immortal-qa/pixel-arena-20261014/final-run-3/05-team.png)、[技能交手](/Volumes/Media/immortal-qa/pixel-arena-20261014/final-run-3/06-team-skills.png)、[胜利](/Volumes/Media/immortal-qa/pixel-arena-20261014/final-run-3/08-victory.png)、[力竭](/Volumes/Media/immortal-qa/pixel-arena-20261014/final-run-3/09-defeat.png)。
- 原山院自动游览仍在主菜单入口保留。

WASD / 点地移动，点击或 Tab 选敌，F / 双击敌人追击普攻，1 剑气、2 火诀、3 护阵。空格暂停并预排下一步，滚轮缩放、右键拖动。只直接操控沈砚，其他参与者自主行动。主菜单和结果窗可重新开始。

普通演武档位于 `~/Library/Application Support/pixel-arena/arena-save.json`。自动每 5 秒保存，手动保存、切后台、关闭前也保存；继续上次演武后先暂停。QA 使用各自目录，正式游戏的三份存档保持原状。

## 已实现与实际验证

| 层次 | 实际结果 |
|---|---|
| 规则 / 存储 / 导航 | 14 + 9 + 6，共 29/29。包含蓝量/CD/忙碌拒绝、遮挡与锁点失手、护盾优先、同步伤害、四种结局、版本校验和写盘失败保护。 |
| 最终 macOS 应用包 | `final-run-3/metrics.json`：13/13，运行错误 0，56.52 秒。暂停计划不扣费、忙碌拒绝、飞行存读一致、恢复后一次结算、双方真实伤害、胜负/退出及重开。 |
| 完整演武 | 自动掌门使用正常命令，16.5 秒胜；单挑不操作，33.3 秒力竭。参数只是当前切片试算。 |
| 跨进程 | `restart-final/write-metrics.json` 与 `metrics.json`：1 + 3 项通过。第 4 步火诀已出手、未命中，关闭再开逐字段一致；继续后敌方 HP 100→72、沈砚 280→266，各结算一次。 |
| 原生键鼠 | CUA 实际点击开始、Tab 选敌、D 按住一秒位移 110 像素（720→830）；超距预排恢复后明确提示，未扣费；剑气命中使敌人 100→66；护阵 50、冷却与灵气变化可见；缩放、保存、双击空地计划为 move，关闭成功。 |
| 后台与恢复 | 原生最小化/隐藏操作产生失活与恢复事件，第 129、266 步均原步恢复。隐藏期间保存文件哈希及 HP 不变，回前台不补离开时长，见 `native-final/background-check.json` 和 `metrics.json`。 |
| 保留入口 | 正式应用主菜单进入原山院游览，场景控制与自动展示可用；该页退出成功。 |

全部证据在本机 `/Volumes/Media/immortal-qa/pixel-arena-20261014/`，过程截图和录像不上传源码仓库。最终运行回调约 198 次/秒，95 分位回调间隔 5.4 毫秒、CPU 帧处理 0.9 毫秒；这是本机回调与处理耗时，不是显示器实际 FPS 或 Windows 性能。

本批修复了持续方向键与施法交接、空地双击误追旧目标、预排执行失败无反馈、保存失败后的读档恢复、打包共享模块路径，以及首次启动/游览页关闭与可见性恢复的接缝。最终包及源码哈希记录在 `source-sha256.json`。

## 源码与验证命令

源码为 `prototypes/pixel_scene_validation/`：`arena-sim.mjs` 唯一规则时钟；`arena-main.mjs` 输入与界面；`arena-renderer.mjs` 只读像素呈现；`arena-storage.cjs`、`desktop.cjs`、`preload.cjs` 负责独立文件与桌面窗口。共享计时模块直接读取/打包 `src/simulation/ea-runtime.mjs` 原文件。

```sh
node --test tests/unit/prototypes/arena-sim.test.mjs tests/unit/prototypes/arena-storage.test.cjs tests/unit/prototypes/world.test.mjs
cd prototypes/pixel_scene_validation
npm ci
npm start
python3 package-macos.py /absolute/path/云岫山院·演武.app
```

本目录通过 lock 文件固定 Electron 39.2.7；打包程序优先使用本地安装，并兼容本机已有的相同版本运行环境，拒绝覆盖已有应用。macOS 为本机临时签名样件。Windows 真机、完整大地图、世界身份/经营存档迁移与正式战斗成长尚未接入；完整 SR/AC 状态保持。后续扩展继续沿用用户认可的像素美术基线。
