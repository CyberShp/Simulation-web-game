# 沈砚掐诀护身动画小样

2026-10-18，按 U-162 制作 S04 掐诀护身，沿用用户认可的 S01 人物。固定前侧视角，共 12 帧、1.76 秒：凝神、抬手、胸前掐诀、脚边起盾、沿身升起、头顶合拢、持诀、盾面受击、复稳、收诀散盾、落手与归势。

## 播放与比例

在仓库根目录运行：

```sh
./node_modules/.bin/electron scripts/art/shen-yan-guard/preview-host.cjs
```

本地桌面窗口支持暂停、重播、逐帧、单次／循环、半速与护盾开关，可在院中石地和主殿阶前平地查看。100%／135%／200% 同时缩放人物、建筑、地面、阴影及遮挡，100% 表示一个母稿像素对应一个画布 CSS 像素。

本小样沿用 U-161 校准的 **80 个母稿像素**人物标尺，三档场景缩放对应 80／108／160 像素。校准参考为 46 稿的成人约 1.8 米、门洞约 2.4–2.7 米，以及母稿门扇、石栏和铺地。正式桌面人物仍使用 111，接入时需要按本批同机位对照复核。

院中脚点为母稿坐标 (710,575)，阶前比较脚点为 (680,465)，均落在平地。本窗口脚点用于美术比较，正式入口检查点保留 (680,407)。母稿、清理补片和遮挡读取当前桌面同一组素材。

## 素材与制作

| 内容 | 位置 |
| --- | --- |
| 认可的人物来源 | `../cast-study-v1/source/casting-master-v1.png` |
| 结诀手臂补图 | `source/seal-master-v1.png` |
| 补图提示词及来源 | `source/seal-generation.json` |
| 佩剑来源 | `source/guard-master-v1.png`，只取腰侧剑鞘区域 |
| 二维网格动作工程 | `motion/s04-guard-mesh.blend` |
| 透明分层帧 | `sprites/body-*.png`、`equipment-*.png`、`effect-behind-*.png`、`effect-front-*.png`，每层 12 张 |
| 合成帧和图集 | `sprites/guard-*.png`、`guard-atlas.png` |
| 时长、脚点、手位、阶段标记及散列 | `sprites/manifest.json` |

脸、发型、躯干、衣摆和靴子直接使用 S01 母稿。结诀手臂由内置 imagegen 按同一人物参考补图：右手食指、中指并拢立于胸前，其余指自然内收；左手承托于上腹。剑收于腰侧，两臂靠近身体，脚点固定。透明源图保持原文件，渲染采用 0.65 透明度裁切。

护盾以人物为中心，从脚边起光，盾膜由下向上升起并合顶。前后弧线、低透明度内膜和底环共同交代包覆关系；受击点产生局部涟漪。前景光线避开人物轮廓，脸、手诀与衣装清楚可见。清单索引 5 为成盾、7 为盾面受击、9 为收诀退散；这些是小样的视觉标记。

人物与装备用 640×512 透明帧保存，图集为 2560×1536。Blender 时间轴以 1000 帧／秒对应毫秒，姿势保持时长与清单一致，总计 1760 毫秒。清单 `fps=12` 保留 T-17 制作参考，播放器按每帧 `durationMs` 播放。

重建：

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --threads 4 --python-exit-code 1 --python scripts/art/shen-yan-guard/render-guard.py -- --output assets/characters/shen-yan/guard-study-v1
node scripts/art/shen-yan-guard/pack-guard.mjs --qa-dir /Volumes/Media/immortal-qa/shen-yan-shield-20261018/pack
./node_modules/.bin/electron scripts/art/shen-yan-guard/preview-host.cjs --qa-dir /Volumes/Media/immortal-qa/shen-yan-shield-20261018/preview --smoke
```

## 验证与接续

本批对应 SR-XF-007 外观与身体活动、SR-XF-013 护盾阶段视觉部分，依据 U-157／U-158／R-51／T-17／U-161／U-162。修改为本小样、`scripts/art/shen-yan-guard/` 及设计和需求导航。

- 12 帧双靴区域逐像素一致；人物、装备及合成帧首尾像素差为 0，起始脸部区域与 S01 一致。
- 61 项资源散列读回一致；成盾的索引 5–8 帧中，人物及装备全部可见像素处于椭球范围内，外漏为 0。前景效果覆盖人物像素与画布边界截断均为 0。
- 白底、深底及 80 像素逐帧图已评看。手诀、袖口、身体和护盾的独立复核见 `review.json`。
- 实际 macOS Electron 播放、暂停、逐帧、单次／循环、半速、护盾开关及两视点三档共同缩放等 30 项检查通过，页面错误 0；缺失清单提示与控件状态等 4 项检查通过。

本批 QA 与实际桌面截图在 `/Volumes/Media/immortal-qa/shen-yan-shield-20261018/`；修订前素材和代码保存在其 `before/`。当前为独立美术小样。用户画面认可、其他朝向、破盾／取消分支，以及正式护持事件和存读接入继续分别推进；Windows 尚未验证，完整 SR／AC 状态保持。
