# Nature model sources

These models and embedded PBR textures originate from Poly Haven and are provided under [CC0](https://polyhaven.com/license).

- [pine_sapling_medium](https://polyhaven.com/a/pine_sapling_medium) → `pine.glb`; 56,387 triangles; grounded Y-up; dimensions [3.84898, 7.0292, 3.52826] metres.
- [rock_face_01](https://polyhaven.com/a/rock_face_01) → `rock-face.glb`; 5,999 triangles; grounded Y-up; dimensions [4.95138, 3.56651, 3.82587] metres.
- [boulder_01](https://polyhaven.com/a/boulder_01) → `boulder.glb`; 6,000 triangles; grounded Y-up; dimensions [1.27618, 1.00026, 1.82931] metres.

The preparation script retains an external source cache, verifies downloaded file checksums, selects one authored pine variant, reduces triangles per material, preserves source UVs and textures, and exports embedded GLB files. Pine foliage uses the official diffuse RGBA PNG byte-for-byte, with sRGB color and a 0.45 opacity cutoff. Exact output hashes and dimensions are in `manifest.json`.
