# 宗门场景素材制作记录

生成工具：内置 image_gen。风格依据：`courtyard-v1.png`。素材均保留原始 RGBA 或 RGB 文件。

当前渲染读取 `sect-ground-v1.png` 与 `sect-objects-v1.png`。
`sect-ground-coordinate-study-v1.png` 为独立坐标校准研究素材。

当前投影：画面 2560 × 1536；米制位置映射为 `x = 128 + 24 × metresX`、`y = 192 + 12 × metresY`。人物、建筑和仓储读正式世界位置。场景比例及连续山域布局待后续画面方案评看。

## 地面

文件：sect-ground-v1.png

```text
Use case: style-transfer
Asset type: production game background plate, 2560x1536 landscape.
Input image 1 is ONLY the strict visual style reference: courtyard-v1.png. Match its fine high-definition 2D pixel texture, delicate pine needles, vertically fissured blue-gray rocks, warm pale stone pavement, muted deep pine greens, naturally bright clear daylight. Maintain crisp fine pixel contour detail.
Primary request: paint the EMPTY playable ground of a modest initial Chinese cultivation mountain courtyard, framed by majestic pine trees, rocky cliffs, distant blue mountains and waterfalls beyond the boundary. This is the same art family as the reference. Fixed oblique view, screen-horizontal east-west ground lines and half-height north-south projection. The entire ground surface is an uninterrupted walkable plane with pale worn flagstones in the north, varied low grass and small flush stone paths in the south. Rich fine texture but generous readable open ground.
The exact playable ground rectangle runs from image x128 to x2432, image y204 to y1344. ALL large pines, solid rocks, cliffs and distant buildings must remain OUTSIDE that rectangle. Soft grasses and small flat pebbles are allowed inside. Keep the central playable space fully visible. Upper margin y0-192 shows distant mountains, not a nearby blocking structure. Do not place any building, stairs, statue, railing, lantern, furniture, person or crop anywhere inside the playable rectangle: these are added as independent game objects. No empty UI slots or artificial floor grid.
One natural shallow water channel is physically located at x1520 to x1664 and y288 to y552. Match these bounds exactly, with short grass edges and water entirely inside this rectangle; no rocks obstructing the surrounding ground.
Leave clear pale paved ground near x704..896,y240..336 for a small separate main hall and a clear naturally earthy ground near x416..512,y672..720 for a separate herb plot. These are simply normal ground, with no markers or drawn frames.
Composition is a coherent beautiful game scene. Preserve reference material richness at game scale. No writing, no labels, no UI, no characters, no graphic outlines, no exaggerated cartoon blocks. Deliver a single opaque background plate in 2560x1536 or exactly the same aspect ratio.
```

## 建筑与药田图集

文件：sect-objects-v1.png

```text
Use case: style-transfer
Asset type: exact 3-column 2-row transparent game sprite atlas, landscape 1536x1024.
Input 1 is the ONLY visual style reference, the accepted fine high-definition pixel courtyard. Match fine pixel edges, gray-blue tiles, warm pale stone, deep pine green, gold details, delicate texture. These are isolated game props, not a scene.
The canvas is divided into SIX equal 512x512 cells with transparent gutters. Each object is fully contained in its own cell with 35 pixels empty margin, centered horizontally and sitting on baseline y=450 within its cell. Same fixed oblique camera as reference, ground east-west horizontal and north-south half-height. No labels or writing.
Top left cell: a modest single closed Chinese cultivation main hall, one principal blue tiled roof with upward-curved corners, carved warm timber entrance doors, stone plinth. Width about 420px, height about320px, a compact 8m by8m footprint; substantial real building, elegant high-definition pixel detail. Closed exterior, no furniture or people visible. Ground shadow subtle and tight.
Top middle cell: the EXACT SAME main-hall footprint under construction: finished pale stone plinth, structural timber posts and beams, roof framework, a little bundled timber. Same spatial registration and camera; no furniture.
Top right cell: the EXACT SAME closed main hall with a worn roof and small visible damage, still retaining a closed exterior. Same footprint and registration.
Bottom left cell: a small 4m by4m medicinal herb plot, camera-matched rectangular parallelogram footprint with warm cultivated soil, three fine planting rows, low natural stone edging and very subtle grass fringe. Empty soil. Plot width360px, projected ground height180px, baseline450.
Bottom middle cell: EXACT SAME plot with emerging small delicate green herb sprouts along those rows. Same footprint and registration.
Bottom right cell: EXACT SAME plot with mature green medicinal herbs with tiny pale violet flowers, lush but orderly and without tall plants. Same footprint and registration.
True transparent RGBA outside objects, no checkerboard painted into image, no opaque background, no labels, no separators, no frame, no independent camera changes. Keep all six cells complete and non-overlapping.
```

## 坐标校准研究

文件：sect-ground-coordinate-study-v1.png

```text
Use case: precise-object-edit
Input image 1 is the edit target. Preserve its approved fine high-definition pixel style, palette, quality and fixed oblique viewpoint.
This is a precise game-ground geometry correction. Keep the output canvas exactly the same aspect and framing, 1672x941. The whole central PLAYABLE GROUND rectangle must extend from x84 to x1588 and y118 to y823. Repaint the existing scene so the mountain panorama occupies ONLY y0..117; the walkable pale flagstone/low grassy ground begins at y118, with no trees or rocks inside that rectangle. The reference currently has too tall a mountain background and too much vegetation inside the boundary. Shift that background upward and keep all solid trunks, tall rocks, cliff edges and white blossom trees outside the rectangle. The ground may have low flat grass, worn stone slabs and short flowers. No hill or sky inside the ground rectangle.
The only water feature inside is a narrow RECTANGULAR shallow water channel at exact image x993..1087, y176..338. Remove the old differently positioned channel and replace its area with matching flagstone ground. Draw the new channel at precisely those coordinates, with water filling that area and no bridge or rocks. It begins and ends within the courtyard; shore corners can have a few pixels of organic softness but its bounds stay fixed.
Keep southern foreground decoration below y823 and left/right scenery outside x84..1588. Keep center ground open for independent buildings and herbs. No building, character, crops, markers, grid, lines, or UI. Maintain crisp rich fine-pixel material throughout.
```



## Continuous metre-domain textures · 2026-10-14
Built-in imagegen. Style reference: courtyard-v1.png. Runtime projection: 40 pixels per metre horizontally, 26 on ground depth; adult sprite height 72 pixels before camera scaling. Source atlas crop anchors are declared in sect-renderer.mjs.

### sect-materials-v1.png
```text
Use case: stylized-concept. Asset type: production game texture atlas.
Use the attached original courtyard only as the STRICT visual style reference: its exceptionally fine crisp pixel detail, natural muted olive grass, warm grey stone, blue green shadows, tiny highlights. Create a square 2048x2048 texture atlas with four equal square quadrants, meeting exactly at x1024 and y1024, NO gutters or labels.
TOP LEFT: continuous warm grey courtyard flagstones. About 16 stones across the quadrant, stones mostly 40-65cm wide, thin restrained seams, subtle surface grain and occasional tiny moss cracks. Every stone on same flat plane.
TOP RIGHT: quiet olive green short wild grass ground with subtle sparse tiny leaves, tiny flecks, even natural density.
BOTTOM LEFT: earthy worn mountain footpath soil, warm grey brown, tiny pebbles and sparse fine roots, flattened packed center texture equally everywhere.
BOTTOM RIGHT: calm jade blue-green shallow mountain water surface, subtle fine ripples and muted small stones beneath. Even light.
Each quadrant is an independent edge-to-edge SEAMLESS repeat texture. Orthographic straight-down material swatches; no depth horizon, no trees/buildings/borders/large rocks, no decorative frames, no text, no sunlight gradients. Lighting identical and diffuse in all quadrants. Keep natural detailed pixel art with crisp single pixel edges and many fine color shades. Ground projection/foreshortening will be applied by game renderer.
```

### sect-domain-objects-v1.png
```text
Use case: stylized-concept. Asset type: transparent sprite atlas for a Chinese mountain sect game.
Reference image 1 original courtyard establishes STRICT fine pixel art style, blue-grey roof tiles, muted olive pine needles, grey vertically cracked limestone, fine crisp edges, warm wood. Reference image 2 shows existing hall; house must be a distinct modest residential building in same architecture.
Create 1536x1024 transparent RGBA atlas, exactly 3 equal columns by 2 equal rows, each cell512x512. Clear transparent gutters, every object wholly inside its cell. All share original front-facing orthographic oblique view, horizontal world X and vertical screen depth ground compression0.65; front doors face viewer, no diamond isometric rotation.
TOP LEFT cell: COMPLETE CLOSED modest single-storey disciples residence with a simple blue-grey tiled gable roof, 3 narrow facade bays, one central closed wooden door, two closed lattice windows, stone plinth and 2 low steps. 6m by6m ground footprint, 2.5m door height. Ordinary residence, roof ridge4.4m tall; warm wood and pale plaster, restrained detail. Full facade visible, fully closed exterior.
TOP MIDDLE: same residence under construction, SAME size/footprint/ground anchor: exposed timber structural frame, foundation, roof rafters and restrained stacked timber, open structural work only.
TOP RIGHT: one medium old mountain pine with irregular layered needle clusters, bent trunk, sparse roots, full crown contained, 7m high and5m crown across; beautifully detailed pine needles as reference, small contact shadow.
BOTTOM LEFT: a smaller crooked mountain pine, 4m high and4m wide, same detail, sparse rocks at root.
BOTTOM MIDDLE: low grey limestone boulder cluster 3m wide by2m deep, fissures/moss/tiny weeds same as reference, maximum1.6m high.
BOTTOM RIGHT: one square weathered stone gate post 1m across and2.2m tall, simple carved cap with restrained blue-grey tile canopy.
Background transparent, NO opaque backdrop, NO scenery floor, NO text, NO people, no horizon. All sprites have grounded clean cutouts with only small contact shadows. Tiny pixel detail, full tonal texture, adult-height doors and architectural perspective matching reference.
```

## Metre-scaled residence · 2026-10-14
Built-in imagegen; courtyard-v1.png style reference. Completed and structural work stages. The visible wall is 540 source pixels wide and the closed door is approximately 225 pixels tall. At 6 metres = 240 projected pixels, the door is approximately 100 pixels tall; adult sprites are 72 pixels.

### sect-residence-v1.png
```text
Use case: stylized-concept. Create a production game asset sheet with TWO sprites on TRANSPARENT background: left completed modest Chinese rural disciples' residence, right same residence under construction. Wide image1536x1024, two equal columns, each object entirely within own column and grounded at the SAME baseline y900. Original courtyard attached is solely fine-pixel craftsmanship/color reference. This is a smaller modest residence for two adults.
ARCHITECTURAL SCALE is the main requirement: six metres WIDE front foundation, only one floor; central door TWO AND A HALF METRES tall; adult1.8m. The closed central wooden door height is almost HALF the visible foundation width. The low front wall height3m and simple low gabled roof peak4.4m. Thus this is a narrow, TALL-DOORED house, with exactly one large central closed door and a small square closed lattice window on each side. Very plain one-ridge blue-grey tiled gable roof; simple restrained curved corners, pale plaster walls and natural timber columns. Only TWO LOW steps, no tall temple stairway, no tower or double roof. No ornate gold crest. Ground plinth6m×6m viewed straight front with original scene grounddepth0.65. Door occupies most of front wall height, from just under lintel to low doorstep. Target geometry within left768px cell: foundationwidth480px, doorheight200px, wallheight240px, roofrise112px, fullheightabout384px. Use empty transparent space above; don't inflate roof vertically to fill cell. Right sprite same footprint/perspective/scale, timber wall frames and roof rafters under construction, two low steps, modest stack of construction timber. No interior furniture/rooms. Fine crisp pixel art, small blue-grey roof tiles, subtle stone grain, natural muted materials, reference-style lighting, clean alpha. No text, no people, no ground backdrop.
```

