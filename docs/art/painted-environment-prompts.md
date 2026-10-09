# 山院二维环境素材

生成方式：内置 image_gen。参考图：`docs/art/reference/mountain-courtyard.png`，仅作为配色、材质笔触和建筑风格参考。

## 地面背景

项目文件：`godot/painted_courtyard/assets/ground.png`。

```text
Use case: stylized-concept. Asset type: production background painting for a Godot 2D Chinese cultivation management game.
The supplied image is a STYLE REFERENCE only: retain its harmonious blue-gray stone, warm cream limestone, moss, jade water, pine foliage and softly painted natural detail.
Create a new 1536 by 1024 landscape game terrain painting, a fixed elevated three-quarter orthographic view with no horizon, looking down at about 40 degrees. This is a flat painted 2D game asset.
Composition: one secluded mountain courtyard. A broad EMPTY level pale-stone foundation/clearing occupies the upper center, roughly x 560-1160 y 170-520; this unobstructed space will receive a separate building sprite. A wide beautifully irregular warm limestone courtyard and stone path extend from that clearing down through the center to the lower edge, occupying roughly x 380-1110 y 500-930, with clear walkable space. A modest rectangular planted herb bed is at the lower right, roughly x 1130-1340 y 700-850, with its left edge clear for a working character. Jade stream and naturally layered mossy rocks run along the far left edge; pine trees, bamboo and mountain boulders frame the outer left, upper and right margins. Gentle pale mountain mist at the very top corners. Keep the middle two-thirds uncluttered and navigable.
Art direction: finely illustrated painterly game background, cohesive hand-painted textures, warm soft daylight from upper left, delicate wear on stone and earthy plant shadows, rich but restrained natural color, readable shapes. Environment fills the whole rectangular canvas and continues beyond its boundaries; no floating island or cutaway platform.
Critical: ZERO buildings, ZERO humans or animals, no furniture on the central clearing, no text, no symbols, no UI, no watermarks, no grid. The terrain and path must be easy to compose with a separate hand-painted main hall at the upper center.
```

## 主殿精灵

项目文件：`godot/painted_courtyard/assets/hall.png`；生成请求使用 transparent_background=true。

```text
Use case: stylized-concept. Asset type: a single production building sprite, a finely hand-painted Chinese cultivation sect main hall on a genuinely transparent background, for Godot 2D.
The supplied image is the STYLE REFERENCE. Use the architecture, proportions, blue-gray ceramic tiles, honey-brown timber, warm plaster, pale limestone and gently weathered illustrated detail of its main hall.
Create only ONE complete hall, full building and its own small raised stone base with five broad entrance steps. Fixed elevated orthographic three-quarter view looking down at about 40 degrees; front facade is strongly visible, right wall visible, front faces slightly to the lower-left. Restrained upturned hip-and-gable blue-gray tiled roof, deep timber brackets, five facade bays, two muted rust-red narrow hanging banners with small abstract ornament, CLOSED solid timber double doors and opaque latticed windows. The roof and all exterior walls are complete. Include a subtle compact contact shadow directly under the plinth/steps that will blend onto warm stone paving.
Painterly 2D asset, elegantly drawn detailed textures and cohesive edges, warm soft daylight from upper-left matching the reference. Entire sprite in frame with generous transparent margin. Landmark proportions, grounded architecture.
No people, no landscape, no surrounding trees, no large courtyard, no standalone props, no cutaway, no interior furnishings, no text or labels. Keep all background pixels genuinely alpha-transparent. Aim 1536 by 1024 canvas.
```

## 导入与布局

两张生成图按原始字节复制进入工程。地面为1536×1024 RGB；主殿为1536×1024 RGBA，透明度范围0–254。Godot中主殿显示尺寸620×413.333，水平翻转使台阶方向与背景平台一致；这属于场景显示参数，源图保留。脚点深度与入口分别在layout.json中记录，碰撞边界按实际画稿校准。

- `ground.png` SHA-256：`6e9933da372f54503f5fba3c6df6239d76d2a585afbc12fa70555dd7278ae2cf`。
- `hall.png` SHA-256：`2f7aba7ac6f4f539bd9d71b1c0344d400bbafcb094a01d3db51b7248b19cbde4`。
