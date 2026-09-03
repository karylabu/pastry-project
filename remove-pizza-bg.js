const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, 'uploads');
const pizzas = [
  'Breakfast.png',
  'four_cheese.png',
  'Hawaiian.png',
  'Pepperoni.png',
  'Spinach.png',
  'Veggie.png',
  'meal7.png'
];

async function removePizzaBackground() {
  console.log('Removing pizza backgrounds...\n');
  
  for (const pizza of pizzas) {
    const filePath = path.join(uploadsDir, pizza);
    const tempPath = path.join(uploadsDir, `${pizza}.temp`);
    
    try {
      if (!fs.existsSync(filePath)) {
        console.log(`✗ File not found: ${pizza}`);
        continue;
      }
      
      console.log(`Processing ${pizza}...`);
      
      // Read original image with alpha
      const { data, info } = await sharp(filePath)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      
      const { width, height, channels } = info;
      console.log(`  Dimensions: ${width}x${height}`);
      
      // Process each pixel - remove white backgrounds
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // If pixel is white or very light (background), make transparent
        if (r > 200 && g > 200 && b > 200) {
          data[i + 3] = 0;  // Set alpha to 0 (transparent)
        } else {
          data[i + 3] = 255;  // Set alpha to 255 (opaque)
        }
      }
      
      // Write processed image
      await sharp(data, {
        raw: {
          width,
          height,
          channels: 4
        }
      })
        .png()
        .toFile(tempPath);
      
      // Replace original with processed
      fs.renameSync(tempPath, filePath);
      
      const stats = fs.statSync(filePath);
      const size = (stats.size / 1024).toFixed(2);
      console.log(`  ✓ Background removed (${size} KB)\n`);
      
    } catch (error) {
      console.error(`✗ Error processing ${pizza}:`, error.message);
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }
  
  console.log('Background removal complete!');
}

removePizzaBackground();
