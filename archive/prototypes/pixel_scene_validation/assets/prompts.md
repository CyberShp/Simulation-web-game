# 像素山院素材

## disciples-v1.png

Use case: stylized-concept. Asset type: transparent production sprite atlas for 2D HD pixel Chinese fantasy game.
References: courtyard-v1.png for camera and palette; cultivator-v1.png for pixel-art rendering density and adult size.
Create TWO NEW distinct people as precisely aligned sprites. Landscape canvas 1536x1024, exactly FOUR equal columns by TWO equal rows, EIGHT full-body sprites with generous gutters.
TOP ROW is one young adult martial man with tan healthy skin, black hair in a short topknot, dark red layered martial coat, charcoal trousers, black boots, brown leather belt and narrow sword. Four different poses left-to-right: 1 relaxed idle facing down-right; 2 walking left leg forward; 3 walking right leg forward; 4 powerful sword lunge arm extended right.
BOTTOM ROW is one young adult female cultivator with ivory and muted lavender long robe, elegant black high ponytail, jade belt, light boots. Same four poses: 1 relaxed idle; 2 walking left leg forward; 3 walking right leg forward; 4 two-finger spellcasting stance.
Each entire figure contained within its own 384x512 cell and centered there, consistent height about 360 pixels including hair, feet at y450 for row1 and y962 for row2. Same game camera and scale as reference blue swordsman. Deliberate crisp pixel clusters with stepped contours. Normal adult proportions. Red coat is clearly dark red, skin warm natural; white/lavender female distinct. Genuine transparent alpha, no backgrounds, no floor, no shadows, no magic effects, no text, no grid, no labels, no glow. Do not reproduce the blue man's hairstyle and costume on these people.

## garden-props-v1.png

Use case: stylized-concept. Production transparent 2D pixel game prop atlas.
Reference: courtyard-v1.png for exact pixel art palette and camera. Create TWO standalone matching game objects, left and right half of a landscape transparent canvas: LEFT one elegant tall Chinese stone lantern, octagonal blue tiled cap, warm amber lantern glass, carved pale granite square pedestal with stepped base. RIGHT one mature small Chinese pine, crooked dark trunk, three clearly separated cloud-shaped jade foliage masses, planted within a square pale stone planter. Fixed oblique topdown camera matching the reference. Full objects in separate halves with ample transparent space, no overlap. Pixel clusters, stepped contour, pure 2D HD pixel art. The stone lantern about 500px tall in its half; pine about 650px tall. Both bottom feet baseline near 92% canvas. NO ground landscape, no background, no shadow baking, no characters, no labels, no borders. Genuine transparent alpha. These props will be independent occluding sprites on the game courtyard.

使用内置 imagegen 生成，2026-10-14。场景参考 `docs/art/hd-pixel-20261014/courtyard-battle.png`，人物参考同目录 `characters-effects.png`。原始生成文件保留在 Codex 的 generated_images 目录；游戏读取本目录 PNG。

## courtyard-v1.png

Use case: precise-object-edit.
Asset type: production 2D pixel game environment plate, landscape 16:9.
Edit target: referenced courtyard-battle.png.
Remove ALL people/characters, all combat effects, shadows of characters, all interface overlays (top left portrait health bars, top right minimap, bottom skill bars, title banner over top of image if it is UI). Reconstruct the paving and architecture cleanly where removed.
KEEP the exact camera, arrangement, large closed main hall with carved wood and blue tiled roof, giant pale sandstone open courtyard and its circular stone motif, left pavilion, right stone bridge, foreground stone balustrades, banners, pines, distant misty peaks. Keep the pixel-art medium: deliberate crisp clusters and stepped edges. Preserve the harmonious blue/jade, warm timber and sandstone palette. Keep the building closed with doors shut, no interior depiction. It is an empty environment for mobile animated characters to be drawn by the game. The empty courtyard is essential; retain all walkable floor. No people anywhere, no interface, no labels, no magic, no signs added. Same 16:9 framing.

## cultivator-v1.png

Use case: stylized-concept. Asset type: production transparent PNG sprite atlas for a pure 2D HD pixel game.
Reference image is character identity/style only: use the blue-and-ivory swordsman shown in the TOP HALF of characters-effects.png, dark tied long hair, adult realistic proportions, teal blue coat, ivory underrobe, brown belt, jade charm, black boots, thin straight sword.
OUTPUT: exactly 4 equal columns by 3 equal rows on a transparent canvas, landscape 1536x1024. Exactly TWELVE separate full-body sprites. Each sprite must fit wholly inside its own cell, with clear transparent gutters. No text labels, no grid lines, no panels, no background, no floor, no cast shadows, no magic effects. Genuine alpha transparent background.
All figures consistent identity, costume and size, about 245 pixels tall, same high-oblique game camera as the courtyard concept, facing diagonal down-right except row2. Preserve true drawn pixel art with clean clusters/stepped silhouettes.
Row 1 = FOUR consecutive WALK cycle frames facing DOWN-RIGHT, starting left foot forward / passing neutral / right foot forward / passing neutral; natural leg and arm changes with cloth swinging, sword kept low. Strong differences between frames, consistent center and ground baseline.
Row 2 = FOUR consecutive WALK frames facing UP-RIGHT with BACK visible, starting left foot forward / passing / right foot forward / passing; same scale and costume. Hair and coat back visible.
Row 3 = four different FRONT-RIGHT action frames: column1 neutral relaxed IDLE swordlow; column2 sword swing windup arm backswept; column3 sword lunge arm and straight sword extended right; column4 palm-forward casting stance, swordlow in otherhand. Keep head/boots same size as walking. No fire or glow baked into the frames.
Each of 12 cells centered at x=192,576,960,1344; each row ground baseline at y=300,641,982 approximately. No cropping or overlapping cell boundaries.
