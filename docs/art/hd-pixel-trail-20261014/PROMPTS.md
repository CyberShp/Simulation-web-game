# 近山像素地形 · 素材制作记录

采用内置 imagegen 编辑生成二维地形。当前运行素材为 `archive/prototypes/pixel_scene_validation/assets/trail-terrain-v4.png`，自然尺寸 1182×1330；投影为 1672×1882，接在原山院南侧。用户确认的颗粒方向为“颗粒再细一级，保留清楚的像素轮廓”；当前接入后的完整画面仍由实机评看确认。

## 生成要求摘要

- 固定斜俯视国风像素场景；细颗粒、明确阶梯边缘、有限分层明暗，人物行走地面清楚。
- 上方为山门向南延伸的石阶与灯柱，中上段为溪流石桥，中段有可从两侧绕行的松石岛，下方为开阔谷地。
- 保持通路几何、石岛位置与下方宽阔场地；树木与石壁集中在边缘，中心留下多人交战空间。
- 精化版维持构图，将可见颗粒细化一级，保留清楚的像素轮廓。
- 最终版同时参照精化地形与现有山院底图，只调整上方约 15% 的接续区域：中央台阶对齐，上方左侧松石延续，右侧瀑布和水流衔接溪桥；其余路线结构保持。
- 素材包含地面与环境；人物、游戏文字、操作界面由运行时独立绘制。

## 源图与使用位置

原始生成图目录为 `/Users/shepard/.codex/generated_images/01a13074-5685-7510-87a8-6238eeab12f8/`。

| 阶段 | 生成文件 | 本地文件 |
|---|---|---|
| 布局草稿 | `exec-dc322b26-d73a-4769-a680-ef704752fb9f.png` | `trail-layout-v1.png` |
| 像素颗粒评看 | `exec-5c41239e-7b5d-4d73-adbe-7cd703afdeaf.png` | `trail-pixel-review-v2.png` |
| 细颗粒地形 | `exec-f7de1f69-12bb-4409-87e8-860d652b6a7c.png` | `assets/trail-terrain-v3.png` |
| 山门衔接地形 | `exec-bf61c132-28ed-4b2b-b68f-877cce0987ec.png` | `assets/trail-terrain-v4.png` |

`assets/` 路径相对 `prototypes/pixel_scene_validation/`。运行中通过地形分层与像素采样呈现，并保留山门两侧原有岩壁植被遮挡。生成图是素材；实际图、交战和连续行程证据见 [RUNTIME](RUNTIME.md)。
