const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Ensure directory exists
const iconsDir = path.join(__dirname, 'public', 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  let c = 0xffffffff;
  const table = [];
  for (let n = 0; n < 256; n++) {
    let v = n;
    for (let k = 0; k < 8; k++) v = (v & 1) ? (0xedb88320 ^ (v >>> 1)) : (v >>> 1);
    table[n] = v;
  }
  for (let i = 0; i < body.length; i++) c = table[(c ^ body[i]) & 0xff] ^ (c >>> 8);
  c = c ^ 0xffffffff;
  crc.writeUInt32BE(c >>> 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function generateAppIconPng(size, maskable = false) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = createChunk('IHDR', ihdrData);

  const rowSize = 1 + size * 4;
  const rawData = Buffer.alloc(rowSize * size);

  const cx = size / 2;
  const cy = size / 2;
  const radius = maskable ? size * 0.5 : size * 0.46;
  const innerRadius = size * 0.40;

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter byte: None

    for (let x = 0; x < size; x++) {
      const px = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);

      if (maskable) {
        // Full square fill for maskable
        const gradient = y / size;
        rawData[px] = Math.round(18 + 10 * gradient);     // R: #12~#1c
        rawData[px + 1] = Math.round(128 + 30 * gradient); // G: #80~#9e
        rawData[px + 2] = Math.round(55 + 20 * gradient);  // B: #37~#4b
        rawData[px + 3] = 255; // Alpha
      } else if (dist <= radius) {
        // Outer glowing circle
        if (dist > innerRadius) {
          // Ring accent (gold / light green glow)
          rawData[px] = 34;
          rawData[px + 1] = 197;
          rawData[px + 2] = 94;
          rawData[px + 3] = Math.round(255 * (1 - (dist - innerRadius) / (radius - innerRadius)));
        } else {
          // Inner emerald green base
          const gradient = y / size;
          rawData[px] = Math.round(21 + 15 * gradient);
          rawData[px + 1] = Math.round(128 + 40 * gradient);
          rawData[px + 2] = Math.round(61 + 25 * gradient);
          rawData[px + 3] = 255;
        }
      } else {
        rawData[px] = 0;
        rawData[px + 1] = 0;
        rawData[px + 2] = 0;
        rawData[px + 3] = 0;
      }

      // Draw stylized sprout / leaf motif in center
      // Center leaf 1: (stem & leaf curve)
      const nx = (x - cx) / (size * 0.25);
      const ny = (y - cy) / (size * 0.25);
      if (dist <= innerRadius) {
        // Leaf 1: upper right curve
        const leaf1 = (nx - 0.2) ** 2 + (ny + 0.3) ** 2 < 0.25 && (nx > ny);
        // Leaf 2: upper left curve
        const leaf2 = (nx + 0.3) ** 2 + (ny + 0.2) ** 2 < 0.22 && (-nx > ny);
        // Center stem
        const stem = Math.abs(nx + ny * 0.2) < 0.12 && ny > -0.6 && ny < 0.6;
        // Central marker / pin head
        const pinHead = nx ** 2 + (ny - 0.45) ** 2 < 0.08;

        if (leaf1 || leaf2 || stem || pinHead) {
          rawData[px] = 255;
          rawData[px + 1] = 255;
          rawData[px + 2] = 255;
          rawData[px + 3] = 245;
        }
      }
    }
  }

  const compressed = zlib.deflateSync(rawData, { level: 9 });
  const idat = createChunk('IDAT', compressed);
  const iend = createChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([signature, ihdr, idat, iend]);
}

// Generate PNG icons
const icon192 = generateAppIconPng(192, false);
fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), icon192);
console.log('✅ Generated public/icons/icon-192.png (' + icon192.length + ' bytes)');

const icon512 = generateAppIconPng(512, false);
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), icon512);
console.log('✅ Generated public/icons/icon-512.png (' + icon512.length + ' bytes)');

const iconMaskable = generateAppIconPng(512, true);
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-512.png'), iconMaskable);
console.log('✅ Generated public/icons/icon-maskable-512.png (' + iconMaskable.length + ' bytes)');

// Also generate SVG icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#15803d" />
      <stop offset="100%" stop-color="#0f5132" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4ade80" />
      <stop offset="100%" stop-color="#22c55e" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="0.3"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="128" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="210" fill="none" stroke="url(#accent)" stroke-width="6" stroke-dasharray="16 8" opacity="0.6"/>
  <!-- Stylized Seed & GPS Pin Icon -->
  <g filter="url(#glow)">
    <!-- Location Pin Base -->
    <path d="M256 90 C180 90, 120 150, 120 226 C120 310, 230 410, 256 430 C282 410, 392 310, 392 226 C392 150, 332 90, 256 90 Z" fill="#ffffff" />
    <!-- Inner Green Circle -->
    <circle cx="256" cy="220" r="70" fill="url(#bg)" />
    <!-- Sprout / Plant Leaves -->
    <path d="M256 260 C256 210, 290 180, 310 180 C310 210, 280 245, 256 260 Z" fill="#22c55e" />
    <path d="M256 260 C256 200, 220 185, 205 195 C205 225, 235 250, 256 260 Z" fill="#4ade80" />
    <circle cx="256" cy="270" r="8" fill="#ffffff" />
  </g>
</svg>`;
fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgContent);
console.log('✅ Generated public/icons/icon.svg');
