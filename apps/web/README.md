# 网页入口

本目录保存现有网页的入口、界面与渲染源码。共用游戏规则位于 `src/simulation/`，网页素材位于 `assets/web/`。

在仓库根目录执行 `npm run dev:web` 进行预览，或执行 `npm run build:web` 生成 `dist/web/`。构建按 `scripts/build/web-files.json` 组装原有公开路径，并生成 `ea-preview/` 入口、资源清单和内容摘要。

当前主力开发入口和真实验证范围见 [项目首页](../../README.md)及 [实现状态](../../docs/design/STATUS.md)。
