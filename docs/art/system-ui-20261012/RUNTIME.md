# U-120 · 系统界面真实数据接入

日期：2026-10-12。范围：Godot 山院预览。用户认可的视觉来源见[原型说明](README.md)和[界面契约](UI-CONTRACT.md)。

## 本批实现

共同大窗口承接门人、功法、行囊、百艺、任务、山外、宗务七个常驻导航，另有掌门与存档入口。窗口沿用青玉云纹、分区卷册和原型的主要布局。页面读取唯一 JS 模拟的快照，实际操作通过正式命令结算，仍使用当前预览档与同一世界时钟。

| 页面 | 当前接入 |
| --- | --- |
| 门人 | 按真实人物 ID 打开名册／详情；搜索、峰属与状态筛选、排序、每页 6 人；来访者单列。修行、装备、身况、关系四页只显示可见事实。邀约显示命令结果；返回功法与名册保留人物及筛选。 |
| 掌门 | 真实肖像、身况、当前修习、兵刃／衣甲／法器／饰物四类实例槽；疗伤、休息、修炼沿现有命令。定位回到同一场景人物。 |
| 行囊 | 装备实例、随身与公库物资、当前位置／所有权／保管情况、换装与搬运事务；搜索、分类和整理次序为界面操作。 |
| 功法 | 沿现有可接触典籍、掌门研习、门人授业及修习事务，保留人物往返入口。 |
| 百艺／任务／山外／宗务 | 展示真实设施、当前目标、在外人物与院中事务／公库，并连接当前可用入口。完整配方工单和后续系统流程另批接入。 |

人物修习经公开学习视图投影；师承／峰属等关系只显示现有公开事实。工作候选使用轻量条件检查，能发出邀约时仍由正式命令判断通路、承诺及本人接受结果。装备槽与行囊使用同一装备实例 ID，换装可先进入预约再由世界步完成。物品所有权、存放位置及搬运分别沿现有规则处理。

共同窗口使用增量更新保留按钮节点，搜索输入保留焦点与选区，各滚动区通过 `data-scroll-key` 恢复位置。独立复核发现的任务目标更新延迟已修正，任务内容读取当前场景目标。构建时 CSS 与模块引用使用统一内容版本号；已实际导出并重载，91 个产物哈希核对一致。

## 源码与命令

以下路径相对仓库根目录。

| 文件 | 责任 |
| --- | --- |
| `godot/estate_3d/web/game-shell.html`、`system-ui.css`、`system-ui-helpers.mjs` | 共同窗口、导航、样式、真实肖像与图标。 |
| `godot/estate_3d/web/base-ui.mjs` | 页面控制、命令反馈、跨页人物／物品参数、增量更新、存读入口。 |
| `godot/estate_3d/web/system-people.mjs`、`system-people.css` | 门人名册、详情和掌门页面。 |
| `godot/estate_3d/web/system-inventory.mjs`、`system-inventory.css` | 行囊、装备和位置库存页面。 |
| `godot/estate_3d/web/game-ui.mjs`、`godot/estate_2d/estate.gd` | 山院剧情／营造与真实人物镜头定位。 |
| `dist/ea-godot-bridge.mjs`、`dist/ea-godot-host.mjs` | `systemPeople`／`inventory` 只读投影及正式命令派发。 |
| `dist/ea-society.mjs`、`dist/ea-sr-economy.mjs` | 公开学习视图、随身货位和搬运边界。 |
| `tools/build-estate-painted-web.py`、`tools/build-estate-web.py` | 随网页导出共同窗口及人物／行囊模块。 |

人物页调用 `masterAction('heal'|'rest'|'cultivate')`、`inviteWork(personId, instanceId)`；行囊调用 `equipItem`、`storeItem`、`masterPill`／`preparePillUse`、`startTransport`／`transferProperty`。UI 以命令回执和后续快照显示预约、前往、完成或拒绝。场景人物点击向页面传入同一 ID，定位通过 `focus_person` 返回场景。

本地构建：

```bash
python3 tools/build-estate-painted-web.py --output output/mountain-courtyard-preview/index.html
```

## 已验证范围

### 定向 Node 检查

```bash
node --test tests/ea-system-ui-projection.test.mjs tests/ea-mountain-herb-crop.test.mjs tests/ea-master-control.test.mjs
```

本批结果 **9／9**：

- `ea-system-ui-projection` 4 项：只读快照与真实换装过程／存读；公开学习与隐藏信息边界；门人工作邀约、种苗运输与存读；公库和随身库存守恒及非法数量拒绝。
- `ea-mountain-herb-crop` 1 项：首畦照料、播种、成长、收获与对应存读。
- `ea-master-control` 4 项：手动期、三十秒交接、重新接管和暂停／倍速／存读等现有控制契约。

人物模块另使用实际载入的 `qa/ea-reference-world.json`（掌门加 30 门人）检查五页名册、每页 6 人、按 ID 选人、搜索、功法往返保持筛选及只读存档不变。此项为模块检查，未据此记作大名册浏览器或目标设备验收。

### 本地浏览器操作

Chromium 1440×960，使用独立 QA 档：

1. 七个常驻导航逐一实点，页面标题对应；新档疗伤，灵草 22→16，进入包裹并取青岚卷。
2. 在行囊安排佩用青溪铁剑，观察预约状态，随后同一装备实例进入掌门真实兵刃槽。
3. 从公库 16 份灵草领 3 份到随身，实际为公库 13／随身 3；送回后公库恢复 16。
4. 保存并刷新，装备和 16 份灵草保持。
5. 经导入界面载入由正式命令生成的 QA 档：主殿已立、陆知微已入院、药圃有 2 份种苗。实际工作邀约返回 `accepted: true`，目标为真实 `building:yunxiu:2`。
6. 实点人物修行／装备／身况／关系四页；点击定位后关闭窗口并回到同一场景人物。

820×1180 实际将行囊滚动至取物操作，按钮完整处于窗口内，页面无横向溢出；同视口实点服丹。该服丹 QA 明确采用人工库存边界：掌门私有随身仓有 1 枚聚气丹，经 `validateSave` 通过后，从导入界面载入当前独立 QA 档。点击“服用一份”后，丹药 1→0、掌门修为 0→70。该证据覆盖现有使用结算，制丹与取得完整链待验。浏览器尺寸属于视口证据。

人物定位后点击院地继续实走四秒，Godot 本机短样本 60 FPS；后两秒位移 2.22／3.16 米、步态 8／9 次，移动停帧最长 0。最新本地刷新运行控制台 0 错误。此短样本记录本机行走回归范围。

### 投影耗时

30 人场景的快照投影在 Node 测量中由 33.69 毫秒降至 18.28 毫秒，记录范围仅为该环境中的投影耗时；网页帧率与目标设备性能另行实测。

## 接续与发布

目标真机及用户对接入后画面的评看仍待完成。百艺配方工单、丹药生产取得、任务／山外／宗务完整流程和 U-111 门籍规则分别按原设计接续。

运行源码 `main` `34a2b3ad2cb1f2c48cc17d417b0a7960d53c772c` 已同步；[公开山院试玩](https://cybershp.github.io/Simulation-web-game/mountain-courtyard/) 的 `gh-pages` 为 `607efe9ce9905c052cc1099ee84019f8f9bab993`，Pages 构建为 `built`。公开 Chromium 独立 QA 档实点掌门、行囊和门人，并将青溪铁剑实际佩入同一装备槽，控制台 0 错误。公开入口、清单及五个界面／规则模块共七个文件与本地导出字节一致。公开检查覆盖上述路径，完整长链沿本地证据。 当前追加 SR-XF-007/010/012/029/030 的局部实现与验证证据；完整 D/I/V/R、AC 和发布状态保持。过程截图、测试日志与 QA 存档留在本地输出目录。
