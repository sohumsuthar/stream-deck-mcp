import sharp from 'sharp';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const SIZE = 144;
const HALF = SIZE / 2;

const V3_PAGE2 = 'C:/Users/sohum/AppData/Roaming/Elgato/StreamDeck/ProfilesV3/E99F842A-1239-4D16-A7EB-2713D98ED6FE.sdProfile/Profiles/F1D2A0CE-962A-4C62-9B7C-54B70A5CEE13';
const V3_PAGE3 = 'C:/Users/sohum/AppData/Roaming/Elgato/StreamDeck/ProfilesV3/E99F842A-1239-4D16-A7EB-2713D98ED6FE.sdProfile/Profiles/C7E8F9A0-B1D2-4E3F-A567-890123456789';
const V2_PAGE2 = 'C:/Users/sohum/AppData/Roaming/Elgato/StreamDeck/ProfilesV2/E99F842A-1239-4D16-A7EB-2713D98ED6FE.sdProfile/Profiles/V79A1JKM596656RSAIRGKN7E2CZ';
const V2_PAGE3 = 'C:/Users/sohum/AppData/Roaming/Elgato/StreamDeck/ProfilesV2/E99F842A-1239-4D16-A7EB-2713D98ED6FE.sdProfile/Profiles/LGTCLRPG3XMHF2BQWZ7KVSNTJR';

async function svgToPng(svg) {
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// Power/toggle icon - circle with gap + vertical line
async function toggleIcon() {
  const svg = `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#1a1a1a" rx="16"/>
    <path d="${describeArc(HALF, HALF+6, 38, 40, 320)}" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round"/>
    <line x1="${HALF}" y1="${HALF-38}" x2="${HALF}" y2="${HALF+6}" stroke="#ffffff" stroke-width="8" stroke-linecap="round"/>
  </svg>`;
  return svgToPng(svg);
}

// Sun icon for brightness up
async function brightUpIcon() {
  const cx = HALF, cy = HALF;
  const rays = Array.from({length: 8}, (_, i) => {
    const a = (i * 45) * Math.PI / 180;
    const x1 = cx + Math.cos(a) * 30;
    const y1 = cy + Math.sin(a) * 30;
    const x2 = cx + Math.cos(a) * 46;
    const y2 = cy + Math.sin(a) * 46;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#FFD700" stroke-width="6" stroke-linecap="round"/>`;
  }).join('');
  const svg = `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#1a1a1a" rx="16"/>
    <circle cx="${cx}" cy="${cy}" r="22" fill="#FFD700"/>
    ${rays}
  </svg>`;
  return svgToPng(svg);
}

// Dim moon icon for brightness down
async function brightDownIcon() {
  const svg = `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#1a1a1a" rx="16"/>
    <circle cx="${HALF}" cy="${HALF}" r="32" fill="#555555"/>
    <circle cx="${HALF+16}" cy="${HALF-10}" r="28" fill="#1a1a1a"/>
  </svg>`;
  return svgToPng(svg);
}

// Color wheel icon
async function colorsIcon() {
  const colors = ['#ff0000','#ff8800','#ffdd00','#00ff00','#00ddff','#0044ff','#aa00ff','#ff44aa'];
  const slices = colors.map((c, i) => {
    const startAngle = i * 45;
    const endAngle = (i + 1) * 45;
    const r = 42;
    const x1 = HALF + r * Math.cos(startAngle * Math.PI / 180);
    const y1 = HALF + r * Math.sin(startAngle * Math.PI / 180);
    const x2 = HALF + r * Math.cos(endAngle * Math.PI / 180);
    const y2 = HALF + r * Math.sin(endAngle * Math.PI / 180);
    return `<path d="M ${HALF} ${HALF} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z" fill="${c}"/>`;
  }).join('');
  const svg = `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#1a1a1a" rx="16"/>
    ${slices}
    <circle cx="${HALF}" cy="${HALF}" r="14" fill="#1a1a1a"/>
  </svg>`;
  return svgToPng(svg);
}

// Solid color fill with rounded corners
async function colorFill(color) {
  const svg = `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${color}" rx="12"/>
  </svg>`;
  return svgToPng(svg);
}

// White preset with warm/cool tint and small icon
async function whitePreset(color, label) {
  const svg = `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#1a1a1a" rx="16"/>
    <circle cx="${HALF}" cy="${HALF-4}" r="36" fill="${color}" opacity="0.9"/>
  </svg>`;
  return svgToPng(svg);
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const large = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`;
}

function polarToCartesian(cx, cy, r, angle) {
  const rad = (angle - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

async function saveIcon(buf, filename, dirs) {
  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, filename), buf);
  }
  console.log(`  ${filename}`);
}

async function main() {
  const page2Dirs = [V3_PAGE2, V2_PAGE2];
  const page3Dirs = [V3_PAGE3, V2_PAGE3];

  console.log('Generating page 2 icons...');
  await saveIcon(await toggleIcon(), 'toggle.png', page2Dirs);
  await saveIcon(await brightUpIcon(), 'bright-up.png', page2Dirs);
  await saveIcon(await brightDownIcon(), 'bright-down.png', page2Dirs);
  await saveIcon(await colorsIcon(), 'colors.png', page2Dirs);

  console.log('Generating page 3 color icons...');
  await saveIcon(await colorFill('#ee1111'), 'color-red.png', page3Dirs);
  await saveIcon(await colorFill('#ff7700'), 'color-orange.png', page3Dirs);
  await saveIcon(await colorFill('#ffcc00'), 'color-yellow.png', page3Dirs);
  await saveIcon(await colorFill('#00cc44'), 'color-green.png', page3Dirs);
  await saveIcon(await colorFill('#00bbdd'), 'color-cyan.png', page3Dirs);
  await saveIcon(await colorFill('#2244ee'), 'color-blue.png', page3Dirs);
  await saveIcon(await colorFill('#8822dd'), 'color-purple.png', page3Dirs);
  await saveIcon(await colorFill('#ee44aa'), 'color-pink.png', page3Dirs);
  await saveIcon(await whitePreset('#ffcc88'), 'white-warm.png', page3Dirs);
  await saveIcon(await whitePreset('#fffef0'), 'white-daylight.png', page3Dirs);
  await saveIcon(await whitePreset('#ccddff'), 'white-cool.png', page3Dirs);

  console.log('Done!');
}

main().catch(console.error);
