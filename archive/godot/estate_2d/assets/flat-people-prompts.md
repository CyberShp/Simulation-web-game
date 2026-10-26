# U-126 人物平涂素材

2026-10-13，使用内置 `image_gen`；输入为既有人物画稿及 `docs/art/mountain-flat-20261013/prototype.png` 风格参考，输出 PNG 原始字节保留。透明边界、图集裁区与脚点登记在两份同目录 JSON；Godot 负责缩放与透明边缘显示。

## 掌门与陆知微图集

输入：`archive/godot/painted_courtyard/assets/characters-v2.png` 与原型。输出：`flat-characters-v1.png`。

```text
Use case: style-transfer. Asset type: transparent game character animation atlas for a Chinese xianxia sect-management game. Image 1 is the EDIT TARGET, a 1254x1254 8-by-8 sprite sheet. Image 2 is STYLE reference only. Repaint the complete 64-sprite atlas in the clean Chinese guofeng flat-color illustration style of Image 2: bold readable silhouettes, crisp outlines, large controlled solid color regions, at most one shadow tone per material, simplified cloth folds and faces that read at 76px tall. KEEP the exact 8 columns and 8 rows, exact character position/scale within each cell, each distinct pose and sequence order, camera angle, equipment, sex and identity. Top four rows are Shen Yan, male long black hair tied in topknot, BLUE and white robe with ochre belt: front-walk 8, back-walk 8, tool-work 8, turn/rest 8. Bottom four rows are Lu Zhiwei, female long black tied hair, OCHRE YELLOW shirt, ivory sleeves, TEAL green skirt/trousers and herb basket: front-walk 8, back-walk 8, herb-work 8, turn/rest 8. Each sprite must remain fully isolated, including feet and work tools, with a transparent gap to its neighbors. Preserve all 64 poses exactly as the edit target, not a new character sheet layout. Actual transparent alpha background, no scenery, no ground shadows, no grids, no text or labels. Output square at the same composition/spacing as target.
```

## 商人、青箩与山魈

各自以 `merchant-qingxi-v1.png`、`qing-luo-v1.png`、`valley-shanxiao-v1.png` 为编辑目标，原型为第二张参考；输出分别为 `flat-merchant-qingxi-v1.png`、`flat-qing-luo-v1.png`、`flat-valley-shanxiao-v1.png`。三次请求均以以下前缀、对应 subject、后缀拼接发送，并使用 `transparent_background: true`。

前缀：

```text
Use case: style-transfer. Asset type: transparent 2D xianxia game world character sprite. Image 1 EDIT TARGET; Image 2 STYLE reference only. Repaint the figure from Image 1 in the crisp guofeng flat-color illustration style of Image 2: large readable color shapes, dark clean thin outlines, simplified fabric folds/fur, one controlled shadow per material, no fine texture.
```

Subjects：

```text
Qingxi merchant, middle-aged Chinese man with moustache and short beard, olive robe, ivory shawl, muted blue sash, olive cloth wrapped hair bun, carrying wooden herb basket backpack and a staff. Preserve this identity, face, costume colors and equipment. 3/4 overhead game view full figure, full shoes and topknot.

Qing Luo, young adult Chinese woman with long dark braid and tied hair bun, lilac gray robe, ivory inner cloth, sage green lapel/sash, herb pouch at waist. Preserve this identity, face, costume colors and equipment. 3/4 overhead game view full figure, full shoes and topknot.

Shanxiao mountain beast, broad hunched gray-brown furry ape creature with olive moss tufts, reddish brown face, tusks and massive four-limbed silhouette. Preserve this identity, face, fur colors, pose, number of limbs and proportions. 3/4 overhead game view full creature.
```

后缀：

```text
Center isolated subject occupying 85% canvas height with clear transparent margin around every side. Output only that figure on an ACTUAL alpha transparent background. No atmospheric halo, no background, no ground shadows, no scenery, no text. Make it read clearly when displayed only 76 pixels tall (beast 100). Preserve its recognizable identity and artwork quality.
```
