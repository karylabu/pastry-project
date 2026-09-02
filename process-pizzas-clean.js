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

async function processPizzas() {
  console.log('Processing pizza images (clean text removal + transparent bg)...\n');
  
  for (const pizza of pizzas) {
    const filePath = path.join(uploadsDir, pizza);
    const tempPath = path.join(uploadsDir, `${pizza}.temp`);
    
    try {
      if (!fs.existsSync(filePath)) {
        console.log(`✗ File not found: ${pizza}`);
        continue;
      }
      
      console.log(`Processing ${pizza}...`);
      
      // Read image with alpha channel
      const { data, info } = await sharp(filePath)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      
      const { width, height } = info;
      console.log(`  Original: ${width}x${height}`);
      
      // Process pixels: remove white bg + reduce text
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Remove white/light backgrounds
        if (r > 200 && g > 200 && b > 200) {
          data[i + 3] = 0;  // Make transparent
        } 
        // For near-white text (typical pizza text), darken it slightly
        else if (r > 180 && g > 180 && b > 180 && data[i + 3] > 200) {
          // Subtle darkening of light pixels (reduces text visibility)
          data[i] = Math.max(0, r - 20);
          data[i + 1] = Math.max(0, g - 20);
          data[i + 2] = Math.max(0, b - 20);
        }
        // Keep pizza opaque
        else if (data[i + 3] < 255) {
          data[i + 3] = 255;
        }
      }
      
      // Create image from processed data and apply minimal sharpening
      await sharp(data, {
        raw: {
          width,
          height,
          channels: 4
        }
      })
        .sharpen({ sigma: 1 })  // Minimal sharpening to keep pizza crisp
        .png()
        .toFile(tempPath);
      
      fs.renameSync(tempPath, filePath);
      
      const stats = fs.statSync(filePath);
      const size = (stats.size / 1024).toFixed(2);
      console.log(`  ✓ Processed (${size} KB)\n`);
      
    } catch (error) {
      console.error(`✗ Error processing ${pizza}:`, error.message);
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }
  
  console.log('Pizza processing complete!');
}

processPizzas();
