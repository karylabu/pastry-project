const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function makeTransparent(filePath) {
  const { data, info } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const out = Buffer.alloc(data.length);

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3] ?? 255;

    const isBackground = r > 230 && g > 230 && b > 230 && a > 200;

    if (isBackground) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
    } else {
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = a;
    }
  }

  await sharp(out, { raw: { width, height, channels } }).png().toFile(filePath);
  console.log('fixed transparent background:', filePath);
}

(async () => {
  const targets = [
    path.join(__dirname, '..', 'public', 'assets', 'logo.png'),
    path.join(__dirname, '..', '..', 'uploads', 'logo.png'),
  ];

  for (const target of targets) {
    if (fs.existsSync(target)) {
      await makeTransparent(target);
    }
  }
})();
