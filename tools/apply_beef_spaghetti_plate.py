from collections import deque
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from rembg import new_session, remove

ROOT = Path(r'D:\xampp\htdocs\pastry-project\uploads')
SOURCES = [
    'baked_mac.png', 'beef_spaghetti.png', 'chicken_pasta.png',
    'tinapa_pasta.png', 'tuna_pasta.png', 'cheesy.jpg', 'french.jpg',
    'mojos.jpg', 'mojos_hot.jpg', 'mozarella.jpg', 'potato.jpg',
]
TEMPLATE = 'beef_spaghetti.png'
WHITE_THRESHOLD = 242


def white_background_mask(image):
    rgb = np.array(image.convert('RGB'))
    white = np.all(rgb >= WHITE_THRESHOLD, axis=2).astype(np.uint8)
    mask = np.zeros((white.shape[0] + 2, white.shape[1] + 2), np.uint8)
    flood = white.copy()
    for x, y in [(0, 0), (white.shape[1] - 1, 0), (0, white.shape[0] - 1), (white.shape[1] - 1, white.shape[0] - 1)]:
        if flood[y, x]:
            cv2.floodFill(flood, mask, (x, y), 2)
    return flood == 2


def make_plate(template, food):
    rgb = np.array(template.convert('RGB'))
    food_mask = np.array(food.getchannel('A')) > 20
    inpaint_mask = (food_mask.astype(np.uint8) * 255)
    inpaint_mask = cv2.dilate(inpaint_mask, np.ones((9, 9), np.uint8))
    restored = cv2.inpaint(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), inpaint_mask, 7, cv2.INPAINT_TELEA)
    restored = cv2.cvtColor(restored, cv2.COLOR_BGR2RGB)
    alpha = np.where(white_background_mask(Image.fromarray(restored)), 0, 255).astype(np.uint8)
    return Image.fromarray(np.dstack((restored, alpha)), 'RGBA')


def composite(plate, food):
    result = Image.new('RGBA', plate.size, (0, 0, 0, 0))
    food = food.convert('RGBA')
    bbox = food.getchannel('A').getbbox()
    if bbox:
        food = food.crop(bbox)
        scale = min((plate.width * 0.72) / food.width, (plate.height * 0.72) / food.height, 1)
        food = food.resize((max(1, int(food.width * scale)), max(1, int(food.height * scale))), Image.Resampling.LANCZOS)
        result.alpha_composite(plate)
        result.alpha_composite(food, ((plate.width - food.width) // 2, (plate.height - food.height) // 2))
    else:
        result.alpha_composite(plate)
    return result


session = new_session('u2netp')
with Image.open(ROOT / TEMPLATE) as template_image:
    template_food = remove(template_image.convert('RGBA'), session=session).convert('RGBA')
    common_plate = make_plate(template_image, template_food)

for source_name in SOURCES:
    with Image.open(ROOT / source_name) as source_image:
        food = remove(source_image.convert('RGBA'), session=session).convert('RGBA')
        composite(common_plate, food).save(ROOT / f'{Path(source_name).stem}.png', format='PNG')
    print(f'processed: {Path(source_name).stem}.png')
