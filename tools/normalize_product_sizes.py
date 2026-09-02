from pathlib import Path

from PIL import Image

ROOT = Path(r'D:\xampp\htdocs\pastry-project\uploads')
SOURCES = [
    'baked_mac.png', 'beef_spaghetti.png', 'chicken_pasta.png',
    'tinapa_pasta.png', 'tuna_pasta.png', 'cheesy.png', 'french.png',
    'mojos.png', 'mojos_hot.png', 'mozarella.png', 'potato.png',
]
REFERENCE = 'beef_spaghetti.png'
TARGET_CANVAS = (1088, 991)

with Image.open(ROOT / REFERENCE) as reference:
    reference_bbox = reference.getchannel('A').getbbox()
    target_width = reference_bbox[2] - reference_bbox[0]

for source_name in SOURCES:
    source_path = ROOT / source_name
    with Image.open(source_path) as source:
        image = source.convert('RGBA')
        bbox = image.getchannel('A').getbbox()
        if not bbox:
            continue

        visible = image.crop(bbox)
        scale = target_width / visible.width
        visible = visible.resize(
            (target_width, max(1, round(visible.height * scale))),
            Image.Resampling.LANCZOS,
        )

        canvas = Image.new('RGBA', TARGET_CANVAS, (0, 0, 0, 0))
        x = (TARGET_CANVAS[0] - visible.width) // 2
        y = (TARGET_CANVAS[1] - visible.height) // 2
        canvas.alpha_composite(visible, (x, y))
        canvas.save(source_path, format='PNG')
        print(f'normalized: {source_name} visible={visible.size} canvas={TARGET_CANVAS}')
