# 云岫山谷平涂素材 · U-126

2026-10-13。使用内置 imagegen，以批准的 `docs/art/mountain-flat-20261013/prototype.png` 为画风参考、原山谷地形和地物为构图参考。运行素材保持实际世界位置和交互范围。

| 运行文件 | 尺寸及用途 |
| --- | --- |
| `flat-valley-ground-v1.png` | 1536×1024 RGB，山谷及旅途中地形 |
| `flat-valley-props-v1.png` | 1024×1536 RGBA，桥、侧洞、药丛图集 |

图集由 Godot `AtlasTexture` 读取生成图原始像素；区域按可见 alpha 范围及边缘留量记录于 `valley_scene.gd`。桥为 `(103,38,801,457)`，洞为 `(211,529,651,543)`，药丛为 `(245,1086,526,426)`。图集原有透明度保留。

世界映射继续为 `(80+21×x,100+16×y)`。药丛、桥、侧洞分别落在屏幕 `(395,356)`、`(731,468)`、`(1067,596)`；人物、返院出口和采集剩余量均由共同快照提供。

## 地形提示词

```text
Use case: style-transfer.
Asset type: production 2D game valley ground layer, landscape 1536 by 1024 pixels.
Input images: image 1 is the existing valley terrain edit target, preserving its fixed oblique camera and broad open walking clearings; image 2 is the approved visual style reference.
Primary request: redraw the valley terrain in the approved clean Chinese fantasy flat-colour illustration style. Use broad muted jade and sage foliage shapes, blue-grey cliff planes, pale warm sandy paths, crisp restrained contours, clear open areas. Simplify all grass, leaf and rock surface detail into quiet large shapes. Soft daylight, readable game art at small scale.
Composition: retain the overall open meadow ringed by trees and cliffs, distant blue peaks and mist at top, walking paths connecting west, centre, east and bottom. Actual scene placement coordinates on a 1536x1024 canvas: herb collecting ground at (395,356), stone bridge anchor (731,468), cave anchor (1067,596), standing person at (983,484), encounter clearing (647,676), return path (227,532). Keep these ground positions clear and connected by open earth/grass. A shallow narrow stream may pass behind the future bridge near (731,435) while the bridge landing remains clear.
Layer constraints: output terrain only; buildings, bridge, cave entrance, herbs, people, monsters, UI and text are separate runtime sprites, so leave their sites as quiet ground. Do not bake any of those objects or their shadows into this terrain. No labels, grid, border or watermark. Preserve the wide 3:2 composition; the second image supplies only line, shape and colour treatment.
```

## 地物提示词

```text
Use case: style-transfer.
Asset type: transparent 2D game sprite atlas, landscape 1536 by 1024 pixels, three equally wide separate columns.
Input images: image 1 existing stone bridge shape; image 2 existing cave shape; image 3 existing herbs shape; image 4 approved clean Chinese fantasy flat-colour style.
Primary request: redraw the three objects as independent cutout sprites matching the style reference: broad simple colour areas, crisp readable silhouette and restrained hand-drawn contours, muted blue-grey stone, jade foliage, pale cream herb flowers. Fixed oblique top-front game camera and soft upper-left daylight.
Atlas layout: exactly one object in each of three 512-pixel wide columns. Left column: low arched stone footbridge with short stone parapets and four simple posts. Middle column: small blue-grey rocky cave mound with a dark open entrance facing lower left and a few grouped vines. Right column: single compact medicinal herb clump with broad jade leaves and small cream flowers rooted in a little irregular earth patch. Each object fully contained in its column with transparent padding all around; no overlap between columns. Keep complete bridge landing stones, cave footing and herb roots visible.
Transparency: genuinely transparent background with alpha, including all space between objects. No contact or cast shadow outside the small physical footprint; do not paint a ground plane. No people, buildings, labels, column lines, text, checkerboard or watermark.
```

## 图集排布提示词

```text
Use case: precise-object-edit.
Edit the attached three-object sprite atlas only to rearrange the layout for reliable game extraction. Preserve the exact clean flat-colour style and designs of the bridge, cave and herbs.
Output a PORTRAIT transparent atlas 1024x1536. Exactly three separate horizontal ROWS, 512 pixels tall each:
ROW 1: only the stone arched bridge, contained within x80..944 and y60..430.
ROW 2: only the rocky cave, contained within x250..774 and y580..940.
ROW 3: only the herb clump, contained within x270..754 and y1120..1450.
Each whole object fits wholly inside its row. At least 100 pixels of fully transparent empty horizontal band separates adjacent rows. Keep clear transparent padding on all four canvas edges. Every object fully visible with its foundation/root footprint. No shadows outside objects. No text, lines, labels, checkerboard or background. Preserve genuine alpha transparency.
```

