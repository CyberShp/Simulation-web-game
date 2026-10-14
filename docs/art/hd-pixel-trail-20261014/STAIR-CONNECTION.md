# 山门石阶与松石接续 · 2026-10-14

按 U-138 的原山院风格继续修整山门接缝。当前使用实色补画接续石阶、栏杆、两侧松石与流水；上下边界沿匹配的纹理接合。原山院、v5 林道和人物图集保持，补画在近山模式中按固定世界坐标呈现，小地图同步显示该区域。

## 当前交付

- [macOS 桌面版](/Volumes/Media/immortal-qa/pixel-seam-20261014/final/云岫山院·近山试行.app)
- [同机位实机](/Volumes/Media/immortal-qa/pixel-seam-20261014/verified-run/trail-02-restored-path.png)
- [西侧近景](/Volumes/Media/immortal-qa/pixel-seam-20261014/verified-run/trail-02-west-detail.png) · [东侧近景](/Volumes/Media/immortal-qa/pixel-seam-20261014/verified-run/trail-02-east-detail.png)
- [行程实录](/Volumes/Media/immortal-qa/pixel-seam-20261014/verified-run/trail-playthrough.webm)
- [补画素材](../../../prototypes/pixel_scene_validation/assets/trail-stair-connection-v1.png) · [生成提示与边界来源](STAIR-CONNECTION-PROMPT.md)

## 实现与复核

对应 TRAIL-03 / SR-XF-003-AC-02、SR-XF-004-AC-01、SR-XF-007-AC-01 的局部视觉修复。新增 `trail-stair-connection-v1.png` 与固定坐标边界 `trail-stair-connection.mjs`；`arena-renderer.mjs` 加载时建立实色接续缓存，`trail-qa.mjs` 在途中暂停时通过全景、跟随按钮补拍左右近景。

补画上下文为世界 x0–1672、y700–1300，实际可见上边界在 y820–926、下边界在 y1166–1256，按各列纹理确定。中央石阶从原院宽度连续收至下方平台，桥入口与后续路线保持。导航、战斗和存档规则源码保持；既有原院演武模式继续使用原底图。

渲染组件 **6/6**。最终可见 macOS 包 `verified-run` **22/22**、运行错误 **0**，实际运行 **84.401 秒**，14 张截图。途中暂停写盘/读取一致，16 人第 501 步实际返院胜利，32 人第 303 步主动退出；最终完整规则快照与上一批 `pixel-style-20261014/final-run` 逐字段一致。见[实际数据](/Volumes/Media/immortal-qa/pixel-seam-20261014/verified-run/metrics.json)。

根 Agent 与独立复核均查看同机位、西侧、东侧三张运行截图：上一批透明叠影与整条横向接线已消除；树干、岩面、水流及石阶栏杆连续，保持原山院材质。此结论覆盖当前机位和两侧 2.25 倍近景，用户最终视觉评看继续登记。

本批验证范围为 macOS 接缝画面、正常行程与途中存读。既有密集队伍站位、完整正式世界接入、Windows 真机和完整 SR/AC 继续保持各自状态；原生技能输入及后台验证沿用上一批的原受验范围。源码和素材同步独立检查点，应用为本机交付。
