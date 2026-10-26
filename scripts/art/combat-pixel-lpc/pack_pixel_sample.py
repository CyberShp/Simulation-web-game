#!/usr/bin/env python3
"""Build the approved LPC pixel sample using whole-frame source layers only."""
import argparse
import csv
import hashlib
import json
import math
from pathlib import Path
import shutil
from PIL import Image, ImageDraw

UNIVERSAL = '95c338c84d55cd3e6790d9eddfa3e22c5a0fb91f'
REVISED = 'f07f7f5892e67c932c68f70bb04472f2c64e46bc'
DIRECTIONS = {'up': 0, 'left': 1, 'down': 2, 'right': 3}
RECIPE = json.loads(Path(__file__).with_name('recipe-v1.json').read_text(encoding='utf8'))
FOOT = RECIPE['foot']
HAND = RECIPE['handBySourceColumn']
ACTOR_LAYERS = {
    'shen-yan': ['body/bodies/male/light.png', 'feet/shoes/male/black.png',
                 'legs/pants/male/white.png', 'torso/clothes/longsleeve/longsleeve/male/teal.png',
                 'head/heads/human/male/light.png', 'hair/long/male/black.png'],
    'shanxiao': ['body/bodies/male/green.png', 'legs/pants/male/brown.png',
                'head/heads/orc/male/green.png'],
}
SWORD = {
    'front': 'weapon/sword/longsword/longsword.png',
    'back': 'weapon/sword/longsword/universal_behind/longsword.png',
    'slashFront': 'weapon/sword/longsword/attack_slash/longsword.png',
    'slashBack': 'weapon/sword/longsword/attack_slash/behind/longsword.png',
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('x', encoding='utf8') as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write('\n')


def crop_cell(image, column, row, size):
    x, y = column * size, row * size
    if min(column, row) < 0 or x + size > image.width or y + size > image.height:
        raise ValueError(f'Source cell outside image: {column},{row}/{size}/{image.size}')
    return image.crop((x, y, x + size, y + size))


def compose_cell(layers, column, row, sword=None, direction_index=0):
    """All actor layers use original 64px cells; sword slash uses original192px cells."""
    frame = Image.new('RGBA', (192, 192))
    if sword and row in range(12, 16):
        frame.alpha_composite(crop_cell(sword['slashBack'], column, direction_index, 192))
    elif sword:
        frame.alpha_composite(crop_cell(sword['back'], column, row, 64), (64, 64))
    for layer in layers:
        frame.alpha_composite(crop_cell(layer, column, row, 64), (64, 64))
    if sword and row in range(12, 16):
        frame.alpha_composite(crop_cell(sword['slashFront'], column, direction_index, 192))
    elif sword:
        frame.alpha_composite(crop_cell(sword['front'], column, row, 64), (64, 64))
    return frame


def action_frames(action, direction):
    d = DIRECTIONS[direction]
    if action == 'idle': return [(8 + d, 0, 'idle', 1000)]
    if action == 'move': return [(8 + d, i, 'move', RECIPE['movePeriodMs'] / 8) for i in range(1, 9)]
    if action == 'attack':
        return [(12 + d, i, phase, 80) for i, phase in zip(RECIPE['actions'][action]['columns'], RECIPE['actions'][action]['phases'])]
    if action == 'spell':
        return [(d, i, phase, 100) for i, phase in zip(RECIPE['actions'][action]['columns'], RECIPE['actions'][action]['phases'])]
    if action == 'guard':
        return [(d, i, phase, 100) for i, phase in zip(RECIPE['actions'][action]['spellColumns'], RECIPE['actions'][action]['phases'])]
    if action == 'dodge':
        spec = RECIPE['actions'][action]
        return [(8 + d, i, phase, duration) for i, phase, duration in zip(spec['walkColumns'], spec['phases'], spec['durationMs'])]
    if action == 'hit': return [(20, i, 'hit', 100) for i in RECIPE['actions'][action]['columns']]
    if action == 'down': return [(20, i, 'down', 120) for i in RECIPE['actions'][action]['columns']]
    raise ValueError('Unknown action ' + action)


def review_contact(path, images, labels, columns=8, scale=1):
    step, label_h = 192 * scale, 20
    out = Image.new('RGBA', (columns * step, math.ceil(len(images) / columns) * (step + label_h)), '#292e37')
    draw = ImageDraw.Draw(out)
    for i, (im, label) in enumerate(zip(images, labels)):
        x, y = i % columns * step, i // columns * (step + label_h)
        draw.text((x + 3, y + 2), label, fill='white')
        if scale != 1: im = im.resize((step, step), Image.Resampling.NEAREST)
        out.alpha_composite(im, (x, y + label_h))
    out.save(path)


def pack_actor(identity, images, output):
    height = RECIPE['sourceHeights'][identity]
    actions = ['idle', 'move', 'attack', 'spell', 'guard', 'dodge', 'hit', 'down'] if identity == 'shen-yan' else ['idle', 'move', 'attack', 'hit', 'down']
    clips, frames, labels, manifests = [], [], [], []
    layers = [images[p] for p in ACTOR_LAYERS[identity]]
    sword = {k: images[v] for k, v in SWORD.items()} if identity == 'shen-yan' else None
    for action in actions:
        for direction in (['down'] if action in ['hit', 'down'] else DIRECTIONS):
            records, clip_images, dodge_slots = [], [], {}
            for index, (row, column, phase, duration) in enumerate(action_frames(action, direction)):
                im = compose_cell(layers, column, row, sword, DIRECTIONS[direction])
                # Dodge phase entries reuse the existing two complete source crops.
                global_index = dodge_slots.get(column) if action == 'dodge' else None
                if global_index is None:
                    global_index = len(frames)
                    frames.append(im); labels.append(f'{action}/{direction}/{index} src{row},{column}')
                    if action == 'dodge': dodge_slots[column] = global_index
                record = {'index': index, 'x': global_index % 12 * 192, 'y': global_index // 12 * 192,
                          'w': 192, 'h': 192, 'durationMs': duration, 'phase': phase,
                          'sourceFrame': {'row': row, 'column': column, 'cellSize': 64},
                          'pixelBounds': list(im.getbbox()) if im.getbbox() else None}
                if identity == 'shen-yan' and action in ['spell', 'guard'] and str(column) in HAND[direction]:
                    record['anchors'] = {'hand': HAND[direction][str(column)]}
                records.append(record); clip_images.append(im)
            path = f'{identity}/{action}-{direction}/manifest.json'
            reuse = {'move': 'Original walk columns1..8 played in460ms; brisk walk source.',
                     'dodge': 'Original walk columns4/5/5/5 map to windup/release/recovery/evade; repeated entries reuse the same complete crop; terminal hold.',
                     'guard': 'Original spell columns1,2,3,4,6,3; terminal guard hold.',
                     'hit': 'Original front hurt column1; single light reaction.',
                     'down': 'Original front hurt columns2..5; terminal hold.'}.get(action)
            manifest = {'schema': 'combat-frame-atlas/v1', 'id': f'pixel-v1-{identity}-{action}-{direction}',
                        'visualIdentity': identity, 'action': action, 'direction': direction,
                        'atlas': '../atlas.png', 'frameSize': [192, 192], 'sourceHeight': height, 'foot': FOOT,
                        'durationMs': sum(f['durationMs'] for f in records),
                        'loop': action in ['idle', 'move'], 'holdLast': action in ['guard', 'down', 'dodge'],
                        'directionalFallback': action in ['hit', 'down'], 'frames': records,
                        'source': {'repository': 'LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator',
                                   'commit': UNIVERSAL, 'selectedLicense': 'CC-BY-SA-3.0',
                                   'bodyOffset': [64, 64], 'wholeFrameOnly': True,
                                   'reuse': reuse, 'timingAuthority': 'Runtime combat phases; frame durations are phase weights.'}}
            dump(output / path, manifest); clips.append({'manifest': path}); manifests.append(manifest)
            review_contact(output / identity / (action + '-' + direction) / 'contact.png', clip_images,
                           [f'{action} {direction} {i}' for i in range(len(clip_images))], len(clip_images), 2)
    atlas = Image.new('RGBA', (12 * 192, math.ceil(len(frames) / 12) * 192))
    for i, frame in enumerate(frames): atlas.alpha_composite(frame, (i % 12 * 192, i // 12 * 192))
    atlas.save(output / identity / 'atlas.png')
    review_contact(output / 'review' / (identity + '-all-contact.png'), frames, labels)
    return clips, manifests


def environment(source, output):
    folder = output / 'environment'; folder.mkdir()
    recipes = [('grass', 'Terrain/terrain_summer.png', [128, 32, 32, 32], [0, 0], 4),
               ('pine', 'Terrain/trees_summer.png', [128, 384, 96, 128], [48, 110], 1)]
    result = {}
    for name, path, rect, foot, repeats in recipes:
        im = Image.open(source / path).convert('RGBA'); x, y, w, h = rect
        if x + w > im.width or y + h > im.height: raise ValueError('Environment crop out of bounds: ' + name)
        tile = im.crop((x, y, x + w, y + h))
        final = Image.new('RGBA', (w * repeats, h * repeats))
        for a in range(repeats):
            for b in range(repeats): final.alpha_composite(tile, (a * w, b * h))
        final.save(folder / (name + '.png'))
        result[name] = {'file': name + '.png', 'source': path, 'crop': rect, 'repeat': repeats,
                        'size': list(final.size), 'foot': foot,
                        'alphaCounts': {str(value): count for count, value in final.getchannel('A').getcolors(256)}}
    flowers = Image.open(source / 'Terrain/flowers.png').convert('RGBA').crop((96, 0, 128, 32))
    herbs = Image.new('RGBA', (128, 64))
    for position in RECIPE['environment']['herbs']['placements']: herbs.alpha_composite(flowers, tuple(position))
    herbs.save(folder / 'herbs.png')
    result['herbs'] = {'file': 'herbs.png', 'source': 'Terrain/flowers.png', 'crop': [96, 0, 32, 32],
                       'placements': RECIPE['environment']['herbs']['placements'], 'size': [128, 64], 'foot': [64, 58]}
    original = Image.open(source / 'Structure/Bridges/Wood Bridge A - No Rails.png').convert('RGBA').crop((0, 0, 128, 80))
    bridge = Image.new('RGBA', (224, 80)); bridge.alpha_composite(original.crop((0, 0, 32, 80)), (0, 0))
    for column in range(5): bridge.alpha_composite(original.crop((32, 0, 64, 80)), (32 + column * 32, 0))
    bridge.alpha_composite(original.crop((96, 0, 128, 80)), (192, 0)); bridge.save(folder / 'bridge.png')
    result['bridge'] = {'file': 'bridge.png', 'source': 'Structure/Bridges/Wood Bridge A - No Rails.png',
                        'crop': [0, 0, 128, 80], 'middleColumnRepeat': 5, 'size': [224, 80], 'foot': [112, 80]}
    cliff = Image.open(source / 'Terrain/cliff_summer.png').convert('RGBA'); cave = Image.new('RGBA', (192, 64))
    wall = cliff.crop((320, 288, 352, 352))
    for column in range(6): cave.alpha_composite(wall, (column * 32, 0))
    cave.alpha_composite(cliff.crop((224, 288, 320, 352)), (48, 0)); cave.save(folder / 'cave.png')
    result['cave'] = {'file': 'cave.png', 'source': 'Terrain/cliff_summer.png', 'wallCrop': [320, 288, 32, 64],
                      'wallRepeat': 6, 'openingCrop': [224, 288, 96, 64], 'openingOffset': [48, 0],
                      'size': [192, 64], 'foot': [96, 64]}
    shutil.copyfile(source / 'Terrain/Rocks, Grasslands.png', folder / 'rocks-source.png')
    result['rocks'] = {'file': 'rocks-source.png', 'source': 'Terrain/Rocks, Grasslands.png', 'crop': None,
                       'size': [192, 384], 'foot': None, 'usage': 'Original reference sheet; root selects a rock crop.'}
    atlas = Image.new('RGBA', (512, 768)); x = y = row_height = 0
    for name, record in result.items():
        im = Image.open(folder / record['file']).convert('RGBA')
        if x + im.width > atlas.width: y += row_height; x = row_height = 0
        atlas.alpha_composite(im, (x, y)); record['sourceRect'] = [x, y, im.width, im.height]
        x += im.width; row_height = max(row_height, im.height)
    atlas.crop((0, 0, 512, y + row_height)).save(folder / 'atlas.png')
    review = Image.new('RGBA', (1536, 840), '#292e37'); draw = ImageDraw.Draw(review)
    for i, (name, record) in enumerate(result.items()):
        im = Image.open(folder / record['file']).convert('RGBA'); col, row = i % 3, i // 3
        x, y = col * 512 + 5, row * 420 + 20; scale = 1 if name == 'rocks' else 2
        draw.text((x, y - 17), name + ' foot=' + str(record.get('foot')), fill='white')
        review.alpha_composite(im.resize((im.width * scale, im.height * scale), Image.Resampling.NEAREST), (x, y))
    review.save(output / 'review/environment-contact.png')
    dump(folder / 'manifest.json', {'schema': 'combat-pixel-environment/v1', 'commit': REVISED,
                                  'license': 'OGA-BY-3.0', 'atlas': 'atlas.png', 'assets': result})
    return result


def spell_reference(output, manifests):
    frames, labels = [], []
    atlas = Image.open(output / 'shen-yan/atlas.png').convert('RGBA')
    for m in manifests:
        if m['action'] != 'spell': continue
        for f in m['frames']:
            if f['phase'] != 'release': continue
            im = atlas.crop((f['x'], f['y'], f['x'] + 192, f['y'] + 192))
            draw = ImageDraw.Draw(im)
            for x in range(0, 192, 16): draw.line((x, 0, x, 191), fill=(130, 130, 130, 90))
            for y in range(0, 192, 16): draw.line((0, y, 191, y), fill=(130, 130, 130, 90))
            x, y = f['anchors']['hand']; draw.line((x - 5, y, x + 5, y), fill='cyan'); draw.line((x, y - 5, x, y + 5), fill='cyan')
            x, y = FOOT; draw.line((x - 4, y, x + 4, y), fill='red'); draw.line((x, y - 4, x, y + 4), fill='red')
            frames.append(im); labels.append(f"{m['direction']} srcCol{f['sourceFrame']['column']} hand{f['anchors']['hand']}")
    review_contact(output / 'review/spell-release-anchors-2x.png', frames, labels, 2, 2)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source-root', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    a = p.parse_args(); root = a.source_root.resolve(); output = a.output.resolve()
    if output.exists(): p.error('Output must be a new version directory')
    classic = root / 'classic/files'; revised = root / 'revised/files'
    names = set(sum(ACTOR_LAYERS.values(), []) + list(SWORD.values()))
    inputs = [classic / 'spritesheets' / name for name in sorted(names)]
    inputs += [classic / name for name in ['CREDITS.csv', 'CREDITS.TXT', 'LICENSE', 'README.md', 'sources/custom-animations.js', 'sources/chargen.js']]
    env_names = ['Terrain/terrain_summer.png', 'Terrain/trees_summer.png', 'Terrain/flowers.png', 'Terrain/cliff_summer.png',
                 'Terrain/Rocks, Grasslands.png', 'Terrain/Credits.txt', 'Structure/Bridges/Credits.txt',
                 'Structure/Bridges/Wood Bridge A - No Rails.png']
    inputs += [revised / name for name in env_names]
    inputs += [root / 'licenses/CC-BY-SA-3.0.txt', root / 'licenses/OGA-BY-3.0.txt']
    before = {str(path): digest(path) for path in inputs}
    lock = json.loads(Path(__file__).with_name('sources.lock.json').read_text())
    locked = {x['local']: x for x in lock}
    provenance = []
    for path in inputs:
        if not (path.is_relative_to(classic) or path.is_relative_to(revised)): continue
        is_classic = path.is_relative_to(classic)
        name = path.relative_to(classic if is_classic else revised).as_posix()
        record = locked[('classic/files/' if is_classic else 'revised/files/') + name]
        expected = record['gitBlobSha1']
        data = path.read_bytes()
        blob = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        if blob != expected or digest(path) != record['sha256']: raise ValueError('Pinned source blob mismatch: ' + name)
        provenance.append({'repository': 'LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator' if is_classic else 'ElizaWy/LPC',
                           'commit': UNIVERSAL if is_classic else REVISED, 'path': name,
                           'gitBlobSha1': blob, 'sha256': before[str(path)], 'bytes': len(data)})
    credits = list(csv.DictReader((classic / 'CREDITS.csv').open(newline='', encoding='utf8')))
    attribution = []
    for name in sorted(names):
        rows = [r for r in credits if r['authors'] and r['licenses'] and (name == r['filename'] or name.startswith(r['filename'].rstrip('/') + '/'))]
        if not rows: raise ValueError('No source credit scope for ' + name)
        credit = max(rows, key=lambda r: len(r['filename']))
        if 'CC-BY-SA 3.0' not in credit['licenses']: raise ValueError('Selected license unavailable: ' + name)
        attribution.append({'path': 'spritesheets/' + name, 'creditScope': credit['filename'],
                            'selectedLicense': 'CC-BY-SA-3.0', 'upstreamCredit': credit})
    output.mkdir(parents=True); (output / 'review').mkdir()
    for path in inputs:
        if path.is_relative_to(classic): target = output / 'sources/universal-lpc' / path.relative_to(classic)
        elif path.is_relative_to(revised): target = output / 'sources/lpc-revised' / path.relative_to(revised)
        else: target = output / 'sources/licenses' / path.name
        target.parent.mkdir(parents=True, exist_ok=True); shutil.copyfile(path, target)
    images = {name: Image.open(classic / 'spritesheets' / name).convert('RGBA') for name in names}
    index, all_manifests = {}, []
    for identity in ACTOR_LAYERS:
        clips, manifests = pack_actor(identity, images, output); index[identity] = {'clips': clips}; all_manifests += manifests
    env = environment(revised, output); spell_reference(output, [m for m in all_manifests if m['visualIdentity'] == 'shen-yan'])
    unchanged = before == {str(path): digest(path) for path in inputs}
    dump(output / 'ATTRIBUTION.json', {'universalCommit': UNIVERSAL, 'revisedCommit': REVISED,
         'characters': attribution, 'environmentCredits': ['sources/lpc-revised/Terrain/Credits.txt', 'sources/lpc-revised/Structure/Bridges/Credits.txt'],
         'adaptation': 'Selected original frame layers alpha-composited, padded onto192px canvas and packed; original pixels retain their scale.'})
    dump(output / 'pack-index.json', {'schema': 'combat-pixel-pack/v1', 'actors': index, 'environment': 'environment/manifest.json'})
    dump(output / 'sources/source-provenance.json', provenance)
    dump(output / 'sources/recipe-v1.json', RECIPE)
    dump(output / 'build-report.json', {'sourceUnchanged': unchanged, 'sourceSha256': {str(Path(k).relative_to(root)): v for k, v in before.items()},
         'scriptSha256': digest(Path(__file__)), 'manifestCount': len(all_manifests), 'atlasCount': 2,
         'sourceFrames': {'spell': 'rows0..3,columns0..6', 'walk': 'rows8..11,columns1..8', 'slash': 'rows12..15,columns0..5', 'hurt': 'row20,columns1..5'},
         'timingsArePresentationWeights': True, 'algorithmChecks': 'Complete source cells; fixed canvas, feet and scale; SHA readback.',
         'artReview': 'pending root review', 'anchors': 'Author marked source col3/4; unmarked columns omit anchors; review overlays remain separate from runtime atlas.', 'environment': env})
    notice = ['Pixel sample artwork attribution', '', 'Character composites and adapted atlases: CC-BY-SA3.0; https://creativecommons.org/licenses/by-sa/3.0/',
              'Environment derivatives: OGA-BY3.0; https://static.opengameart.org/OGA-BY-3.0.txt', '',
              'Original complete CREDITS.csv and CREDITS.TXT, source PNGs, license texts, precise per-file authors and source URLs accompany this pack.',
              'See ATTRIBUTION.json for each original author and source credit scope.',
              'Adaptation: original layers composited into whole192px frames; fixed canvas padding and tile crops/repetition.']
    for item in attribution:
        c = item['upstreamCredit']; notice += ['', item['path'], 'Authors: ' + c['authors'],
            'Source credit scope: ' + item['creditScope'], 'Original license options: ' + c['licenses'],
            'Selected license: CC-BY-SA 3.0', 'Source URLs: ' + ' ; '.join(v for k, v in c.items() if k.startswith('url') and v)]
    notice += ['', 'Environment original authors and notices:', (revised / 'Terrain/Credits.txt').read_text(),
               (revised / 'Structure/Bridges/Credits.txt').read_text(), '',
               'Pinned character repository: https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/tree/' + UNIVERSAL,
               'Pinned environment repository: https://github.com/ElizaWy/LPC/tree/' + REVISED]
    (output / 'CREDITS.txt').write_text('\n'.join(notice) + '\n', encoding='utf8')
    if not unchanged: raise RuntimeError('Source changed during build')
    print(json.dumps({'output': str(output), 'manifests': len(all_manifests), 'atlases': 2, 'sourceUnchanged': unchanged}))


if __name__ == '__main__':
    main()
