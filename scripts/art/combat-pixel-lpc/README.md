# LPC combat pixel sample

This offline tool builds the author-selected `shen-yan` and `shanxiao` complete-frame sample. It consumes only the immutable files in `sources.lock.json`; the author frame phases, hand anchors and environment assembly recipe are recorded in `recipe-v1.json`.

With Python 3.12 and Pillow, acquire the small source set once:

```sh
python3 fetch_sources.py --output /absolute/new/source-cache
```

Build into a new output directory; existing outputs are refused:

```sh
python3 pack_pixel_sample.py --source-root /absolute/new/source-cache --output /absolute/new/combat-pixel-v003
```

The package contains two character atlases, 40 manifests, `environment/manifest.json` and its atlas, review contact sheets, complete original source PNGs and credits under `sources/`, plus a human-readable `CREDITS.txt`. `pack-index.json` lists the actor manifests; runtime registry integration is separate.

Character cells retain original pixels and scale. A 64px body cell is placed at `[64,64]` on a 192px canvas. The original oversized192px sword slash is composited with its corresponding body frame and original front/back layer order. Move uses original8-frame walk at460ms; guard/dodge/hit/down reuse is explicit in every manifest. Down/hit have only the original front direction. Frame durations weight the renderer's formal phases and do not own combat time.

Character adapted artwork uses CC-BY-SA3.0 from the exact original per-file credits. Environment artwork uses OGA-BY3.0. Full author lists, upstream URLs, original licenses and adaptation notes accompany the package. Algorithm checks do not constitute visual acceptance.

Run the small synthetic mapping checks with:

```sh
python3 -m unittest -v test_pack_pixel_sample.py
```
