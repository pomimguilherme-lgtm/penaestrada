const { Jimp, intToRGBA, rgbaToInt } = require('jimp');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, 'frontend/src/assets/logo-icon.png');
const OUT_DIR = path.join(__dirname, 'frontend/public/icons');

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const img = await Jimp.read(SRC);

  // 192x192
  const img192 = img.clone().resize({ w: 192, h: 192 });
  await img192.write(path.join(OUT_DIR, 'icon-192.png'));
  console.log('Gerado: icon-192.png');

  // 512x512
  const img512 = img.clone().resize({ w: 512, h: 512 });
  await img512.write(path.join(OUT_DIR, 'icon-512.png'));
  console.log('Gerado: icon-512.png');
}

main().catch(console.error);
