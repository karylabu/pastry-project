const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, 'uploads');
const crops = {
  'Breakfast.png': { left: 102, top: 0, width: 820, height: 820 },
  'four_cheese.png': { left: 186, top: 0, width: 689, height: 689 },
  'Hawaiian.png': { left: 127, top: 0, width: 786, height: 786 },
  'Pepperoni.png': { left: 102, top: 0, width: 867, height: 867 },
  'Spinach.png': { left: 97, top: 0, width: 813, height: 813 },
  'Veggie.png': { left: 47, top: 0, width: 881, height: 881 },
  'meal7.png': { left: 3, top: 0, width: 1074, height: 1074 }
};

async function cropPizzaImages() {
  for (const [filename, crop] of Object.entries(crops)) {
    const inputPath = path.join(uploadsDir, filename);
    const tempPath = `${inputPath}.crop-temp`;

    if (!fs.existsSync(inputPath)) {
      console.log(`Missing: ${filename}`);
      continue;
    }

    await sharp(inputPath)
      .extract(crop)
      .resize(1024, 1024, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(tempPath);

    fs.renameSync(tempPath, inputPath);
    console.log(`Cropped text from ${filename}`);
  }
}

cropPizzaImages().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
