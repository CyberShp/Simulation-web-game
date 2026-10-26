# 东路客院素材

U-167 / GC15 一级客院，沿已批准的东路靠山门方向接入。内置 `image_gen.imagegen` 以 `assets/courtyard/east-path-a.png` 为固定机位参考生成空台地、施工木架与封闭成品。原图继续保留，渲染以局部遮罩叠加，既有东路画面及其边缘保持。

正式素材为 `assets/courtyard/east-guesthouse-empty-v3.png`、`east-guesthouse-construction-v1.png`、`east-guesthouse-complete-v1.png`。每张图为 1672×941；哈希见 [provenance.json](provenance.json)。未采用的空台地一、二版保存在本批 QA 目录的 `art-iterations/`。

实测固定建位为世界 `(66,14)`、6×6 米；门底脚世界 `(69,20)` 对应本图像素 `(778.110,378.837)`，门外入口为 `(69,20.6)`。两客床室内脚点分别为 `(67.2,17)` 与 `(70.8,17)`。台地、石阶、屋外墙体按同一画面量测，定义在 `ea-guesthouse-geometry.mjs`；点选和遮挡在 `courtyard-guesthouse-layout.mjs`。

生成约束：保持 1672×941 原机位、像素密度、光照、道路与远山；空台地的平面覆盖像素 x600–980/y280–430，南缘约 y445。成品为单层两间客房，灰蓝瓦顶、木框与粉墙，封闭屋顶和墙面完整；门底脚对准 `(778,379)`。施工图只替换同一墙基内的房屋为石基、木柱和屋架，入口通道清楚。三图均无人物、文字和界面。

美术生成与实际游戏验证分别记录；开发与验收结果见 [71 客院接入](../../design/71-GUESTHOUSE-INTEGRATION.md)。
