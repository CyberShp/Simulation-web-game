#!/usr/bin/env python3
"""Draw the author's eight projected running poses as a white reference sheet."""
from pathlib import Path
import json

from PIL import Image, ImageDraw, ImageFont


def main():
    output = Path('/Volumes/Media/immortal-qa/combat-direction-study-20261025/pose-guide-v001.png')
    if output.exists():
        raise FileExistsError(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    image = Image.new('RGB', (1536, 1024), 'white')
    draw = ImageDraw.Draw(image)
    title_font = ImageFont.load_default(size=25)
    font = ImageFont.load_default(size=17)
    near = [((265, 370), (298, 435)), ((235, 386), (235, 435)),
            ((185, 378), (165, 428)), ((165, 360), (180, 323)),
            ((168, 368), (135, 395)), ((218, 345), (177, 390)),
            ((265, 350), (235, 390)), ((274, 350), (295, 405))]
    far = near[4:] + near[:4]
    records = []
    for index in range(8):
        ox, oy = index % 4 * 384, index // 4 * 512
        shift = 8 if index in (1, 5) else -8 if index in (3, 7) else 0
        def point(p):
            return (p[0] + ox, p[1] + oy)
        def line(points, fill, width):
            draw.line([point(p) for p in points], fill=fill, width=width, joint='curve')
        def circle(center, radius, fill, outline=None, width=1):
            cx, cy = point(center)
            draw.ellipse((cx-radius, cy-radius, cx+radius, cy+radius), fill=fill, outline=outline, width=width)
        draw.rectangle((ox, oy, ox+383, oy+511), outline='#dddddd', width=1)
        draw.text(point((18, 16)), f'{index+1} / AUTHOR POSE GUIDE', font=title_font, fill='#1c2832')
        draw.text(point((18, 52)), 'near R', font=font, fill='#009da9')
        draw.text(point((112, 52)), 'far L', font=font, fill='#8b3fc3')
        draw.text(point((18, 78)), 'facing RIGHT  >', font=font, fill='#475663')
        for x in range(8, 377, 16):
            line([(x, 440), (min(x+9, 377), 440)], '#aeb9c1', 2)
        for y in range(124, 466, 16):
            line([(215, y), (215, min(y+9, 466))], '#c5cdd3', 2)
        pelvis = (215, 330+shift)
        shoulder = (238, 245+shift)
        head = (253, 203+shift)
        hips = {'near R': (220, 330+shift), 'far L': (208, 325+shift)}
        legs = {}
        for name, sequence, color, contact in [('far L', far, '#a45ad3', index in (4, 5, 6)),
                                                ('near R', near, '#00b7c7', index in (0, 1, 2))]:
            knee, ankle = sequence[index]
            tip = (ankle[0]+18, 440 if contact else ankle[1])
            line([hips[name], knee, ankle, tip], color, 10)
            for joint in [hips[name], knee, ankle]:
                circle(joint, 5, 'white', color, 3)
            legs[name] = {'hip': hips[name], 'knee': knee, 'ankle': ankle,
                          'footTip': tip, 'contact': contact}
        line([hips['far L'], pelvis, hips['near R']], '#3b4b57', 7)
        line([pelvis, shoulder, (253, 229+shift)], '#3b4b57', 7)
        circle(head, 26, 'white', '#3b4b57', 5)
        line([(278, 202+shift), (286, 207+shift), (277, 211+shift)], '#3b4b57', 3)
        # Hands and sword are authored at the same absolute cell positions in every frame.
        line([shoulder, (193, 280), (165, 320)], '#657785', 6)
        line([shoulder, (271, 253), (293, 282)], '#3b4b57', 6)
        circle((165, 320), 6, 'white', '#3b4b57', 3)
        circle((293, 282), 6, 'white', '#3b4b57', 3)
        line([(165, 320), (40, 365)], '#576e84', 5)
        line([(161, 310), (169, 330)], '#576e84', 4)
        circle(pelvis, 5, '#3b4b57')
        draw.text(point((18, 475)), f'body dy {shift:+d}px; floor y440; guides only', font=font, fill='#65717b')
        records.append({'frame': index+1, 'bodyShiftY': shift, 'head': head, 'shoulder': shoulder,
                        'pelvis': pelvis, 'legs': legs, 'nearRightHand': [165,320],
                        'swordTip': [40,365], 'leftHand': [293,282]})
    image.save(output)
    output.with_suffix('.json').write_text(json.dumps({'scope': 'author projected T candidate; not measured biomechanics',
                                                      'size': [1536,1024], 'tile': [384,512],
                                                      'contactFrames': {'near R': [1,2,3], 'far L': [5,6,7]},
                                                      'frames': records}, indent=2)+'\n')
    print(str(output))


if __name__ == '__main__':
    main()
