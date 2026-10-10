# 门人系统 · 游戏界面原型图（2026-10-11）

这组图用于评看门人系统的画面和信息层级。人物、事件、资源与名额是连贯的内容示例；静态原型不改变正式游戏、门籍或存档。

各峰的收徒权限随峰别信息呈现；大人数分峰索引中的人数为排版示例，不构成游戏上限或阶段阈值。

## 原型图

| 图 | 画面重点 |
| --- | --- |
| [卷首与名册](overview.png) | 找人，先看此刻行动、身体与眼下阻碍 |
| [门籍事务](duties.png) | 入门、归峰、师承、职务、本人答应的差事 |
| [修行传承](cultivation.png) | 修为、已知适性、所习法门、授业机会与阻碍 |
| [人情纪事](relations.png) | 本人所述志向、已知关系、关键事件与来源 |
| [分峰名册](peaks.png) | 主峰与丹霞峰的门籍分组、丹房供给提示 |
| [大人数门人志](roster-large.png) | 以 138 人为排版例，先按峰定位，再找具体门人；可见身份、任职和待照应提示 |
| [山门求见](petition.png) | 求见者的已知信息、拟授身份、收录核对 |
| [iPad 横屏](ipad-landscape.png) | 双页卷册布局 |
| [iPad 竖屏](ipad-portrait.png) | 单页卷册布局 |

画面采用旧别院与分峰阶段现有绘画背景、人物肖像和导航素材。打开 `prototype.html?page=overview` 可在本地浏览这些卷页；主要展示尺寸为 1920×1080，另留 1194×834 与 834×1194 两张浏览器视口图。

## 空白卷册底图生成提示词

生成工具为内置 imagegen；成品保存在 `open-ledger.png`，其余中文文字由原型排版绘制。

> Use case: ui-mockup. Asset type: blank full-screen fantasy sect-management game's open character register overlay, to receive exact Chinese typography afterward. Create ONE front-facing, flat orthographic, 2D painted open ledger with two large, nearly rectangular blank parchment pages; each page should have generous uninterrupted pale warm-ivory writing area from near top to near bottom. Wide landscape composition, approximately 16:10. The book is physically plausible, bound along a narrow central spine, with thin dark aged-wood and worn black-leather outer edges, restrained antique bronze corner fittings and subtle green jade accents, in the visual language of high quality Chinese xianxia game UI. Fine ink-wash mountain and bamboo decoration only in the far margins, very low contrast. The open pages should occupy at least 85% of total width and 82% of total height. Designed to read clearly at 1920x1080 after overlaying text. Transparent background outside the book. No typography, no characters, no emblems, no buttons, no icons, no grids, no page division beyond the central book spine, no drop shadow extending far beyond the book.
