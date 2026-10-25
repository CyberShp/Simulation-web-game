# 最小四动作离线样板 · 2026-10-25

## v002 · 稳定站姿与单轮反击

[打开新样板](/Volumes/Media/immortal-qa/combat-minimum-20261025-v002/index.html)：待机固定同一站姿，D松键、动作结束与R统一回位。新兽四帧反击、人物四帧后撤整帧呈现；Space后撤离预警圈可避伤，全无声。主Chrome核敌75后反击玩家80并恢复；重置后Space避开，玩家100/敌75；背景、单只新兽与全画面均已看。四帧跨度和人物细节差异仍属粗样，全部SR/AC状态保持。见[本轮审看](review-v002.json)，原v001保留。

[打开样板](/Volumes/Media/immortal-qa/combat-minimum-20261025-v001/index.html)：D右行、松键即停；鼠标左键/J出剑，H受击预览，R复位。全无声。练习靶为背景静态山魈，3米内每次剑击第3帧结算一次25点示例伤害。

复用Kling待机/跑步整帧；新图[source-actions.png](source-actions.png)的上4格剑击、下4格受击按八个独立透明组件完整取出，保留原RGB与剑全长，作者H0=390、统一58/390缩放及固定脚点；[生成提示词](image-prompt.txt)保留。工具为`scripts/art/combat-direction-study/minimum_combat.py`与`minimum_combat_controller.mjs`，产物、8帧白底表与配置保留独立QA目录。

主Agent已看原sheet及8帧contact，并在Chrome操作：远4.5米出剑后靶100/命中0；D前进后2.21米出剑靶75/命中1；H后恢复待机、靶仍75。全身/剑完整、同服饰可辨；四帧姿态跨度及剑长细节差异仍属粗样。独立只读复核近靶单次伤害、远靶挥空、H打断无延迟幽灵命中、松键/持D恢复/失焦清键与无音频存储接口均通过，未据此认定动画流畅成品。

本批对应SR-XF-007/013局部素材与交互、U-171及55动作方向，仅右向离线样板；未改游戏、运行素材registry或存档，全部SR/AC状态保持。[实际审看记录](review.json)另存。
