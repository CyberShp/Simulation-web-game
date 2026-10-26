# 掌门倒地整帧制作记录

2026-10-27，内置imagegen，单张三姿势。既有动作继续复用，本图补当前同身份角色的倒地缺口。三帧已接入，正式败退终局侧卧画面已由主Agent查看；以下保留制作阶段的提示词与判断。原Kling片段仅含待机、起跑、跑步、收步；已存action/counter/player/cast图没有人物侧卧姿势。

身份参考：`assets/courtyard/combat-sword-study-v1/frames/action-03.png`。主Agent已实际查看参考及生成结果。

生成原文件：`/Users/shepard/.codex/generated_images/01a171b0-eee9-7701-bd4a-61dcb2b0b53b/exec-1c93ad0e-f8ab-4b09-9667-7b2f21b0891c.png`。

实际提示词：

```text
Use case: identity-preserve. Asset type: a single production sprite sheet filling one missing collapse animation for an existing 2D xianxia sword cultivator. Reference image 1 is the EXACT CHARACTER IDENTITY and pixel rendering to preserve, not an environment. Create exactly THREE separate full-body sprites in one horizontal row on genuine transparent alpha, each in an equal spacious cell with no overlap. Same fixed slightly elevated orthographic 3/4 game camera, facing screen-right, same body scale in every cell. Left pose: knees buckling, right knee touches ground, torso leaning forward, sword held low in his right hand, free left hand reaching to brace. Middle pose: the same character collapsing onto left forearm and hip, knees folding naturally, head and torso lowering toward screen-right. Right pose: the same character completely down on his side, torso horizontal and head resting toward screen-right, legs extended toward screen-left with a slight natural knee bend, right hand still holding his silver sword resting flat on the ground beside him; eyes closed, readable non-graphic unconscious defeat. Every pose must be anatomically coherent whole-frame artwork, same costume and accessories: plain deep royal blue long outer robe, plain ivory-white inner lapels and long front panels, plain ivory cuff bands, navy trousers, plain dark brown wrapped ankle boots, dark brown double waist belt, ONE small pale turquoise round waist ornament with a short tie. Dark brown long hair tied into the SAME compact topknot and blue ribbons, same youthful male face. Keep the reference's dark pixel outlines, simple blue/white color blocks, light from upper left, pixel-cluster shading, consistent pixel density. The robe stays simple: no added embroidery, gold straps, armor, additional jewelry or decorative shoulder panels. Preserve exactly one slim straight silver sword with the same small gold guard and dark handle per pose. Generous transparent margins fully contain the entire sword, hair, hands, feet in each cell. No floating extra sword fragments from the reference image, no ground tile, no backdrop, no text, no grid, no shadows disconnected from the body, no blood. Do not use the different pale-cyan ornate-costume character. Pose changes only; identity and clothing remain locked.
```

初步视觉检查：深蓝素服、白袖口、小发髻、腰饰与参考相符；膝跪、撑地、侧卧三姿势可辨认。中间剑尖跨越假定等分格，后续应按分离的透明轮廓提取，不能切断剑尖。三帧必须共用源比例，以头部和躯干对照现有1.45米成人标尺；卧姿不能按自身包围盒高度放大到站立高度。等尺度对照、根点、连续动作和正式失败结局画面仍待验证。

## 等尺度选择

主Agent已查看`/Volumes/Media/immortal-qa/combat-sword-study-motion-20261027-v001/down-scale-v001/down-scale-contact.png`。选择上排native整帧、共用成人源标尺H650：跪姿、撑地、侧卧保持同一个人的大小，原始服装和头部细节可读；下排BOX58在两倍对照下明显更糊，未选。语义根点按原sheet坐标分别为[350,600]、[1040,600]、[1690,600]，不是把各帧包围盒重新居中或拉成站立高度。

批准进入运行候选，不等于实际败退画面已验收。预期只读正式`downedTick`在0/150/300ms推进三帧，末帧稳定保持；左右通过整帧镜像表示，上下没有独立素材。原来源缺少倒地起点时直接保持末帧，避免每个世界步重复跪下。采样和正式失败终局像素待验证。

## 正式窗口结果

随后动作采样按上述时钟接入。`/Volumes/Media/immortal-qa/combat-final-native-20261027/defeat-01/report.json`的5项检查通过：预置旧伤99后，真实敌人攻击使掌门HP由1降至0、伤势达到100%，进入唯一败退结果并返院。主Agent实际查看`terminal-pose.png`，确认深蓝同身份人物侧卧、尺度与0HP终局相符。该图在终局后13tick抓取，末帧保持；更早的`combat-result.png`仍显示上一轮HUD的1HP，不能代替最终证据。

后续`/Volumes/Media/immortal-qa/combat-final-native-20261027/vertical-down-02/report.json`在894版本补齐活动中的三阶段截图：真实敌击造成倒地，canonical downedTick=780，0/151.9/300ms分别为跪、撑、卧。主Agent已亲看三张原生PNG，确认同身份、同尺度和固定脚点；窗口正常关闭，源与运行散列保持。独立上下倒地素材仍缺。
