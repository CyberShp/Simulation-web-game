# 构建入口

使用 Node.js 22.12 以上版本，CI 使用 Node.js 24。首次运行先在仓库根目录执行 `npm ci`。

- `npm start`：启动当前桌面山院。Electron 固定为 39.2.7。
- `npm run dev:web`：构建网页并在本机 8080 端口预览；改用其他端口可追加 `-- --port=8081`。
- `npm run build:web`：按 `web-files.json` 组装完整的 `dist/web/`，保留根入口和 `ea-preview/`，输出文件散列清单。追加 `-- --tag=<版本>` 指定缓存版本。
- `npm run build:desktop`：在当前 macOS 或 Windows 上打包，输出到 `dist/desktop/`。可追加 `-- --arch=x64` 或 `-- --arch=arm64`；`-- --stage-only` 只准备运行文件。
- `npm run verify`：检查源码与网页构建，再执行单元测试。

桌面打包从 `apps/courtyard/`、`src/simulation/` 与 `assets/courtyard/` 取运行文件，保留随共用模块提供的许可证。应用标识为 `games.xianfu.courtyard-master`；存档继续使用系统应用数据目录内的 `yunxiu-courtyard-master` 与原存档文件名。

`check.yml` 在主分支推送或 PR 时执行三平台检查，并由 Ubuntu 任务保存完整网页产物。

`pages.yml` 由手动触发，先执行完整工程验证，再按源码提交号构建网页。发布脚本校验产物散列，在临时分离工作树中更新现有 `gh-pages` 分支，只同步构建清单中的文件，保留其他历史路径，以普通推送防止覆盖并发提交。之后通过 GitHub Pages API 请求构建，并等待对应提交实际完成；发布权限为 `contents: write` 与 `pages: write`，同仓库发布串行执行。现有 Pages 设置应为 `gh-pages` 分支根目录。用 `node scripts/release/publish-pages.mjs --dry-run` 可先核对本地产物。

`release.yml` 在 `v*` 标签或手动触发时生成 macOS arm64、macOS x64 与 Windows x64 压缩包，保存为工作流产物。标签触发且三个构建成功后，汇总任务创建 GitHub **Draft Release**，附压缩包、源码提交号和自上一标签起的变更记录；手动触发只保存构建产物。已有同名草稿只更新构建附件，保留其说明，已公开的同名 Release 会让任务停止。macOS 包使用本机临时签名；面向公开分发的签名和公证仍需发布凭据。工程检查与打包结果和目标设备游戏验收分别记录。

网页构建的发布路径以 `web-files.json` 为准；新增公开文件时更新此清单。`package-pages.py` 提供现有 GitHub Git Tree 文本条目格式，完整静态发布使用 `dist/web/`。

## 依赖审计记录 · 2026-10-16

根目录 `npm ci` 已按锁文件安装。`npm audit` 报告 6 个依赖告警（2 高危、4 中危），均处在固定 Electron 39.2.7 的依赖链上。以下区分安装工具和随应用分发的运行库；告警级别来自 npm 审计，并非当前应用已复现相应攻击。

| 依赖及锁定版本 | 范围 | 审计结果 |
| --- | --- | --- |
| `electron@39.2.7` | 桌面运行库 | 高危。当前公告含上下文隔离、窗口/iframe 权限及内存访问问题，具体修复版本随公告不同。 |
| `extract-zip@2.0.1` | Electron 安装时解压 | 高危。公告覆盖 `<=2.0.1`，涉及 ZIP 符号链接路径越界写入。 |
| `@electron/get@2.0.3` | Electron 安装时下载 | 中危。审计影响范围 `1.6.0–4.0.3`，来自其代理依赖链。 |
| `global-agent@3.0.0` | 下载代理工具 | 中危。审计影响范围 `<=3.0.0`，来自日志格式化依赖。 |
| `roarr@2.15.4` | 下载代理日志工具 | 中危。审计影响范围 `<=2.15.4`，来自字符串格式化依赖。 |
| `sprintf-js@1.1.3` | 下载代理日志格式化 | 中危。公告覆盖 `<=1.1.3`，涉及无界精度导致的拒绝服务。 |

这些安装工具不会复制进桌面应用。打包器本身使用 `@electron/get@5.1.0` 和 `@electron-internal/extract-zip`；它按固定 Electron npm 包中的 `checksums.json` 校验运行库 ZIP。

npm 自动修复建议为 Electron 39.8.10，但当前合并公告仍覆盖该版本，不能据此认为全部告警关闭。例如 [webview 工作线程权限公告](https://github.com/advisories/GHSA-9qh4-3jw8-366w) 的修复分支包含 41.10.6。运行库升级需另批完成版本选择和桌面回归，本次依照工程整理范围保持 39.2.7。安装链的具体公告见 [ZIP 路径问题](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3) 和 [格式化精度问题](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)。
