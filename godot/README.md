# 模拟仙府 Godot Web 工程

> **当前美术方案 · 2026-10-09 · [U-104](../docs/design/DECISIONS.md)：** 用户已确认 Godot 2D、固定斜俯视、统一绘画素材、二维人物动画与连续移动。先按[二维绘画小院](../docs/PAINTED-COURTYARD.md)制作一殿、一道、两人的实际 Web 场景；网页美术效果须另行验收，用户认可后再批量扩展。

使用 Godot **4.6.3 stable**、GDScript、Compatibility 和单线程 Web 导出。当前任务按 **U-104** 制作二维绘画小院，范围与验收见 [二维绘画小院](../docs/PAINTED-COURTYARD.md)；完整玩法迁移路线见 [G0–G3](../docs/GODOT-MIGRATION.md)。制作已获批准，网页实机美术认可仍待用户确认；确认后再批量扩展地图、建筑和人物。

## 当前二维绘画小院入口

场景为 `painted_courtyard/courtyard.tscn`，资源在 `painted_courtyard/assets/`。内置 imagegen 生成的绘画素材由 Godot 二维图层直接使用。人物连续位置与动作动画、图层遮挡和输入分别检查。在仓库根目录执行：

```sh
python3 tools/build-painted-web.py
python3 -m http.server 8080 --directory dist --bind 127.0.0.1
```

打开[二维绘画小院](http://127.0.0.1:8080/painted-courtyard/)，独立输出为 `dist/painted-courtyard/index.html`。源场景可用 `/Applications/Godot.app/Contents/MacOS/Godot --path godot res://painted_courtyard/courtyard.tscn` 运行。原主场景与正式游戏保持；样板不读写正式三个档位、不结算经营资源。按 [ART-2D 检查项](../docs/PAINTED-COURTYARD.md)实际操作 Web 构建，再登记 [STATUS](../docs/design/STATUS.md)。

## U-103 试验工程入口（历史）

以下工程、资源和命令保留用于复现已有试验；U-104 已停止该路线的继续制作。

场景为 `art/art_courtyard.tscn`，资源在 `art/assets/`，包含一栋主殿、一段山石道路、两名人物。使用本机 Godot 4.6.3 及对应的标准 Web 导出模板，在仓库根目录运行：

```sh
python3 tools/build-art-web.py
python3 -m http.server 8080 --directory dist --bind 127.0.0.1
```

浏览器打开 [实机小院](http://127.0.0.1:8080/art-courtyard/)。`build-art-web.py` 在单独的临时项目中只复制和打包本批 `godot/art/`，导出到 `dist/art-courtyard/index.html`；可用 `--godot` 指定 Godot 可执行文件。本批构建需要 Python 3，不使用旧桥接的素材准备流程。

直接运行源场景：

```sh
/Applications/Godot.app/Contents/MacOS/Godot --headless --path godot --editor --import
/Applications/Godot.app/Contents/MacOS/Godot --path godot res://art/art_courtyard.tscn
```

此命令指定3D场景运行；`project.godot` 的原主场景保持现状。样板独立检查模型材质、连续动作、缩放、点选与遮挡，不结算经营资源、不读写正式三个档位。实际构建、浏览器检查、用户确认及发布情况查 [STATUS](../docs/design/STATUS.md)；本说明不预先声明网页验收通过。

## 已有2D桥接入口与准备方式

以下保留 U-102 的桥接实现与复验方式：山院、人物与建筑点选、掌门行走、疗伤和隔离存档由 Godot 场景连接既有 JS 模拟，经营规则仍由唯一 JS 模拟执行。该入口和旧素材作为已有成果保留；当前美术制作使用上方 U-104 二维绘画场景。

安装 Godot 对应版本的标准导出模板。构建需要 Python 3 和 Node.js；通过 `--godot`、`--node` 指定可执行文件，或用 `GODOT_BIN` 环境变量指定 Godot。

```sh
python3 tools/build-godot-web.py --prepare-only
# 在 Godot 编辑器打开 godot/project.godot
python3 tools/build-godot-web.py
python3 -m http.server 8080 --directory dist --bind 127.0.0.1
```

浏览器打开 [已有桥接预览](http://127.0.0.1:8080/godot/)。该构建从 `dist/` 复制已登记素材和字体，生成 `godot/assets/`；不修改原素材。`godot/.godot/`、`godot/assets/`、`dist/godot/` 是可重建产物。原主场景在原生编辑器运行时展示由现有新档生成的静态快照，实际世界操作通过桥接 Web 入口验收。

预览只使用 `godot-preview` 存档键。导入文件经原校验器检查和用户确认后写入预览档，并保留原文及替换前档案；正式三个档位独立。现阶段导入支持掌门已归院的存档，山外界面在后续批次接入。

## 已有桥接的定向验证

```sh
node --test tests/ea-godot-bridge.test.mjs tests/ea-godot-host.test.mjs
godot --headless --path godot --script ../qa/godot-scene-check.gd
```

这些脚本针对已有2D桥接，不能代替当前二维小院导出页面的实际点击、连续动作、横竖屏与设备验收。旧图集的完整动作和原模拟行走节奏保留为该实现的局限；新美术先按 U-104 完成二维绘画小院与用户实机确认，后续玩法接入再按 G1 及原 SR/AC 验收。
