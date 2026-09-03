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

async function resizePizzas() {
  console.log('Starting pizza image resize...\n');
  
  for (const pizza of pizzas) {
    const inputPath = path.join(uploadsDir, pizza);
    const tempPath = path.join(uploadsDir, `${pizza}.temp`);
    
    try {
      // Check if file exists
      if (!fs.existsSync(inputPath)) {
        console.log(`✗ File not found: ${pizza}`);
        continue;
      }
      
      const stats = fs.statSync(inputPath);
      const originalSize = (stats.size / 1024).toFixed(2);
      
      // Get original dimensions
      const metadata = await sharp(inputPath).metadata();
      console.log(`Processing ${pizza}`);
      console.log(`  Original: ${metadata.width}x${metadata.height} (${originalSize} KB)`);
      
      // Resize to 1024x1024
      await sharp(inputPath)
        .resize(1024, 1024, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .toFile(tempPath);
      
      // Replace original with temp
      fs.renameSync(tempPath, inputPath);
      
      const newStats = fs.statSync(inputPath);
      const newSize = (newStats.size / 1024).toFixed(2);
      
      // Verify with metadata
      const newMetadata = await sharp(inputPath).metadata();
      console.log(`  ✓ Resized to ${newMetadata.width}x${newMetadata.height} (${newSize} KB)\n`);
      
    } catch (error) {
      console.error(`✗ Error processing ${pizza}:`, error.message);
      // Clean up temp file if it exists
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  }
  
  console.log('Pizza resize complete!');
}

resizePizzas();
