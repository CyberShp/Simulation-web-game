# SR-XF-001 · 需求基线、设计冲突与版本状态统一

来源：DB-2026-10-05 v1.2；需求版本：1.0；建档日期：2026-10-06。

| 字段 | 值 |
| --- | --- |
| 范围 / 模块 | 前期必需 / 管理 |
| 优先级 / 计划 | P0 / I0 |
| 设计 / 开发 | ready / implemented |
| 验收 / 发布 | passed / not_applicable |
| 责任人 / 复核人 | Codex / Codex（结构与来源自检） |

## 来源、依赖与范围

纳入云岫前期，按依赖推进。

决策来源：U-63, U-93, R-25, R-26。这是继承的U项和作者实施默认；具体新增名称/数值不得伪装成用户逐项批准。

规格：[00-BASELINE.md](../../../docs/design/00-BASELINE.md)、[04-WORLD-STORY.md](../../../docs/design/04-WORLD-STORY.md)、[12-CONTENT-AUTHORING.md](../../../docs/design/12-CONTENT-AUTHORING.md)、[13-WORLDVIEW-DISCUSSION.md](../../../docs/design/13-WORLDVIEW-DISCUSSION.md)、[14-EARLY-GAME-DETAILED-DESIGN.md](../../../docs/design/14-EARLY-GAME-DETAILED-DESIGN.md)、[18-SPATIAL-CONTINUITY-IMPLEMENTATION.md](../../../docs/design/18-SPATIAL-CONTINUITY-IMPLEMENTATION.md)、[06-OPENING-ACCEPTANCE.md](../../../docs/design/06-OPENING-ACCEPTANCE.md)。

依赖：无。

关联既有验收：DELIVERY-01；本SR的AC细化这些目标，不代表旧版本已经通过。

## 现状与设计缺口

已有统一规格与已发布EA 1.5.0-dev，旧索引仍残留未部署/待定表述。

建立逐项SR、来源、依赖、任务和关闭条件；统一药师身份及最新发布状态。

现状是适用旧能力的基线，不表示该SR完整目标已通过。

## 必须补齐的设计交付物

1. SR编号与字段规范、总表、机器可读台账及状态维护入口。
2. 核实当前源码/Pages版本，给历史状态加明确时间边界。
3. 14已确定的作者默认与旧待定字段形成覆盖说明；12示例不再复用陆知微作为失联药师。

## 需求行为

SR-XF-001-REQ-01：新增开发必须引用SR与验收ID；设计、代码、验收、发布分别记录。

SR-XF-001-REQ-02：远期需求不得成为前期依赖；历史验收保留适用范围。

SR-XF-001-REQ-03：需求缺口、缺陷、实现子任务分别登记，未完成任务不得靠测试数量关闭。


## 验收标准

| ID | 情景 / 操作 | 必须看到的结果 | 状态 |
| --- | --- | --- | --- |
| SR-XF-001-AC-01 | 查看台账和单项SR | 每项有稳定ID、范围、来源、依赖、状态、任务和可观察验收；无悬空或循环依赖。 | passed |
| SR-XF-001-AC-02 | 核对14、12与manifest | 药师身份方向一致，四个月流亡及三名责任人不再列为前期未定；源码和Pages版本与事实一致。 | passed |
| SR-XF-001-AC-03 | 设计完成但代码未完成 | 台账仍显示开发/验收未完成，历史测试数量不将其自动关闭。 | passed |

SR-XF-001-AC-01证据：2026-10-06：validate通过40项SR、200任务、120AC；来源有效、依赖无循环；51个Markdown文件503个本地链接无缺失。

SR-XF-001-AC-02证据：2026-10-06：审阅12/14/04/manifest差异；独立药师未复用陆知微；四个月、开局知情及三人责任链按R-26覆盖；API核实main74df8c4与Pages350a4d6。

SR-XF-001-AC-03证据：2026-10-06：ready缺设计任务、passed缺实现与AC、无证据done、未完成前置均被拒绝；其余玩法仍partial/not_started及not_verified，task不自动提升SR整体状态。

本管理SR验证文档、机器台账、状态守卫和既有发布事实；不要求新的游戏场景、设备或截图验收。

## 开发任务

| 任务 | 工作 | 状态 | 前置 | 责任人 |
| --- | --- | --- | --- | --- |
| SR-XF-001-D01 | 设计补齐：交付：SR编号与字段规范、总表、机器可读台账及状态维护入口。；核实当前源码/Pages版本，给历史状态加明确时间边界。；14已确定的作者默认与旧待定字段形成覆盖说明；12示例不再复用陆知微作为失联药师。；填实必需参数并标记U/R/T来源。 | done | 无 | Codex |
| SR-XF-001-D02 | 契约与内容审阅：审阅需求基线、设计冲突与版本状态统一与依赖契约（无外部SR依赖）的字段、时序、失败及恢复；逐项核对本SR的REQ/AC。 | done | SR-XF-001-D01 | Codex |
| SR-XF-001-I01 | 开发与集成：实现JSON校验、列表、状态更新和Markdown派生；接入设计入口、AGENTS、manifest及交接文档。 | done | SR-XF-001-D02 | Codex |
| SR-XF-001-V01 | 验收与兼容：执行SR-XF-001-AC-01至AC-03及DELIVERY-01；登记实际结果、兼容和设备证据边界。 | done | SR-XF-001-I01 | Codex |
| SR-XF-001-R01 | 发布与关闭：将需求与管理脚本通过GitHub API提交main，核对远端文件内容；无游戏运行时变更，Pages发布不适用。 | done | SR-XF-001-V01 | Codex |

SR-XF-001-D01证据：docs/requirements/README.md、TEMPLATE.md、registry.json：字段、状态、40项SR及范围已定义。

SR-XF-001-D02证据：2026-10-06：validate确认40项来源/原验收引用有效、无循环依赖、前期不依赖条件或远期。；2026-10-06：503个本地文档链接检查通过；12独立药师与14一致，旧待定字段增加R-26覆盖说明。

SR-XF-001-I01证据：qa/sr-manager.py：validate/refresh/list/task可用；派生40项页面与BACKLOG，AGENTS/manifest/STATUS/HANDOFF已接续。

SR-XF-001-V01证据：2026-10-06：3项非法任务状态更新均被拒绝且registry未写入；另5项循环、越界及虚假完成守卫检查通过。；2026-10-06：GitHub API核实main基线74df8c4及Pages350a4d6，与manifest及发布记录一致。

SR-XF-001-R01证据：2026-10-06：GitHub API提交main 272cbe8c1f5fba39ac2293a139ce79a842619762，远端branch/tree核对成功，54个变更blob哈希与本地提交79a57c2一致。；仅文档和管理脚本；未改dist/gh-pages，Pages发布not_applicable；未上传截图或过程产物。

## 可进入开发的条件

- SR字段、分层状态及需求依赖规则固定。
- 原设计来源、旧验收和当前版本均可追溯，冲突覆盖关系明确。
- 总表、单项页面和台账使用同一组稳定SR编号。

## 关闭条件

- 40项SR完整建档，来源、引用、依赖和状态校验通过。
- 文档身份与版本冲突已统一；基线能力未被误报为新功能完成。
- 状态守卫拒绝无证据完成、未满足前置及无原因阻塞。
- 文档和管理脚本提交main并核对；游戏运行时不变，发布标记not_applicable。

## 不在本SR范围

- 不改变仅控掌门、NPC自主、单一时钟和旧完成档保护。
- 不把该SR的设计完成声明为实现、体验或发布完成。

## 证据与变更

- 2026-10-06：40项SR、200任务、120AC建档并校验；需求管理本身D01/D02/I01/V01/R01全部完成。
- 需求基线文档main提交：272cbe8c1f5fba39ac2293a139ce79a842619762；远端54个变更文件哈希已核对。
- 这只覆盖SR-XF-001管理能力；其余玩法仍待设计补齐、实现及独立验收。

- 2026-10-06：由v1.2设计缺口审计建立SR；新增内容和参数遵循作者默认，不冒充用户逐项确认。
- 2026-10-06：完成管理SR的设计、实现及结构/来源/状态守卫验收；仅文档提交待核对，游戏Pages不适用。
- 2026-10-06：GitHub API提交main并核对远端内容，完成R01；文档SR关闭，Pages运行时不变。

本文件由[registry.json](../registry.json)派生；更新台账后执行 `python qa/sr-manager.py refresh`，不单独修改此派生页。
