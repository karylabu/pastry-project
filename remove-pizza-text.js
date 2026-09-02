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

async function removeTextFromPizzas() {
  console.log('Removing text overlays from pizza images...\n');
  
  for (const pizza of pizzas) {
    const filePath = path.join(uploadsDir, pizza);
    const tempPath = path.join(uploadsDir, `${pizza}.temp`);
    
    try {
      if (!fs.existsSync(filePath)) {
        console.log(`✗ File not found: ${pizza}`);
        continue;
      }
      
      console.log(`Processing ${pizza}...`);
      
      // Apply median and blur filters to reduce text while keeping pizza edges
      await sharp(filePath)
        .median(3)           // Median filter removes small text/artifacts
        .blur(0.5)           // Slight blur to smooth text edges
        .sharpen({           // Re-sharpen pizza edges
          sigma: 1.5
        })
        .png()
        .toFile(tempPath);
      
      // Replace original
      fs.renameSync(tempPath, filePath);
      
      const stats = fs.statSync(filePath);
      const size = (stats.size / 1024).toFixed(2);
      console.log(`  ✓ Text reduced (${size} KB)\n`);
      
    } catch (error) {
      console.error(`✗ Error processing ${pizza}:`, error.message);
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }
  
  console.log('Text removal complete!');
}

removeTextFromPizzas();
