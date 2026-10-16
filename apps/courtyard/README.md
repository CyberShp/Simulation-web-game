# 桌面山院

在仓库根目录运行 `npm ci`，随后 `npm start`。当前入口是 `courtyard-host.cjs`，渲染页面是 `courtyard.html`，实际规则通过 `sect-sim.mjs` 调用 `src/simulation/`。

素材由宿主的 `/assets/` 路由提供，对应 `assets/courtyard/`；共用模块由 `/src/simulation/` 提供。源码路径与包内路径保持一致。

应用 ID 为 `games.xianfu.courtyard-master`，正式资料目录沿用系统 appData 下的 `yunxiu-courtyard-master`，存档为 `sect-save.json`。传入绝对路径 `--qa-dir` 使用独立验收档，完整验证说明见 [工程指南](../../docs/engineering/REPOSITORY.md)。
