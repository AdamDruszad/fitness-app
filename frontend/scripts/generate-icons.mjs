// Deterministic raster brand assets, without a runtime graphics dependency.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
const crc = bytes => { let c = 0xffffffff; for (const b of bytes) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); } return (c ^ 0xffffffff) >>> 0; };
function chunk(name, bytes) { const type = Buffer.from(name); const size = Buffer.alloc(4); size.writeUInt32BE(bytes.length); const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc(Buffer.concat([type, bytes]))); return Buffer.concat([size, type, bytes, checksum]); }
mkdirSync(new URL("../public/icons/", import.meta.url), { recursive: true });
for (const size of [192, 512]) {
  const pixels = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const slant = x / size + y / size * .17;
    const accent = y > size * .26 && y < size * .74 && slant > .40 && slant < .72;
    const i = y * (size * 4 + 1) + 1 + x * 4;
    pixels.set(accent ? [216, 90, 48, 255] : [22, 23, 29, 255], i);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  writeFileSync(new URL(`../public/icons/icon-${size}.png`, import.meta.url), Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk("IHDR", header), chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]));
}
