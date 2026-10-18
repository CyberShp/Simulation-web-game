# 沈砚 · 原像素形象行走小样

2026-10-17，U-157。按用户在对照中选定的蓝白衣装、长发持剑形象，复用已生成的行走周期，制作单方向 16 帧候选。

## 素材与制作

外观来自 `assets/courtyard/cultivator-v1.png` 的原站立帧，裁切范围 `[70,660,218,335]`、原脚点 `[134,329]`。原 RGBA 颜色用于四块二维网格；[现有行走骨架](../walk-study-v1/README.md)的实际关节运动投影驱动这些网格。剑与握剑手保持刚性，袍身保持连续。

动作周期 1.366667 秒，16 帧、约 11.71 帧/秒。为适配原图，位移与平面转角统一缩至 0.6 倍；左右交替与周期相位保留。输出为 512×512 透明帧，共用脚点 `[256,460]` 和参考高度 323，游戏正常显示高度为 111 像素。全程使用同一画布和缩放。

- `source/pixel-identity-reference.png`：从原图集精确裁出的原外观。
- `motion/pixel-walk-mesh.blend`：已打包纹理的二维网格与动作工程。
- `motion/projected-motion.json`：来源骨架逐帧投影关节。
- `sprites/`：16 帧、4×4 图集与播放清单。
- `provenance.json`：原图、动作和交付文件的来源及散列。

## 查看与复现

在仓库根目录打开本地桌面评看窗：

```sh
env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron \
  scripts/art/shen-yan-motion/preview-host.cjs \
  --manifest "$PWD/assets/characters/shen-yan/pixel-walk-study-v1/sprites/manifest.json"
```

左侧是原人物站立参考，右侧是行走小样。可切换 111、150、222 像素高度、暂停和逐帧检查；沿路位移按清单的周期位移显示，循环结束回到起点。

使用 Blender 5.2.1 LTS 复现，输出到独立目录：

```sh
blender_bin=/Applications/Blender.app/Contents/MacOS/Blender
pixel_output=/Volumes/Media/immortal-qa/shen-yan-pixel-walk-rebuild
"$blender_bin" -b --python-exit-code 1 \
  --python scripts/art/shen-yan-motion/project_pixel_walk.py -- \
  --output "$pixel_output"
node scripts/art/shen-yan-motion/pack-frames.mjs "$pixel_output"
```

## 验证范围与待改进处

16 张帧图散列均不同，源纹理和来源动作保持。独立静态复核确认脸、长发、衣装纹样和佩剑保留，双脚前后交替；未见阻断级透明裂缝、断剑或发尾缺失。最终资产在本地 Electron 按 111、150、222 像素实际加载；播放、步进、暂停与单次结束正常，页面错误 0。连续滑步与细边闪烁尚未完整验收。

第 008–011 帧前伸裤腿仍有单图拉伸感，原站立图中被袍子遮住的腿部缺少可供屈膝使用的独立图层。当前是固定视角的二维网格小样，更多方向、完整屈膝体积、换装复用、用户画面批准和正式游戏接入继续独立处理。SR-XF-007 完整状态保持。

实际桌面评看证据保存在 `/Volumes/Media/immortal-qa/shen-yan-motion-study-20261017/pixel-mesh-audit/`，制作检查见同级 `pixel-mesh/round-02/verification.json`。
