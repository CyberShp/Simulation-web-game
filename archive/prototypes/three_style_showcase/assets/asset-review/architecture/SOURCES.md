# 主殿建筑资产来源

建筑、石桥和石灯由 `blender/build_asset_architecture.py` 制作，可编辑源文件为 `architecture.blend`。主殿形体依据 `docs/art/asset-review-20261013/main-hall-design.png`，采用统一七开间、左右对称柱网及四面闭合外观。

以下 2K 扫描材质来自 Poly Haven，作者均为 Rob Tuytel，按 [CC0 许可](https://polyhaven.com/license)使用。颜色、OpenGL 法线与 AO／粗糙度／金属度贴图下载地址、字节数和 SHA-256 见 [textures/sources.json](textures/sources.json)。

| 材质 | 资产来源 | 用途 |
| --- | --- | --- |
| 木纹 | [Fine Grained Wood](https://polyhaven.com/a/fine_grained_wood) | 梁柱、格扇、木栏 |
| 灰瓦 | [Grey Roof 01](https://polyhaven.com/a/grey_roof_01) | 独立瓦片表面 |
| 石材 | [Rock 01](https://polyhaven.com/a/rock_01) | 石台、台阶、石栏、桥与灯的灰石表面 |
| 灰泥 | [Grey Plaster](https://polyhaven.com/a/grey_plaster) | 建筑封闭墙面 |

GLB 内嵌实际渲染所需贴图。Blender 工程保留分件、UV、扫描贴图和可编辑材质；四个 GLB 分别按材质组织运行网格。
