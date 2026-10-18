# 沈砚 · 行走动作样片

2026-10-17。固定视角山院的人物动作制作试验，复用 [v2 动作模型](../hunyuan-v2/README.md)，由 Hunyuan 生成动作、Blender 适配骨架并输出 2D 透明帧。用户随后选定现行像素人物外观；当前候选见[原像素形象行走小样](../pixel-walk-study-v1/README.md)，本目录继续提供动作来源与首轮试验记录。

## 内容

- `source/walk-source.fbx`：一次实际 Hunyuan Motion 请求返回的四秒源动作。
- `motion/shen-yan-walk.blend`：22 个关节适配后的完整行走循环；30 fps、播放帧 1–41，42 为闭合键，周期 1.366667 秒。
- `sprites/`：16 张 256×320 RGBA PNG、4×4 图集和清单；播放速度 11.7073 帧/秒，保持上述动作时长。
- `provenance.json`：云任务、提示词、骨骼映射、输入输出散列与验证来源。
- `../../../../scripts/art/shen-yan-motion/`：动作适配、固定相机渲染、图集整理和本地桌面预览脚本。

相机为正交，前侧 40°、俯看 25°。整段使用同一相机、画布与脚点；参考人物高度 222 像素，正常山院按 111 像素显示，另检查 150 与 222 像素。轮廓线在 222 像素档为 1.35 像素；贴图、模型几何和绑定母稿保留。

## 查看

在仓库根目录执行：

```sh
env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron \
  scripts/art/shen-yan-motion/preview-host.cjs \
  --manifest "$PWD/assets/characters/shen-yan/walk-study-v1/sprites/manifest.json"
```

左侧为原图集静态参考，右侧为行走候选。可暂停、逐帧、切换尺寸和检查一个周期的沿路位移；位移循环结束回到起点。背景按批准山院的源像素显示。此入口用于离线素材评看，与正式游戏运行及存档独立。

## 复现

以下输出目录由调用者指定，保留本目录中的源资产：

```sh
blender_bin=/Applications/Blender.app/Contents/MacOS/Blender
motion_output=/Volumes/Media/immortal-qa/shen-yan-walk-rebuild
"$blender_bin" -b --python-exit-code 1 \
  --python scripts/art/shen-yan-motion/retarget_walk.py -- \
  --source "$PWD/assets/characters/shen-yan/walk-study-v1/source/walk-source.fbx" \
  --target "$PWD/assets/characters/shen-yan/hunyuan-v2/prepared/shen-yan-rigged.blend" \
  --output "$motion_output/motion" --start 43 --end 84
"$blender_bin" -b "$motion_output/motion/shen-yan-walk.blend" --python-exit-code 1 \
  --python scripts/art/shen-yan-motion/render_sprites.py -- \
  --output "$motion_output/sprites" --start 1 --end 42 \
  --duration 1.3666666666666667 --stride 1.0895218881790494 \
  --count 16 --samples 32 --outline 1.35
node scripts/art/shen-yan-motion/pack-frames.mjs "$motion_output/sprites"
```

实际使用 Blender 5.2.1 LTS。渲染先按静止人物高度确定比例，再保留动作的自然起伏；不逐帧重新缩放人物。

## 验证与评看

原 FBX 与 v2 模型散列保持。重开动作工程后，几何、UV、自定义法线与材质签名一致；83 个半帧采样全部有限，半帧鞋底高度偏差约在 222 像素身高下的 0.53 像素以内。首尾闭合身体顶点最大坐标差为 4.77e-7 模型单位。此为接地高度检查，未据此宣称支撑脚水平滑移已完整验收。

本地 Electron 控件检查 14 项通过，最终交付清单实际加载 16 帧，三档尺寸、播放循环和位移可用，页面错误 0。独立静态复核看过完整 16 帧：迈步与腿部交替可读，未见明显大片穿模，正常尺寸下轮廓分离改善。

当前局限：手指保持基础张开形态；衣摆随人体权重运动，未制作独立衣料控制；细衣褶线偏密，近看仍有写实材质感。细线的连续闪烁、换装复用、其他方向和其他动作继续独立评看。用户画面批准和正式游戏接入尚待后续，SR-XF-007 完整状态保持。

本次 QA、截图、原始任务响应和独立复核保存在 `/Volumes/Media/immortal-qa/shen-yan-motion-study-20261017/`。对应 `preview/final-111px.png`、`final-150px.png`、`final-222px.png`、`final-asset-check.json`、`control-test-results.json` 及 `audit/round-03-visual-review.md`。
