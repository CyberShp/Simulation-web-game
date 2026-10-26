# 正式山谷战场素材

2026-10-26，内置 imagegen；以已获整体认可的离线战斗场地作为风格参考，按48×32米正式战场与22米跟随镜头延展。人物动作沿已选整帧，以下仅制作环境。

## 宽幅地面

参考图：`/Volumes/Media/immortal-qa/combat-ranged-20261026-v002/background.png`。

生成源：`/Users/shepard/.codex/generated_images/01a171b0-eee9-7701-bd4a-61dcb2b0b53b/exec-51b08f53-0630-4da1-833e-2732da4e4f40.png`。

实际提示词：

```text
Use case: stylized-concept. Asset type: complete top-down pixel-art battlefield ground plate for the same xianxia game as reference image. Input image is an approved STYLE REFERENCE, not a map to enlarge. Produce a new wide landscape 2:1 composition at 2048x1024, matching its crisp small pixel clusters, blue-green pine canopy, grey ochre rocks, pale warm dirt, subdued grass and light from upper left. This map will be seen through a moving close camera, so detail size stays small: each paving pebble about 8-16 pixels, small stone steps about 20px wide; avoid giant features. Layout: a large nearly rectangular FLAT OPEN ochre dirt and worn-stone clearing spans x=7% to93%, y=16% to84% of image, about 48x32 metres. The entire inner rectangle must be safely walkable flat continuous ground with very subdued local ground textures and broad naturally varied dirt/grass transitions, without trees, boulders, water, cliffs, pits, walls or stairs INSIDE this rectangle. Keep broad spaces for long-range fighting and leave all inner ground uninterrupted. All elevated terrain lies OUTSIDE: layered pine forest beyond left/right edges, a low mossy stone cliff beyond the TOP edge, narrow stream and small waterfall far left OUTSIDE x7%, a low foreground rock ledge and pine tops below y84%. A clear level dirt exit path breaks through the left border at y49%, continuing left off frame, absolutely no water across this path. A path exits lower middle too. Natural asymmetric grouping of boundary trees and rocks, no repeating tile pattern, no giant decoration, no characters or creatures, no cast character shadows, no UI, no text, no border/grid. Keep orthographic 3/4 top-down game perspective, vertical rock faces only on outside border, not cinematic perspective. Render intentional clean readable pixel art, uniform pixel density, not blurry painting.
```

主Agent已查看生成结果。原提示词矩形的左下和下沿被石崖、树冠侵入，登记时改取约x17–87.42%、y20–75%的平地范围；横向右界按48×32米与正式sx:sy投影推导，使源图等比缩放，不以提示词要求自动证明结果成立。画面与正式障碍的实机套合仍须检查。

## 地物

参考图同上。生成源：`/Users/shepard/.codex/generated_images/01a171b0-eee9-7701-bd4a-61dcb2b0b53b/exec-2eddc0f4-1874-42af-97a6-d44947d64675.png`。

实际提示词：

```text
Use case: stylized-concept. Asset type: three isolated environmental sprites for an orthographic 3/4 top-down xianxia pixel-art game. Match ONLY the pixel-art style, warm grey stone, green moss and upper-left lighting of attached battlefield. Transparent background with actual alpha. One horizontal sprite sheet, three separate equally-sized cells with generous transparent gutters, each object fully contained, no overlap. LEFT: low dense oval patch of medicinal woodland herbs with several small mossy rocks, ground footprint about 4 metres wide by3 deep, height no more than knee height. CENTER: ancient ruined short stone bridge segment and collapsed parapet, horizontal seven-metre-long by three-metre-deep footprint; low grey stone arch entirely self-contained, dark under-arch occlusion, broken stone rubble around foot, no water, no long extending pathway. RIGHT: freestanding mossy rock outcrop with a dark shallow cave mouth, six-metre-wide by five-metre-deep footprint, about3m tall, asymmetric grey boulder cap. Consistent orthographic top-down ground compression (depth 0.59 compared to width), visible south-facing vertical surfaces; crisp uniform small pixel clusters and restrained palette like reference. Objects are meant to be placed as obstacles on the existing terrain. No ground rectangle, no scenic backdrop, no characters, no text, no UI, no numbering, no outline box. Preserve clean alpha, subtle contact shadows contained within footprint.
```

主Agent已查看三件完整地物：药丛、残桥、洞口。透明间隔可分组裁切，按正式障碍占地注册；源边缘少量黄绿像素需在实际显示尺寸继续检查。
