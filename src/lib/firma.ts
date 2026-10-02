// Firma del portfolio.
//  · Si existe src/data/firma.svg (la firma real, a trazos), se usa esa.
//  · Si no, se genera con una letra manuscrita a partir del texto de config.json ("firma").
import opentype from 'opentype.js';
import fs from 'node:fs';
import path from 'node:path';

const FUENTE = 'node_modules/@fontsource/mrs-saint-delafield/files/mrs-saint-delafield-latin-400-normal.woff';
const FIRMA_REAL = 'src/data/firma.svg';

export type Trazo = { d: string; transform?: string };
export type Firma = { trazos: Trazo[]; viewBox: string; real: boolean };

export function generarFirma(texto: string): Firma {
  const real = path.resolve(FIRMA_REAL);
  if (fs.existsSync(real)) {
    const svg = fs.readFileSync(real, 'utf8');
    const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 100 100';
    const trazos = Array.from(svg.matchAll(/<path([^>]*)>/g)).map((m) => ({
      d: m[1].match(/\sd="([^"]+)"/)?.[1] ?? '',
      transform: m[1].match(/transform="([^"]+)"/)?.[1],
    })).filter((t) => t.d);
    return { trazos, viewBox, real: true };
  }
  const buf = fs.readFileSync(path.resolve(FUENTE));
  const fuente = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const tam = 120;
  const trazos = fuente.getPaths(texto, 0, tam, tam).map((p) => ({ d: p.toPathData(2) })).filter((t) => t.d.length > 0);
  const bb = fuente.getPath(texto, 0, tam, tam).getBoundingBox();
  const m = 8;
  return {
    trazos, real: false,
    viewBox: `${(bb.x1 - m).toFixed(1)} ${(bb.y1 - m).toFixed(1)} ${(bb.x2 - bb.x1 + m * 2).toFixed(1)} ${(bb.y2 - bb.y1 + m * 2).toFixed(1)}`,
  };
}
