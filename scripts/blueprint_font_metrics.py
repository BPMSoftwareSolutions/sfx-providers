"""Generate portable font metrics and inspect blueprint text using Pillow.

The generated metrics let the Node provider fit labels deterministically without
requiring a Python process or an installed system font on every invocation.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import ImageFont

parser = argparse.ArgumentParser()
parser.add_argument('--font', required=True)
parser.add_argument('--bold-font')
parser.add_argument('--output')
parser.add_argument('--inspect')
args = parser.parse_args()
font_path = Path(args.font)
font = ImageFont.truetype(str(font_path), 1000)
bold_font = ImageFont.truetype(args.bold_font, 1000) if args.bold_font else font
chars = ''.join(chr(i) for i in range(32, 256)) + '→←↑↓…✓×·–—'
metrics = dict(schema='blueprint-font-metrics.v1', family=font.getname()[0],
               fontSha256=hashlib.sha256(font_path.read_bytes()).hexdigest(),
               unitsPerEm=1000, fallbackAdvance=1000,
               boldFontSha256=hashlib.sha256(Path(args.bold_font).read_bytes()).hexdigest() if args.bold_font else None,
               advances={c: round(max(font.getlength(c), bold_font.getlength(c)), 4) for c in chars})
if args.output:
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps(metrics, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')
if args.inspect:
    story = json.loads(Path(args.inspect).read_text(encoding='utf-8'))
    checked = 0
    findings = []
    for index, slide in enumerate(story['slides'], 1):
        if slide.get('blueprint', {}).get('role') not in ('overview', 'projection', 'provider-detail'):
            continue
        for command in slide['commands']:
            if command['op'] != 't':
                continue
            text, x, y, w, h, size, *_ = command['args']
            if not (160 <= y < 437):
                continue
            checked += 1
            widths = [sum(metrics['advances'].get(c, 1000) for c in line) * size / 1000 for line in text.split('\n')]
            height = len(widths) * size * 1.24 + 7.2
            if max(widths, default=0) > w - 16 + .1 or height > h + .1:
                findings.append(dict(slide=index, text=text, width=max(widths), availableWidth=w-16, height=height, availableHeight=h))
    print(json.dumps(dict(checkedLabels=checked, findings=findings), ensure_ascii=False))
    raise SystemExit(bool(findings))
