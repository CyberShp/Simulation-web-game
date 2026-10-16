# 工程验证

在仓库根目录安装依赖后运行：

```sh
npm ci
npm run check
npm test
```

`check` 核对当前源码引用、15 份桌面图片、设计文档入口与 SR 台账，然后构建网页并核对发布文件的哈希、模块和素材引用。`npm test` 运行当前桌面空间、管理、存储与恢复，以及共用时钟、门道、独立源码加载和网页打包检查。

`npm test -- --all` 运行 `tests/unit/` 中全部保留的单元测试。2026-10-16 整理时，扩展套件实际为 560 通过、60 失败、3 跳过；60 个旧网页失败均已在整理前 `e5f0d7` 的同名测试重现，涉及旧开局前提、界面桩和固定内容数量。具体范围见[工程迁移记录](../docs/engineering/MIGRATION-20261016.md)。可指定文件做局部复验：

```sh
npm test -- tests/unit/web/ea-release-package.test.mjs
```

可见桌面迁移验收使用一份已有暂停档的独立副本：

```sh
node tests/acceptance/courtyard-migration-desktop.mjs --source-save=/absolute/sect-save.json --output=/absolute/fresh-evidence
```

加 `--app=/absolute/package.app` 可检查 macOS 包；也可传 Windows 的完整 `.exe` 路径。脚本通过管理入口、实际运行、保存、关闭和重新启动检查同一世界，截图与报告写入指定仓库外目录，来源档保持原字节。长期自主经营、完整恢复和东台往返仍由 `tests/acceptance/courtyard-*-desktop.mjs` 的专用命令分别验收。

`tests/fixtures/` 保存复用输入。`tests/fixtures/legacy/` 中两份旧网页输入保留其原始内容，并分别来自历史 `acceptance-1.3/midgame.json` 与 `acceptance-indoor-v12/opening-invite.json`。CI 的三系统 Node 检查与构建结果只覆盖对应自动化范围；可见操作和目标设备体验另行记录。
