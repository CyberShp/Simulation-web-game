#!/usr/bin/env python3
"""Fetch selected public LPC files at one immutable commit; never clone assets."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import urllib.parse
import urllib.request

DEFAULT_COMMIT = 'f07f7f5892e67c932c68f70bb04472f2c64e46bc'


def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'immortal-lpc-sample/1.0'})
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read()


def write_once(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.read_bytes() != data:
            raise ValueError('Existing output differs: ' + str(path))
    else:
        with path.open('xb') as stream:
            stream.write(data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', default='ElizaWy/LPC')
    parser.add_argument('--commit', default=DEFAULT_COMMIT)
    parser.add_argument('--output', type=Path, required=True)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--tree', help='Immutable Git tree SHA; returns immediate children')
    group.add_argument('--files', nargs='+', help='Exact repository paths')
    args = parser.parse_args()
    if len(args.commit) != 40 or any(c not in '0123456789abcdef' for c in args.commit):
        parser.error('--commit must be a full immutable lowercase SHA')
    if args.tree:
        url = f'https://api.github.com/repos/{args.repo}/git/trees/{args.tree}'
        data = fetch(url)
        decoded = json.loads(data)
        if decoded.get('truncated'):
            raise ValueError('Tree response was truncated')
        write_once(args.output / 'metadata' / (args.tree + '.json'), data)
        print(json.dumps({'tree': args.tree, 'entries': decoded['tree']}, ensure_ascii=False))
        return
    records = []
    for name in args.files:
        relative = PurePosixPath(name)
        if relative.is_absolute() or '..' in relative.parts:
            raise ValueError('Repository-relative paths required')
        url = f'https://raw.githubusercontent.com/{args.repo}/{args.commit}/' + urllib.parse.quote(name)
        data = fetch(url)
        destination = args.output / 'files' / Path(name)
        write_once(destination, data)
        record = {'repo': args.repo, 'commit': args.commit, 'path': name, 'url': url,
                  'local': str(destination.resolve()), 'bytes': len(data),
                  'sha256': hashlib.sha256(data).hexdigest(),
                  'gitBlobSha1': hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()}
        record_name = hashlib.sha256(name.encode()).hexdigest() + '.json'
        write_once(args.output / 'provenance' / record_name,
                   (json.dumps(record, ensure_ascii=False, indent=2) + '\n').encode())
        records.append(record)
    print(json.dumps(records, ensure_ascii=False))


if __name__ == '__main__':
    main()
