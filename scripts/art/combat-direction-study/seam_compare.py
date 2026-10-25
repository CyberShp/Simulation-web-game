#!/usr/bin/env python3
"""Compare original cycle boundary frames and one fixed-scale, whole-frame preview."""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--metadata', type=Path, required=True)
    parser.add_argument('--idle-frame', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--source-height', type=float, default=650)
    parser.add_argument('--root', type=float, nargs=2, default=[580, 825])
    args = parser.parse_args()
    if args.output.exists():
        raise FileExistsError('Existing evidence directory is protected: '+str(args.output))
    if args.source_height <= 0:
        raise ValueError('Fixed source height must be positive')
    metadata = json.loads(args.metadata.read_text())
    sources = {s['frameIndex']: (args.metadata.parent/s['file'], s) for s in metadata['samples']}
    groups = [(48, 66, 67)]
    required = sorted(set(range(48, 67)) | {i for group in groups for i in group})
    images = {}
    hashes = {}
    for index in required:
        path, sample = sources[index]
        hashes[str(path)] = sha(path)
        if hashes[str(path)] != sample['sha256']:
            raise ValueError('Original PNG hash differs: '+str(path))
        with Image.open(path) as image:
            if image.size != (940, 940) or image.mode != 'RGB':
                raise ValueError('Expected unmodified native 940x940 RGB frame')
            images[index] = image.copy()
    args.output.mkdir(parents=True, exist_ok=False)
    font = ImageFont.load_default(size=20)
    small = ImageFont.load_default(size=15)
    logical_scale = 58/args.source_height
    display_scale = 1536/880
    logical_size, anchor = (160, 140), (80, 100)
    inverse = 1/logical_scale

    def preview(image):
        logical = image.transform(logical_size, Image.Transform.AFFINE,
            (inverse, 0, args.root[0]-anchor[0]*inverse,
             0, inverse, args.root[1]-anchor[1]*inverse),
            resample=Image.Resampling.NEAREST, fillcolor=(238, 238, 238))
        return logical.transform((280, 245), Image.Transform.AFFINE,
            (1/display_scale, 0, 0, 0, 1/display_scale, 0),
            resample=Image.Resampling.NEAREST, fillcolor=(238, 238, 238))

    def label(index, role):
        return f'{role}: frame {index} / {sources[index][1]["actualTimestampSeconds"]:.3f}s'

    contact = Image.new('RGB', (1410, len(groups)*510), (238, 238, 238))
    game = Image.new('RGB', (900, len(groups)*300), (238, 238, 238))
    for row, group in enumerate(groups):
        native = Image.new('RGB', (2820, 992), (238, 238, 238))
        for col, index in enumerate(group):
            role = ['first', 'last', 'original next'][col]
            native.paste(images[index], (col*940, 52))
            ImageDraw.Draw(native).text((col*940+10, 12), label(index, role), font=font, fill=(25, 25, 25))
            thumb = images[index].resize((470, 470), Image.Resampling.LANCZOS)
            contact.paste(thumb, (col*470, row*510+40))
            ImageDraw.Draw(contact).text((col*470+7, row*510+10), label(index, role), font=small, fill=(25, 25, 25))
            game.paste(preview(images[index]), (col*300+10, row*300+40))
            ImageDraw.Draw(game).text((col*300+7, row*300+9), label(index, role), font=small, fill=(25, 25, 25))
        path = args.output/f'native-seam-{group[0]}-{group[1]}-{group[2]}.png'
        native.save(path)
        with Image.open(path) as readback:
            for col, index in enumerate(group):
                if ImageChops.difference(readback.crop((col*940,52,(col+1)*940,992)), images[index]).getbbox():
                    raise ValueError('Native side-by-side pixels changed')
    contact.save(args.output/'seam-contact-470.png')
    game.save(args.output/'game-size-comparison.png')
    transition_native = Image.new('RGB', (3760, 992), (238,238,238))
    transition_game = Image.new('RGB', (1200, 300), (238,238,238))
    for col, index in enumerate([66,48,66,67]):
        role = ['loop last','loop first','source last','source next'][col]
        transition_native.paste(images[index],(col*940,52))
        ImageDraw.Draw(transition_native).text((col*940+10,12),label(index,role),font=font,fill=(25,25,25))
        transition_game.paste(preview(images[index]),(col*300+10,40))
        ImageDraw.Draw(transition_game).text((col*300+7,10),label(index,role),font=small,fill=(25,25,25))
    transition_native.save(args.output/'transition-native-66-48-vs-66-67.png')
    transition_game.save(args.output/'transition-game-size.png')
    cycle = Image.new('RGB', (1500, 1200), (238, 238, 238))
    for number, index in enumerate(range(48, 67)):
        x, y = (number%5)*300, (number//5)*300
        cycle.paste(preview(images[index]), (x+10, y+40))
        ImageDraw.Draw(cycle).text((x+7, y+10), label(index, 'cycle'), font=small, fill=(25,25,25))
    cycle.save(args.output/'candidate-game-size-contact.png')
    # These bounds are read-only RGB contrast diagnostics, not a matte or scale source.
    def contrast_bounds(image):
        pixels = image.load(); xs=[]; ys=[]
        for y in range(880):
            for x in range(900):
                color = pixels[x,y]
                if max(color)-min(color)>18 or max(color)<140:
                    xs.append(x);ys.append(y)
        return [min(xs),min(ys),max(xs)+1,max(ys)+1]
    bounds = {str(i):contrast_bounds(images[i]) for i in range(48,67)}
    with Image.open(args.idle_frame) as idle:
        idle_bounds = contrast_bounds(idle.convert('RGB'))
    report = {
        'sourceVideoSha256':metadata['sourceSha256'], 'originalFrameHashes':hashes,
        'groups':[{'first':g[0],'last':g[1],'originalNext':g[2]} for g in groups],
        'authorCandidateCalibration':{'sourceHeight':args.source_height,'root':args.root,
            'status':'author-fixed-candidate-values-supplied-for-offline-review','targetHeightLogical':58,
            'logicalScale':logical_scale,'displayScale':display_scale,
            'theoreticalStandingBodyAt1536Width':58*display_scale,
            'logicalCanvas':list(logical_size),'logicalAnchor':list(anchor)},
        'contrastDiagnostic':{'method':'RGB chroma>18 or maximum channel<140 within x0..899/y0..879; excludes watermark region; not alpha or anatomical height',
            'idle0BoundsExclusive':idle_bounds,'cycleBoundsExclusive':bounds,
            'use':'read-only visible extent aid; never used to rescale or track feet'},
        'processing':'whole original frames, one fixed nearest logical scale and one shared display scale; source RGB background and vertical motion retained',
        'nativeReadbackPixelsEqual':True,
        'seamReview':'pending main-agent leg phase and joint motion assessment; no image similarity acceptance score'}
    (args.output/'measurements.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    if any(sha(Path(path))!=value for path,value in hashes.items()):
        raise ValueError('An input frame changed during comparison')
    (args.output/'checksums.json').write_text(json.dumps({p.name:sha(p) for p in sorted(args.output.iterdir()) if p.is_file()},indent=2)+'\n')
    print(json.dumps({'native':str(args.output/'native-seam-48-66-67.png'),
        'contact':str(args.output/'seam-contact-470.png'),'gameSize':str(args.output/'game-size-comparison.png'),
        'cycleGameSize':str(args.output/'candidate-game-size-contact.png'),
        'idleContrastBounds':idle_bounds,'cycleContrastBoundsUnion':[
            min(b[0] for b in bounds.values()),min(b[1] for b in bounds.values()),
            max(b[2] for b in bounds.values()),max(b[3] for b in bounds.values())]},ensure_ascii=False))


if __name__ == '__main__':
    main()
