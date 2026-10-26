# Combat frame pipeline

确定性整理已绘制的完整 PNG 帧、规则图集或已有视频，输出固定脚点的整帧 PNG、atlas、运行 manifest、contact sheet、GIF 和算法 QC。每份 manifest 对应一个 `action` 与一个 `direction`，由运行时 registry 聚合。

工作流参考 [Agent Sprite Forge 0.4.0](https://github.com/0x0funky/agent-sprite-forge/tree/5324342fdfab72430f4e9604f3fe427009f8596d)，固定 revision `5324342fdfab72430f4e9604f3fe427009f8596d`，尤其是其源文件留存、统一画布／锚点和数值 QC／视觉评看分列约定。本脚本独立执行像素后处理；`workflowReference` 记录参考版本，不表示执行了上游生成、动作推断或整套 `sprite_set.py`。上游 [known limitations](https://github.com/0x0funky/agent-sprite-forge/blob/5324342fdfab72430f4e9604f3fe427009f8596d/docs/known-limitations.md) 同样明确数值 QC 不能批准人体、身份或动作质量。

## 环境

已验证 Python 3.12.14、Pillow 12.3.0。PNG 路径仅依赖 Pillow；已有视频需要 ffmpeg。安装到任务专用虚拟环境：

```sh
python3.12 -m venv /absolute/task-directory/venv
/absolute/task-directory/venv/bin/python -m pip install -r scripts/art/combat-frame-pipeline/requirements.txt
# 需要视频且本机没有 ffmpeg 时：
/absolute/task-directory/venv/bin/python -m pip install imageio-ffmpeg==0.6.0
```

视频优先使用 `--ffmpeg /absolute/path/ffmpeg`，其次 PATH，再其次 `imageio_ffmpeg` 随包二进制。实际 ffmpeg 版本、抽样帧率和起点记入 provenance。此二进制解码路径已在 macOS arm64 / ffmpeg 7.1 验证。

## PNG 单帧和图集

```sh
python pipeline.py pack --inputs /art/000.png /art/001.png \
  --foot 256 460 --source-height 384 --duration-ms 100 --phase move \
  --id shen-yan-walk-right --visual-identity shen-yan --action walk --direction right \
  --output-root /qa/frames --name shen-yan-walk-right

python pipeline.py pack --sheet /art/sheet.png --tile 512 512 \
  --foot 256 460 --source-height 384 --duration-ms 100 --phase move \
  --output-root /qa/frames --name sheet
```

命令中的 `pipeline.py` 指本目录文件。`--inputs` 按显式参数顺序；`--sheet` 从左到右、从上到下切片，图幅必须整除 tile。不同大小或位置的图请用 JSON spec 逐帧声明裁切和脚点。`sourceHeight` 是作者选定的统一站姿身体标尺，单位为源图像素；它保持全 clip 相同，不以每张动作外包框重新估计身高。

## 逐帧 spec

```json
{
  "id": "shen-yan-attack-right",
  "visualIdentity": "shen-yan",
  "action": "attack",
  "direction": "right",
  "sourceHeight": 384,
  "foot": [256, 460],
  "canvas": [640, 512],
  "targetFoot": [256, 460],
  "expectedDurationMs": 300,
  "metadata": {"sourceReview": "pending"},
  "frames": [
    {"file": "sheet.png", "crop": [0, 0, 512, 512], "durationMs": 100, "phase": "windup"},
    {"file": "release.png", "durationMs": 100, "phase": "release", "event": "release", "anchors": {"hand": [300.5, 220], "grip": [305, 275], "tip": [495, 270]}},
    {"file": "recovery.png", "durationMs": 100, "phase": "recovery"}
  ]
}
```

```sh
python pipeline.py pack --spec /art/clip.json --output-root /qa/frames --name attack-right
```

`file` 相对 spec 所在目录解析。`crop` 为 `[x,y,w,h]` 源图像素；输入 `foot` 和 `anchors` 均为该 crop 内局部坐标。脚点须为整数；手／握持／剑尖可为小数。逐帧 `foot` 可覆盖顶层值。`canvas` 和 `targetFoot` 是输出画布和输出脚点；省略时按所有源矩形的并集外加 `margin`（默认 2）计算，不按逐帧可见边缘收缩。显式画布容不下任一源矩形时失败。

`--scale 0.5` 或 spec 顶层 `"scale": 0.5` 显式指定整组共用的等比缩放，最近邻采样，并令输出 `sourceHeight = 输入 sourceHeight × scale`。平移为 `targetFoot - scale × inputFoot`，可用 `--foot`、`--target-foot` 与 `--canvas` 完整指定。默认 scale 为 1，此时只做整数平移，逐字节保留源 RGBA。逐帧 `scale` 会被拒绝；不同源尺度必须由作者登记为分开的输入批次及显式倍率，不能让工具按动作外包框自行缩放。实际倍率、源标尺和各帧平移均可从 provenance／QC 回读。

`canvas` 与 `targetFoot` 始终是输出绝对像素量。例如输入 `sourceHeight:440`、`scale:0.5`、`canvas:[330,280]`、`targetFoot:[150,250]`，最终画布为330×280、脚点为[150,250]、身高标尺为220。

图集人物或兵器跨越规则格边时，作者可为单帧给出 `"clipPolygon":[[0,0],[575,0],[575,511],[0,511]]`。多边形顶点使用该 crop 内的整数坐标，支持凹多边形，边界像素包含在内；顶点可位于右／下边界 `w/h`，可重复首点闭合。越界、重复顶点、退化及自交会被拒绝。此操作只将多边形外 alpha 置0，保留外部 RGB 与内部全部 RGBA，不改变图内姿势。作者应给足矩形 crop 以容纳跨格物件，再手工标定分离轮廓，并检查评看图是否裁伤。原始源图保持，manifest 逐帧 `source` 记录原crop与polygon，QC `alphaClip` 记录处理前后像素hash及剔除可见像素数。

spec 的同名选项优先于 CLI。`id/visualIdentity/action/direction` 为运行接入的稳定字符串，方向约定 `left/right/up/down/up-left/up-right/down-left/down-right`；`phase` 使用正式动作阶段，逐帧 phase 覆盖顶层缺省值。多阶段片段由播放器匹配正式 phase，时长只控制阶段内选帧，不改变世界时钟或正式释放时刻。

## 已有视频

```sh
python pipeline.py pack --video /art/action.mp4 --fps 12 --start 0 --seconds 1 \
  --foot 360 650 --source-height 480 --phase move \
  --output-root /qa/frames --name video-walk
```

`fps` 接受 `12` 或 `25/2`。每帧毫秒时长通过累计有理数四舍五入得到；总时长等于抽样帧数／帧率按毫秒取整。原视频与抽出的 PNG 一并留存。默认最多 256 帧，读到第 257 帧即拒绝；总解码和输出像素各限 1.6 亿。视频原始时长不依赖 ffprobe 探测，报告只证明已抽到的帧和 manifest 时长。

scale=1 的 PNG 路径保留每个源 RGBA 字节，含半透明和透明像素的 RGB；显式统一缩放时保留最近邻采样到的实际 RGBA。不做自动背景抠除。视频保留解码器实际给出的 RGBA，不能从普通 H.264 得到原本不存在的透明通道；全不透明源会有 `opaque-source` 警告。带 alpha 的 VP9 WebM 可显式设置 `--video-decoder libvpx-vp9`，并在使用前核对 QC 的 alpha 数据。

## 整张 sheet 的 alpha 评看

```sh
python inspect_alpha.py /art/whole-sheet.png --background /art/scene.png \
  --scene-fit cover --sample 10 10 --sample 512 500 --sample 1024 500 \
  --output-root /qa/alpha-review --name whole-sheet
```

此 helper 保持整张源图的尺寸、RGB 和 alpha，直接合成在纯白及指定场景背景。输出 `on-white.png`、`on-scene.png`、原图字节副本、`inspection.json` 和所有文件 SHA-256。报告包含 alpha 分档、指定坐标的原始 RGBA 与背景缩放方式。`cover` 对背景等比放大后居中裁齐，`stretch` 将背景拉伸到整张 sheet 尺寸；源 sheet 均不切格或缩放。合成图是人工评看材料，人体、动作和 halo 的视觉可接受性保持待评。

## 运行契约与输出

每次保留一个新目录 `<name>-v001`、`<name>-v002`……，旧输出和原输入保持原字节。失败发生在已保留输入之后时，目录内有 `failure.json`；只使用含完整 `manifest.json`、`qc.json`、`checksums.json` 且 `validate` 通过的包。

```json
{
  "schema": "combat-frame-atlas/v1",
  "atlas": "atlas.png",
  "frameSize": [640, 512],
  "sourceHeight": 384,
  "foot": [256, 460],
  "durationMs": 300,
  "frames": [
    {"index": 0, "file": "frames/0000.png", "x": 0, "y": 0, "w": 640, "h": 512, "sourceHeight": 384, "foot": [256, 460], "durationMs": 100, "phase": "windup"}
  ]
}
```

`x/y/w/h` 是 atlas 源矩形，`foot` 是完整输出帧局部坐标。运行时统一 `scale = targetBodyHeight / sourceHeight`，以 `screenFoot - frame.foot * scale` 为整帧左上角 blit。所有帧尺寸和脚点一致；手／握持／剑尖锚点随同整数平移记录于 `frames[].anchors`。

`frames/*.png` 与 `atlas.png` 是运行素材；`contact-sheet.png` 和 `preview.gif` 是评看产物。默认另输出 `contact-sheet-111.png`／`-150.png`／`-222.png` 与对应 `preview-111.gif`／`-150.gif`／`-222.gif`，按统一站姿身体标尺给根 Agent 在目标身高评看。`--preview-heights 111 150 222` 可显式设置，空参数可关闭此组预览。GIF 使用不透明深灰底、调色板与 10ms 时长精度；PNG 保持实际 alpha。GIF 时长与运行时不一致时有明确警告，运行以 `durationMs` 为准。

`qc.json` 记录可见像素外包框（右／下为开区间）、alpha 范围、半透明数、实际源／输出像素 hash、精确重复帧组、固定脚点范围、可见底边相对脚点和实际时长。`--reject-duplicates` 可将精确重复变为失败；默认留警告以允许有意停帧。脚点是作者给定锚点，底边可能包含衣摆、武器或特效；数据不能替代人工辨认脚与地面。

算法通过写 `algorithmStatus: passed`，美术状态保持 `artReview: not-reviewed`。人体、身份、步态、动作连续性、命中几何、实机接入和用户美术认可各自验收。

```sh
python pipeline.py validate /qa/frames/attack-right-v001
python -m unittest discover -s scripts/art/combat-frame-pipeline -p 'test_pipeline.py' -v
```

`validate` 回读所有已登记 SHA-256、atlas 与单帧 RGBA、共同尺寸／脚点／身高标尺和时长总和。相同 Python/Pillow/zlib build 下重复运行验证字节一致；跨 build 应比较解码后的 RGBA。
