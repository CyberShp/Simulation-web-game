# 东台三院 · 一级素材与空间校准

2026-10-18。依据 U-167、[58号总图](../../design/58-GOLDEN-CORE-PRESET-BUILDINGS.md)与[61号规格](../../design/61-RESIDENTIAL-INTEGRATION.md)，GC-10、GC-11、GC-12 沿现东台向东接续。新画稿原点为全局画稿坐标 `(6688,0)`，尺寸为 1672×941。

## 本批素材

| 用途 | 当前文件 | 内容 |
| --- | --- | --- |
| 一级完工 | [complete-v2](../../../assets/courtyard/east-residences-complete-v2.png) | 三座封闭住居、门阶和院前铺地 |
| 共用地面 | [empty-v4](../../../assets/courtyard/east-residences-empty-v4.png) | 公共道路、三块最大预留平地和林缘 |
| 一级施工 | [construction-v1](../../../assets/courtyard/east-residences-construction-v1.png) | 开放木架、低石基、营造材料 |
| 东台接续 | [join-v3](../../../assets/courtyard/east-residences-join-v3.png) | 旧东台石阶旁平台至新图西侧竖路的土石通路 |

四张素材均使用内置 imagegen 制作；材质参考[东台 clean](../../../assets/courtyard/east-terrace-clean.png)与[原院母稿](../../../assets/courtyard/courtyard-master-v2.png)。实际提示词、参考文件与生成来源见 [prompts.json](prompts.json)。选定文件的 SHA-256 保存在[几何审计 JSON](candidate-audit-v2.json)。早期图与坐标研究按各自版本保留。

[独立布局模块](../../../apps/courtyard/courtyard-residences-layout.mjs)提供选定图、三址入口、站位面、完整建筑轮廓、阶段裁剪、道路、地面、接缝和投影函数。现场使用 empty-v4 作为公共底图，再按每址 `stagePatches.complete` 或 `stagePatches.construction` 叠加设施。阶段范围沿屋身、木架和铺地边缘收口，公共地面由底图提供。

## 素材锚点

| 建位 | 米制西北角 | 一级接地范围（图内像素） | 门前脚点 | 门洞净高 |
| --- | --- | --- | --- | --- |
| GC-11 | (162,40) | (218,309)–(602,382) | (418,386) | 119px |
| GC-12 | (174,40) | (921,309)–(1304,382) | (1118,386) | 119px |
| GC-10 | (168,60) | (550,710)–(999,779) | (779,788) | 123px |

门洞原始量测和边缘容差见 [asset-measurements-v2.json](asset-measurements-v2.json)与[量测叠图](asset-measurements-v2.png)。门洞量测容差约2像素，111像素人物的名义净高余量为8–12像素；实际人物比例由同机位实景继续核对。

一级为6×6米，最大预留为10×10米。后排共用路中心约 y478，前排约 y845，西侧竖路中心约 x75。空地层显露了完工时被前院屋顶遮挡的上横路。最大预留与道路的几何检查、逐层入口、反投影方法和适用边界详见[校准 v2 报告](candidate-review-v2.md)。

## 本批检查

已复算三处一级接地范围与入口、325个旧域委托样点、新域单调往返、2520个边界样点、三处最大地块间隔及接缝脚圈。旧域样点直接委托原投影；新域最大往返误差约5.69×10⁻¹⁴米。三块最大地面与公共道路没有几何交集。

已目视[全完工静态合成](stage-composite-complete-v3.png)、[全施工静态合成](stage-composite-construction-v3.png)、[混合静态合成](stage-composite-mixed-v3.png)及[接缝静态合成](join-composite-v3.png)。阶段图保留完整屋顶、木柱、石阶和门前铺地，背景连续性按阶段裁剪范围检查。

这些合成图和几何脚本属于素材校准证据。运行接入、正式寻路、人物遮挡、营造与存读结果由对应运行记录承担。二、三级住居及随占地移动的门阶仍需各级画稿。
