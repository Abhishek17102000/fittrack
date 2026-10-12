// Generates the PWA icons (pure Node, no deps): a dumbbell on a dark green tile.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'

function crc32(buf) {
  let c, crc = ~0
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return ~crc >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(size, draw) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = draw(x / size, y / size)
      const o = y * (size * 4 + 1) + 1 + x * 4
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ])
}
const BG = [11, 18, 16, 255], FG = [163, 230, 53, 255]
const rect = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1
// scale = how much of the tile the glyph uses (maskable needs a safe zone)
const glyph = (scale, round) => (u, v) => {
  const x = (u - 0.5) / scale + 0.5, y = (v - 0.5) / scale + 0.5
  if (round) { // rounded tile corners
    const cx = Math.min(u, 1 - u), cy = Math.min(v, 1 - v), r = 0.2
    if (cx < r && cy < r && (r - cx) ** 2 + (r - cy) ** 2 > r * r) return [0, 0, 0, 0]
  }
  const hit =
    rect(x, y, 0.22, 0.44, 0.78, 0.56) || // bar
    rect(x, y, 0.30, 0.30, 0.38, 0.70) || rect(x, y, 0.62, 0.30, 0.70, 0.70) || // inner plates
    rect(x, y, 0.20, 0.38, 0.28, 0.62) || rect(x, y, 0.72, 0.38, 0.80, 0.62) // outer plates
  return hit ? FG : BG
}
mkdirSync('public/icons', { recursive: true })
writeFileSync('public/icons/icon-192.png', png(192, glyph(1, true)))
writeFileSync('public/icons/icon-512.png', png(512, glyph(1, true)))
writeFileSync('public/icons/maskable-512.png', png(512, glyph(0.72, false)))
writeFileSync('public/icons/apple-touch-icon.png', png(180, glyph(0.85, false)))
console.log('icons written')

// Android launcher icons (legacy PNGs; the adaptive-icon XML from the template is removed so these are used)
const RES = 'android/app/src/main/res'
if (existsSync(RES)) {
  const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }
  for (const [d, s] of Object.entries(sizes)) {
    for (const name of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
      writeFileSync(`${RES}/mipmap-${d}/${name}`, png(s, glyph(name.includes('foreground') ? 0.72 : 1, true)))
    }
  }
  rmSync(`${RES}/mipmap-anydpi-v26`, { recursive: true, force: true })
  console.log('android icons written')
}
