# 金丹篇山院总体场景制作记录

日期：2026-10-18。使用内置 `image_gen`，生成全山院场景概念图，再定向细化西谷上缘的丹房与药圃。最终选用图为 `overview-v1.png`，1536×1024 像素，3:2。

本图用于评看空间关系、建筑尺度、材质和总体气氛。建筑及场地身份、精确数量、编号和固定建位以同目录建位方案为准；运行接入与验收分别记录。

## 参照

- `assets/courtyard/courtyard-master-v2.png`：原山院主殿、前庭、古松、蓝灰瓦与暖灰石的视觉基准。
- `docs/art/west-forest-20261018/west-forest-scene-v1.png`：西侧林地、石桥、采伐场与道路衔接参照。

两张参考图均在调用前通过 `view_image` 查看。

## 原始输出

- 初稿：`/Users/shepard/.codex/generated_images/01a14d9a-76c1-7ac1-9b5c-88208d785804/exec-6c472b2f-712f-4371-84ff-d7ed9483fa6f.png`
- 最终选用：`/Users/shepard/.codex/generated_images/01a14d9a-76c1-7ac1-9b5c-88208d785804/exec-34a1ed11-946f-44c7-9ec8-cd261087eecc.png`

## 初稿完整提示词

```text
Use case: stylized-concept.
Asset type: one landscape game environment concept image, expanded full mountain estate overview, wide 3:2 composition.
Primary request: Pull the camera far back from the two supplied reference images and imagine the complete Golden Core chapter mountain estate surrounding the same main hall. Paint one coherent richly detailed pure 2D high-definition pixel-art scene, all buildings embedded naturally in the continuous land, paths and rock terraces. Reference image 1 establishes the original hall, open stone courtyard, ancient pine, fine pixel textures and building proportions. Reference image 2 establishes the west stone bridge, forest lumberyard and continuous roads. Keep their visual identities, roofing palette, warm stone, natural light and exact style as the art baseline while composing the substantially larger estate.
Scene and visual hierarchy: A modest functioning cultivation sect for roughly sixteen permanent people plus visitors, spread across a beautiful connected mountainous estate. At center slightly behind the middle is the recognizable single main hall with blue-gray tiled roof, carved warm timber, a few gold details, its broad clear stone forecourt and ancient pine. A long stepped southern approach connects a modest mountain gate in the lower foreground to this forecourt. Preserve human-scale doors, steps, paths and courtyards; a few tiny adult figures demonstrate scale.
Behind the main hall, connected by ascending stone paths, place a small library-and-teaching courtyard, an open circular qi-gathering platform, a quiet retreat courtyard built against a rock face with cave doors, a martial practice terrace with restrained training equipment, and a small mountain-defense array pavilion with stone array anchors. These facilities occupy separate little terraces among pines, with generous open land and natural rock.
To the east/right, the road follows contiguous gentle terraces with three or four separate modest disciples' residential courtyards, a communal kitchen and dining house, a medical recuperation house, a compact alchemy house with its herb-drying courtyard, and a small guest court. Houses are separated by gardens, trees and usable stone walks; each house is appreciably smaller than the main hall.
To the west/left, a stone bridge connects the recognizable forest lumberyard. The road descends to a broader productive valley with irrigation channels, rice paddies, medicinal herb plots, a public storehouse and goods-loading yard. Near this valley is a compact connected artisan cluster: a timber workshop with stacked wood, a forge with a tiny warm furnace glow and a small pottery kiln, a clean paper/talisman and array-device workroom, and a puppet assembly courtyard with small wooden mechanical frames. These are readable activity groups rather than huge monuments. Add a wooded beast enclosure at the forest edge and, separated from daily living by a creek and trees, a compact insect-cultivation courtyard with screened pens. A small quarry hugs bare rock on the outer western flank, away from the clean spring and residence area. Roads reach each group and leave room for carrying materials.
Water and land: A clear natural spring emerges high on the mountain and supplies a coherent downhill water channel, small pools and agricultural irrigation. Streams, stone bridges, green slopes, gray cliffs and pines give strong continuous geographical connections. Forest belts, courtyards and transport paths remain dominant separators between groups.
Distant geography: Four recognizable subsidiary mountain peaks frame the rear background, two near and two far, with forested terraces and faint future connecting paths. Most distant peaks remain natural mountain scenery. All land is physically connected by ridges and valleys.
Style/medium: meticulous pure 2D high-definition fine pixel painting, crisp small pixel clusters, exquisite blue-gray roof tiles, warm gray stone slabs, textured timber, jade-green pine forest, earthy cultivated ground. Maintain the reference images' level of craft across the whole image. Fixed elevated oblique front camera with consistent parallel local building scale, clear readable roof and courtyard silhouettes. Soft sunny mountain daylight, restrained airy mist only in far valleys. Mountain retreat, low building density, substantial landscape breathing room.
Constraints: One unified continuous landscape, fully grounded buildings, solid enclosed roofs, usable exterior entrances, overall overview framing, ordinary workshops smaller than the main hall. This is a scene composition concept; depict all the named functional groups without turning the painting into a numerical building schedule.
Avoid: any text, labels, signage lettering, numbers, UI, grid, diagram arrows, border, watermark, floating islands, oversized close-up people, modern structures, urban density, gigantic palace clusters, plastic 3D-render appearance.
```

## 定向细化完整提示词

```text
Use case: precise-object-edit.
Edit the provided mountain-estate overview with one local planning correction: make a compact clean alchemy/herb-processing courtyard clearly visible on the UPPER EDGE OF THE WESTERN PRODUCTION VALLEY (left half of image), beside a clean branch of the spring-fed water channel and a small medicinal herb plot, spatially separated from the quarry and forge. Use an existing small workshop footprint or adjacent small terrace without increasing overall density. Its small blue-gray-roof house, enclosed warm timber walls, neat herb drying trays and clean water basin should make its purpose visually readable. Eastern/right buildings remain living, dining, medical recuperation and guest courtyards.
Keep the overall composition, all major roads, the central main hall, pine, southern gate and long stone stairs, the eastern residential terraces, the rear library/teaching/meditation/cave-retreat/martial platforms, western quarry, forest lumberyard, irrigated paddies, public warehouse, compact artisan yards, animal enclosure and the natural distant mountain peaks unchanged. Preserve their current pixel texture, fine blue-gray tiled roofs, warm gray stone, jade forest, daylight, scale and framing. Where there is a small insect-cultivation compound near the forest/creek edge, show a modest enclosed screened house with a tiny separate storage shed as part of that same courtyard. Only make this refinement if the courtyard remains naturally integrated.
No text, labels, numbers, UI, grids, signage or added monument. Preserve 3:2 landscape framing.
```

## 图像检查

已查看最终图：中央主殿和宽阔前庭、古松、南门长阶、东侧院落、西侧桥路及生产谷、后山静修与演武台地可辨；蓝灰屋瓦、暖石与青绿松林沿用参考方向。道路在各功能组之间连续展开，普通作坊体量小于主殿。最终图显示了西谷上缘的小型药圃、制药院落与清洁水池。

总体功能分组用于美术评看；符箓、阵器、傀儡、蛊苑等具体身份及水渠、隔离、供给关系仍需结合编号方案核对。图稿未进行运行、碰撞、真实道路、工位或施工验证。
