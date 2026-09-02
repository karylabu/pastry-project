from PIL import Image, ImageChops
import os
from pathlib import Path

def remove_pizza_background(input_path, output_path):
    """Remove white/light backgrounds from pizza images"""
    img = Image.open(input_path).convert('RGBA')
    
    # Get image data
    data = img.getdata()
    
    # Create new image with alpha channel
    new_data = []
    for item in data:
        # item is (R, G, B, A)
        r, g, b, a = item if len(item) == 4 else (item[0], item[1], item[2], 255)
        
        # Check if pixel is "white" or very light (background)
        # White background: R>200 AND G>200 AND B>200
        # We want to remove light backgrounds but keep pizza
        if r > 200 and g > 200 and b > 200:
            # Make transparent
            new_data.append((r, g, b, 0))
        else:
            # Keep the pixel with full alpha
            new_data.append((r, g, b, 255))
    
    img.putdata(new_data)
    img.save(output_path, 'PNG')
    print(f"✓ Removed background from {Path(input_path).name}")

# Process all pizzas
uploads_dir = Path(__file__).parent / 'uploads'
pizzas = [
    'Breakfast.png',
    'four_cheese.png',
    'Hawaiian.png',
    'Pepperoni.png',
    'Spinach.png',
    'Veggie.png',
    'meal7.png'
]

print("Removing pizza backgrounds...\n")
for pizza in pizzas:
    input_path = uploads_dir / pizza
    if input_path.exists():
        remove_pizza_background(str(input_path), str(input_path))
    else:
        print(f"✗ File not found: {pizza}")

print("\nBackground removal complete!")
