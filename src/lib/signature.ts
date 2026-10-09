// Uses src/data/signature.svg if present, otherwise renders config.signature with a script font.
import opentype from 'opentype.js';
import fs from 'node:fs';
import path from 'node:path';

const FONT = 'node_modules/@fontsource/mrs-saint-delafield/files/mrs-saint-delafield-latin-400-normal.woff';
const HAND_DRAWN = 'src/data/signature.svg';

export type Stroke = { d: string; transform?: string };
export type Signature = { strokes: Stroke[]; viewBox: string; handDrawn: boolean };

export function buildSignature(text: string): Signature {
  const file = path.resolve(HAND_DRAWN);
  if (fs.existsSync(file)) {
    const svg = fs.readFileSync(file, 'utf8');
    const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 100 100';
    const strokes = Array.from(svg.matchAll(/<path([^>]*)>/g)).map((m) => ({
      d: m[1].match(/\sd="([^"]+)"/)?.[1] ?? '',
      transform: m[1].match(/transform="([^"]+)"/)?.[1],
    })).filter((s) => s.d);
    return { strokes, viewBox, handDrawn: true };
  }
  const buf = fs.readFileSync(path.resolve(FONT));
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const size = 120;
  const strokes = font.getPaths(text, 0, size, size).map((p) => ({ d: p.toPathData(2) })).filter((s) => s.d.length > 0);
  const bb = font.getPath(text, 0, size, size).getBoundingBox();
  const m = 8;
  return {
    strokes, handDrawn: false,
    viewBox: `${(bb.x1 - m).toFixed(1)} ${(bb.y1 - m).toFixed(1)} ${(bb.x2 - bb.x1 + m * 2).toFixed(1)} ${(bb.y2 - bb.y1 + m * 2).toFixed(1)}`,
  };
}
