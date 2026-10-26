# 山魈砸地完整帧小样

2026-10-24，主 Agent 以内置 image_gen、原 `valley-shanxiao-pixel-v1.png` 为身份依据生成六张完整姿势，再操作项目帧管线抽取。源图保留于 `source/attack-left-sheet.png`，生成来源为 `exec-9b603403-643b-49ca-b0e0-52d302fb19ec.png`。

制作要求为固定机位、白毛苔背山魈、朝左、完整身体，依次为伏身戒备、屈臂蓄力、双拳举高、双掌砸地、起身、恢复；特效独立呈现。此段记录制作要求摘要。

统一蹲姿身体标尺350，整组缩放0.5，输出340×320、脚点(160,280)、标尺175；六帧总900毫秒，阶段为起手100/150/150、释放100、恢复150/250。高举姿势保留实际身高变化。运行时服从正式世界动作阶段，其毫秒值只决定各阶段内的帧分配。

主 Agent 已检查222像素接触表，六张身体完整、姿势可辨，选入 `assets/courtyard/combat-actors-v3/shanxiao/attack-left/` 供实机检查。数值管线6帧各异并通过；连续动作、与旧站姿衔接、命中几何和视觉质量仍待运行验收。离线记录：`/Volumes/Media/immortal-qa/combat-frame-pipeline-20261024/runs/shanxiao-attack-left-v002/`。
