# 青衫门人人物样板

本批依据 D 写实国风方向制作一位泛化男性门人，供人物造型与动作审核。角色身高约 1.75 米，青灰外袍、浅色交领内衬、腰封、束腕、黑靴、发髻与玉佩组成同一套衣装。

## 文件

- [正侧背衣装设计稿](character-design-v1.png)：内置 imagegen 生成的设计参考。图中的袖形、佩饰与背部细节仍有跨视图差异，三维结构以可编辑源文件为准。
- [可编辑 Blender 源](../../../prototypes/three_style_showcase/assets/asset-review/character/disciple.blend)：保留 222 个具名部件及骨骼。
- [实际三维模型](../../../prototypes/three_style_showcase/assets/asset-review/character/disciple.glb)：带蒙皮、三段动画与内嵌织物法线贴图。
- [重建脚本](../../../prototypes/three_style_showcase/blender/build_asset_character.py)。
- [导出清单](../../../prototypes/three_style_showcase/assets/asset-review/character/manifest.json)、[结构与动作采样](../../../prototypes/three_style_showcase/assets/asset-review/character/geometry-animation-check.json)。

## 当前模型内容

已建模连续胸背与肩颈、贴合胸面的分层交领、长袍褶皱与开衩、包边、带内衬与垂布起伏的宽袖、束腕、分指手、鞋靴、连续头部形体及独立五官、梳理发束和后发、开孔玉佩。衣摆由八根独立骨骼带动。模型采用米制，导出为 Y 向上、正面 +Z、脚底 Y=0。

动画名固定为 `idle`（3 秒）、`walk`（1.2 秒）、`cast`（2.2 秒）。三段均原地播放，施法含起手、前伸与收势。运行时骨骼名由 Three 加载器移除句点，例如 `hand.R` 读取为 `handR`。

近景审核精度为 188,356 个三角面、18 种材质、26 根骨骼；这些数值记录当前资产状态，同屏批量性能待验证。

## 已做的有限检查

Blender 5.2.1 后台生成并实际导出成功。Three GLTFLoader 读取真实 GLB，CPU 计算蒙皮后的顶点：静止高度 1.750 米；每段动作在起始、25%、50%、75%与结尾采样均有有效骨骼变化、有限坐标、接地鞋底；首尾采样一致。该检查未解码贴图像素，实时画面由旋转台承担。首轮实时画面发现肩颈开口、领片悬空与宽袖过于规整；已经据此修改模型结构并重导，第二轮确认肩颈封合后，继续定点修改领片共面重叠与内衣层级；后续画面审核继续记录。

最终实际帧位于 `/Volumes/Media/immortal-qa/asset-review-20261014/final-models/asset-disciple-hero.png` 和 `asset-disciple-cast.png`，根 Agent 已检查：肩颈封合成立，领片白色破碎边沿已消除；三个动作的实时播放与施法按钮已验证。该结果只覆盖所见姿态和功能。

## 继续审核的内容

设计稿的脸部塑形、自然头发束、衣料细纹与刺绣密度仍需与实际近景逐项对照。当前脸部和手部为程序化几何，细腻度未达设计稿。动作的衣袖与衣摆穿插、从侧面看的衣料厚度、真实光照下的皮肤和布料表现，需依实际帧修订。多人同场、Windows 及正式角色接入另行验证。

## 设计稿生成记录

模式：内置 imagegen，2026-10-14 生成，保留项目内版本 `character-design-v1.png`。

最终提示词：

```text
Use case: stylized-concept.
Asset type: professional character turnaround design sheet for a realistic Chinese fantasy 3D game.
Primary request: create one consistent generic adult Chinese male sect disciple in muted blue-green robes, shown as full-body FRONT, SIDE, and BACK views, to guide a real editable 3D model. This is an original clothing design sheet, not a game screenshot. Realistic adult anatomy, approximately 1.75m including a modest topknot; age about 28, lean athletic build, calm focused face, natural facial features.
Scene/backdrop: clean warm light-gray studio board with three evenly spaced full-height figures, same scale and shared foot baseline. A faint ground shadow only.
Clothing: pale warm-ivory inner cross collar under a desaturated dark teal outer robe; tailored shoulders and sleeves tapering near wrists, layered folded collar with narrow stitched edges; broad woven dark blue-green sash at the waist; open overlapping lower robe panels with a front walking slit and visible pale under-robe, hem above dark ankle boots; physically plausible fabric thickness and gravitational folds, no armor. A single small restrained jade pendant hung at the waist. Black hair gathered in a simple high knot with a narrow hairpin, long rear hair tied neatly down the upper back. Five-finger hands visible and relaxed. Neutral slight A pose with sleeves separated from torso so garment construction is clear.
Style/medium: high-end realistic Chinese fantasy game character art, exquisite but grounded cloth materials, dark restrained colors, natural skin, subtle woven textile grain, readable garment layers and seam logic. Consistent garment details in all three views; realistic 7.5-head proportions. Soft neutral lighting shows cloth form and material, with modest contrast.
Composition/framing: wide horizontal single sheet, all three views same exact person, front facing camera, strict side profile facing left, back facing away; each figure fully visible from topknot to boots, with generous space between figures. No perspective distortion.
Text (verbatim): small elegant Chinese title at top: "青衫门人 · 衣装设计稿"; under each figure respectively: "正面", "侧面", "背面".
Constraints: the same hair, belt, panel overlap, shoes, sleeve cuts and jade ornament across views. The look belongs to a realistic stone courtyard and ancient timber temple setting. The garment must look wearable during walking and casting, with restrained ornament and carefully layered silhouette.
```

