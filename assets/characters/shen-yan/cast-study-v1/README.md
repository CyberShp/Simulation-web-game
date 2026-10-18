# 沈砚引诀点发动画小样

2026-10-18，按 U-160 制作 S01 引诀点发的完整起势、释放与收势。沿用 U-157 蓝白袍像素外观，以一张透明母稿制作固定前侧动作，共 12 帧、1.28 秒，右手持剑、左手引诀。当前供美术评看。

## 播放

在仓库根目录运行：

```sh
./node_modules/.bin/electron scripts/art/shen-yan-cast/preview-host.cjs
```

本地桌面窗口使用山院石地背景，支持播放、暂停、重播、前后逐帧、单次或循环、半速、111／150／222 像素人物高度，以及法术效果开关。窗口按原画布尺寸显示，窄窗口可以横向滚动。

## 素材与制作

| 内容 | 路径及用途 |
| --- | --- |
| 人物母稿 | `source/casting-master-v1.png`，由原像素人物及 S01 姿势板参考生成，PNG 原文件保留 |
| 提示词与来源 | `source/generation.json` |
| 二维动作工程 | `motion/s01-cast-mesh.blend`，身体、施法臂与刚性剑分组；袖口使用稳定前后顺序 |
| 透明分层帧 | `sprites/body-*.png`、`weapon-*.png`、`effect-*.png`，各 12 张，640×512 |
| 合成帧与图集 | `sprites/cast-*.png`、`cast-atlas.png`，图集 2560×1536 |
| 播放清单 | `sprites/manifest.json`，脚点、手位、各帧时长、释放标记、图集坐标与散列 |

同一张母稿用于全部帧，身体轻微前送，头发和衣摆跟随，双脚固定。原图带有半透明边缘，渲染采用 0.65 透明度裁切。左臂用二维网格屈伸，剑与握持区域同位移。法术层从第 6 张图的指尖释放，随后沿固定方向前进，第 10–12 张图为空。

Blender 时间轴保存 12 个等距姿势，便于逐帧修改；最终播放节奏由清单的 `durationMs` 决定，总计 1280 毫秒。清单 `fps=12` 保留 T-17 制作参考值，实际播放器使用每帧停留时间。

重建命令：

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --threads 4 --python scripts/art/shen-yan-cast/render-cast.py -- --output assets/characters/shen-yan/cast-study-v1
node scripts/art/shen-yan-cast/pack-cast.mjs --qa-dir /Volumes/Media/immortal-qa/shen-yan-cast-20261018/pack
./node_modules/.bin/electron scripts/art/shen-yan-cast/preview-host.cjs --qa-dir /Volumes/Media/immortal-qa/shen-yan-cast-20261018/preview-final --smoke
```

## 检查与接续

本批对应 SR-XF-007 的稳定外观和身体活动、SR-XF-013 的施法阶段视觉部分，依据 U-157、U-158／R-51／T-17 与 U-160。制作范围为本目录、`scripts/art/shen-yan-cast/` 及需求和设计导航。

- 12 帧脚底位置一致；双靴所在的下部区域逐像素相同。人物、剑和合成帧首尾像素差均为 0。
- 49 个分层、合成及图集资源散列读回一致，画布边界保持透明；释放标记只有一处。
- 实际 macOS Electron 素材加载、暂停、逐帧、重播、循环、单次停止、半速、三档尺寸和效果开关共 20 项检查通过，页面错误 0。
- 白底／深底整套姿势、山院石地三档尺寸及去效果释放帧已评看；独立复核确认收诀袖口、释放手腕、剑柄与脚点连接。111 像素下法术加入深青边缘以提高浅石地对比。

QA 截图与状态报告保存在 `/Volumes/Media/immortal-qa/shen-yan-cast-20261018/`；来源和交付摘要见 `review.json`。PNG 是本小样可复用素材，截图是对应预览窗口的实际画面。

用户美术认可、深草与工位背景、其余朝向、受击／取消分支，以及正式游戏释放事件和存读接入继续分别推进。整项 SR、AC 与任务状态保持现状。
