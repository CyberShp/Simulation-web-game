# GC25 百工坊接续交接

2026-10-19。本文件只记录 GC25 面板链路的已交付部分与剩余步骤，供新会话直接接续；规则与验收口径仍以 58/68、STATUS 和需求台账为准。

## 已交付（远端 main `05d8b41`）

| 提交 | 内容 | 位置 |
| --- | --- | --- |
| `7953e5e` | 百工坊并入 `operations.workplaces` | `apps/courtyard/sect-sim.mjs` |
| `5707717` | 作业区显示现场物资 | `apps/courtyard/courtyard-panels.mjs` |
| `09cc91b` | 在制订单 `order` 进入 workplaces 投影 | `apps/courtyard/sect-sim.mjs` |
| `05d8b41` | 显示在制批次、加工进度、工单状态 | `apps/courtyard/courtyard-panels.mjs` |

验证：`courtyard-preset-sites` 5/5、`courtyard-west-workshops-domain` 4/4、`ea-west-valley-economy` 11/11、`npm run check` 通过。CI run `39151740353` 结论未取到。

本文件随后续提交 `feat(courtyard): start and cancel workshop production from the panel` 更新：作业区投影补 `recipe`（投料、产出、工时、技艺）、`missingCost`、`cancelable`；面板按缺料给出“送入”入口（公库→工位货位，实际搬运）与“中止本批生产”；新增 `cancel-production` 公开请求，转 `cancelProduction`，按进度退回未耗原料。验证 `courtyard-workplace-production` 2/2。作业区面板同时补齐“搬回”入口：现场货位逐项按统一搬运页搬回公库，伐木场、采石场与百工坊共用，仅呈现层改动。

## 剩余步骤

1. **开工/投料与取消**：已完成面板接线（见上）。待办只剩在正常档的 GC25 实机走一遍：送木石入坊、受邀工人到岗、商人取货付款。
2. **取消与存读验证**：请求层已验证途中取消与精确存读；仍需正常档两次关闭重开（完工前、完工后）与商人取货记录。
3. **五类专业工序**：已按 T-26 登记并实现委托、预留、到岗、结算与取消；`courtyard-workshop-processes` 2/2。剩余：正常档实机走一遍、专用台面（现共用一级两工位）与二三级工序。
4. **GC21/22/23**：药圃、育苗、供水的定义、锚点、工位与规则。

## 注意

- `ea-sr-spatial.mjs` 的 body-yield 改动归 Codex 候选，先协调再改该文件。
- 不动 174422 世界链；不生图；正式连续验收档单人推进。
- 面板相关改动需 `node --check` 与 `npm run check`，规则改动加定向测试。
