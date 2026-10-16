# 模拟仙府 · 余烬立山

单人修仙宗门经营游戏。玩家只直接控制掌门，门人按意愿和现实条件自主生活、劳作与修行；人物、物资、营造和成长共用同一世界与存档。

当前开发入口是 **纯 2D 高清像素桌面山院**，以 Windows 为主力平台，在 macOS 进行前期验证。当前山院使用 Electron 与 Canvas 2D 呈现，玩法读取共用 JavaScript 模拟。已有网页入口继续保留：[网页开发版](https://cybershp.github.io/Simulation-web-game/)。

## 当前可运行范围

山院已接入人物与建筑查看、院务、修行和物资面板、实际供苗与劳动、收成搬运、保存恢复，以及沿东路往返并营造首处门人居。开着游戏、切后台或最小化时世界继续运行；手动暂停和阅读按当前规则停止世界，关闭后停止，重开不补离线进度。掌门自主行为受玩家设定的目标、预算和风险偏好约束。

迁移前已记录 macOS 山院管理、东台扩建与同一世界二十分钟自主经营的实际证据。持续口粮供给、完整桌面新档流程、三至五人长期经营、Windows 真机及完整游戏验收继续接续。具体范围见 [当前状态](docs/design/STATUS.md)；工程迁移已完成干净检出安装、根检查、124 项核心测试、macOS 同档恢复与网页操作复验，源码远端核对另见 [迁移记录](docs/engineering/MIGRATION-20261016.md)。

## 本地运行

需要 Node.js 22.12 或以上、npm；需求台账检查和部分历史构建使用 Python 3。在仓库根目录执行：

```sh
npm ci
npm start
```

| 命令 | 用途 |
| --- | --- |
| `npm start` | 打开当前高清像素桌面山院 |
| `npm test` | 运行当前山院及相关核心单元测试 |
| `npm run check` | 检查源码、工程入口与需求台账 |
| `npm run build:web` | 生成现有网页到 `dist/web/` |
| `npm run build:desktop` | 生成当前平台桌面应用到 `dist/desktop/` |
| `npm run dev:web` | 构建并预览现有网页入口 |

`dist/` 是构建输出。修改源码后重新构建；依赖版本由根目录 `package-lock.json` 固定。构建输出位置、专项验收及历史场景使用方式见 [工程说明](docs/engineering/REPOSITORY.md)。

## 目录

| 路径 | 内容 |
| --- | --- |
| `apps/courtyard/` | 当前桌面山院的窗口、界面与呈现 |
| `apps/web/` | 现有网页入口和网页界面 |
| `src/simulation/` | 共用规则、状态、空间、时钟与存档模块 |
| `assets/courtyard/`、`assets/web/` | 桌面山院和网页素材 |
| `tests/unit/`、`tests/acceptance/`、`tests/fixtures/` | 单元检查、实际流程验收和可复用夹具 |
| `scripts/` | 检查、测试、构建、发布、开发、需求管理和美术工具 |
| `archive/godot/`、`archive/prototypes/` | 已有 Godot 工程和历史样板 |
| `docs/` | 设计、需求、工程说明、美术依据与历史记录 |

## 接续开发

先读 [AGENTS.md](AGENTS.md) 与 [Codex 接手指南](docs/CODEX-HANDOFF.md)，再查 [设计入口](docs/design/README.md)、[决策登记](docs/design/DECISIONS.md) 和 [需求台账](docs/requirements/registry.json)。设计基线为 DB-2026-10-05 v1.2，共用运行时为 EA 1.6.0-dev / schema 6。

40 项 SR 和 120 条 AC 分别记录设计、实现、验收与发布状态。局部玩法或组件检查只证明对应范围，完整状态以台账和实际证据为准。旧入口文档原文按原路径保存在 [历史快照](docs/history/README.md)。
