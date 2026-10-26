# Kling动作素材候选记录

## D右向移动与即时起停校准 · 55 B03/B04

本批仅复用原87帧制作D右向离线样板，A/W/S禁用；固定H650/root[580,825]/BOX58，未替换运行素材或修改正式移速。A标尺连续3.3m/s、480ms走1.584m；B正式100ms世界步、.045m预显及35–100ms松键收敛保持，不能把样板即时冻结称作runtime零延迟。

主审采用contact时长作为离线候选：51/52/62各43.939ms、60为37.179ms、61为40.559ms，其余14帧各19.317ms，总19帧480ms，equal对照保留。这里只拟合5个人工水平端点，点误差±5源px，单对±.8923逻辑px/约±6.76ms；纵向直接列逻辑px，不代表整圈无滑步或连续锁脚。主Agent看完19组停步与13组重启配对，腾空转站腿、腿位收缩及衣发回跳仍有视觉缺口。

Chrome实际D检查确认松键后x保持、A无效、stop203可被新D切入run63；指定长按1000ms实际观察x3.321780m，不声称系统事件精确1秒。独立只读核对76边界场景及114矩阵，keyup冻结/重按/blur成立，两圈累计1.584→3.168m不归零；未做UI美术判定。页面在`/Volumes/Media/immortal-qa/kling-movement-20261025-v001/d-study-v001/index.html`，单圈时长对照及配对图随QA保存；完整观察见[review.json](review.json)的`rightwardMovementStudyReview`。本批不新打87帧ZIP，旧包保持；全部SR/AC及任务状态保持。

## 480ms跑步与起停组合

用户确定19帧跑步480ms，并继续制作待机/起跑/收步。新68帧加原跑步19帧，共87张原生RGBA与87张BOX逻辑帧，仍固定H650/root `[580,825]`，原RGB全部保留。待机0–14为625ms、起跑15–24为250ms、跑步以58入圈为480ms、收步198–210为330ms、回稳211–240为1250ms。组合跑两圈后58–61接198，110帧理论3516.053ms，GIF量化3520ms；末尾保持240并提供重播，入口/出口仅为离线剪辑。

主Agent审完13页68帧，并在Chrome实际检查idle11→start15、自动停在settle240/110of110及滑块24→58、61→198；接受为本批离线动作候选。独立motion_verify只读核对87帧RGB/BOX/atlas、200散列、110帧序与197个GIF编码帧图像及时长通过，未做UI美术判断。小灰残点、24膝边及全组浅边保留；不声称全片连续肉眼审看、任意相位即时停步、脚速或实机验收。详见[review.json](review.json)的`offlineActionSequenceReview`，全部SR/AC及任务状态保持。

QA：`/Volumes/Media/immortal-qa/kling-actions-20261025-v001/action-package-v002/`中的`index.html`、`combined-white-dark.gif`及`run-white-dark.gif`；生成时pending标签由后续review补充，不重打素材。最终`kling-actions-candidate-v001.zip`位于同一QA批根目录，38,367,579字节、206项，含87+87帧及预览/核验记录，原视频未入包；CRC/归档字节核对通过，SHA-256 `8a1d245c132df0935dfa47efdc177c474fb94acb199c857129dcb651a94a3435`。原片、前批791.667ms样片与旧ZIP保留。

## 透明跑步候选接续

用户选择脚本逐帧分离背景后，frame48–66共19帧已形成透明候选：原940×940 RGB逐像素保留，只改alpha；固定H0=650、root `[580,825]`，统一`58/650` BOX缩小，再nearest呈现。19张84×84逻辑帧、atlas/manifest、深浅底GIF及校准场景HTML均留QA。原PNG、视频及各版试样保留，未接入运行或修改存档。

主Agent已审dark01–04全部19帧，在Chrome打开HTML、播放观察原frame52推进到57后暂停，切换校准场景检查全身与比例；接受为本轮透明跑步候选。白袖/袍完整、钢剑全长连续，身份与原帧序保留；轻微源混色浅边仍在，闪烁完全消除、无缝接点、地面脚速匹配及实机未验。实际范围见[review.json](review.json)的`transparentRunCandidateReview`。

QA根目录为`/Volumes/Media/immortal-qa/kling-process-20261025-v001/`。透明原生帧在`matte-full19-v001/rgba/`；主Agent选定BOX，nearest仅留对照。全组人工衣物保护明记于`matte-full19-v001/protection.json`：源坐标后袖`[330,365..530,510]`、前袖`[560,375..780,575]`、下袍`[240,465..780,715]`，只恢复v001已opaque像素；外围及发束空隙沿v002处理，RGB未重染。每帧恢复像素数、来源SHA及限制随report保存。

- `cycle-preview-v001/white-dark-cycle.gif`为实际尺寸左右深浅底循环；理论791.6667ms，GIF为790ms。`index.html`提供时间轴、逐帧与场景切换；`contacts/`每页最多6帧，`scene-cycle.gif`为场景预览。
- `transparent-run-cycle-candidate-v001.zip`含19张原生RGBA、19张逻辑PNG、atlas/manifest/protection/report/review等45项，6,605,842字节；CRC与所有归档字节核对通过，原视频未打包。SHA-256 `025b44ddd5124180bfae990e0826dc0ad72d45338c1e2228729531483154a934`。
- [matte_frames.py](../../../scripts/art/combat-direction-study/matte_frames.py)负责alpha与BOX派生；[package_matte_cycle.py](../../../scripts/art/combat-direction-study/package_matte_cycle.py)负责离线包和预览。已有目录受保护；可用`--matte /Volumes/Media/immortal-qa/kling-process-20261025-v001/matte-full19-v001 --output <新目录>`重建预览。全部D/I/V/R、AC与任务状态保持。

## 原片审看与选段记录

2026-10-25原片审看批仅离线解码、审看与人工选段。主Agent认为原片值得保留并进入帧制作，暂不建议重生成；当时尚未制作透明素材。原视频留在Downloads，另有仓库外原字节备份；视频、接触表与原尺寸PNG均不进入源码目录。未改运行代码、运行素材registry或存档，全部SR/AC及任务状态保持。

- [来源与可恢复备份](source.json)：5,110,263字节，SHA-256 `85fd646933c860531fb55fd2ab3230a2fa145cc5266145364edbb3d464d683db`；原件与备份一致。
- [解码元数据](metadata.json)：OpenCV 4.13.0 / FFMPEG，H.264、940×940、约24fps，顺序实际解码241帧，时间戳0–10.0秒；帧数/fps推算10.0416667秒，不等同容器探测时长。音轨及容器标签未检查。该文件保留生成时pending审看标记，最新主审另见[review.json](review.json)；其中帧相对路径以QA根目录解析。
- QA根目录：`/Volumes/Media/immortal-qa/kling-review-20261025-v001/`。`source/original.mp4`为原字节备份；`contact-sheet.png`及`frames/`为每0.5秒21点全片样本。密集表为`dense-2to3/`的frame48–72共25帧、`dense-0p5to1/`的12–24共13帧、`dense-8to9/`的192–216共25帧；原940×940 PNG、时间戳及散列各随表保存。所有frame id均从0计。

主Agent实际范围：Chrome打开原片、播放/seek查看0秒、3.978秒、7.56秒、8.39秒与10秒画面；另审上述21点全片表、25帧跑步密集表、13帧起跑密集表、25帧收步密集表及2.5秒原尺寸图。人物身份、持剑及单人全身固定构图连续，跑动有两半步及衣发滞后，起停过渡可进入候选制作。像素边缘较输入软化、原片带RGB背景；无缝接点、地面滑步、实际显示尺度及统一像素采样仍待验证。

| 作者候选分段 | 原frame id（含首尾） |
| --- | --- |
| 待机 | 0–14 |
| 起跑 | 15–24 |
| 持续跑 | 25–197 |
| 收步 | 198–210 |
| 回待机 | 211–240 |

以上为本轮人工选段，衔接仍需校准。连续frame48–66共19帧另保存在QA的`run-cycle-candidate/frames/`，原PNG字节与抽取件一致，`sequence.json`逐项记录原frame→timestamp。320px候选GIF为`run-cycle-candidate/run-cycle-candidate-320.gif`：24fps理论周期791.6667ms，GIF逐边界10ms量化为790ms（误差−1.6667ms），回读19帧及节拍一致；只有预览缩略和GIF调色板处理，未插帧、倒放、变形或去背景。该周期尚未通过实际尺度及接缝审看。

从仓库根目录重建时使用新输出目录，已有证据目录受保护：

```sh
PYTHONDONTWRITEBYTECODE=1 /usr/bin/python3 scripts/art/combat-direction-study/video_inspect.py --source '/Users/shepard/Downloads/kling_20261025_作品_固定镜头的2D像素游_4629_0.mp4' --output /Volumes/Media/immortal-qa/kling-review-rebuild --step 0.5 --columns 5 --tile 320
```

密集抽帧将`--step 0.5`改为`--every-frame --start 2 --end 3`并另指定新目录；起跑与收步分别用0.5–1、8–9。19帧候选复用既有密集原PNG：

```sh
PYTHONDONTWRITEBYTECODE=1 /usr/bin/python3 scripts/art/combat-direction-study/video_inspect.py --candidate-from /Volumes/Media/immortal-qa/kling-review-20261025-v001/dense-2to3/metadata.json --frame-range 48 66 --preview-fps 24 --tile 320 --output /Volumes/Media/immortal-qa/kling-cycle-rebuild
```
