# 云岫山院 · Three.js 桌面画风样板

本样板使用 Electron 39.2.7 桌面窗口与 Three.js r180，自动比较 D 国风 3D 和高清像素两种渲染。两种模式共用场景、人物和演示事件，每种播放 72 秒，依次展示山院全景、主殿与建筑、人物与行走、招式与护持、多人同场交战、暮色与灯火六段内容。

场景包含 30 名示例人物，演示连续行走、剑击、施法与受击。界面展示 12 个主动技能快捷位；当前自动演示实现青岚剑、飞剑、灵壁、雷印四种示范技能及对应冷却。其余快捷位、法宝和丹药区域用于界面容量评看，名称、键位和数值属于样例配置。

## 启动

安装 Node.js 与 npm 后，在本目录执行：

```sh
npm ci
npm start
```

首次安装会下载锁定版本的依赖。启动后自动打开桌面窗口，无需操作；默认按 D → 高清像素 → D 的顺序循环播放。按 Escape 退出。

可指定单一模式循环播放：

```sh
npm start -- --style=d
npm start -- --style=pixel
```

## 采集参数

带值参数使用 `--名称=值` 格式：

| 参数 | 用途 |
| --- | --- |
| `--style=both` | 默认值，自动交替播放两种模式。 |
| `--style=d` / `--style=pixel` | 选择单一渲染模式。 |
| `--qa-dir=/absolute/path` | 将阶段截图与运行指标写入指定目录；当前模式播放一次后退出。 |
| `--record` | 同时录制 WebM；与 `--qa-dir` 配合保存视频。 |
| `--show` | 在采集模式下显示桌面窗口；普通启动默认显示。 |

分别采集两种模式：

```sh
npm start -- --style=d --qa-dir=/tmp/yunxiu-three-d --record
npm start -- --style=pixel --qa-dir=/tmp/yunxiu-three-pixel --record
```

采集模式默认隐藏窗口。截图为 PNG，录像为 `<style>-autoplay.webm`，指标为 `<style>-metrics.json`。指标仅描述当前运行环境与样板负载。

## 渲染与评审状态

D 模式使用三维模型、材质、阴影及光照。高清像素模式将三维场景渲染为 640 像素宽，再按窗口比例放大；人物由模型实时渲染到每格 96 × 128 像素的共享图集，作为场景中的人物精灵显示，界面保持窗口分辨率。这是低分辨率三维场景与人物精灵的效果样板，手绘像素资产尚待制作。

目前建筑、人物模型和整体细节仍低于 [D 画风原型](../../../docs/art/desktop-style-review-20261013/d-realistic-3d.png) 的精细度，整体美术待审核。macOS 自包含应用已分别完整播放两种模式并录制，Windows 待测；完整运行与交付证据见 [桌面样板记录](../../../docs/art/DESKTOP-RUNTIME-SAMPLES-2026-10-13.md)。

样板使用独立演示数据，不读取或写入正式三个档位。正式经营、人物成长、存档与战斗规则的桌面迁移另行实施和验收。

## 素材来源

树木、山石与地表贴图采用 Poly Haven CC0 素材；具体出处、许可、处理方式和文件哈希见：

- [自然模型来源](assets/nature/SOURCE.md)
- [自然模型清单与尺寸](assets/nature/manifest.json)
- [地表贴图来源与哈希](assets/surfaces/SOURCES.json)

主殿与骨骼人物基础资产来自本仓库 Blender 制作文件；样板代码分别由 `environment.mjs`、`actors.mjs`、`pixel-actors.mjs`、`effects.mjs` 和 `main.mjs` 组织环境、人物、精灵渲染、技能效果及自动演示。

## macOS 自包含包

安装依赖后执行 `python3 package-macos.py /absolute/new/path/云岫山院-双画风样板.app`。输出目录必须尚不存在；脚本生成本地开发签名的应用。当前验证为 macOS arm64，Windows 打包与实机另行验证。

主殿场景可单独打包：

```sh
python3 package-macos.py --reference /absolute/new/path/云岫山院-主殿场景样板.app
```

该选项使用独立应用名称与标识，并在应用资源内写入 `showcase-config.json`，以 `{"scene":"reference"}` 选择 `reference.html`。省略 `--reference` 时仍打包默认的双画风自动演示。
