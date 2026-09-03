const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, 'uploads');
const files = [
  'americano.png', 'Capuccino.png', 'Latte.png', 'Whitechocolate.png',
  'Caramel2.png', 'Saltedcaramel.png', 'Mocha.png', 'Hazelnut.png',
  'Vanilla.png', 'Pastryprojlatte.png', 'Dirtymatcha.png', 'matcha.png'
];

const isBackground = (data, offset) => {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
  return red >= 185 && green >= 185 && blue >= 185 && spread <= 42;
};

function removeEdgeBackground(data, width, height) {
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const enqueue = (x, y) => {
    const index = y * width + x;
    if (visited[index] || !isBackground(data, index * 4)) return;
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

async function normalize() {
  for (const file of files) {
    const input = path.join(uploadsDir, file);
    const temp = `${input}.normalize-temp`;
    const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    removeEdgeBackground(data, info.width, info.height);
    await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
      .png()
      .toFile(temp);
    fs.renameSync(temp, input);
    const metadata = await sharp(input).metadata();
    console.log(`${file}: ${metadata.width}x${metadata.height}`);
  }
}

normalize().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
