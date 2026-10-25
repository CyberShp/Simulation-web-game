#!/usr/bin/env python3
"""Read a source video with existing OpenCV and save timestamped native RGB samples."""
import argparse
from fractions import Fraction
import hashlib
import json
import math
from pathlib import Path
import shutil
import sys

import cv2
from PIL import Image, ImageDraw, ImageFont


def sha(path):
    with Path(path).open('rb') as stream:
        result = hashlib.sha256()
        for chunk in iter(lambda:stream.read(1024*1024), b''):
            result.update(chunk)
    return result.hexdigest()


def candidate_from_samples(args):
    """Copy selected original PNGs; only the GIF is a reduced/palette preview."""
    if args.output.exists():
        raise FileExistsError('Existing evidence directory is protected: '+str(args.output))
    original = json.loads(args.candidate_from.read_text(encoding='utf-8'))
    first, last = args.frame_range
    if first < 0 or last < first or args.preview_fps <= 0 or args.tile <= 0:
        raise ValueError('Invalid frame range or preview parameters')
    selected = [s for s in original['samples'] if first <= s['frameIndex'] <= last]
    if [s['frameIndex'] for s in selected] != list(range(first, last+1)):
        raise ValueError('Requested original frames are not all present in sampled metadata')
    sources = [args.candidate_from.parent/s['file'] for s in selected]
    if any(sha(p) != s['sha256'] for p, s in zip(sources, selected)):
        raise ValueError('An original PNG no longer matches its extraction hash')
    args.output.mkdir(parents=True, exist_ok=False)
    (args.output/'frames').mkdir()
    frames, sequence = [], []
    for number, (source, sample) in enumerate(zip(sources, selected)):
        dest = args.output/'frames'/source.name
        shutil.copyfile(source, dest)
        if sha(dest) != sample['sha256']:
            raise ValueError('Copied original PNG differs')
        with Image.open(dest) as image:
            if list(image.size) != sample['decodedSize']:
                raise ValueError('Native dimensions differ')
            preview = image.convert('RGB')
            preview.thumbnail((args.tile, args.tile), Image.Resampling.LANCZOS)
            frames.append(preview)
        sequence.append(dict(sample, file='frames/'+source.name, sequenceIndex=number))
    # GIF uses 10 ms units. Round cumulative boundaries to avoid 19x40 ms drift.
    boundaries = [round(i*1000/args.preview_fps/10)*10 for i in range(len(frames)+1)]
    durations = [b-a for a, b in zip(boundaries, boundaries[1:])]
    if min(durations) < 10:
        raise ValueError('Preview frame rate exceeds GIF time resolution')
    gif = args.output/'run-cycle-candidate-320.gif'
    frames[0].save(gif, save_all=True, append_images=frames[1:], duration=durations,
                   loop=0, disposal=2, optimize=False)
    with Image.open(gif) as image:
        actual_durations = []
        for index in range(image.n_frames):
            image.seek(index);actual_durations.append(image.info['duration'])
        if image.n_frames != len(frames) or actual_durations != durations:
            raise ValueError('GIF frame count or durations differ on readback')
    report = {'sourceVideoSha256':original['sourceSha256'],
              'extractionMetadata':str(args.candidate_from.resolve()),
              'selection':'main-agent author candidate; seam and actual-scale review pending',
              'frameIndexConvention':original['frameIndexConvention'],
              'sequence':sequence,'frameCount':len(frames),'sourceFpsForPreview':args.preview_fps,
              'idealCycleDurationMs':len(frames)*1000/args.preview_fps,
              'gifFrameDurationsMs':durations,'gifDurationMs':sum(durations),
              'gifDurationErrorMs':sum(durations)-len(frames)*1000/args.preview_fps,
              'previewOnly':'320px LANCZOS thumbnail and GIF palette; native PNG bytes preserved',
              'processing':'original order only; no interpolation, reversal, deformation or background removal',
              'command':[sys.executable,str(Path(__file__).resolve()),*sys.argv[1:]]}
    (args.output/'sequence.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (args.output/'checksums.json').write_text(json.dumps({str(p.relative_to(args.output)):sha(p) for p in sorted(args.output.rglob('*')) if p.is_file()},indent=2)+'\n')
    print(json.dumps({'gif':str(gif.resolve()),'sequence':str((args.output/'sequence.json').resolve()),
                      'frames':len(frames),'gifDurationMs':sum(durations)},ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--candidate-from', type=Path, help='Previously extracted metadata; copy a contiguous original frame range')
    parser.add_argument('--frame-range', type=int, nargs=2)
    parser.add_argument('--preview-fps', type=float, default=24)
    parser.add_argument('--step', type=float, default=.5)
    parser.add_argument('--columns', type=int, default=5)
    parser.add_argument('--tile', type=int, default=320)
    parser.add_argument('--page-size', type=int, default=0, help='Contact frames per page; zero keeps one sheet')
    parser.add_argument('--every-frame', action='store_true', help='Keep every decoded frame in an inclusive timestamp range')
    parser.add_argument('--start', type=float, default=0)
    parser.add_argument('--end', type=float)
    args = parser.parse_args()
    if args.candidate_from:
        if not args.frame_range:
            parser.error('--candidate-from requires --frame-range FIRST LAST')
        candidate_from_samples(args)
        return
    if args.output.exists():
        raise FileExistsError('Existing evidence directory is protected: '+str(args.output))
    if args.source is None or not args.source.is_file() or args.step<=0 or args.columns<=0 or args.tile<=0 or args.page_size<0:
        raise ValueError('Invalid source or sampling parameters')
    if args.start<0 or (args.end is not None and args.end<args.start):
        raise ValueError('Invalid timestamp range')
    source_hash = sha(args.source)
    cap = cv2.VideoCapture(str(args.source))
    if not cap.isOpened():
        raise ValueError('Existing OpenCV backend could not open source video')
    fps = cap.get(cv2.CAP_PROP_FPS)
    fourcc = int(cap.get(cv2.CAP_PROP_FOURCC))
    metadata = {'source':str(args.source.resolve()), 'sourceBytes':args.source.stat().st_size,
                'sourceSha256':source_hash, 'decoder':'OpenCV '+cv2.__version__,
                'decoderModule':cv2.__file__, 'backend':cap.getBackendName(),
                'reportedWidth':int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
                'reportedHeight':int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
                'reportedFps':fps, 'nearbyRationalFps':str(Fraction(fps).limit_denominator(1001)),
                'reportedFrameCount':int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
                'fourcc':''.join(chr((fourcc >> 8*i)&255) for i in range(4)),
                'reportedBitrateKbps':cap.get(cv2.CAP_PROP_BITRATE),
                'samplingStepSeconds':args.step,
                'sampling':'nearest decoded timestamp to each uniform target; full sequential decode',
                'frameIndexConvention':'zero-based decoded frame index',
                'nativeFrames':'original decoded dimensions, BGR-to-RGB channel order only, lossless PNG',
                'contactSheet':'scaled thumbnails with timestamps and source frame indices',
                'visualReview':'pending-main-agent-assessment',
                'notInspected':['audio streams and container tags','motion quality','runtime integration'],
                'command':[sys.executable,str(Path(__file__).resolve()),*sys.argv[1:]]}
    if args.every_frame:
        metadata.update(sampling='every original decoded frame in inclusive timestamp range; no temporal resampling',
                        samplingRangeSeconds=[args.start,args.end],samplingStepSeconds=None)
    if not math.isfinite(fps) or fps<=0:
        raise ValueError('No usable stream frame rate')
    args.output.mkdir(parents=True,exist_ok=False)
    frames_dir = args.output/'frames';frames_dir.mkdir()
    samples, thumbnails, timestamps, fallbacks = [], [], [], []
    previous, index, target = None, 0, 0.0
    def save_sample(frame_index, at, frame, requested):
        rgb = cv2.cvtColor(frame,cv2.COLOR_BGR2RGB)
        image = Image.fromarray(rgb)
        filename = f'frame-{frame_index:06d}-t{at:07.3f}.png'
        path = frames_dir/filename
        image.save(path)
        with Image.open(path) as readback:
            if readback.size!=image.size or readback.tobytes()!=image.tobytes():
                raise ValueError('Native decoded PNG readback differs')
        thumb=image.copy();thumb.thumbnail((args.tile,args.tile),Image.Resampling.LANCZOS)
        thumbnails.append(thumb)
        samples.append({'targetSeconds':requested,'actualTimestampSeconds':at,
                        'targetErrorSeconds':at-requested,'frameIndex':frame_index,
                        'file':'frames/'+filename,'decodedSize':list(image.size),'sha256':sha(path)})
    while True:
        ok, frame = cap.read()
        if not ok:break
        at = cap.get(cv2.CAP_PROP_POS_MSEC)/1000
        if not math.isfinite(at) or at<0 or (timestamps and at<=timestamps[-1]):
            fallbacks.append(index);at=index/fps
        timestamps.append(at)
        if args.every_frame:
            if at>=args.start-1e-7 and (args.end is None or at<=args.end+1e-7):
                save_sample(index,at,frame,index/fps)
        else:
            while target<=at+1e-7:
                chosen=(index,at,frame)
                if previous is not None and abs(previous[1]-target)<abs(at-target):
                    chosen=previous
                save_sample(*chosen,target)
                target=round(target+args.step,9)
        previous=(index,at,frame.copy());index+=1
    cap.release()
    if not samples:raise ValueError('No video frames decoded')
    caption=42;font=ImageFont.load_default(size=17);contact_files=[]
    page_size=args.page_size or len(samples)
    if args.page_size:(args.output/'contact-pages').mkdir()
    for start in range(0,len(samples),page_size):
        page_samples=samples[start:start+page_size];page_thumbs=thumbnails[start:start+page_size]
        rows=math.ceil(len(page_samples)/args.columns)
        contact=Image.new('RGB',(args.columns*args.tile,rows*(args.tile+caption)),(238,238,238));draw=ImageDraw.Draw(contact)
        for number,(sample,thumb) in enumerate(zip(page_samples,page_thumbs)):
            x=number%args.columns*args.tile;y=number//args.columns*(args.tile+caption)
            contact.paste(thumb,(x+(args.tile-thumb.width)//2,y+(args.tile-thumb.height)//2))
            draw.text((x+6,y+args.tile+4),f"t={sample['actualTimestampSeconds']:.3f}s / frame {sample['frameIndex']}",font=font,fill=(25,25,25))
            caption_text = 'original decoded frame' if args.every_frame else f"target {sample['targetSeconds']:.1f}s"
            draw.text((x+6,y+args.tile+23),caption_text,font=font,fill=(70,70,70))
        name=f'contact-pages/contact-{start//page_size+1:02d}.png' if args.page_size else 'contact-sheet.png'
        contact.save(args.output/name);contact_files.append(name)
    metadata.update(decodedFrameCount=index,decodedFirstTimestamp=timestamps[0],decodedLastTimestamp=timestamps[-1],
                    durationFromDecodedCountAndReportedFps=index/fps,
                    decodedTimestampStepsMs={'min':min((b-a)*1000 for a,b in zip(timestamps,timestamps[1:])),
                                             'max':max((b-a)*1000 for a,b in zip(timestamps,timestamps[1:]))},
                    timestampFallbackFrameIndices=fallbacks,sampleCount=len(samples),samples=samples,contactFiles=contact_files,
                    sourceUnchanged=sha(args.source)==source_hash)
    if not metadata['sourceUnchanged']:raise ValueError('Source video changed while reading')
    (args.output/'metadata.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (args.output/'decoded-timestamps.json').write_text(json.dumps(timestamps)+'\n')
    (args.output/'checksums.json').write_text(json.dumps({str(p.relative_to(args.output)):sha(p) for p in sorted(args.output.rglob('*')) if p.is_file()},indent=2)+'\n')
    print(json.dumps({'contact':str((args.output/contact_files[0]).resolve()),'contactPages':len(contact_files),
                      'metadata':str((args.output/'metadata.json').resolve()),
                      'nativeFrames':str(frames_dir.resolve()),'decodedFrames':index,'samples':len(samples),
                      'sourceSha256':source_hash,'sourceUnchanged':True},ensure_ascii=False))


if __name__=='__main__':main()
