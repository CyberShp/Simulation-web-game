# D 主殿与山院：固定机位实机重建

用户采用已有 [D 国风 3D 原图](../desktop-style-review-20261013/d-realistic-3d.png) 作为本批目标，先还原同一机位下的主殿、侧亭、庭院、前道、石桥和周边山石草木。画面按 [八组构图锚点](COMPOSITION.md) 与原图对照，材质、明暗和整体观感由实际桌面画面评看。

Blender 保存可编辑的建筑、树木与崖石模型，Three.js 呈现场景，Electron 打开桌面样板。本批聚焦主殿与山院的静态画面；正式经营、新战斗、人物重做和完整游戏桌面迁移另行实施。**当前正在制作与复核，尚未达到本批视觉验收，用户视觉确认待进行。**

## 启动与查看

进入仓库的 `prototypes/three_style_showcase/` 目录。首次准备依赖可运行 `npm ci`，随后执行：

```sh
npm start -- --reference
```

窗口显示本批固定机位场景，按 Escape 退出。带上 `--camera=hall` 或 `--camera=garden` 可检查主殿及园景近处细节；构图验收仍以默认机位为准。

需要保存一次实际截图、短录像和运行指标时，使用独立采集目录，例如：

```sh
npm start -- --reference --qa-dir=/tmp/yunxiu-reference-review --record --show --duration=8
```

采集结果留在指定目录，包括 `reference-reference.png`、`reference-autoplay.webm` 和 `reference-metrics.json`。短片与运行指标仅说明该次环境下的样板表现。

## 当前材料

| 内容 | 位置 |
| --- | --- |
| 目标画面与构图约测 | [D 原图](../desktop-style-review-20261013/d-realistic-3d.png)、[COMPOSITION.md](COMPOSITION.md) |
| 可编辑建筑源文件 | [architecture.blend](../../../prototypes/three_style_showcase/assets/reference/architecture.blend) |
| 可编辑树木与崖石源文件 | [nature.blend](../../../prototypes/three_style_showcase/assets/reference/nature.blend) |
| 模型清单与来源 | [建筑清单](../../../prototypes/three_style_showcase/assets/reference/architecture-manifest.json)、[自然素材清单](../../../prototypes/three_style_showcase/assets/reference/nature-manifest.json) |
| 桌面参考场景 | [reference-main.mjs](../../../prototypes/three_style_showcase/reference-main.mjs)、[reference-world.mjs](../../../prototypes/three_style_showcase/reference-world.mjs) |

## 实际证据与待复核项

2026-10-13 已在本机 Apple M4 的自包含 macOS 应用中完成实际载入与固定机位采集。1600 × 900、12 个示例人物、主殿及两侧亭、园景和石桥；8 秒短样本后 6 秒平均约 44.8 FPS，帧间隔 P95 25.5 毫秒，日志无载入或渲染错误。它只覆盖当前静态场景负载，不代表多人战斗和 Windows 性能。人物采用现有模型，并按画面辨认度临时放大 1.4 倍，正式人物比例仍需统一校准。

当前场景中主殿、两侧亭、殿前阶、广场与前道位置已能与参考图逐项对照。修复了前阶埋入地面、角色骨骼位置、窗面遮挡与针叶裁区混入边料的问题；石桥具备实体拱身。重复树石采用共享绘制，保留实际模型及阴影。

**仍有明显视觉差距：**远峰形态较规则，前阶偏长、前道弯曲不足，桥拱与峡谷高差偏弱，草地与岩岸层次不足，木石细节和光照还不具备原图的写实质感；现有角色只作场景比例示例。当前交付为制作样板，美术未验收，后续应先打磨这些差距再扩展战斗演示。

| 证据 | 本地位置 | 状态 |
| --- | --- | --- |
| 自包含桌面应用 | `/Volumes/Media/immortal-qa/reference-reconstruction/delivery/云岫山院-主殿场景样板.app` | 实际启动、载入通过 |
| 固定机位截图 | `/Volumes/Media/immortal-qa/reference-reconstruction/delivery/verification/reference-reference.png` | 已实际采集和目视 |
| 同次指标与日志 | `delivery/verification/reference-metrics.json`、`delivery/verification.log`，均位于上述 QA 根目录下 | 8 秒短样本 |
| 主殿近景 | `/Volumes/Media/immortal-qa/reference-reconstruction/delivery/hall/reference-hall.png` | 同一应用实际采集和目视 |
| 受验源文件 SHA-256 | `/Volumes/Media/immortal-qa/reference-reconstruction/delivery/source-manifest.json` | 绑定本批模型与呈现代码 |
| 用户视觉确认 | 用户实际反馈 | 待确认 |

Blender 源文件和模型保存在本地工作区；本批尚未提交或发布。正式存档与玩法未接入此样板，Windows 未测试。完整 SR/AC 状态保持；需求台账 refresh 与 validate 通过。
