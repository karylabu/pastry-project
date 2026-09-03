from collections import deque
from pathlib import Path

from PIL import Image

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
WHITE_THRESHOLD = 242


def is_background(pixel):
    red, green, blue = pixel[:3]
    return red >= WHITE_THRESHOLD and green >= WHITE_THRESHOLD and blue >= WHITE_THRESHOLD


def remove_outer_white(image):
    rgba = image.convert('RGBA')
    pixels = rgba.load()
    width, height = rgba.size
    queue = deque()
    visited = bytearray(width * height)

    def enqueue(x, y):
        index = y * width + x
        if visited[index] or not is_background(pixels[x, y]):
            return
        visited[index] = 1
        queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        pixels[x, y] = (pixels[x, y][0], pixels[x, y][1], pixels[x, y][2], 0)
        for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= next_x < width and 0 <= next_y < height:
                enqueue(next_x, next_y)

    return rgba


for source_name in SOURCES:
    source = ROOT / source_name
    output = ROOT / f'{Path(source_name).stem}.png'
    with Image.open(source) as image:
        result = remove_outer_white(image)
        result.save(output, format='PNG')
    print(f'processed: {output}')
