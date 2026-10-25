# 林间首战人物动作

2026-10-23。用于 `courtyard-combat-actors.mjs`，依据 55 人物动作库和 70 林间首战。人物以 `cultivator-v1.png` 的蓝白衣装、长发、佩玉和右手持剑为来源，常规检查高度为 111 CSS 像素。

`master-reactions.png` 提供短步、轻重受击、伏地及护持关键姿势；`master-left-actions.png` 使用上排待机和剑式、下排左侧起诀姿势；`master-left-continuity.png` 使用右上护掌和下排步态；`master-left-spell.png` 提供右手低持剑、左臂跨胸向左出诀的独立释放姿势。`shanxiao-motion.png` 提供步行、轻重受击、落击恢复和倒地关键姿势，并与原山魈三姿图衔接。

`cast/` 复制 S01 引诀小样的十二张身体层、十二张剑层及必要清单字段，正式战斗按实际起手、释放、收势时长采样。剑层按握点作刚体平移；左向步态的剑及握手区域同样独立保存刚性。各方向人物使用独立图稿，山魈按目标所在侧转身。

其余动作采用少量关键姿势与程序分部位形变：膝、髋、肩和头各自变化，脚点始终由实际人物坐标映射。左向受击沿左向姿势表现回震、屈肩和屈膝。倒地先经过低身姿势，再落入伏地姿势。动作、收势和真实僵直取 `actor.motion`；入射方向取 `hitReaction`，人物朝向保留 `actor.facing`。表现没有伤害或世界结算入口。

原始 PNG 保持生成文件；加载时沿已有动作小样使用 0.65 透明度阈值，裁净半透明背景。正式宿主与桌面构建均收集 `assets/courtyard/`，本目录不依赖仓库外的资源。

生成使用内置 imagegen；完整提示词见 `prompts.json`、`continuity-prompts.json`，来源与文件散列见 `provenance.json`。离线检查使用 `tests/acceptance/courtyard-combat-actor-poses.mjs`，输出正式绘制器的 111 像素姿势对照及只读采样检查。连续实机操作、用户美术评看、Windows 和完整多方向动作库分别验证；本目录关键姿势数量与完整连续动作数量分别计算。
