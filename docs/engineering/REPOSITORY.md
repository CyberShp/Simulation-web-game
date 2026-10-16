# 工程目录与常用命令

U-152，2026-10-16。当前主线是高清像素桌面山院，现有网页入口与共用模拟继续维护。目录迁移及验证范围见 [本次记录](MIGRATION-20261016.md)。

## 目录职责

| 目录 | 内容与修改入口 |
| --- | --- |
| `apps/courtyard/` | Electron 窗口、山院界面、像素呈现、读档恢复，以及对共用模拟的接入 |
| `apps/web/` | 既有网页 HTML、样式、界面和渲染入口 |
| `src/simulation/` | 共用规则、数据、持久事实、时钟、活动、物流和兼容代码 |
| `assets/courtyard/` | 当前原山院与东台像素素材 |
| `assets/web/` | 现有网页人物、建筑、字体和场景素材 |
| `tests/unit/` | 可重复的规则、存储和界面组件检查 |
| `tests/acceptance/` | 公开命令、浏览器、桌面与历史场景的定向验收脚本 |
| `tests/fixtures/` | 可复用兼容档与测试数据 |
| `scripts/check.mjs`、`scripts/test.mjs` | 根检查与单元测试入口 |
| `scripts/build/` | 现有网页与当前桌面构建，以及历史场景导出工具 |
| `scripts/release/` | 发布产物整理与兼容发布工具 |
| `scripts/dev/` | 本地预览服务 |
| `scripts/requirements/` | SR 台账管理与派生文档生成 |
| `scripts/art/` | 可复用美术制作工具 |
| `archive/godot/`、`archive/prototypes/` | 历史工程和独立样板；按各自 README 和证据使用 |
| `docs/design/`、`docs/requirements/` | 产品依据、行为契约、状态和验收 |
| `docs/history/` | 历史入口原文及已有历史材料 |
| `.github/workflows/` | CI 检查与构建定义 |
| `dist/` | 生成的网页和桌面应用；可从源码重建，不纳入版本跟踪 |

## 开发与构建

根目录 `package.json` 与 `package-lock.json` 固定当前依赖。需要 Node.js 22.12 或以上、npm 与 Python 3；首次安装执行 `npm ci`。

```sh
npm start
npm run dev:web
npm test
npm run check
npm run build:web
npm run build:desktop
```

`npm start` 启动 `apps/courtyard/courtyard-host.cjs`。网页构建将 `apps/web/`、所需共用模块和网页素材组合为静态运行目录；保持现有公开 URL 的模块与素材布局。桌面构建打包当前平台应用；macOS 构建成功与 Windows 真机通过分别记录。

网页构建输出为 `dist/web/`，默认预览地址为 `http://127.0.0.1:8080/`；桌面应用输出为 `dist/desktop/`，暂存目录为 `dist/staging/courtyard/`。桌面完整打包须在目标系统执行，脚本支持的选项见 `scripts/build/`、`scripts/dev/`。本次实际构建目录记录在 [迁移验证](MIGRATION-20261016.md)，不要手工修改生成的 `dist/` 来修复源码问题。

## 分层验证

先检查本次直接功能与旧档读取，再做相关回归。`npm test` 默认运行当前山院、共用存档/时钟/空间和工程打包相关单元层；`npm test -- --all` 运行全部单元套件。实际桌面、浏览器和长时经营脚本位于 `tests/acceptance/`，按本次影响和对应设计选择，脚本通过数只覆盖其断言范围。

典型定向命令：

```sh
node --test tests/unit/web/ea-master-control.test.mjs
node --test tests/unit/web/ea-persistence.test.mjs
python3 scripts/requirements/sr-manager.py validate
```

桌面独立验收目录、网页 `acceptance=qa-*` 命名空间和正式用户档分开。可复用夹具留在 `tests/fixtures/`；实际运行日志、截图、过程档与临时导出写到仓库外。

## 文档与台账

[设计入口](../design/README.md)负责产品规格导航，[STATUS](../design/STATUS.md)负责当前已验证范围，[接手指南](../CODEX-HANDOFF.md)负责操作入口。`docs/requirements/registry.json` 是需求状态来源，更新后执行：

```sh
python3 scripts/requirements/sr-manager.py refresh
python3 scripts/requirements/sr-manager.py validate
```

refresh 生成 BACKLOG 和单项 SR 页面。历史记录保留原结论与证据范围；进入新批次时只更新当前导航，不继续向所有入口复制同一篇进展。

## 兼容与发布

目录整理保持共用模拟、schema、应用身份、用户数据目录、命名空间及存档文件名。既有网页发布使用 `gh-pages`，源码位于 `main`；构建和发布分别核对。历史 Godot 导出依赖相应工具和导出模板，执行相关任务时再安装与验证。

提交只包含必要源码、素材、文档、固定依赖清单和可复用测试。`node_modules/`、构建产物、日志、截图及个人测试存档不纳入源码提交。
