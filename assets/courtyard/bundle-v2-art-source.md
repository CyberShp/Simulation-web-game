# 雨夜开包关键帧 v2 · 素材来源

日期：2026-10-16。通过内置 `image_gen` 的参考图编辑生成，用于当前高清像素桌面开局。

## 画面与顺序

1. `bundle-tied-v2.png`：双手放下收紧的靛蓝布包。
2. `bundle-knot-v2.png`：双手解开顶部布结。
3. `bundle-unfold-v2.png`：双手向两侧掀布，露出卷轴中段及封绳。
4. `prologue-scroll-v1.png`：布面完全展开，完整封缄遗卷显露。

基准为 `prologue-scroll-v1.png`，1672×941，SHA-256 `9e8cc2910bba084ddac19f41173fdd9ae5919f211b21b0b77d73d5278eaa3658`。源图保留，前三张以同机位、同一桌面和同一卷轴的位置为编辑目标。设计来源为 U-115/U-116 的雨夜单卷遗物、U-153 的当前桌面开局，表现遵循高清像素基准。

## 文件核对

| 文件 | 尺寸 | SHA-256 |
| --- | --- | --- |
| `bundle-tied-v2.png` | 1672×941 | `54bd8e2c9f1242f43a25ee7e97b7af60962e0cd8655bf0ecf4f54d5e9db7f1af` |
| `bundle-knot-v2.png` | 1672×941 | `be7689e10e8f565faeeece52d2f8de92a6770d9376cd684b25a22f047859948e` |
| `bundle-unfold-v2.png` | 1672×941 | `dff4f18227601598813514499f9237a47a212b8788913445aef78093db898874` |

每幅均完成初次生成和一轮局部连续性修订。使用 `view_image` 检查参考及最终像素，核对灯、雨窗、山景、药碗、暗墙的位置、手部动作及卷轴数量；PNG 尺寸与复制后 SHA-256 已核对。前三帧在布纹、轮廓和局部桌纹上仍有独立生成带来的细微差异。静态素材检查不代替实际四帧播放、窗口交互和存档验收。

## 完整生成记录

所有调用均为 `transparent_background: false`。每帧初次调用以基准图为唯一 `referenced_image_paths`；局部修订以该帧初次输出为第一张编辑目标、基准图为第二张位置参考。最终文件从生成输出直接复制，保持原始 PNG 字节。

### 1. 放下布包

目标文件：`assets/courtyard/bundle-tied-v2.png`。

初次输出：`/Users/shepard/.codex/generated_images/01a14558-9dc5-7600-953b-72471c8b45d0/exec-65a765b1-4bc8-4618-9fdd-d4f5f2a12dc9.png`。

初次输出 SHA-256：`3bc0e0184d552ed6891e4ab6836ef2b4ebb7126c20e6786752e8091ec0a97eb1`。

初次完整提示词：

```text
Use case: precise-object-edit.
Asset type: one continuous animation keyframe for the existing 2D high-definition pixel-art xianxia game.
Input image 1 is the EDIT TARGET and final animation frame: /Volumes/Media/immortal/assets/courtyard/prologue-scroll-v1.png. Edit this image locally in the package and hands area only.
Composition invariants: Preserve exactly the same 1672 x 941 landscape canvas, same locked camera, perspective, framing, scale, table silhouette and planks. Keep the warm oil lamp at far left, medicine bowl and pestle at lower left, loose green herb leaves, rainy blue-gray mountain window centered in the left half, pine silhouette, distant pavilion, right-hand dark green wall, hanging straw rain cape, basket, chest and floor absolutely fixed. Preserve the entire background and all objects outside the local bundle/hands area, with identical palette and brightness. The right half stays quiet and empty as in the image.
Object continuity: there is ONE rolled parchment scroll only, lying diagonally on the table on the same axis as the original: rear-left wooden end near (280, 530), foreground-right wooden end near (655, 680). Its diameter, length, orientation and placement must stay the same through all animation frames. The aged indigo cloth is the same frayed cloth, now in a previous stage of opening around this scroll.
Character continuity: exactly two modestly sized youthful adult human hands with realistic finger anatomy, pale warm skin and worn muted blue-gray Chinese robe cuffs. Both forearms enter naturally from the bottom foreground edge, belonging to a single seated protagonist who is opening the package. Hands and cloth are the only changing objects. Keep hands appropriately scaled to the approximately 440px-long scroll. Do not show a head, torso or additional people.
Style: match the source's meticulous fine 2D pixel-art texture, crisp pixel clusters and subdued blue-green rain-night colors with soft amber light from the left. Preserve reference detail and mood. Output one full frame at 1672 x 941, same aspect ratio.
Constraints: no extra keepsakes, no additional scrolls, no text, no symbols, no labels, no UI, no borders, no collage, no camera movement or crop.
FRAME 1 / TIED PACKAGE: Replace the spread-open cloth and visible scroll with the SAME single scroll completely enclosed in that aged indigo cloth. It forms a low elongated cloth parcel around the diagonal scroll, with compact folded ends and one tightly tied cloth knot on top near (460, 570). The parcel occupies roughly x240..710, y480..735, not a round sack. The scroll is entirely covered by the cloth. The protagonist's two hands have just set the parcel down: left hand gently touching the parcel's rear-left side, right hand gently supporting its near-right end; relaxed fingers are withdrawing, while the knot remains tight. The table underneath and outside the parcel is visible in the original lighting. Match all background pixels and proportions as closely as possible.
```

最终输出：`/Users/shepard/.codex/generated_images/01a14558-9dc5-7600-953b-72471c8b45d0/exec-88d887b6-996d-4f6c-ab15-1b1a23e4db05.png`。

最终输出 SHA-256：`54bd8e2c9f1242f43a25ee7e97b7af60962e0cd8655bf0ecf4f54d5e9db7f1af`。

局部修订完整提示词：

```text
Use case: precise-object-edit. Image 1 is the edit target, a tied-parcel animation frame. Image 2 is the fixed final-frame reference showing the exact original scroll size and location. Make ONE localized continuity correction to image 1: refine the indigo cloth envelope to tightly and completely enclose the scroll at the exact size and diagonal placement of image 2. The parcel rear end is at x255 y515 and the front end is at x690 y700; fold the frayed cloth over both circular end caps so only cloth is visible. Retain the single compact top cloth knot at x460 y570. The same two youthful adult hands are just releasing the parcel at its sides; keep the existing blue-gray cuffs and natural restrained fingers, adjusting the right hand only enough to support the corrected front end. Preserve every other image 1 pixel as closely as possible: identical camera, background, lamp, rain window, mountain silhouettes, table, medicine bowl, herbs, right wall and chest, lighting and fine pixel-art texture. Keep 1672 x 941. Exactly one fully enclosed scroll; no text or UI.
```

### 2. 解开布结

目标文件：`assets/courtyard/bundle-knot-v2.png`。

初次输出：`/Users/shepard/.codex/generated_images/01a14558-9dc5-7600-953b-72471c8b45d0/exec-63ce846d-d824-4e7a-a7d5-ec907e94fe57.png`。

初次输出 SHA-256：`4982c96bd4e9e1f45f10f077eb8fe68f1a62bed506a8d611bdf1b728b8736917`。

初次完整提示词：

```text
Use case: precise-object-edit.
Asset type: one continuous animation keyframe for the existing 2D high-definition pixel-art xianxia game.
Input image 1 is the EDIT TARGET and final animation frame: /Volumes/Media/immortal/assets/courtyard/prologue-scroll-v1.png. Edit this image locally in the package and hands area only.
Composition invariants: Preserve exactly the same 1672 x 941 landscape canvas, same locked camera, perspective, framing, scale, table silhouette and planks. Keep the warm oil lamp at far left, medicine bowl and pestle at lower left, loose green herb leaves, rainy blue-gray mountain window centered in the left half, pine silhouette, distant pavilion, right-hand dark green wall, hanging straw rain cape, basket, chest and floor absolutely fixed. Preserve the entire background and all objects outside the local bundle/hands area, with identical palette and brightness. The right half stays quiet and empty as in the image.
Object continuity: there is ONE rolled parchment scroll only, lying diagonally on the table on the same axis as the original: rear-left wooden end near (280, 530), foreground-right wooden end near (655, 680). Its diameter, length, orientation and placement must stay the same through all animation frames. The aged indigo cloth is the same frayed cloth, now in a previous stage of opening around this scroll.
Character continuity: exactly two modestly sized youthful adult human hands with realistic finger anatomy, pale warm skin and worn muted blue-gray Chinese robe cuffs. Both forearms enter naturally from the bottom foreground edge, belonging to a single seated protagonist who is opening the package. Hands and cloth are the only changing objects. Keep hands appropriately scaled to the approximately 440px-long scroll. Do not show a head, torso or additional people.
Style: match the source's meticulous fine 2D pixel-art texture, crisp pixel clusters and subdued blue-green rain-night colors with soft amber light from the left. Preserve reference detail and mood. Output one full frame at 1672 x 941, same aspect ratio.
Constraints: no extra keepsakes, no additional scrolls, no text, no symbols, no labels, no UI, no borders, no collage, no camera movement or crop.
FRAME 2 / UNTYING THE KNOT: Show the SAME low elongated indigo cloth parcel still fully enclosing the single scroll at its original diagonal position. One cloth knot is at the top near (460, 570). The protagonist's two blue-gray-sleeved hands are actively loosening this top cloth knot: one hand steadies one short cloth tail while the other pulls the other tail outward slightly. The knot is beginning to loosen, but the package still covers the entire scroll. Cloth folds around the scroll remain compact and the overall bundle silhouette remains close to FRAME 1. The hands should clearly perform a small deliberate untying gesture with natural fingertips. Match all background pixels and proportions as closely as possible.
```

最终输出：`/Users/shepard/.codex/generated_images/01a14558-9dc5-7600-953b-72471c8b45d0/exec-ba52c21d-2c28-4b10-b8f0-f9c53877875b.png`。

最终输出 SHA-256：`be7689e10e8f565faeeece52d2f8de92a6770d9376cd684b25a22f047859948e`。

局部修订完整提示词：

```text
Use case: precise-object-edit. Image 1 is the edit target, the animation frame with two hands untying the top cloth knot. Image 2 is the fixed final-frame reference defining the original scroll size and location. Make ONE localized continuity correction: close and fold the indigo cloth over BOTH wooden end caps, so the single scroll remains entirely enclosed while the two hands untie the top cloth knot. The closed bundle is a low elongated parcel with its rear end at x255 y515, front end at x690 y700, and top knot at x460 y570. The cloth envelope must fit the scroll visible in image 2; maintain the existing diagonal orientation. Keep the same two hands in their small pulling-the-knot gesture, muted blue-gray sleeves, natural fingers and scale. The only changing pixels should be the small cloth folds needed for full coverage and consistent parcel size. Preserve the entire image 1 composition, background, lamp, rain window, mountain silhouettes, table, medicine bowl, herbs, right dark wall and chest, lighting and fine pixel-art texture. Output 1672 x 941. Exactly one cloth bundle; no text or UI.
```

### 3. 向两侧揭布

目标文件：`assets/courtyard/bundle-unfold-v2.png`。

初次输出：`/Users/shepard/.codex/generated_images/01a14558-9dc5-7600-953b-72471c8b45d0/exec-8baeea4c-8a62-4a9d-8acf-8409a494f880.png`。

初次输出 SHA-256：`4411ad8bf45598c7151b04ab690dcff3377e1cb04080b55003baa0f2a0eea06d`。

初次完整提示词：

```text
Use case: precise-object-edit.
Asset type: one continuous animation keyframe for the existing 2D high-definition pixel-art xianxia game.
Input image 1 is the EDIT TARGET and final animation frame: /Volumes/Media/immortal/assets/courtyard/prologue-scroll-v1.png. Edit this image locally in the package and hands area only.
Composition invariants: Preserve exactly the same 1672 x 941 landscape canvas, same locked camera, perspective, framing, scale, table silhouette and planks. Keep the warm oil lamp at far left, medicine bowl and pestle at lower left, loose green herb leaves, rainy blue-gray mountain window centered in the left half, pine silhouette, distant pavilion, right-hand dark green wall, hanging straw rain cape, basket, chest and floor absolutely fixed. Preserve the entire background and all objects outside the local bundle/hands area, with identical palette and brightness. The right half stays quiet and empty as in the image.
Object continuity: there is ONE rolled parchment scroll only, lying diagonally on the table on the same axis as the original: rear-left wooden end near (280, 530), foreground-right wooden end near (655, 680). Its diameter, length, orientation and placement must stay the same through all animation frames. The aged indigo cloth is the same frayed cloth, now in a previous stage of opening around this scroll.
Character continuity: exactly two modestly sized youthful adult human hands with realistic finger anatomy, pale warm skin and worn muted blue-gray Chinese robe cuffs. Both forearms enter naturally from the bottom foreground edge, belonging to a single seated protagonist who is opening the package. Hands and cloth are the only changing objects. Keep hands appropriately scaled to the approximately 440px-long scroll. Do not show a head, torso or additional people.
Style: match the source's meticulous fine 2D pixel-art texture, crisp pixel clusters and subdued blue-green rain-night colors with soft amber light from the left. Preserve reference detail and mood. Output one full frame at 1672 x 941, same aspect ratio.
Constraints: no extra keepsakes, no additional scrolls, no text, no symbols, no labels, no UI, no borders, no collage, no camera movement or crop.
FRAME 3 / OPENING THE CLOTH: The knot is fully released. The protagonist's two blue-gray-sleeved hands are pulling the two cloth flaps outward to the left and right, halfway through opening the SAME aged indigo cloth. The cloth is partially spread on the table, approaching the original final-frame cloth shape but with both side flaps visibly lifted a little by the hands. A narrow central opening reveals only part of the SAME single aged parchment scroll and part of its ochre sealing cord, in exactly the original diagonal position and size. Keep at least about half of the scroll covered by the folds, and keep its rolled form and original wooden ends. The reveal should read clearly as the intermediate moment before the reference final frame, where the cloth lies fully flat and the entire sealed scroll is exposed. Hands naturally separate toward the two sides of the cloth, with forearms entering from bottom foreground. Match all background pixels and proportions as closely as possible.
```

最终输出：`/Users/shepard/.codex/generated_images/01a14558-9dc5-7600-953b-72471c8b45d0/exec-5ef34922-8a13-417b-abb3-2fc023cde4c1.png`。

最终输出 SHA-256：`dff4f18227601598813514499f9237a47a212b8788913445aef78093db898874`。

局部修订完整提示词：

```text
Use case: precise-object-edit. Image 1 is the edit target, the half-open cloth animation frame. Image 2 is the fixed final-frame reference. Make ONE localized continuity correction to the bundle's opening degree: keep the hands and forearms exactly where they are, pulling the side cloth flaps, but let the lifted indigo cloth still cover the outer portions and both ends of the scroll. The two cloth flaps should drape diagonally across the scroll with a small central diamond-shaped gap around x430..550 y565..650, revealing only a small section of ivory parchment and the ochre sealing cord; at least half the scroll remains hidden under cloth. The scroll remains at exactly the original position, diagonal orientation and size from image 2. The action reads as cloth halfway unfolded, with hands holding cloth flaps slightly above the table. Preserve all pixels outside this localized cloth/scroll area as closely as possible, including the hands' anatomy, blue-gray cuffs, lamp, rain window, mountain silhouettes, table, medicine bowl, herbs, right dark wall and chest, lighting and fine pixel-art texture. Output 1672 x 941. One scroll only; no text or UI.
```
