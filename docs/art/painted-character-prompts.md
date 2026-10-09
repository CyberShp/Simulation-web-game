# 绘画小院人物素材

本批对应 SR-XF-007-AC-01/03 的两人辨认、动作与点选局部验证。源素材由内置 `image_gen` 生成，原图按字节复制到工程；Godot 读取图集区域及逐帧脚点。

## 资产

- 文件：`godot/painted_courtyard/assets/characters.png`
- 元数据：`godot/painted_courtyard/assets/characters.json`
- 尺寸：1254 × 1254，RGBA；6 列 × 6 行，每片 209 × 209。
- 沈砚：象牙白外袍、青绿衣缘和腰带、深发高髻；陆知微：青绿工作衣、米白袖、深青腰带。
- 每人有前向行走 6 帧、后向行走 6 帧、锄地 6 帧。左右朝向由同一脚点水平翻转；静止使用对应方向的第 2 帧。
- Actor 的 `visual_height` 默认 88，本批小院配置为 72；步行动画 9 帧/秒，劳作 5 帧/秒。人物位置由父场景连续更新，Actor 只播放当前动作。
- 透明像素及边缘保留生成图的 alpha。脚点根据可见鞋底区域测量，以独立偏移对齐每一帧；每人保持统一身体缩放。
- 分辨率、透明度、帧数量与动作播放是技术检查；同场景比例、人物辨识和动作观感由实际 Web 页面复核。

## 首次生成提示词

```text
Use case: illustration-story.
Asset type: production-ready transparent 2D sprite atlas for a refined hand-painted Chinese xianxia management game, to be used directly by Godot.
Create ONE square image, ideally 1536x1536 pixels, containing exactly a 6 COLUMN by 6 ROW regular invisible grid, 36 full-body character sprites total. All background pixels must be genuinely transparent alpha, including between sprites. No grid lines, labels, text, numbers, watermarks, landscape, floor, shadow ellipse, scenery, panels, or frames.
Match the delicate painted brushwork, soft warm upper-left daylight, warm ivory, blue-gray and muted moss/jade-green palette of a mountain monastery courtyard illustration. Polished hand-painted 2D game art with clean silhouettes and cloth folds, normal adult bodies about five heads high, consistently viewed from a fixed elevated three-quarter/isometric camera, slightly looking down. Characters must remain recognizable at 88 screen pixels high. Keep faces and hands simple and readable.
Character A, rows 1–3: Shen Yan, young adult Chinese man, dark hair in a high topknot with a small jade tie, ivory-white hanfu robes with restrained teal-green lapels and sash, charcoal shoes, calm scholarly bearing. Preserve exactly the same face, hair, outfit and size across his 18 frames.
Character B, rows 4–6: Lu Zhiwei, young adult Chinese woman, black hair tied in a practical high bun/short ponytail with a muted cream ribbon, muted jade-green practical working hanfu with ivory sleeves, dark teal sash, warm gray lower skirt/trousers and dark shoes. Preserve exactly the same face, hair, outfit and size across her 18 frames.
ROW 1: Shen Yan walking diagonally toward the lower right, front three-quarter view, six sequential phases of ONE seamless walk cycle from left to right: left contact, left passing, left high point, right contact, right passing, right high point. Arms counter-swing and robe hems follow legs.
ROW 2: Shen Yan walking diagonally toward the upper right, back three-quarter view, same six sequential phases of ONE walk cycle.
ROW 3: Shen Yan performing one hoeing work cycle facing lower right, feet planted apart, holding one modest wood-handled farming hoe in both hands: raise, forward reach, downswing, ground contact, pull toward body, recover. Clear successive changes in arms, torso and tool. Tool and hands must remain connected.
ROW 4: Lu Zhiwei walking diagonally toward the lower right, front three-quarter view, same six sequential phases.
ROW 5: Lu Zhiwei walking diagonally toward the upper right, back three-quarter view, same six sequential phases.
ROW 6: Lu Zhiwei hoeing with a wood-handled farming hoe facing lower right, same six successive work poses as row 3.
Precise layout: cells equal size. Within every cell the body axis is horizontally centered, full body spans approximately 75 percent of cell height, the ground foot anchor stays at exactly 50 percent cell width and 87 percent cell height. Each sprite including all hair, sleeves, feet and tools must fit entirely inside its cell with transparent margins, absolutely no overlap with neighboring cells. The two walking rows for each character keep an identical scale and baseline. Labor bending changes posture, not body dimensions. Entire output must contain exactly 36 separate complete character poses.
```

## 间隔修订提示词

```text
Use case: identity-preserve.
Asset type: transparent 2D animation atlas, exactly 6 columns by 6 rows, 36 sprites.
Input image is the edit target. Preserve both exact character designs, the delicate hand-painted artwork, ivory and jade colors, six sequential walking and hoeing poses in every row, fixed elevated three-quarter view, outfit identity and animation order.
Change only spacing and placement: give every sprite dramatically more transparent breathing room inside its own equal square cell. Each character including its hoe must fit inside the INNER 68 PERCENT width and INNER 68 PERCENT height of its cell. Keep a completely transparent gutter of at least 16 PERCENT of the cell on ALL FOUR SIDES of EVERY sprite. Head and tool may never extend above their cell. Feet and tool may never extend below their cell. Keep body ground foot anchor at the same point in every cell: 50 PERCENT horizontal, 80 PERCENT vertical. Labor tool may go higher while the bending body gets shorter, but the entire silhouette fits.
All 36 sprites should be centered consistently in their cells, at identical body scale. A true regular 6 by 6 grid, square overall canvas, invisible cell borders. Exactly 36 full-body sprites, same poses and visual quality as input, just with significantly larger gaps. Genuinely transparent alpha background everywhere, no drawn grid, no text, no solid background, no floor shadows.
```

## 生成记录

- 首次生成：`/Users/shepard/.codex/generated_images/01a11dbf-d6e5-7ef2-97c8-2497330d8d13/exec-3e8cd2d3-2c07-45e8-ad45-f7b97b0f73e6.png`
- 最终生成：`/Users/shepard/.codex/generated_images/01a11dbf-d6e5-7ef2-97c8-2497330d8d13/exec-d807d324-5f70-4aba-9ab3-619d5de23874.png`
- 使用内置 image_gen；第二次以首次图为编辑目标，扩大帧间空白。
- 颜色、光照、画笔参考：已查看同批地面素材 `exec-7a06164c-0e97-42d6-97e9-dcb3654d3a48.png`，在生成提示中使用暖光、米灰、青灰、苔绿调色约束。
- PNG SHA-256：`577465185213cd6503ecfd6e9a065d4fbe54ad762b6b924d6a47d9e8f2c8a4a1`；同值记录在 `characters.json`。

## 接口和验证边界

`setup(is_master)` 选择同一人物的18帧；`set_motion(moving, working, delta)` 设置当前活动；`set_facing(direction, delta)` 根据实际方向选择前后与左右；`hit_test(world_point)` 在当前显示范围内反投影到图集像素，按 alpha > 0.12 判断，包含缩放和水平翻转。父场景负责位置和暂停；Actor没有经营结算或存档写入。

2026-10-09 在独立临时项目中由 Godot 4.6.3 完成资源导入与行为检查：两人各18帧、行走/劳动切帧、脚点变换、水平翻转点选、透明角落拒点、隐藏拒点、暂停冻结和恢复时动画增量上限通过。PNG 1254×1254/RGBA、36个可分离主体、透明像素和素材哈希已核对。这里的检查不提升整项 SR 或真人美术验收状态。

同日只读复核实际 Web 的 `output/playwright/painted-courtyard/default.png`：约1440×900画面中掌门约70屏幕像素高，人物与门框比例成立；该静态帧未见明显矩形底色或黄红边缘噪点，存在细灰黑轮廓。两人白袖、高髻与衣形较接近，药田景物进一步削弱门人轮廓；真人辨识继续待验。该截图只覆盖当前姿态，连续切帧、全部36帧边缘与运动观感仍由实机操作核对。

人物素材覆盖行走与锄地，两种朝向加左右翻转。室内活动、装备换装、施法和其余人物活动继续按各自 SR 验收。当前静止帧来自步行周期；两人姿态连续性和整场景观感以本批实机记录为准。
