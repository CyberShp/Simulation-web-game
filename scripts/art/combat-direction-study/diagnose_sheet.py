#!/usr/bin/env python3
"""Inspect original sheet alpha and emit a raw-cell viewer without sprite packing."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import shutil

from PIL import Image


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--columns", type=int, default=4)
    parser.add_argument("--rows", type=int, default=2)
    parser.add_argument("--gif", action="store_true", help="Opaque white diagnostic GIF at 100ms per raw cell")
    args = parser.parse_args()
    raw = args.source.read_bytes()
    image = Image.open(args.source).convert("RGBA")
    if image.width % args.columns or image.height % args.rows:
        raise ValueError("Sheet dimensions do not divide into the supplied grid")
    args.output.mkdir(parents=True, exist_ok=False)
    shutil.copyfile(args.source, args.output / "original-sheet.png")
    tile = [image.width // args.columns, image.height // args.rows]
    histogram = image.getchannel("A").histogram()
    bins = [(0, 0), (1, 7), (8, 31), (32, 63), (64, 127), (128, 191), (192, 253), (254, 254), (255, 255)]
    report = {"scope": "raw sheet alpha and diagnostic cell playback only", "artReview": "not-approved",
              "source": str(args.source.resolve()), "sourceSha256": hashlib.sha256(raw).hexdigest(),
              "size": list(image.size), "tile": tile, "columns": args.columns, "rows": args.rows,
              "pixelOperations": "none on source; browser draws original cell rectangles",
              "frameOrder": "left-to-right then top-to-bottom; author phase mapping not supplied",
              "timing": "interactive diagnostic interval, not authored or runtime timing",
              "alphaRange": list(image.getchannel("A").getextrema()),
              "alphaBins": {f"{lo}..{hi}": sum(histogram[lo:hi + 1]) for lo, hi in bins}, "cells": []}
    white_sheet = Image.new("RGBA", image.size, "white")
    white_sheet.alpha_composite(image)
    white_sheet.convert("RGB").save(args.output / "contact-sheet-white.png")
    gif_frames = []
    for index in range(args.columns * args.rows):
        x, y = index % args.columns * tile[0], index // args.columns * tile[1]
        cell = image.crop((x, y, x + tile[0], y + tile[1]))
        alpha = cell.getchannel("A")
        hist = alpha.histogram()
        bounds = {str(t): list(box) if (box := alpha.point(lambda v: 255 if v >= t else 0).getbbox()) else None
                  for t in [1, 8, 32, 128, 255]}
        borders = [cell.getpixel((xx, yy))[3] for xx in range(tile[0]) for yy in (0, tile[1] - 1)]
        borders += [cell.getpixel((xx, yy))[3] for yy in range(1, tile[1] - 1) for xx in (0, tile[0] - 1)]
        report["cells"].append({"index": index, "sourceRect": [x, y, *tile], "boundsExclusive": bounds,
                                "alpha8to191": sum(hist[8:192]), "borderPixelsAlphaGE8": sum(v >= 8 for v in borders)})
        if args.gif:
            white = Image.new("RGBA", cell.size, "white")
            white.alpha_composite(cell)
            gif_frames.append(white.convert("RGB").quantize(colors=256))
    if args.gif:
        gif_frames[0].save(args.output / "diagnostic-100ms.gif", save_all=True, append_images=gif_frames[1:],
                           duration=100, loop=0, optimize=False, disposal=2)
        report["gif"] = {"file": "diagnostic-100ms.gif", "intervalMs": 100,
                         "scope": "raw cell diagnostic timing only; not an authored stride or runtime cadence",
                         "background": "white", "paletteLimit": 256}
    metadata = json.dumps({"report": report, "image": "data:image/png;base64," + base64.b64encode(raw).decode()}).replace("<", "\\u003c")
    html = r'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>原始跑步帧诊断</title>
<style>body{margin:24px;font:15px system-ui;background:#222;color:#eee}button,input,select{font:inherit;margin:5px;padding:5px}canvas{image-rendering:pixelated;max-width:none}.checker{background:conic-gradient(#bbb 25%,#eee 0 50%,#bbb 0 75%,#eee 0) 0 0/16px 16px}.white{background:white}.black{background:black}pre{white-space:pre-wrap}#stage{overflow:auto;max-height:75vh;border:1px solid #777}</style>
<h1>原始跑步帧诊断</h1><p>直接绘制原图RGBA，未抠背景、未修腿、未设脚点、未生成动作包。4×2格仅作原始顺序诊断，跨格像素和人体阶段由美术复核。</p>
<button id="prev">上一格</button><button id="play">播放</button><button id="next">下一格</button>
<label>格<select id="frame"></select></label><label>间隔ms<input id="interval" type="number" min="30" max="1000" value="100"></label>
<label>显示<select id="mode"><option value="cell">单格</option><option value="sheet">整图</option></select></label>
<label>缩放<select id="zoom"><option value="1">1×</option><option value="2">2×nearest</option></select></label>
<label>背景<select id="background"><option value="checker">棋盘格</option><option value="white">白色</option><option value="black">黑色</option></select></label>
<pre id="readout"></pre><div id="stage"><canvas id="canvas" class="checker"></canvas></div><pre id="source"></pre>
<script>const data=@@DATA@@,r=data.report,$=id=>document.getElementById(id),image=new Image();let index=0,playing=false,last=0;
for(let i=0;i<r.cells.length;i++){let o=document.createElement('option');o.value=i;o.textContent=i;$('frame').append(o)}
function render(){const full=$('mode').value==='sheet',canvas=$('canvas'),ctx=canvas.getContext('2d'),rect=full?[0,0,...r.size]:r.cells[index].sourceRect;canvas.width=rect[2];canvas.height=rect[3];canvas.style.width=rect[2]*Number($('zoom').value)+'px';canvas.style.height=rect[3]*Number($('zoom').value)+'px';canvas.className=$('background').value;ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,...rect,0,0,rect[2],rect[3]);$('frame').value=index;$('readout').textContent=JSON.stringify({cell:index,sourceRect:rect,alpha:r.cells[index],intervalKind:r.timing},null,2)}
function stop(){playing=false;$('play').textContent='播放';last=0}function step(n){stop();index=(index+n+r.cells.length)%r.cells.length;render()}
$('prev').onclick=()=>step(-1);$('next').onclick=()=>step(1);$('play').onclick=()=>{playing=!playing;last=0;$('play').textContent=playing?'暂停':'播放'};
$('frame').onchange=()=>{stop();index=Number($('frame').value);render()};for(const id of ['mode','zoom','background'])$(id).onchange=render;
function loop(now){if(playing){const interval=Math.max(30,Math.min(1000,Number($('interval').value)||100));if(!last)last=now;if(now-last>=interval){index=(index+1)%r.cells.length;last=now;render()}}requestAnimationFrame(loop)}
image.onload=()=>{render();requestAnimationFrame(loop)};image.src=data.image;$('source').textContent=r.source+'\nSHA256 '+r.sourceSha256+'\n'+JSON.stringify(r.alphaBins,null,2);</script></html>'''.replace("@@DATA@@", metadata)
    (args.output / "index.html").write_text(html, encoding="utf-8")
    (args.output / "alpha-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.source.read_bytes() != raw or (args.output / "original-sheet.png").read_bytes() != raw:
        raise ValueError("Original source bytes changed")
    print(json.dumps({"page": str((args.output / "index.html").resolve()), "report": str((args.output / "alpha-report.json").resolve()),
                      "sourceUnchanged": True, "sourceByteCopyExact": True}, ensure_ascii=False))


if __name__ == "__main__":
    main()
