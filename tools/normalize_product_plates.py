from pathlib import Path

from PIL import Image
from rembg import new_session, remove

ROOT = Path(r'D:\xampp\htdocs\pastry-project\uploads')
SOURCES = [
    'baked_mac.png',
    'beef_spaghetti.png',
    'chicken_pasta.png',
    'tinapa_pasta.png',
    'tuna_pasta.png',
    'cheesy.jpg',
    'french.jpg',
    'mojos.jpg',
    'mojos_hot.jpg',
    'mozarella.jpg',
    'potato.jpg',
]
TEMPLATE_NAME = 'beef_spaghetti.png'


def remove_food_from_plate(image, food):
    plate = image.convert('RGBA')
    plate_pixels = plate.load()
    food_alpha = food.getchannel('A')
    for y in range(plate.height):
        for x in range(plate.width):
            if food_alpha.getpixel((x, y)) > 20:
                red, green, blue, _ = plate_pixels[x, y]
                plate_pixels[x, y] = (red, green, blue, 0)
    return plate


def make_common_plate(template_image, template_food):
    plate = remove_food_from_plate(template_image, template_food)
    plate.thumbnail((1400, 1400), Image.Resampling.LANCZOS)
    return plate


def compose_on_plate(plate, food):
    canvas = Image.new('RGBA', plate.size, (0, 0, 0, 0))
    food = food.convert('RGBA')
    bbox = food.getchannel('A').getbbox()
    if bbox:
        food = food.crop(bbox)
        max_width = int(plate.width * 0.72)
        max_height = int(plate.height * 0.72)
        scale = min(max_width / food.width, max_height / food.height, 1)
        food = food.resize((max(1, int(food.width * scale)), max(1, int(food.height * scale))), Image.Resampling.LANCZOS)
        food_position = ((plate.width - food.width) // 2, (plate.height - food.height) // 2)
        canvas.alpha_composite(food, food_position)
    canvas.alpha_composite(plate)
    return canvas


session = new_session('u2netp')
with Image.open(ROOT / TEMPLATE_NAME) as template_image:
    template_food = remove(template_image.convert('RGBA'), session=session).convert('RGBA')
    common_plate = make_common_plate(template_image, template_food)

for source_name in SOURCES:
    source_path = ROOT / source_name
    with Image.open(source_path) as source_image:
        food = remove(source_image.convert('RGBA'), session=session).convert('RGBA')
        result = compose_on_plate(common_plate, food)
        result.save(ROOT / f'{Path(source_name).stem}.png', format='PNG')
    print(f'processed: {ROOT / f"{Path(source_name).stem}.png"}')
