# SR-XF-006 · 升级、迁建与拆除的安全任务

来源：DB-2026-10-05 v1.2；需求版本：1.0；建档日期：2026-10-06。

| 字段 | 值 |
| --- | --- |
| 范围 / 模块 | 前期必需 / 营造 |
| 优先级 / 计划 | P1 / I1 |
| 设计 / 开发 | draft / in_progress |
| 验收 / 发布 | in_progress / not_released_for_this_sr |
| 责任人 / 复核人 | Codex/space_construction / Codex/root（集成） |

## 来源、依赖与范围

纳入云岫前期，按依赖推进。

决策来源：U-63, U-93, R-25, U-94。这是继承的U项和作者实施默认；具体新增名称/数值不得伪装成用户逐项批准。

规格：[03-SPATIAL-ART.md](../../../docs/design/03-SPATIAL-ART.md)、[05-RUNTIME-CONTRACTS.md](../../../docs/design/05-RUNTIME-CONTRACTS.md)、[07-ECONOMY-ORGANIZATION.md](../../../docs/design/07-ECONOMY-ORGANIZATION.md)、[18-SPATIAL-CONTINUITY-IMPLEMENTATION.md](../../../docs/design/18-SPATIAL-CONTINUITY-IMPLEMENTATION.md)。

依赖：[SR-XF-004](SR-XF-004.md)、[SR-XF-005](SR-XF-005.md)。

关联既有验收：BUILD-04, SAVE-01；本SR的AC细化这些目标，不代表旧版本已经通过。

## 现状与设计缺口

已有升级迁建预览尺寸修正和安全完工等待。

劳动/占床中的完整迁建拆除流程、退款与位置恢复未统一。

现状是适用旧能力的基线，不表示该SR完整目标已通过。

## 必须补齐的设计交付物

1. 升级占地冲突、迁建源/目标预约、拆除与材料回收的任务状态图。
2. 人物活动中断、等待、临时撤离/安置和重新预约策略。
3. 各取消阶段的已用成本、余料、进度和身份保留表。

## 需求行为

SR-XF-006-REQ-01：被使用建筑不得瞬间消失或隔空复制；改动有实际时间与劳动成本。

SR-XF-006-REQ-02：迁建保留buildingId及槽位关联，活动重验后恢复或说明失效原因。

SR-XF-006-REQ-03：目标地被占或取消时保留原实体，失败不困人不重退资源。


## 验收标准

| ID | 情景 / 操作 | 必须看到的结果 | 状态 |
| --- | --- | --- | --- |
| SR-XF-006-AC-01 | 占床/劳动时发起迁建或拆除 | 按明确策略等待或安全结束活动，人物有可达去处。 | passed |
| SR-XF-006-AC-02 | 目标地失效、途中取消并重载 | 原建筑和已用投入可追溯，退款一次，无复制建筑。 | passed |
| SR-XF-006-AC-03 | 升级扩大占地 | 合法扩大才能完成；通路/容量/UI使用新统一定义。 | passed |

SR-XF-006-AC-01证据：qa/ea-sr-spatial-acceptance.mjs；docs/requirements/IMPLEMENTATION-2026-10-06.md

SR-XF-006-AC-02证据：qa/ea-sr-spatial-acceptance.mjs；docs/requirements/IMPLEMENTATION-2026-10-06.md

SR-XF-006-AC-03证据：qa/ea-sr-spatial-acceptance.mjs；docs/requirements/IMPLEMENTATION-2026-10-06.md

每条AC至少覆盖相关数据、真实行为、UI解释和保存恢复；需要设备或真人证据时单独列出，不以旧测试数量替代。

## 开发任务

| 任务 | 工作 | 状态 | 前置 | 责任人 |
| --- | --- | --- | --- | --- |
| SR-XF-006-D01 | 设计补齐：交付：升级占地冲突、迁建源/目标预约、拆除与材料回收的任务状态图。；人物活动中断、等待、临时撤离/安置和重新预约策略。；各取消阶段的已用成本、余料、进度和身份保留表。；填实必需参数并标记U/R/T来源。 | in_progress | 无 | Codex/space_construction |
| SR-XF-006-D02 | 契约与内容审阅：审阅升级、迁建与拆除的安全任务与依赖契约（SR-XF-004、SR-XF-005）的字段、时序、失败及恢复；逐项核对本SR的REQ/AC。 | todo | SR-XF-006-D01 | 待分配 |
| SR-XF-006-I01 | 开发与集成：在营造模块实现升级、迁建与拆除的安全任务；交付SR-XF-006-REQ-01至REQ-03，接入相关数据、行为、素材、UI和恢复，提交关联SR。 | todo | SR-XF-006-D02 | 待分配 |
| SR-XF-006-V01 | 验收与兼容：执行SR-XF-006-AC-01至AC-03及BUILD-04、SAVE-01；登记实际结果、兼容和设备证据边界。 | todo | SR-XF-006-I01 | 待分配 |
| SR-XF-006-R01 | 发布与关闭：完成所需源码/运行时发布核对、交接和未覆盖说明；本轮用户不要求上传QA过程产物。 | todo | SR-XF-006-V01 | 待分配 |

## 可进入开发的条件

- 设计交付物存在且版本/引用正确。
- 所有行为、失败、取消、恢复和存档影响可执行；未定必需参数已填入配置。
- 依赖契约已可使用；涉及身份、风险、真相与来源的作者卡固定。
- 验收步骤、预期、数据/设备和结果守恒条件可检查。

## 关闭条件

- 需求行为与所有必需AC通过，设计/实现/验收状态分别更新。
- 代码与规格同步，旧档保护、失败恢复和无AI路线通过适用检查。
- 范围内所需浏览器/触控/设备/真人验证已取得；未测项不能谎标通过。
- 提交/版本/简要结果与发布入口登记；未达到范围内门槛不得关闭。

## 不在本SR范围

- 不改变仅控掌门、NPC自主、单一时钟和旧完成档保护。
- 不把该SR的设计完成声明为实现、体验或发布完成。

## 证据与变更

- docs/requirements/design/SR-XF-003-006.md
- docs/requirements/IMPLEMENTATION-2026-10-06.md

- 2026-10-06：由v1.2设计缺口审计建立SR；新增内容和参数遵循作者默认，不冒充用户逐项确认。
- 2026-10-06：用户授权目标模式、多agent并行开发与验收；启动D01，按现有契约展开模块设计，未将建档或局部实现标作交付。

本文件由[registry.json](../registry.json)派生；更新台账后执行 `python qa/sr-manager.py refresh`，不单独修改此派生页。
