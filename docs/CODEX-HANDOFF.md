# Codex 接手指南

更新于 2026-10-16，当前开局演示按 U-153，工程目录按 U-152。先读 [AGENTS.md](../AGENTS.md)，核对工作区、当前分支和未提交差异。本文负责当前导航；规则由设计规格定义，实际完成范围由 [STATUS](design/STATUS.md) 与 [需求台账](requirements/registry.json) 记录。

## 当前主线

当前可运行主线是纯 2D 高清像素桌面山院，Windows 为主力平台，macOS 用于前期验证。`apps/courtyard/` 使用 Electron / Canvas 2D 展示原山院、东路与首处东台门人居，并读取 `src/simulation/` 的共用规则。现有网页入口保存在 `apps/web/`，历史 Godot 工程与独立样板位于 `archive/`。

原山院实机与东台 v2 母稿已获用户批准。当前山院管理、供苗/劳动/搬运、修行与物资操作、保存恢复和东台实际扩建有迁移前 macOS 证据。同一东台完成档已实际自主运行 1200.036 秒，原生最小化 180.857 秒并继续推进；其中持续口粮供给不足，之后使用同源存档手动采粮恢复。完整范围与原验收脚本失败的处理见 [53 长验记录](design/53-COURTYARD-AUTONOMY-ACCEPTANCE.md)。

本次整理工程结构、命令、构建、测试与文档导航，保持既有游戏逻辑和存档标识。干净检出安装、根检查、默认核心测试 124/124、桌面暂存、最终 macOS 包同档复验 5/5 和真实网页操作 8/8 已完成，独立审计无阻断。扩展套件 623 项中 560 通过、60 失败、3 跳过；60 项失败均在迁移前基点逐名重现，当前失败名称没有新增。源码已推送，远端三平台检查、三个桌面包及现有网页发布已核对，具体证据见 [工程迁移记录](engineering/MIGRATION-20261016.md)。

U-153 将当前桌面的空存档入口接通灭门序章、云岫落脚、疗伤择卷与首次主殿营造。阶段读取正式共用状态，同一人物与物资持续保存；详细实现、最终包验证和连续录像见 [54 开局演示](design/54-COURTYARD-OPENING-DEMO.md)。主殿之后的完整前期流程继续按原验收范围接续。

## 读取顺序

1. [设计入口](design/README.md)、[统一基准](design/00-BASELINE.md)、[决策登记](design/DECISIONS.md)、[当前状态](design/STATUS.md)。
2. [共同运行契约](design/05-RUNTIME-CONTRACTS.md)、[开局验收](design/06-OPENING-ACCEPTANCE.md)、[前期详细设计](design/14-EARLY-GAME-DETAILED-DESIGN.md)，再读取本次分系统。
3. [需求管理](requirements/README.md)、[总表](requirements/BACKLOG.md)、[台账](requirements/registry.json) 和对应 `items/SR-XF-xxx.md`。
4. 当前空间与经营任务读取 [45 自主经营](design/45-SECT-IDLE-SLICE.md)、[46 连续山域](design/46-CONTINUOUS-DOMAIN-FOUNDATION.md)、[51 山院管理](design/51-COURTYARD-MANAGEMENT-INTEGRATION.md)、[52 东台](design/52-EAST-TERRACE-INTEGRATION.md)、[53 长验](design/53-COURTYARD-AUTONOMY-ACCEPTANCE.md)。
5. 美术按 [原山院母稿](art/pixel-courtyard-prototype-20261014/README.md)、[保真要求](art/pixel-courtyard-prototype-20261014/FIDELITY.md) 和 52 的东台批准依据核对。山域规划另读 [成长章程](SECT-GROWTH-PLAN.md) 与 [山域试游](MOUNTAIN-DOMAIN.md)。

当前设计为 DB-2026-10-05 v1.2。U 表示用户确认，R/T 表示作者建议或可调参数。U-93 暂停主动远期世界观问答；未答的神道两项保留未定，按现有依赖继续前期工作。

## 根目录命令

安装需要 Node.js 22.12 或以上与 npm；台账及部分历史工具使用 Python 3。

```sh
npm ci
npm start
npm test
npm run check
npm run build:web
npm run build:desktop
```

`npm run dev:web` 构建并启动现有网页预览。生成目录与各命令范围见 [工程说明](engineering/REPOSITORY.md)。QA 日志、截图、测试存档与临时产物写到仓库外；桌面验收使用独立 `--qa-dir`，网页验收使用 `acceptance=qa-*`，保护用户正式存档。

台账由 JSON 生成派生文档：

```sh
python3 scripts/requirements/sr-manager.py refresh
python3 scripts/requirements/sr-manager.py validate
```

## 关键文件

| 工作 | 当前路径 |
| --- | --- |
| 桌面窗口与生命周期 | `apps/courtyard/courtyard-host.cjs`、`courtyard-preload.cjs` |
| 山院界面与操作 | `apps/courtyard/courtyard-main.mjs`、`courtyard-panels.mjs`、`courtyard-panel-state.mjs` |
| 场景、坐标与东台 | `apps/courtyard/courtyard-renderer.mjs`、`courtyard-space.mjs`、`courtyard-east-layout.mjs` |
| 桌面读档与恢复 | `apps/courtyard/courtyard-persistence.mjs`、`courtyard-recovery.cjs`、`sect-storage.cjs` |
| 山院对共用模拟的接入 | `apps/courtyard/sect-sim.mjs`、`sect-seed.mjs` |
| 模拟、活动与自主 | `src/simulation/ea-sim.mjs`、`ea-opening-sim.mjs`、`ea-sr-runtime.mjs`、`ea-sr-persons.mjs` |
| 空间、物流与持久化 | `src/simulation/ea-sr-spatial.mjs`、`ea-sr-economy.mjs`、`ea-persistence.mjs` |
| 现有网页 | `apps/web/index.html`、`apps/web/ea-game.mjs` |
| 运行素材 | `assets/courtyard/`、`assets/web/` |
| 单元与实际验收 | `tests/unit/`、`tests/acceptance/`、`tests/fixtures/` |
| 构建与发布 | `scripts/build/`、`scripts/release/`、`.github/workflows/` |
| 历史工程 | `archive/godot/`、`archive/prototypes/` |

历史源码和证据中的旧路径可按 [迁移说明](engineering/MIGRATION-20261016.md) 追溯。`dist/` 是构建产物，源码修改在上述目录进行。

## 每批执行与验收

每批开始建立四项对应关系：

```text
本批需求：SR-XF-xxx / 对应 AC，以及尚未完成的部分
设计依据：U/R/T 编号和当前规格条款
预计修改：文件、模块和受影响的身份、空间、活动或存档接口
验收：正常公开操作 → 可见结果 → 失败/中断恢复 → 精确存读 → 相关界面
```

先验证本次基本功能，再做直接相关回归。正常流程保持同一来源档，记录真实资源、时间和状态变化。正式世界规则、人物身份、NPC 意愿、空间事实和时钟由共用模拟裁定；UI 与只读检查不推进世界。当前后台继续、关闭不补时遵守 U-139。

迁移保持 schema 6、桌面应用身份、用户数据目录、存档命名空间和存档文件名；不得因目录整理创建一个看似空白的新用户档。旧档按现有加载器校验，失败保留原文。组件检查、屏幕交互、旧档矩阵和目标设备分别记证据。

交付前由另一个 Agent 只读复核；主 Agent 再核对实际差异、公共命令与接缝。独立复核不可用时明确记录。更新台账和 STATUS，执行 refresh / validate；源码提交、远端核对、网页部署与桌面应用交付分别报告。

## 当前未完成事项

1. 小院持续口粮供给，以及三至五人正常持续经营。NPC 应急觅食与手动补粮恢复已有记录，长期自动供给仍待接入和验收。
2. 当前桌面从普通新档完整走到炼丹、出谷首战、撤退返院与恢复；正式人物交谈、突破和独立演武整合分别接续。
3. 东台接入后的实机画面评看、更大山域、跨区成长与完整迁移矩阵。
4. Windows 真机、系统睡眠/唤醒、足额自主整备成功支出、目标规模性能与完整 SR/AC。

40 项 SR 继续按现有依赖推进；当前 120 条 AC 为 31 通过、88 未运行、1 阻塞，整项通过的是需求管理。720 项修行库属于作者内容草案，运行接入、动作数值、效果与平衡另验。

## 历史与发布

迁移开始时工作区基点为 `e5f0d78358ab42fefbd2b5e3c516465bff115f8b`，既有未提交成果备份于 `/Volumes/Media/immortal-delivery-backups/engineering-20261016-202844`。最新提交与远端状态须重新核对；这个基点只用于本次迁移追溯。

入口文档的旧全文按原路径保存在 [历史快照](history/README.md)，历史验收记录与失败原文继续保留。只提交必要源码、素材、设计和可复用测试；运行日志、截图、个人测试存档与生成物留在仓库外。

现有 GitHub Pages 由 `gh-pages` 发布运行产物。文档整理本身不证明游戏部署完成；运行版本变更须构建、验证并核对实际公开文件。源码推送失败时可使用已授权的 GitHub API 路径，更新分支须核对预期 HEAD 并保持 `force:false`。
