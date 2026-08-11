import { deflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(value: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of value) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, checksum]);
}

/**
 * Produce a small but genuinely decodable 600 x 750 RGB portrait fixture.
 * Django's real minimum-dimension and content checks accept this image; the
 * earlier 1 x 1 fixture could only work when the upload endpoint was mocked.
 */
export function profilePortraitPng(red: number, green: number, blue: number): Buffer {
  const width = 600;
  const height = 750;
  const scanlineLength = 1 + width * 3;
  const pixels = Buffer.alloc(scanlineLength * height);

  for (let y = 0; y < height; y += 1) {
    const row = y * scanlineLength;
    pixels[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * 3;
      pixels[offset] = red;
      pixels[offset + 1] = green;
      pixels[offset + 2] = blue;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(pixels, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export const uploadPortraitPng = profilePortraitPng(134, 49, 79);
export const replacementPortraitPng = profilePortraitPng(38, 93, 125);
