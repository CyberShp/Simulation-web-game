# 守牢者外观制作稿

2026-10-24，按73号战斗制作中既有 `rescue` 两名普通守牢者配置制作。两者沿稳定战斗身份 `combatant:rescue:enemy-1` 与 `combatant:rescue:enemy-2`，外观为作者在 U-63 范围内的具体化；没有新增剧情身份、伤害数值或世界根链。

`source/guard-identities.png` 左为短扎巾、灰甲褐衣的壮实守卫；右为短髭、黑灰长褂的瘦高守卫。两者均右手普通直剑、褪色砖红腰带。根 Agent 已目检全身轮廓与服饰差异，供后续动作生产使用。当前只有戒备姿势，尚未登记为完整运行动画，也没有用户美术认可。

内置 `image_gen` 生成，透明背景。来源 `/Users/shepard/.codex/generated_images/01a1688b-282e-7033-b2ca-e9663044fed8/exec-21491b3f-bb90-4120-b705-038b3c51e2d1.png`，风格参照原沈砚像素母稿；输出1774×887，两人各占887×887画幅。

## 生成提示词

Design TWO ordinary human prison guards for this same Chinese xianxia game, as separate whole-body pixel-art sprites side by side with ample transparent space. Reference ONLY supplies detailed HD pixel-art rendering, adult proportions and the fixed slightly elevated three-quarter game camera. Neither character is the blue-robed hero. Both face SCREEN LEFT, grounded guarded ready posture, entire weapons and boots inside own half. Left sprite: stocky adult male about 35, broad square face, short black tied hair under a simple dark headwrap, muted slate-grey short lamellar vest over dusty brown short robe, dark trousers, sturdy black boots, restrained faded brick-red waist sash. Right sprite: lean adult male about 30, narrow face, short moustache, compact black topknot, dark charcoal sleeveless overcoat over desaturated grey tunic, charcoal trousers, brown boots, same faded brick-red sash. Both carry exactly ONE plain straight iron sword in anatomical RIGHT hand, held in a low forward guard toward screen-left; free left hand naturally balanced, weapon grips and forearms anatomically clear. Practical ordinary uniforms with modest wear, no skulls, horns, glowing eyes, villain caricature or fancy gold ornament. Similar adult height to reference, distinct silhouettes and faces. Crisp pixel clusters and clean readable outline at small game size; consistent camera and lighting. Two complete idle-ready poses only, on actual transparent background, no shadows, scenery, effects, text, divider or grid. Do not change weapon hands between the sprites.

## 甲衣守卫左向攻击姿势

2026-10-24，主 Agent 内置image_gen以本目录双人母稿左侧守卫为参考，制作 `source/guard-armored-attack-left-sheet.png`（来源 `exec-d2fded78-299b-49f1-99c3-7e7ec7d598ca.png`）。六姿势保留头巾、灰甲、棕衣、红腰带和右手短剑。当前只为源姿势候选，尚未抽帧或接入runtime；身份、起手至释放的连接和脚点需进一步评看。

生成提示：

> Create a six-frame complete-body sword attack sprite sheet of ONLY THE STOCKY ARMORED GUARD ON THE LEFT in the reference. Preserve his identity exactly: black head wrap with short tails, broad young clean-shaven face, dark gray lamellar chest and shoulder armor, dull brown short robe, brick red waist sash, charcoal trousers, wrapped ankles and plain dark boots. Plain short straight iron sword held in anatomical RIGHT hand throughout. Same crisp high-definition pixel-art style and elevated three-quarter camera as reference. Face LEFT in all six frames. Uniform physical size and ground baseline, generous empty gutters, all hair sword limbs fit entirely inside each cell. 3 columns by 2 rows, six different connected key poses: 1 guarded ready stance sword pointing up-left; 2 sword raised over shoulder with body coiled; 3 forceful complete arm extension and full body forward step, sword cutting left into opponent space; 4 follow-through with sword down-left, body weight forward; 5 draw sword back and recover balance; 6 ready stance. Entire character is redrawn naturally per frame, correct shoulder/elbow/wrist anatomy and five fingers where visible. No VFX, sword trails, impact sparks, text, labels, grid, shadows, mist or background. True transparent alpha around crisp silhouettes. Keep all brown cloth and dark trousers colors consistent across all six frames.

### 抽帧与接入候选

随后主 Agent 已抽取六帧左向攻击，统一站姿标尺440、整组缩放0.5、画布420×300、脚点(240,260)，起手100/200、释放100、恢复100/100/100，总700毫秒。另以第一帧制作单帧左向待机。222像素接触表已复看，剑身、脚部及相邻格边分离完整。管线均通过，运行候选位于 `assets/courtyard/combat-actors-v3/prison-guard-armored/`；映射稳定守卫 `combatant:rescue:enemy-1`。其行走、反应及右侧动作尚未完成，完整动作连贯性与群战实机仍待验。

### 布衣守卫

主 Agent 另以同一母稿右侧人物制作 `guard-cloth-attack-left-sheet.png`，来源 `exec-c7d060f9-8e72-49fa-a483-628c92083526.png`。制作要求：黑灰布衣、短须、红腰带、右手短剑、朝左刺击、固定机位与物理比例、六姿势透明底。实际选取源格1/3/4/6四张持剑身份连续的姿势，起手200、释放100、恢复100/100毫秒，统一站姿标尺460、缩放0.5、画布420×300、脚点(240,260)。另以第一张作为单帧待机。

222像素接触表经主 Agent 复看，完整四帧选入 `assets/courtyard/combat-actors-v3/prison-guard-cloth/`，映射 `combatant:rescue:enemy-2`。动作属于运行候选；完整行走、受击、方向覆盖与最终视觉验收待完成。离线来源包为 `guard-cloth-attack-left-v001` 与 `guard-cloth-idle-left-v001`，均在本次QA素材管线目录。

## 2026-10-25 受击与倒下

主Agent使用内置image_gen，分别以两守卫左攻击母稿为身份参考，新绘四姿势：胸部受击后仰、单膝跪倒、双膝撑地、侧身伏地。原源图为source/guard-armored-hit-down-sheet.png与source/guard-cloth-hit-down-sheet.png；对应生成ID为exec-2c77e15f-07fc-4a74-8c51-46e087919d24与exec-c42dafaa-3921-40a5-95d6-29026361e7d2。

提示词核心：保留各自帽/发髻、甲衣或灰衣、红腰带、右手剑及左向机位；四完整身体依序受击、跪倒、撑地、侧卧，统一人物尺度，伏地自然变矮变宽，透明背景。主Agent逐帧裁切、固定地面锚点，222像素接触表目检两组倒下；甲衣源透明检查1136398像素alpha为0，三采样背景均为0。边缘微量alpha警告保留在外部QC。

两身份各补hit-left一张200ms、down-left三张200/200/800ms，统一源标尺500、缩放0.5、输出500×360、固定脚点(250,300)。down按正式12世界步采样，最终伏地保持；hit按真实2/3步僵直映射，不控制伤害或生死。runtime registry已列候选，右半面反应及连续实机质量仍待验。抽帧spec与QC位于/Volumes/Media/immortal-qa/combat-frame-pipeline-20261024/guard-{armored,cloth}-{hit,down}-review.json及runs/对应目录。

## 甲衣守卫右向攻击

2026-10-25补右向待机1帧与攻击6帧，原图source/guard-armored-attack-right-sheet.png，生成ID exec-0682ef71-4053-478b-bb1c-8d9de50d3ab7。内置image_gen以甲衣左向母稿为身份参考，提示词指定右向全身戒备、举剑、水平出剑、随势、回剑、归架，保留右手持剑与服饰身份、统一比例及透明背景。

主Agent裁切并分离跨格剑体后222接触表复看；源标尺440、缩放0.5、输出460×320、脚点(220,270)，攻击100/200/100/100/100/100ms，待机取第一姿势。当前为运行候选，右向hit/down及完整行走仍待补。spec与QC在外部guard-armored-{attack,idle}-right-review及runs对应v001中。
