# 云岫山院 · 像素演武

独立桌面即时战斗切片；用户已认可的像素山院与原 66 秒游览共用四份素材。

运行与验收详见 [运行记录](../../docs/art/hd-pixel-20261014/ARENA-RUNTIME.md)，规则范围见 [43](../../docs/design/43-PIXEL-ARENA-SLICE.md)。

本目录固定 Electron 39.2.7，首次 `npm ci` 安装，然后 `npm start` 进入演武；附加 `-- --scene` 进入原游览。`python3 package-macos.py /absolute/new-destination.app` 创建 macOS 应用包；优先使用本目录 Electron，兼容本机已安装的旧样件运行环境。

测试：`node --test arena-sim.test.mjs arena-storage.test.cjs world.test.mjs`。

验收标记 `--qa-dir=/absolute/path --show --qa-scenario=integration --record` 使用独立存档、实际前台计时和录像；`restart-write` / `restart-read` 检查跨进程；`native` 只记录实际原生操作。未显示、失焦、隐藏、最小化的演武不推进。
