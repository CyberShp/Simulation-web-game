# 云岫山院 · 近山试行

纯 2D 高清像素桌面样件：从山院步行下山，穿过溪桥、绕松石岛，进入谷地会武，再沿原路返院。支持亲自操作与自动行程。

[实机记录](../../docs/art/hd-pixel-trail-20261014/RUNTIME.md) · [连续行程规则](../../docs/design/44-PIXEL-TRAIL-SLICE.md) · [基础演武规则](../../docs/design/43-PIXEL-ARENA-SLICE.md)

本目录固定 Electron 39.2.7，首次运行 `npm ci`，随后 `npm start` 打开主菜单。

- `npm start -- --trail --autoplay`：自动完成 16 人近山行程。
- `npm start -- --trail32 --autoplay`：32 人谷地会武观察配置。
- `npm start -- --scene`：原山院 66 秒自动游览。
- `python3 package-macos.py /absolute/new-destination.app`：创建 macOS 应用包。

WASD 或点地行走，Tab / 点击选敌，F 普攻，1–3 剑气／火诀／护阵，空格暂停；滚轮缩放、右键拖动，跟随、全景和小地图改变视野。两排 12 格保留后续技能位置，当前四格可用。

测试：`node --test arena-sim.test.mjs arena-storage.test.cjs world.test.mjs trail-world.test.mjs arena-renderer.test.mjs`。

验收启动参数 `--qa-dir=/absolute/path --show --qa-scenario=trail-integration --record` 使用独立存档、实际前台计时和录像；`native` 记录原生操作。普通演武的 `integration`、`restart-write`、`restart-read` 仍可单独运行。失焦、隐藏、最小化和关闭后不推进。

本批为近山空间与初级战斗的独立切片。正式世界、经营、人物成长与三个正式存档接入、Windows 真机验证分别接续。
