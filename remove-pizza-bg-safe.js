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

function isBackgroundPixel(data, offset) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const spread = Math.max(red, green, blue) - Math.min(red, green, blue);

  return red >= 185 && green >= 185 && blue >= 185 && spread <= 38;
}

function removeConnectedBackground(data, width, height) {
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const enqueue = (x, y) => {
    const index = y * width + x;
    if (visited[index]) return;

    const offset = index * 4;
    if (!isBackgroundPixel(data, offset)) return;

    visited[index] = 1;
    queue[tail++] = index;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    data[index * 4 + 3] = 0;

    if (x > 0) enqueue(x - 1, y);
    if (x < width - 1) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y < height - 1) enqueue(x, y + 1);
  }
}

async function processPizzas() {
  for (const filename of pizzas) {
    const inputPath = path.join(uploadsDir, filename);
    const tempPath = `${inputPath}.bg-temp`;

    if (!fs.existsSync(inputPath)) {
      console.log(`Missing: ${filename}`);
      continue;
    }

    const { data, info } = await sharp(inputPath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    removeConnectedBackground(data, info.width, info.height);

    await sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4
      }
    })
      .png()
      .toFile(tempPath);

    fs.renameSync(tempPath, inputPath);
    console.log(`Removed connected white background from ${filename}`);
  }
}

processPizzas().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
