# SR需求总表与开发顺序

设计基线：DB-2026-10-05 v1.2；需求台账：SR-XF-2026-10-06。

计划编号表示依赖顺序，不表示用户只要求交付某一小块，也不是承诺发布日期。具体任务能否启动还须检查其依赖的可用契约与设计完成情况。

前期32项、条件范围2项、远期暂存6项。每SR含设计、契约审阅、开发集成、验收兼容、发布交接五类任务；本次建档不把这些功能标完成。

## I0 · 基线整理

| SR | 名称 | 优先级 | 设计 | 开发 | 验收 | 依赖 |
| --- | --- | --- | --- | --- | --- | --- |
| [SR-XF-001](items/SR-XF-001.md) | 需求基线、设计冲突与版本状态统一 | P0 | ready | implemented | passed | 无 |

## I1 · 完整小院

| SR | 名称 | 优先级 | 设计 | 开发 | 验收 | 依赖 |
| --- | --- | --- | --- | --- | --- | --- |
| [SR-XF-002](items/SR-XF-002.md) | 共同实体、动作与内容定义契约补齐 | P0 | ready | in_progress | in_progress | SR-XF-001 |
| [SR-XF-003](items/SR-XF-003.md) | 统一米制空间、导航与镜头 | P0 | ready | in_progress | in_progress | SR-XF-002 |
| [SR-XF-004](items/SR-XF-004.md) | 建筑预制件、室内与分层素材目录 | P0 | ready | in_progress | in_progress | SR-XF-003 |
| [SR-XF-005](items/SR-XF-005.md) | 自由选址、施工与入口安全 | P0 | ready | in_progress | in_progress | SR-XF-003, SR-XF-004 |
| [SR-XF-006](items/SR-XF-006.md) | 升级、迁建与拆除的安全任务 | P1 | ready | in_progress | in_progress | SR-XF-004, SR-XF-005 |
| [SR-XF-007](items/SR-XF-007.md) | 稳定人物外观、肖像与活动动作 | P0 | ready | in_progress | in_progress | SR-XF-002, SR-XF-004 |
| [SR-XF-008](items/SR-XF-008.md) | NPC日程、自主选择与职责参数 | P1 | ready | in_progress | in_progress | SR-XF-002, SR-XF-003 |
| [SR-XF-009](items/SR-XF-009.md) | 有限供给链与配方产能表 | P0 | ready | in_progress | in_progress | SR-XF-002, SR-XF-004 |
| [SR-XF-010](items/SR-XF-010.md) | 位置库存、搬运与公私账本 | P0 | ready | in_progress | in_progress | SR-XF-002, SR-XF-003, SR-XF-009 |
| [SR-XF-029](items/SR-XF-029.md) | 统一操作流程、窄屏与人物触控 | P0 | ready | in_progress | in_progress | SR-XF-003, SR-XF-004, SR-XF-005, SR-XF-007 |
| [SR-XF-030](items/SR-XF-030.md) | 旧布局、装备、成长与篇章的完整迁移 | P0 | draft | in_progress | in_progress | SR-XF-002 |

## I2 · 装备成长与地方合作

| SR | 名称 | 优先级 | 设计 | 开发 | 验收 | 依赖 |
| --- | --- | --- | --- | --- | --- | --- |
| [SR-XF-011](items/SR-XF-011.md) | 有限交易、补货与地方订单 | P1 | ready | in_progress | in_progress | SR-XF-009, SR-XF-010, SR-XF-017 |
| [SR-XF-012](items/SR-XF-012.md) | 装备实例、维护、套装与获取目录 | P1 | draft | in_progress | in_progress | SR-XF-002, SR-XF-007, SR-XF-009, SR-XF-010 |
| [SR-XF-013](items/SR-XF-013.md) | 三路战斗动作、同行战术与敌人配置 | P1 | draft | in_progress | in_progress | SR-XF-002, SR-XF-003, SR-XF-007, SR-XF-012 |
| [SR-XF-014](items/SR-XF-014.md) | 学习、转修与炼气至筑基配置 | P1 | draft | in_progress | in_progress | SR-XF-002, SR-XF-009, SR-XF-012 |
| [SR-XF-015](items/SR-XF-015.md) | 本地旅行、路线与有限定位 | P1 | draft | in_progress | in_progress | SR-XF-002, SR-XF-003, SR-XF-010 |
| [SR-XF-016](items/SR-XF-016.md) | 前期七类地点实景与交互设计 | P1 | ready | implemented | in_progress | SR-XF-003, SR-XF-004, SR-XF-015 |
| [SR-XF-017](items/SR-XF-017.md) | 地方组织、重要NPC与产业内容卡 | P1 | ready | implemented | in_progress | SR-XF-001, SR-XF-002 |
| [SR-XF-018](items/SR-XF-018.md) | 雨后伤匠至唯一装备的完整事件链 | P1 | draft | in_progress | in_progress | SR-XF-011, SR-XF-012, SR-XF-013, SR-XF-014, SR-XF-016, SR-XF-017 |

## I3 · 活世界与救援

| SR | 名称 | 优先级 | 设计 | 开发 | 验收 | 依赖 |
| --- | --- | --- | --- | --- | --- | --- |
| [SR-XF-019](items/SR-XF-019.md) | 天气、作物、道路与生态恢复参数 | P1 | draft | in_progress | in_progress | SR-XF-002, SR-XF-003, SR-XF-009, SR-XF-015 |
| [SR-XF-020](items/SR-XF-020.md) | 消息传播、信念与三层社会评价 | P1 | ready | implemented | in_progress | SR-XF-002, SR-XF-017 |
| [SR-XF-021](items/SR-XF-021.md) | 调查、有限卜算与根链调度 | P1 | draft | in_progress | in_progress | SR-XF-015, SR-XF-017, SR-XF-020 |
| [SR-XF-022](items/SR-XF-022.md) | 持续危机、NPC自救与永久死亡后果 | P1 | ready | implemented | in_progress | SR-XF-002, SR-XF-013, SR-XF-015, SR-XF-020 |
| [SR-XF-023](items/SR-XF-023.md) | 暴雨、药商与独立失联药师全链 | P1 | draft | in_progress | in_progress | SR-XF-016, SR-XF-017, SR-XF-019, SR-XF-020, SR-XF-021, SR-XF-022 |

## I4 · 篇章与组织收束

| SR | 名称 | 优先级 | 设计 | 开发 | 验收 | 依赖 |
| --- | --- | --- | --- | --- | --- | --- |
| [SR-XF-024](items/SR-XF-024.md) | 母子篇缩尺暗线与反制恢复 | P2 | draft | in_progress | in_progress | SR-XF-012, SR-XF-014, SR-XF-021, SR-XF-022 |
| [SR-XF-025](items/SR-XF-025.md) | 固定三名责任人的复仇任务图与收束 | P1 | ready | implemented | in_progress | SR-XF-013, SR-XF-014, SR-XF-016, SR-XF-017, SR-XF-020, SR-XF-021 |
| [SR-XF-026](items/SR-XF-026.md) | 立派、任职、分峰与公开政策 | P1 | draft | in_progress | in_progress | SR-XF-008, SR-XF-009, SR-XF-010, SR-XF-014, SR-XF-020 |
| [SR-XF-027](items/SR-XF-027.md) | 共同禁忌、门规与悬赏处置细则 | P2 | draft | in_progress | in_progress | SR-XF-017, SR-XF-020, SR-XF-021, SR-XF-022 |
| [SR-XF-028](items/SR-XF-028.md) | 天道誓言与修真合约具体机制 | P2 | draft | in_progress | in_progress | SR-XF-002, SR-XF-017, SR-XF-020, SR-XF-027 |

## I5 · 平衡、设备与发布

| SR | 名称 | 优先级 | 设计 | 开发 | 验收 | 依赖 |
| --- | --- | --- | --- | --- | --- | --- |
| [SR-XF-031](items/SR-XF-031.md) | 统一平衡参数与首次体验节奏 | P1 | draft | in_progress | in_progress | SR-XF-009, SR-XF-013, SR-XF-014, SR-XF-019, SR-XF-022, SR-XF-026 |
| [SR-XF-032](items/SR-XF-032.md) | 完整前期集成、设备验收与发布关闭 | P1 | draft | in_progress | in_progress | SR-XF-006, SR-XF-008, SR-XF-010, SR-XF-011, SR-XF-012, SR-XF-013, SR-XF-014, SR-XF-015, SR-XF-016, SR-XF-017, SR-XF-018, SR-XF-019, SR-XF-020, SR-XF-021, SR-XF-022, SR-XF-023, SR-XF-024, SR-XF-025, SR-XF-026, SR-XF-027, SR-XF-028, SR-XF-029, SR-XF-030, SR-XF-031 |

## conditional · 条件范围

| SR | 名称 | 优先级 | 设计 | 开发 | 验收 | 依赖 |
| --- | --- | --- | --- | --- | --- | --- |
| [SR-XF-033](items/SR-XF-033.md) | 本命绑定的完整获取与解除闭环 | P3 | draft | in_progress | in_progress | SR-XF-012, SR-XF-014, SR-XF-028 |
| [SR-XF-034](items/SR-XF-034.md) | 可选对白AI的服务、预算与回退 | P3 | draft | in_progress | in_progress | SR-XF-002, SR-XF-020 |

## deferred · 远期暂存

| SR | 名称 | 优先级 | 设计 | 开发 | 验收 | 依赖 |
| --- | --- | --- | --- | --- | --- | --- |
| [SR-XF-035](items/SR-XF-035.md) | 青衡六宗、王朝与顶级世家人物谱 | P3 | draft | in_progress | in_progress | SR-XF-001 |
| [SR-XF-036](items/SR-XF-036.md) | 其他四洲地理、势力、族群与历史 | P3 | draft | in_progress | in_progress | SR-XF-001 |
| [SR-XF-037](items/SR-XF-037.md) | 敕封神道统一王朝的统治结构 | P3 | blocked | in_progress | blocked | SR-XF-001 |
| [SR-XF-038](items/SR-XF-038.md) | 高阶境界、道路对应与寿元资源 | P3 | ready | implemented | in_progress | SR-XF-001 |
| [SR-XF-039](items/SR-XF-039.md) | 跨洲交通、异界适应与仙界降临 | P3 | ready | implemented | in_progress | SR-XF-001 |
| [SR-XF-040](items/SR-XF-040.md) | 魂魄留存、化身损失与远期生命玩法 | P3 | draft | in_progress | in_progress | SR-XF-001 |

## 当前接续

SR-XF-001已完成需求管理及文档一致性验收。下一迭代按I1集中补齐共同契约、空间、预制件、自由营造、人物活动、生产物流、触控和迁移。设计输出与实现同SR跟踪，跨模块依赖不按文件独立完成判断。

远期或条件项不进入前期关键依赖；范围改变时登记决策与影响，再重新排期。
