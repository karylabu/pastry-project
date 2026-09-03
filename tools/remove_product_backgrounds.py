from pathlib import Path

from PIL import Image
from rembg import new_session, remove

ROOTS = [
    Path(r'D:\xampp\htdocs\pastry-project\uploads'),
    Path(r'D:\xampp\htdocs\pastry-project\customer\uploads'),
    Path(r'D:\xampp\htdocs\pastry-project\staff\uploads'),
]

ALLOWED_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp'}
SKIP_PARTS = {'background', 'chat', 'rate_limit', 'logo', 'banner', 'login', 'customize'}
TARGET_MAX_DIMENSION = 1400
MODEL_SESSION = new_session('u2netp')


def resize_for_rembg(image: Image.Image) -> Image.Image:
    width, height = image.size
    max_dimension = max(width, height)
    if max_dimension <= TARGET_MAX_DIMENSION:
        return image.convert('RGBA')

    scale = TARGET_MAX_DIMENSION / max_dimension
    new_size = (max(1, int(round(width * scale))), max(1, int(round(height * scale))))
    return image.resize(new_size, Image.Resampling.LANCZOS).convert('RGBA')


def process_image(path: Path) -> None:
    name = path.name.lower()
    if any(part in name for part in ('logo', 'banner', 'login', 'customize', 'background')):
        return

    with Image.open(path) as original:
        resized = resize_for_rembg(original)
        result = remove(resized, session=MODEL_SESSION)

        if result.mode != 'RGBA':
            result = result.convert('RGBA')

        output_path = path.with_suffix('.png')
        if output_path != path:
            if output_path.exists():
                output_path.unlink()
            path.rename(output_path)

        result.save(output_path, format='PNG')
        print(f'processed: {output_path}')


processed = []
errors = []

for root in ROOTS:
    if not root.exists():
        continue

    for path in sorted(root.rglob('*')):
        if not path.is_file() or path.suffix.lower() not in ALLOWED_EXTENSIONS:
            continue

        if any(part.lower() in SKIP_PARTS for part in path.parts):
            continue

        name = path.name.lower()
        if 'transparent' in name:
            continue

        try:
            process_image(path)
            processed.append(str(path))
        except Exception as exc:
            errors.append((str(path), str(exc)))
            print(f'ERROR: {path}: {exc}')

print(f'PROCESSED={len(processed)}')
print(f'ERRORS={len(errors)}')
for item in errors[:10]:
    print(item)
