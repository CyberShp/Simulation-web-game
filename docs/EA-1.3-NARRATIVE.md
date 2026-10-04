# EA 1.3 主线叙事与现场交互

叙事层以已提交的游戏状态为依据。不会发放资源、招募人物、判定战斗胜负或推进主线；这些操作仍由现有 campaign command 完成。

## 已覆盖内容

| 已发生阶段 | 场景与承接 |
| --- | --- |
| 伤势痊愈 | 回忆父亲守门、母亲启阵，以生命掩护掌门出逃；保留天资与根骨 |
| 赠药与来客 | 陆知微因救亲与药理留下，林长风因安身与传承留下；不默认承诺复仇 |
| 整理藏书 | 商路账册、阵匠与遗址的来源，以及三取二交叉印证 |
| 取得证据 | 各自来源、能证明的事实与局限；证据不会随撤离、伤势或续档丢失 |
| 筑基与筹备 | 主角自主决定突破；粮药、营造、阵术与同道信用对应战局变化 |
| 解除山门与最终战 | 父亲阵图重新护人；韩厉川是直接责任者，现场明确清算目的 |
| 取回遗物 | 阵笔、药匣与族谱；明确旧案已收束，没有无尽幕后 |
| 两种结局 | 重建栖霞或回云岫；根据实际准备、行动方式与仍在院中的人物回应 |
| 战败与撤离 | 现有战果界面优先，叙事层提供疗伤与重试提示，不遮挡确认／撤退控制 |

## 接入接口

- `initNarrative(s, {legacy:false})`：新建世界。初始化阅读记录；序章仍归已有三幕开场。
- `initNarrative(s, {legacy:true})`：只对缺少阅读记录的旧世界初始化。把已发生结果标成已读，不补播历史、发奖或改写选择。已有记录保持原样。
- `validateNarrative(s)`：校验记录、重复 ID、幕次和事实前置。无阅读字段允许作为迁移输入。
- `narrativeForState(s)`：纯读 `{pending,chapter,clues,preparations,recovery,responses,archive}`。
- `sceneDialogue(s,id)`：取得已发生剧情的 `{id,title,scene,pages,cursor,acknowledged}`；未发生返回 null。每幕包含 speaker 与 text。
- `setNarrativePage(s,id,page)`：保存可续读幕次。只写阅读字段。
- `acknowledgeNarrative(s,id)`：确认已发生剧情；重复返回 false，不重复改变世界。
- `regionInteractions(s)`：真实探索交互点的位置、半径、类型与对白。choices 来源于 `explorationOptions`，每项包含成本、禁用原因和 `command/args`。距离不足保持禁用；途中与战斗中不产生交互。
- `homeInteractions(s)`：当前章节来客／手札以及实际建筑 ID；`advanceStory` 始终是唯一推进入口。
- `choiceResponses(s)`：依据已提交的准备、战斗领取记录、人物和结局返回回响。

## 阅读与存档

`story.narrative` 是可选向前兼容字段：

```json
{"version":1,"acknowledged":["chapter:1"],"cursor":{"id":"chapter:2","page":1}}
```

新档初始化使用 legacy false，载入缺字段的已有 v5 以及旧版迁移使用 legacy true。校验须调用 validateNarrative；模拟器应 re-export 公开接口。读取本身无需 tick。

自动剧情只在 intro 已读、阅读记录存在且无任何 combat 时出现。存在已保存 cursor 时优先续读，否则读取第一个未确认、已发生的永久剧情；章节、证据、准备、山门、胜利与结局依次查询。交互阅读使用已有模态暂停机制。上下幕调用 setNarrativePage；末幕调用 acknowledgeNarrative 后保存，随后再次查询 pending。

战败／撤离片段是现有 combat.result 的单幕补充，不自动弹出，不存可恢复幕次。acknowledgeCombat 可以正常移除临时战果对象；伤势存在时 recovery 继续提示正常疗伤路径。既有证据与准备均保持不变。

已读 archive 可人工回顾；回顾不调用推进或奖励命令。禁止把最终页确认与 advanceStory 绑定为一个隐式动作。现场对白选择可执行已有 resolveExploration，执行前以当前 campaign 条件重新验证；阅读对白不会提前结算。

## 独立验证

`node --test tests/ea-narrative.test.mjs` 9 项验证：投影无副作用、未来剧情拒绝、幕次续读、重复确认无奖励、旧世界不补播、新证据才入队、交互距离与权威费用、来客不因阅读招募、战败正常疗伤重试、两种真实通关结局回应。正常通关与战败使用 Player 公开命令，不直接写资源或主线结果。

`node --test tests/ea-narrative-ui.test.mjs` 8 项轻量事件回归：显式序章跳过、原生关闭序章、真实按钮参数展开、阅读幕次保存与恢复、未读片段关闭后不立即重弹、保存游标优先于更早被略过章节、只读回顾无命令、两个结局按钮与三幕回应。使用真实 createEAUI 事件处理及模板记录器，不替代浏览器版式或触控验收。结局按钮验证使用已保存完整 reference 派生的明确 UI 门槛夹具，不视为新增正常通关证据。
