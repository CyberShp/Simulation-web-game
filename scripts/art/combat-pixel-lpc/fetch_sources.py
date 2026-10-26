#!/usr/bin/env python3
"""Acquire only the exact source files in sources.lock.json, with SHA verification."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    records = json.loads(Path(__file__).with_name('sources.lock.json').read_text())
    result = []
    for entry in records:
        relative = PurePosixPath(entry['local'])
        if relative.is_absolute() or '..' in relative.parts:
            raise ValueError('Unsafe source-lock path')
        target = args.output / Path(relative)
        if target.exists():
            data = target.read_bytes()
        else:
            request = urllib.request.Request(entry['url'], headers={'User-Agent': 'immortal-pixel-source-fetch/1.0'})
            with urllib.request.urlopen(request, timeout=45) as response:
                data = response.read()
        if len(data) != entry['bytes'] or hashlib.sha256(data).hexdigest() != entry['sha256']:
            raise ValueError('Pinned source differs: ' + entry['local'])
        if 'gitBlobSha1' in entry:
            blob = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
            if blob != entry['gitBlobSha1']: raise ValueError('Git blob differs: ' + entry['local'])
        if not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open('xb') as stream: stream.write(data)
        result.append({'path': entry['local'], 'sha256': entry['sha256']})
    print(json.dumps({'verifiedFiles': len(result), 'output': str(args.output.resolve())}))


if __name__ == '__main__': main()
