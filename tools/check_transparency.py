import os
from PIL import Image

files = [
    r'D:\xampp\htdocs\pastry-project\uploads\americano.png',
    r'D:\xampp\htdocs\pastry-project\uploads\pepperoni.png',
    r'D:\xampp\htdocs\pastry-project\uploads\transparent_test.png',
]

for path in files:
    if not os.path.exists(path):
        print(f'MISSING {path}')
        continue
    img = Image.open(path)
    print(f'{os.path.basename(path)} | size={img.size} mode={img.mode}')
    if 'A' in img.getbands():
        alpha = img.getchannel('A')
        transparent = sum(1 for v in alpha.getdata() if v < 10)
        total = alpha.width * alpha.height
        print(f'  alpha_pixels_under_10={transparent} / {total}')
    else:
        print('  no alpha channel')
