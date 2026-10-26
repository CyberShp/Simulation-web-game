# 云岫 · 资产图鉴

本批按 U-132 制作 D 写实国风方向的独立资产，先用设计稿固定外观，再检查实际模型。

当前人物版本见[三视图与模型样件](character-study-v2.md)，设计图为 `character-design-v2.png`。

## 设计参照

- [主殿五视图](main-hall-design.png)
- [青衣修士衣装正侧背](character-design-v1.png)
- [图像生成要求](GENERATION.md)

设计稿由内置 imagegen 生成。图鉴里的外观、正面、侧面、背面和俯视，均使用同一个 GLB 实时渲染。

## 本批资产

| 类别 | 资产 | 可编辑源文件 |
| --- | --- | --- |
| 建筑 | 主殿、廊亭、石桥、石灯 | `prototypes/three_style_showcase/assets/asset-review/architecture/architecture.blend` |
| 自然 | 古松、松石坡地、山石、灌木；另有松树 LOD | `prototypes/three_style_showcase/assets/asset-review/nature/nature.blend` |
| 人物 | 青衣修士，待机、行走、施法 | `prototypes/three_style_showcase/assets/asset-review/character/disciple.blend` |

人物是衣装与动作样件，正式人物的身份与外观定义仍由人物规则管理。各目录清单记录尺寸与面数；建筑和自然素材另列来源与哈希，人物制作及动画检查见 [人物记录](character-notes.md)。

## 桌面评看

入口：`prototypes/three_style_showcase/asset-review.html`。Electron 启动参数 `--assets`。默认每件资产巡览 24 秒，可选择资产、拖动旋转、滚轮缩放、切换正侧背俯视、四面同看以及材质/素模；人物可切换三个动作。主殿和人物可打开设计参照。

```sh
cd /Volumes/Media/immortal/prototypes/three_style_showcase
./node_modules/.bin/electron . --assets
```

## 验证范围

对应 U-132 与 SR-XF-003/004/007/029/030 的局部资产及呈现证据，SR 状态和完整 AC 不因资产样件推进。正式模拟、存档、战斗和平台迁移仍单独验收。

本批重点为九件模型载入与多视图、材质加载、人物三个动作、资产选择和载入失败恢复、macOS 包运行。过程截图留在 `/Volumes/Media/immortal-qa/asset-review-20261014/`。

## 实际结果 · 2026-10-14

- macOS / Electron / WebGL2，1600×900、像素倍率 1：九件 GLB 全部载入，外观、四面同看和俯视均截取实际画面；最终一轮错误为 0。记录为 `final-models/assets-metrics.json`，过程图同目录。
- 实际人物模型含 26 根骨骼，待机、行走、施法三个动画均播放并截取实际帧。修复了肩颈开口、领片共面重叠；最终帧确认领片破碎边沿已消除。动作循环与接地另有 CPU 蒙皮采样。
- 坡地连续表面已烘焙为 2K 颜色、法线和粗糙度贴图；最终实图确认草土石块状边界与整圈深绿带已消除。岩石和坡面仍为几何交接。
- 原生桌面包实际打开并自动推进主殿、廊亭、石桥、石灯；实际点击了主殿、人物、四面同看、材质/素模、设计参照开关和施法按钮。
- 文件缺失分支：GLB 缺失记录错误并正常结束 QA，退出码 1；环境光文件缺失时采用基础灯光，人物动画继续推进，QA 记录警告并返回 1。桌面包另实际触发山石 404，确认巡览暂停、错误可见；恢复文件后重选主殿，错误层清除并重新载入。
- 包内 17 个入口、模型、设计图和光照文件与受验工作区逐字节一致，清单为 `delivery/package-check.json`。所有纹理均在包内，模型纹理已内嵌。
- 需求台账 `refresh` / `validate` 通过：40 项需求、200 项任务和 120 个 AC；完整状态保持。

桌面包：[云岫·资产图鉴.app](/Volumes/Media/immortal-qa/asset-review-20261014/delivery/云岫·资产图鉴.app)。本批保存在本地，尚未提交或发布正式游戏。

## 继续打磨与待验内容

主殿的细部雕刻、脊饰以及材质旧化仍比设计稿简化；人物面部、发丝、衣料纹理与刺绣尚未达到设计稿的细腻度。松石样件已能检查三维结构，整场景中的构图、接地和密度须在组装后评看。当前角色和主殿采用近景审核精度，分别约 18.8 万与 29.7 万三角；尚未作为多人同场的性能配置。

本轮的短时帧间隔记录用于定位载入/渲染异常，不作为真实显示 FPS、全场性能或 Windows 验收。用户美术认可、Windows、全场组装、人物批量细节分级与战斗效果继续单独进行。
