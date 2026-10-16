# Issue #5 · 显式生产结算与数量守恒

2026-10-12；检查基点 `434c6cfef791ebdb547057b4d625bb5dfd0aca63`。
关联 SR-XF-009-AC-02/03、SR-XF-010-AC-01/02/03、SR-XF-030，及 05 的 TX-01 / SAVE-02 / MIG-01。本批是经济缺陷修复与局部回归，不改变整项 SR 的完成状态。

## 修复前后真实实验

Issue 原脚本在最新开局因传承待选而暂停。复现沿公开命令疗伤后增加 `chooseOpeningInheritance('qinglan')`，随后赠药、邀约、营造药田与林地、会见林长风；自世界步 542 开始完整运行 6000 游戏秒，到 60542。每 600 秒将食粮设为 2000、人物饱食度设为 100，与原实验一致，这是明确的营养边界夹具，不是正常玩家经营证明。

| 观察 | 修复前 | 修复后 |
| --- | --- | --- |
| 林地生产事实 | 16 笔 | 16 笔 |
| 包含异常灵石的生产事实 | 14 笔 | 0 笔 |
| 首笔毛产出 | 木 17.949600000000004，灵石 3.552713678800501e-15 | 木 17.9496，无灵石项 |
| 林地累计灵石 | 4.618527782440651e-14 | 0 |
| 公库最终灵石 | 0.20000000000001705 | 0.2 |
| 林地最终灵木 | 315.704312064 | 315.704312064 |
| 微量运输 | 原残差可创建 `work:transport:1` | 零库存请求 1e-14 灵石以库存不足拒绝，无工单 |

修复前终档在旧代码与新代码中均可完整恢复；新代码的恢复结果与输入 JSON 逐字节一致。历史数量与事实没有被重写。复现报告、日志和实验存档只留本次仓库外工作目录，不提交。

## 根因与数据流

`ea-society.production` 原本已经通过 `buildingYield`、贡献份额、首贡献技能和峰加成明确计算 `out`。它先将产物送入公库，再扣工资、加钱包，只返回成功标记。`settleFiniteProduction` 丢弃原 `out`，克隆试算后用公库差额与钱包增量反推毛产出。灵石工资的两次浮点抵消被 `Math.max(0, ...)` 当作物资产出，写进事实、现场库存和可接受运输数量。

另有两个守恒接缝：工资先扣公库再封顶钱包，超过钱包上限的款项丢失；运输允许 `source + 1e-9 >= cargo`，随后把负差截为零，可从零余额建立微量货物。

当前流程是配方公式 → 显式产出/工资 receipt → 隔离草稿中的个人效果 → 来源、容量、买方和工资资金校验 → 现场净产出/公库预算/钱包一次入账 → 版本化生产事实与工单绑定 → 正式运输预约、取料、交付/取消事实 → 保存恢复校验。

## 数量与事务契约

- 新计算的生产毛产出和工资需求采用 `resource-amounts:decimal-9:v1`，最小计算单位 0.000000001；在协作加成汇总后规范一次。17.145、13.8、315.704312064 等合法小数保留，零产出不写进事实。丹药计数继续按已有整数规则。
- 金额及物资加减从序列化十进制值转为 BigInt 运算，再返回既有 Number 字段；公库费用、生产输入、搬运及山外行囊使用同一数量工具。新工资优先由公库支付，差额由本次灵石产出支付；毛产出、净入库和实际钱包收款可逐笔核对。
- 工资只支付钱包可接收的金额。满钱包不扣款；最后 0.3 灵石可以支付到钱包 10000，公库严格归零。
- 产出直接进入现场货位；藏经阁研习预算留公库。生产不再往返公库，也不通过大公库余额相减计算小产出。
- 结算 callback 仅在隔离草稿执行一次。失败、返回 false、抛错或整批容量/来源不足不提交工资、成长、库存或事实。成功递归同步实际状态，保持调用方持有的人物、建筑、身体活动和工单对象引用。
- 商人的待取货行走预约是独立、合法的 pending 动作。预约成立但尚未到场时允许保存该行程，生产与工资仍等待；不将 pending 当作已完成产出。
- 运输严格检查实际余额，不用 epsilon 透支，不设置最小运输数量。数学总量恰好 40 的多种小数货物也能送入容量 40 的目标。生产来源及搬运不截断负余额来隐藏透支。
- 新版生产事实检查配方产出键、毛净量、工资来源合计、批次、目标位置和买方付款；完成工单须绑定同一结果。新版运输完成/取消须有匹配数量、目标和时刻的事实，坏分录或丢失事实拒绝恢复。
- 无新版标记的历史事实、库存和在途货物保留原契约。不能仅凭数量很小就判定为残渣或删除。旧档真实微量可送入零余额目标并原样恢复。现有字段仍是 Number，任意极小量合入极大余额的无限精度不在本次保证范围；本批未全局改为整数库存或静默清理旧残渣。

## 文件与验收

运行修改：`ea-resource-amounts.mjs`、`ea-society.mjs`、`ea-sr-economy.mjs`、`ea-state-v6.mjs`、`ea-data.mjs`、`ea-sr-world.mjs`。契约来源：05 的数值单位、事务/幂等和迁移保护，07 的位置库存、工资与物资守恒。本次固定精度是作者实施取值，不冒充用户逐项确认的平衡参数。

复验入口：

```bash
node --test tests/acceptance/ea-sr-production-accounting-acceptance.mjs
node --test tests/unit/web/ea-mountain-alchemy.test.mjs tests/unit/web/ea-mountain-valley.test.mjs tests/unit/web/ea-mountain-herb-crop.test.mjs tests/unit/web/ea-society.test.mjs tests/unit/web/ea-facility-v12.test.mjs tests/unit/web/ea-persistence.test.mjs tests/unit/web/ea-mountain-first-combat.test.mjs tests/unit/web/ea-system-ui-projection.test.mjs
node tests/acceptance/ea-sr-integration-acceptance.mjs --case 'normal fresh SR opening'
node --test tests/acceptance/ea-sr-009-pill-recipe-public-acceptance.mjs
python3 scripts/requirements/sr-manager.py refresh
python3 scripts/requirements/sr-manager.py validate
```

专属 12 项覆盖 6000 秒生产、合法小数/大公库、一次结算、失败原子回滚、满额/部分余额工资、事实篡改、幽灵运输拒绝、取消/交付、40 份边界、真实旧微量、旧炉批兼容和炼丹存读。正常公开开局接受与拒绝邀请两条链均通过，包括生产搬运和首次研习；正常丹炉配方公开链通过。当前广域 `tests/acceptance/ea-sr-economy-acceptance.mjs` 的首个旧夹具把 SR 经济挂入非 SR 世界，基点和修复后均被版本校验拒绝；此预先存在的夹具错误未宣称通过。该脚本的五处生产回调已适配显式 receipt，五个相关组件情景另行执行通过。

本批证据是自动化规则、公开命令和存档验证；没有将 Node 运行当作真人试玩、目标设备或美术验收。运行源码 `main` `850a7ea2178063684715ec2e46e625faf492bf40`，Pages `39a7225625046742bb4d5997dc15ad2c7b5d571b` 已同步；[构建与部署](https://github.com/CyberShp/Simulation-web-game/actions/runs/38197200144) completed/success。保留正式页和山院各自的原玩法，对现有运行模块分别应用本次修复；两套发布模块专项各12/12，243个发布文本blob与验收目录一致，22个公网入口、修复模块和构建清单均HTTP 200、SHA-256一致。Issue #5已完成并附实验记录。112/112 Node、公开开局2/2、丹炉1/1与经济组件5/5通过；字节和Node验证不表示浏览器视觉或目标设备试玩。
