# 云岫山院 · 近山试行

## 山院院务接续 · U-147

`npm run courtyard` 进入既有两人小院，新增院务目标、人物/重叠候选、真实工位、物资账、研习修炼及采集搬运。保存失败后保护暂停，可显式重试或另存恢复文件。只操作掌门和管理机会，NPC可拒绝邀请。当前仍使用已建成主殿/药田的公开命令检查点，尚非普通新档开局。

本批47项Node检查通过，实际浏览器/桌面验证待补，运行命令和证据范围见[49记录](../../docs/design/49-P0-P2-COURTYARD-PROGRESS.md)。桌面保持U-139后台继续；原生包尚未在本环境重建。

## 山院实景 · U-144

按确认的 `courtyard-v2.png` 还原首屏，入口 `npm run courtyard`；macOS打包使用 `python3 package-courtyard-macos.py /absolute/new-destination.app`。实际画面、走路范围与验证见 [首屏记录](../../docs/art/pixel-courtyard-prototype-20261014/RUNTIME.md)。

左键点地行走、点人物交谈、点建筑查看近况；滚轮缩放、右键拖动，空格暂停，Tab收起界面。原稿对照保持同一镜头。该入口读取正式模拟与独立山院存档，运行时切后台继续，手动暂停、阅读与关闭停止；重开恢复保存事实。下方演武与近山试行保留各自入口和历史规则。

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
