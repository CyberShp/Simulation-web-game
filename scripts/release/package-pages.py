#!/usr/bin/env python3
"""Build the complete Pages tree and export its Git Tree text entries."""

import argparse
import json
import subprocess
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tag', required=True)
    parser.add_argument('--preview-only', action='store_true')
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    subprocess.run(['node', str(root / 'scripts/build/web.mjs'), '--tag', args.tag],
                   cwd=root, check=True)
    web = root / 'dist/web'
    text_extensions = {'.mjs', '.js', '.css', '.html', '.json', '.txt', '.md', '.svg'}
    entries = []
    for file in sorted(web.rglob('*')):
        if not file.is_file():
            continue
        relative = file.relative_to(web).as_posix()
        if args.preview_only and not relative.startswith('ea-preview/'):
            continue
        if file.suffix not in text_extensions and not file.name.endswith('LICENSE') and file.name != '.nojekyll':
            continue
        entries.append({'path': relative, 'mode': '100644', 'type': 'blob',
                        'content': file.read_text(encoding='utf-8')})
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(entries, ensure_ascii=False), encoding='utf-8')
    print(json.dumps({'entries': len(entries), 'bytes': args.output.stat().st_size,
                      'tag': args.tag, 'web': 'dist/web'}))


if __name__ == '__main__':
    main()
