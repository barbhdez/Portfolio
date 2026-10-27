import raw from '../data/signature.svg?raw';

export type Stroke = { d: string; transform?: string };
export type Signature = { strokes: Stroke[]; viewBox: string };

export function loadSignature(svg: string = raw): Signature {
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 100 100';
  const strokes = Array.from(svg.matchAll(/<path([^>]*)>/g)).map((m) => ({
    d: m[1].match(/\sd="([^"]+)"/)?.[1] ?? '',
    transform: m[1].match(/transform="([^"]+)"/)?.[1],
  })).filter((s) => s.d);
  return { strokes, viewBox };
}
