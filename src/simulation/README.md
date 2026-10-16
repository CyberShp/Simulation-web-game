# 共用游戏模拟

桌面山院和网页入口使用同一套世界规则。`ea-opening-sim.mjs` 提供初始化、公开命令与世界推进；`ea-state-v6.mjs`、`ea-persistence.mjs`、`ea-save-codec.mjs` 负责现有状态和存档边界；空间、人物、经济等继续按原模块划分。

此目录由当前应用的实际引用闭包迁入。身份、命令、世界时钟、随机结果与存档格式沿用现有实现。模块内部相对引用可以直接由 Node 和浏览器加载。

行为契约见 [运行时契约](../../docs/design/05-RUNTIME-CONTRACTS.md)，真实覆盖范围见 [当前状态](../../docs/design/STATUS.md)。
