# 云岫山院 · 近山试行

当前美术按 U-138 以上方原山院为参照，使用 `trail-terrain-v5.png`；最新应用与实际画面见[风格统一记录](STYLE-ALIGNMENT.md)。下文保留 U-136/U-137 的 v4 受验版本及其原验证范围。

2026-10-14，U-136 / U-137。当前三项技能沿用初阶动效，南方地形按更细一级颗粒、保留像素轮廓制作。规则与样件参数见 [44 · 近山行程切片](../../design/44-PIXEL-TRAIL-SLICE.md)。本批在同一个二维场景中实际走过山院、溪桥、松林和谷地，再沿原路返回。

## 本机入口

- 应用：[云岫山院·近山试行.app](/Volumes/Media/immortal-qa/pixel-trail-20261014/云岫山院·近山试行.app)。主菜单可选择结伴下山、观看完整行程或三十二人会武，庭中演武与旧山院游览入口保留。
- 实录：[run-3 行程录像](/Volumes/Media/immortal-qa/pixel-trail-20261014/run-3/trail-playthrough.webm)，直接采集运行画布；HUD、操作面板和结果窗口以截图为准。
- 截图：[途中存读](/Volumes/Media/immortal-qa/pixel-trail-20261014/run-3/trail-02-restored-path.png)、[十六人谷地交手](/Volumes/Media/immortal-qa/pixel-trail-20261014/run-3/trail-16-combat.png)、[返院结果](/Volumes/Media/immortal-qa/pixel-trail-20261014/run-3/trail-16-result.png)、[三十二人交手](/Volumes/Media/immortal-qa/pixel-trail-20261014/run-3/trail-32-combat.png)。

WASD / 点地行走，点选或 Tab 选敌，F / 双击敌人追击，1–3 使用剑气、火诀、护阵。空格暂停并预排下一步；滚轮缩放、右键拖动，跟随与全景切换观察尺度，小地图定位镜头。自动行进可以接管；读取行程后先暂停，并由玩家重新选择继续或自动行进。

原院为 1672×941，南方扩展为 1672×1882，总图 1672×2823。原四份场景/人物图集继续使用，地形为 `trail-terrain-v4.png`。图像像素尚未换算为正式世界米数；16/32 人均为本批测试配置。

## 已有证据

以下为最终包 `run-3` 的自动路线与画面证据；原生输入、后台和重开补验单列记录。

| 层次 | 当前结果 |
|---|---|
| 组件 | 根 Agent 实跑 45/45：模拟 21、旧导航 6、近山导航 3、存储 9、渲染 6。包含真实到场、北向入场集结、实际返院、地面/视线分离、连续位移、只读镜头、战斗视野、存读和旧演武兼容。 |
| 打包 macOS 自动路径 | [run-3/metrics.json](/Volumes/Media/immortal-qa/pixel-trail-20261014/run-3/metrics.json)：22/22，运行错误 0，前台实际运行 83.44 秒，10 张截图。通过正常命令行走与交战，未改坐标或加速规则时钟。 |
| 途中暂停与存读 | 第 42 步，掌门 y=1107.30，在溪桥前暂停；镜头变化保持完整快照不变；写盘、读回和恢复逐字段一致，继续完成同一行程。 |
| 十六人完整路线 | 第 153 步进入到场区，第 161 步全体青方集结后交战，掌门位于 `(829.30,2318.70)`；第 329 步赤方清空，模拟仍继续；第 501 步实际返院胜利。规则时长 50.1 秒、观测前台时间 50.20 秒，连续步行 3673.32 像素，返院气血 6。 |
| 三十二人观察 | 第 153 步掌门进入到场区，第 172 步全体青方集结开战；到谷后观察 15.00 秒，其中交战 13.08 秒。第 303 步通过公开撤退命令结束，掌门气血 253。记录 32 位稳定参与者、实际行动、伤害与主动退出结果。 |
| 旧演武兼容 | 核心复核对比旧导航的 49 组路径均一致；有来源的 U-135 `restart-final/arena-save.json`（duel，第 15 步）恢复后 JSON 一致。完整正式游戏档迁移另验。 |
| 原生行走与镜头 | 根 Agent 在最终应用中实际按 D 约 1 秒，9 步行走 99 像素；第 497 步暂停后，依次操作全景、小地图双击、滚轮、跟随与保存。与 `paused-before-camera.json` 完整快照一致，预排行动仍为空，见 [camera-check.json](/Volumes/Media/immortal-qa/pixel-trail-20261014/native-final/camera-check.json)。本轮原生操作覆盖行走、暂停、相机和保存；技能键与选敌沿用 43 已有证据及本批自动命令验证。 |
| 后台与恢复 | 实际点击自动行进并恢复，走到桥尾 y=1595.87；第 583 步以系统隐藏快捷键隐藏窗口。保存字节哈希保持一致，[native-write-metrics.json](/Volumes/Media/immortal-qa/pixel-trail-20261014/native-final/native-write-metrics.json) 记录 `active=false/true` 均为第 583 步，恢复无补时，见 [hidden-check.json](/Volumes/Media/immortal-qa/pixel-trail-20261014/native-final/hidden-check.json)。本轮原生后台覆盖系统隐藏；最小化保留 43 的历史验证范围。 |
| 跨进程续行与关闭 | 手动保存并关闭，使用同一 QA 目录重新启动，实际点击“继续上次行程”，恢复为 32 人、第 583 步、暂停，完整快照相等，见 [restart-check.json](/Volumes/Media/immortal-qa/pixel-trail-20261014/native-final/restart-check.json)。继续后按 S 约 700 毫秒，第 590 步暂停，实际行走 77 像素，再次关闭完成；[native-summary.json](/Volumes/Media/immortal-qa/pixel-trail-20261014/native-final/native-summary.json) 记录读取 1 次、错误 0。 |
| 显示层复核 | `run-2` 与 `run-3` 的最终完整规则快照 JSON 一致，16 人路线时刻、位移、结果与气血一致；镜头与提示密度调整没有改变这一正常命令路径的模拟结果。 |

32 人交战期间的分段样本中，95 分位回调间隔约 5.5–5.6 毫秒，CPU 帧处理约 1.4–1.8 毫秒；这是可见 Electron 窗口的动画回调与 CPU 工作采样。它不代表显示器实际帧率、Windows 性能或最大人数上限。

此前 `run-1` 的 19 项自动检查通过，但交战发生在松林出口，掌门最南仅 y=2092.19；该轮不能证明抵达开阔谷地。`run-2` 使用共享到场区与全队集结条件复验通过；`run-3` 在同一规则上修正战斗视野与提示密度后再次通过。历史证据保留其原范围。

## 画面复核与待完善处

实机已能看到连续地形、溪桥、松岛与开阔谷地；十六人交手发生在谷地地面，原山院人物比例保持。独立目视 `run-3` 的十六人与三十二人交手截图，交战人物脚点均位于技能栏上方，伤害数字与 NPC 护阵的遮盖明显减少。以下仍属于当前可见差距：

1. `trail-32-combat.png` 中，青方后排和掌门附近仍有局部人物重叠，部分轮廓被同伴遮住。当前随行与攻击站位没有人物间避让，尚不能把每一位同场人物都易于单独辨认记为完成。
2. `trail-02-restored-path.png` 左右坡壁与树林的衔接已用边缘遮挡处理，但轮廓仍呈可辨的折线拼接；中央石阶两段的纹理尺度也有变化。

截图来自实际运行；用户对本轮完整实机的最终视觉评看仍待进行。

## 源码与复验

源码在 `prototypes/pixel_scene_validation/`。`trail-world.mjs` 提供长场景地面、实体遮挡与到场区；`arena-sim.mjs` 保持唯一规则写入；`arena-main.mjs` 接输入与自动操作；`arena-renderer.mjs` 只读呈现；`trail-qa.mjs` 通过正常命令、前台时钟及文件存读完成验收。

```sh
node --test prototypes/pixel_scene_validation/arena-sim.test.mjs prototypes/pixel_scene_validation/world.test.mjs prototypes/pixel_scene_validation/trail-world.test.mjs prototypes/pixel_scene_validation/arena-storage.test.cjs prototypes/pixel_scene_validation/arena-renderer.test.mjs
cd prototypes/pixel_scene_validation
npm start
npm start -- --trail --autoplay
npm start -- --trail32 --autoplay
```

QA 使用 `--qa-dir` 独立目录，自动路线参数为 `--qa-scenario=trail-integration --show --record`。普通档仍为 `~/Library/Application Support/pixel-arena/arena-save.json`，正式游戏三档保留。过程截图、录像与运行数据位于本机 `/Volumes/Media/immortal-qa/pixel-trail-20261014/`。

源码与素材随本批独立源码检查点保存；桌面应用为本机交付。包内31个运行文件／资源与工作区逐字节一致，共享时钟模块另行核对一致。Windows 真机、完整世界地图、正式角色成长/经营存档与完整 SR/AC 验收分别待完成。
