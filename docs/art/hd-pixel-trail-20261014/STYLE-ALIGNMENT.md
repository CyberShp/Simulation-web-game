# 原山院风格统一 · 2026-10-14

当前山门接缝已补画接续，最新应用和放大复核见[山门石阶与松石接续](STAIR-CONNECTION.md)。下文为前一批材质统一的受验记录。

用户明确“保留上面的风格”，按 U-138 以原山院 `courtyard-v1.png` 为美术参照。新增林道和谷地已重绘为细密松针、灰青裂岩、暖灰石板及小型花草；当前运行素材为 [trail-terrain-v5.png](../../../archive/prototypes/pixel_scene_validation/assets/trail-terrain-v5.png)，生成来源见 [STYLE-PROMPT.md](STYLE-PROMPT.md)。四份既有山院、人物及道具素材保持逐字节一致。

## 当前桌面入口

- [云岫山院·近山试行.app](/Volumes/Media/immortal-qa/pixel-style-20261014/final/云岫山院·近山试行.app)
- [同机位山门衔接](/Volumes/Media/immortal-qa/pixel-style-20261014/final-run/trail-02-restored-path.png)
- [松岛后方行走](/Volumes/Media/immortal-qa/pixel-style-20261014/final-run/trail-16-pine.png)
- [三十二人谷地交手](/Volumes/Media/immortal-qa/pixel-style-20261014/final-run/trail-32-combat.png)
- [实际行程录像](/Volumes/Media/immortal-qa/pixel-style-20261014/final-run/trail-playthrough.webm)

## 修改与验证范围

对应 TRAIL-03 / SR-XF-003-AC-02、SR-XF-004-AC-01、SR-XF-007-AC-01 的局部视觉证据。运行修改仅为新地形引用、中央松岛前景轮廓、接缝边缘缓存；QA 增加经过松岛时的截图。松岛导航脚印、行走与战斗规则源码没有变更。接缝透明度边缘在加载时一次缓存，正常逐帧仅绘制该缓存。

渲染组件 **6/6**。最终打包 macOS 应用 `final-run` 通过正常命令与前台时钟完成行程，**22/22、运行错误 0**，实际运行 **84.022 秒**，12 张截图。途中暂停、写盘与读取一致；16 人第 501 步实际返院胜利，32 人第 303 步主动退出。最终完整规则快照与 U-136/U-137 `run-3` 逐字段一致。数据见 [metrics.json](/Volumes/Media/immortal-qa/pixel-style-20261014/final-run/metrics.json)。

根 Agent 与独立复核均查看同一接缝机位及松岛截图：细密松针、岩面与石材已接近上方山院；掌门实际经过左侧树冠后方时，被枝叶遮住，未见明显斜线截断或人物反压树冠。三十二人近景仍保留旧人物与初级技能表现。

## 仍可见的差距

山门两侧接图边缘的硬折线减弱，但局部有柔化与双重纹理，中央石阶两段的纹理尺度也尚未完全一致。密集队伍的局部重叠沿用上一批现状。当前美术方向按用户确认执行，最终实机画面仍由用户评看；以上不记为无缝贴图或全体人物辨识完成。

本批不重跑原生技能输入、后台/关闭存档与 Windows；其已验证范围及待验平台沿用 [近山行程记录](RUNTIME.md)。源码与素材同步独立检查点，桌面包为本机交付；正式世界、完整 SR/AC 和 Windows 状态保持。
