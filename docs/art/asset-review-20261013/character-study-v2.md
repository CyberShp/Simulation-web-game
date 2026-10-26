# 青衣修士 · 三视图与模型样件

2026-10-14，接续 U-132。用户要求先出人物三视图，再据图建模渲染。本批以通用青衣修士检验衣装、头部与材质制作流程。

## 制作依据

[正、侧、背设计图](character-design-v2.png)由内置 imagegen 生成，[完整生成要求](character-v2-prompt.txt)随素材保存。

图中肩线、腰带与脚底用于对齐模型。前襟与背部中央衣摆分别定长；侧面被袖子和手遮挡的躯干部位按衣片结构补齐。模型包含连续交叠衣襟、分片衣摆、扁宽袖口、成人头部与中分后梳发束。衣料颜色与细纹从三视图投射并烘焙为 4K 贴图；头部另用[近景参照](character-head-detail-v2.png)辅助五官与发际线对齐，[生成要求](character-head-detail-v2-prompt.txt)随图保存。眼白、虹膜与嘴唇保留独立几何材料。

## 文件

- 可编辑部件：`prototypes/three_style_showcase/assets/asset-review/character-v2/disciple-editable.blend`
- 烘焙模型：`prototypes/three_style_showcase/assets/asset-review/character-v2/disciple.blend`
- 实时模型：`prototypes/three_style_showcase/assets/asset-review/character-v2/disciple.glb`
- 制作入口：`prototypes/three_style_showcase/blender/build_character_v2.py`
- 实际渲染：`prototypes/three_style_showcase/blender/render_character_study.py`

图鉴中的青衣修士载入本版本，设计参照按钮打开同一张 v2 三视图。此前的人物模型和设计稿保留在各自目录。

## 本批验证边界

对应 SR-XF-003/007/029/030 的局部人物呈现，完整 SR 与 AC 状态保持。检查模型载入、正侧背实际渲染、材质与素模切换、待机/行走/施法；独立模型文件重开代替本批素材读回检查。正式游戏存档、战斗结算、Windows 与多人场景性能在各自批次验收。

过程与实际模型截图保存在 `/Volumes/Media/immortal-qa/character-study-20261014/`。设计图与实际模型渲染分别标明，用户美术评看继续独立记录。

## 当前视觉差距

衣片和袖摆已能逐面查看。脸部结构与投射颜色仍有衔接痕迹，头发的自然轮廓与发丝层次低于设计参照；本样件尚未达到 D 图的写实质量。当前近景模型约 20 万三角，还需要针对正式镜头和多人场景制作适合的细节等级。三视图对齐、模型导出与可运行，不等于美术质量已获认可。
