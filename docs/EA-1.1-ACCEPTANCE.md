# EA 1.1 开发与验收记录

日期：2026-10-04。发布目标为 GitHub Pages 正式根入口，版本 1.1.0-ea，存档格式 v5。

## 本轮修改

用户追加的字体要求：本地嵌入马善政毛笔楷书，标题、导航与主操作采用苍劲书法笔锋；正文保留清楚的阅读字体。随包提供 SIL OFL 许可。

- 把云岫别院绘景、人物身份和正式经营核心接在同一入口，保留 10 组 35 个原型范围。
- 修复窄屏战斗相机：按掌门位置取景，保持角色可读、目的地与画面坐标一致。战斗时隐藏遮挡敌人的手机任务栏；增加行动反馈和暂停说明。
- 修复营造视图键盘行走被误切回观景模式的问题。
- 按用户要求统一藏卷、存档、导入、恢复、确认、设置、人物档案和指引弹窗：青玉标题栏、云岫印记、金线边框、纸卷底纹、统一按钮、输入、勾选、滑杆和下拉控件。窄屏保留 44px 控件与内部滚动，关闭按钮固定在标题栏。
- 弹窗显示后重置内容滚动，避免新档案继承先前的阅读位置；尚未启卷时隐藏无效的关闭按钮。
- 增加当前存档文本导出及保存失败后的显式内存继续。写入空间不足时保留旧主档与全部原始资料；用户可以保存当前进度的文本，不自动清理任何旧档。
- 发布脚本收集完整模块图并统一缓存参数。acceptance=qa-* 的验收档位、锁、偏好与正式档位隔离；验收试读通过公开导入校验界面，仅在验收模式使用，不写入本机。

## 验证结果

- `node --test tests/*.test.mjs`：189 / 189。覆盖 v1–v4 迁移、v5 校验、社会意愿、经济、故事、战斗、寻路、并发保存、备份损坏与空间不足。
- `node qa/ea-normal-play.mjs --reference`：1358 个公开玩家操作，22 次整档校验，55 游戏日；筑基、通关、正式立派、30 人、40 设施、双峰。没有直接改资源或进度旗标。
- `node qa/ea-ui-smoke.mjs`：6 个场景、48 个模板无异常、无非有限数值，渲染未改状态。这项只证明模板执行，视觉通过来自下列浏览器记录。
- 实际桌面浏览器：八系统、四阶段、九地域、带林长风同行的栖霞决战；青岚术真气消耗与命中、守御/闪避冷却、暂停后战斗恢复、沿退路撤回云岫；访客修缮消耗及结果。
- 实际存档操作：三个世界切换、v4 原文导入、坏 JSON 拒绝、恢复旧备份、双窗口锁阻止重复写入、请求接管使原窗口暂停只读。浏览器反复导入大型验收资料触发配额不足，保存未宣称成功且原主档可重新打开；显式内存继续可推进。
- 文本导出：从真实弹窗读回完整 EA envelope，并用正式校验器验证；30 人、40 设施、双峰均保留。文件导入使用系统文件选择器实际执行。
- 窄屏：320×568、390×844 的真实页面布局与操作；档位卡、系统抽屉、人物档案、导入预览/确认、设置与战斗。320 战斗 HUD 无横向溢出，敌人与技能按钮可见。

## 范围与边界

角色是固定身份的六种可复用 2.5D 外观；绘景道路与前景遮挡使用注册区域，不是完整 3D 模型或任意碰撞。
真实 iOS/Android 设备、锁屏/强退、移动浏览器下载和长期实机性能未测。云浏览器的文件下载事件未取得可读的下载路径，因此文件下载到磁盘的完整往返不标为通过；完整文本导出已实测可用。
已有六游戏小时的逻辑压力报告不能代表六小时真人或实机测试。经济平衡及前 30 分钟无指导试玩仍属后续产品验收。

## 原型逐项证据

| 原型 | 页面或场景 | 验收环境 | 证据 |
| --- | --- | --- | --- |
| 01 | 主界面与图标导航 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/01-main.jpg) |
| 02A | 掌门 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/02A-master.jpg) |
| 02B | 营造 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/02B-build.jpg) |
| 02C | 门人 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/02C-disciples.jpg) |
| 02D | 传承 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/02D-manuals.jpg) |
| 03A | 府库与生产 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/03A-inventory.jpg) |
| 03B | 炼丹 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/03B-alchemy.jpg) |
| 03C | 坊市与委托 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/03C-market.jpg) |
| 03D | 山门治理 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/03D-governance.jpg) |
| 04A | 分峰 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/04A-peaks.jpg) |
| 04B | 山外舆图与同行 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/04B-worldmap.jpg) |
| 04C | 纪事与线索 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/04C-journal.jpg) |
| 04D | 访客与事务 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/04D-visitors.jpg) |
| 05A | 门人档案与关系 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/05A-person.jpg) |
| 05B | 实时战斗 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/09B-battle-party.jpg) |
| 05C | 存档与恢复 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/05C-backups-redesign.jpg) |
| 05D | 设置与操作 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/05D-settings-redesign.jpg) |
| 06A | 结庐立足 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/06A-estate-initial.jpg) |
| 06B | 山院初成 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/06B-estate-grown.jpg) |
| 06C | 正式立派 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/06C-estate-founded.jpg) |
| 06D | 双峰承道 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/06D-estate-peaks.jpg) |
| 07A | 云岫山谷 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/07A-valley.jpg) |
| 07B | 青溪坊市 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/07B-market.jpg) |
| 07C | 石桥驿 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/07C-quarry.jpg) |
| 07D | 听雨遗址 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/07D-ruins.jpg) |
| 08A | 赤嶂偏牢 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/08A-prison.jpg) |
| 08B | 赤嶂粮道 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/08B-supply.jpg) |
| 08C | 栖霞外阵 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/08C-ward.jpg) |
| 08D | 南渡公议 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/08D-council.jpg) |
| 09A | 栖霞旧山门 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/09A-qixia.jpg) |
| 09B | 灵脉决战 | 桌面 | [截图](../qa/acceptance-1.1/screenshots/09B-battle-party.jpg) |
| 10A | 手机主场景 | 窄屏模拟 | [截图](../qa/acceptance-1.1/screenshots/10A-mobile-main.jpg) |
| 10B | 手机系统抽屉 | 窄屏模拟 | [截图](../qa/acceptance-1.1/screenshots/10B-mobile-drawer-final.jpg) |
| 10C | 手机门人详情 | 窄屏模拟 | [截图](../qa/acceptance-1.1/screenshots/10C-mobile-person-final.jpg) |
| 10D | 手机战斗 | 窄屏模拟 | [截图](../qa/acceptance-1.1/screenshots/10D-mobile-320-final.jpg) |

浏览器状态、时间与图片索引见 `qa/acceptance-1.1/browser-observations.json`；UI 重新截图已排除导入弹窗过渡帧。浏览器导出的验收存档为 `qa/acceptance-1.1/browser-export.json`。

## 正式上线复验

正式根入口已显示 1.1.0-ea，缓存图使用 ea-110-release-20261004-r2。原正式世界只读取列表，所有操作均在 qa-* 档位或内存验收中进行。
毛笔楷书由本地 WOFF2 加载；桌面藏卷、设置、主界面及 390 像素人物弹窗已复核，字体加载检查通过。关闭后再打开人物弹窗，内容滚动位置为 0；1.2 倍大字设置无横向溢出。320 战斗最终复验：HUD clientWidth 与 scrollWidth 均为 302px；五个操作按钮高度均为 44px，技能名及冷却为紧凑换行。各系统 h2–h5 标题均使用毛笔字体。线上检查细节见 qa/acceptance-1.1/release-verification.json。
最终字体截图为 qa/acceptance-1.1/screenshots/release-*.jpg。原型逐项截图记录功能与布局；字体追加修改的实际效果以这些发布截图为准。
