# 首屏环境补画记录

2026-10-15，使用内置 image_gen。输入为已确认的 `courtyard-v2.png`，尺寸1672×941。原图完整保留；运行仅在人物原位置的局部多边形内取用清人补画，在药田实际为空时取用空田补画。其余环境继续绘制原图像素。

## 人物移开后的环境

输出：`prototypes/pixel_scene_validation/assets/courtyard-clean-v2.png`。

```text
Use case: precise-object-edit.
Input image is the APPROVED fixed-camera HD pixel-art courtyard master. Create a clean environment plate by removing ONLY the two painted people and their small personal cast shadows: the blue-white robed man in the central stone courtyard, and the lavender-robed woman tending the lower-left herb plot.
Reconstruct the paving slabs, stone seams, tiny moss and existing herb rows / soil visible behind those figures. Continue exact neighboring stone alignment and plant spacing. Preserve every other pixel as closely as possible: hall, roof, pine trees, lanterns, stairs, herb garden fences, tools, planted rows, all paths, valley, bridge and terrain must keep their exact position, shape, scale, color and fine pixel texture. Preserve all shadows belonging to buildings, trees, garden tools and fences. No new props or people. The camera and entire image dimensions must stay exactly the same 1672x941. This will be used in a layered game, with small local patches drawn only where the people used to be.
```

## 待播药田

输入为上述清人环境，输出：`prototypes/pixel_scene_validation/assets/courtyard-fallow-v2.png`。

```text
Use case: precise-object-edit. This is a game environment layer.
Starting from the supplied clean courtyard image, edit ONLY the planted soil inside the bamboo-fenced herb garden in the lower-left corner (approximately x=175..630, y=650..845 of the 1672x941 image).
Replace the herb plants and their flowers inside this enclosed cultivated plot with clearly tilled empty earthy furrows, subtle soil clods and narrow walking strips, matching the existing ground perspective and fine pixel grain. It is a prepared garden awaiting planting.
Keep the entire garden fence, tool shelf, jars, baskets, surrounding flowers outside the fence, paths and nearby rocks in exactly their existing positions. Keep EVERY other part of the image unchanged. No people. Same 1672x941 composition and materials. We will only use the interior garden patch for the actual unplanted game state.
```

像素对照与实际运行记录见 [RUNTIME.md](RUNTIME.md)。人物帧、脚点、比例及遮挡多边形见 `courtyard-layers.mjs`；场景图像与正式米制坐标的对应见 `courtyard-space.mjs`。
