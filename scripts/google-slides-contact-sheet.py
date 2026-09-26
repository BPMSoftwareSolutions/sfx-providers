"""Contact sheets for Google PDF pages already rendered with pdftoppm.

Usage: python scripts/google-slides-contact-sheet.py PATH/TO/renders
Requires Pillow. Keeps individual PNG pages for full-resolution inspection.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(sys.argv[1]).resolve()
pages = sorted(root.glob('slide-*.png'))
if not pages:
    raise SystemExit('No slide-*.png files found.')
for start in range(0, len(pages), 8):
    sheet = Image.new('RGB', (1440, 4 * 435), '#e1e6ef')
    draw = ImageDraw.Draw(sheet)
    for offset, file in enumerate(pages[start:start + 8]):
        with Image.open(file) as source:
            page = source.convert('RGB')
            page.thumbnail((700, 394))
            x, y = (offset % 2) * 720 + 10, (offset // 2) * 435 + 28
            sheet.paste(page, (x, y))
            draw.text((x, y - 20), file.stem, fill='#142535')
    output = root / f'contact-{start // 8 + 1:02}.png'
    sheet.save(output)
    print(output)
