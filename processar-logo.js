// Gera logo-icon.png (apenas símbolo) e refina logo.png (completo)
const { Jimp, intToRGBA, rgbaToInt } = require('jimp');
const path = require('path');

const ASSETS = path.join(__dirname, 'frontend/src/assets');
const SRC    = path.join(ASSETS, 'logo.png');
const FULL   = path.join(ASSETS, 'logo.png');       // logo completo (já existe)
const ICON   = path.join(ASSETS, 'logo-icon.png');  // só o símbolo

async function main() {
  const img = await Jimp.read(SRC);
  const W   = img.bitmap.width;
  const H   = img.bitmap.height;

  console.log(`Logo original: ${W}x${H}px`);

  // ── Contar pixels visíveis por linha ─────────────────────────────────────
  const rowPixels = new Int32Array(H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (intToRGBA(img.getPixelColor(x, y)).a > 20) rowPixels[y]++;
    }
  }

  // ── Encontrar o gap entre símbolo e texto ────────────────────────────────
  // Procura a primeira linha vazia (ou quase) depois do meio vertical
  const mid = Math.floor(H * 0.4); // começa a buscar do 40% pra baixo
  let gapStart = -1;
  let gapEnd   = -1;

  for (let y = mid; y < H; y++) {
    if (rowPixels[y] <= 2) {
      if (gapStart === -1) gapStart = y;
      gapEnd = y;
    } else if (gapStart !== -1 && gapEnd !== -1 && y - gapEnd > 5) {
      break; // gap real encontrado
    }
  }

  // Fallback: cortar em 55% da altura se não achar gap
  const corte = gapStart !== -1 ? gapStart : Math.floor(H * 0.55);
  console.log(`Gap detectado na linha ${corte} (de ${H})`);

  // ── Versão ícone: apenas o símbolo (acima do gap) ────────────────────────
  const icon = img.clone();
  icon.crop({ x: 0, y: 0, w: W, h: corte });

  // Auto-crop horizontal do ícone (remover colunas transparentes)
  let minX = W, maxX = 0;
  for (let y = 0; y < icon.bitmap.height; y++) {
    for (let x = 0; x < W; x++) {
      if (intToRGBA(icon.getPixelColor(x, y)).a > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }
  const padH = 8;
  minX = Math.max(0, minX - padH);
  maxX = Math.min(W - 1, maxX + padH);
  icon.crop({ x: minX, y: 0, w: maxX - minX + 1, h: corte });

  // Upscale 2× para nitidez (depois o CSS reduz para 40px)
  const iW = icon.bitmap.width;
  const iH = icon.bitmap.height;
  icon.resize({ w: iW * 2, h: iH * 2 });

  await icon.write(ICON);
  console.log(`✓ logo-icon.png salvo: ${icon.bitmap.width}x${icon.bitmap.height}px`);

  // ── Versão completa: manter tudo, só refinar ─────────────────────────────
  // Upscale 1.5× para mais nitidez na tela de login
  const full = img.clone();
  full.resize({ w: Math.round(W * 1.5), h: Math.round(H * 1.5) });
  await full.write(FULL);
  console.log(`✓ logo.png refinado: ${full.bitmap.width}x${full.bitmap.height}px`);
}

main().catch(console.error);
