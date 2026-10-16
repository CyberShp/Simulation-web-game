# 山门石阶接续带 · 生成提示

内置 imagegen 精修。输入为按实际世界坐标导出的纯地形上下文：x0–1672、y700–1300；上部来自原山院，下部来自 v5 林道。工具生成 2094×751 图像，运行时按相同宽高比映回 1672×600。实际使用素材为 [trail-stair-connection-v1.png](../../../archive/prototypes/pixel_scene_validation/assets/trail-stair-connection-v1.png)。

上下边界位于原图已对应的纹理范围内，沿颜色接近的石纹和枝叶接合；边界坐标保存于 [trail-stair-connection.mjs](../../../archive/prototypes/pixel_scene_validation/trail-stair-connection.mjs)。上下各以 2 像素步长比较相邻区域，选择连贯的低色差路径，运行加载时绘制实色补画缓存。

```text
Use case: precise-object-edit.
Asset type: production high-definition fine-pixel 2D terrain repair strip.
Edit target: the supplied 1672 by 600 image is an exact 1:1 game terrain excerpt. Its visible horizontal join at y=241 is defective. Repair the LOWER side of this join only so the whole scene is physically continuous.
Strict canvas and framing: keep EXACT same wide 1672:600 aspect ratio, camera, scale, viewpoint, every object's position outside the repair band. Return the entire same excerpt. Do not crop, zoom, shift, add borders, or rearrange landmarks.
Protected reference: keep the TOP 241 pixels unchanged. The original upper courtyard is the authoritative style and its bottom-row rock faces, pine foliage, tree trunks, banner posts and stone staircase must continue naturally downward. Also preserve the BOTTOM 100 pixels (y500..599) exactly. Most edits belong to y241..470.
Central stairs: the upper staircase reaches the join at x about640..1030. Continue this same staircase smoothly below y241 with the same stone course height, fine pixel material and matching rail edges. It should taper gradually to the existing lower landing near x685..965 at y390. Preserve the lower paved approach, existing lower lantern locations, and bridge entrance at y566. One continuous stone stair and landing, coherent widths and steps.
Sides: repaint only the connection area below the join to continue the existing original branches, gray rock fissures and shrub masses seamlessly. Connect actual shapes across y241, with crisp opaque fine-pixel rendering and natural branch contours. The upper pine needles and gray-green rocks dictate detail scale, color and shading. No transparent blends, doubled contours, blur or fog.
Keep upper flags, lower bridge lamps, paths and river banks in place. No people, UI, text, or new objects. This is a surgical terrain continuity repair with fixed geometry. Render at the source pixel resolution or larger with the exact ratio.
```
