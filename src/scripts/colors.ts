// Dominant hue of each thumbnail, used as a sort key (greys last).

export type Color = { hue: number; sat: number; light: number; key: number };

function rgbToHsv(r: number, g: number, b: number) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max / 255 };
}

function analyse(img: HTMLImageElement): Color {
  const L = 32;
  const c = document.createElement('canvas');
  c.width = c.height = L;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.drawImage(img, 0, 0, L, L);
  const px = x.getImageData(0, 0, L, L).data;
  const bins = new Float32Array(36);
  let sumS = 0, sumV = 0;
  for (let i = 0; i < px.length; i += 4) {
    const { h, s, v } = rgbToHsv(px[i], px[i + 1], px[i + 2]);
    sumS += s; sumV += v;
    const weight = s * v * (v > 0.12 ? 1 : 0);
    bins[Math.floor(h / 10) % 36] += weight;
    bins[(Math.floor(h / 10) + 1) % 36] += weight * 0.5;
  }
  let best = 0;
  bins.forEach((b, i) => { if (b > bins[best]) best = i; });
  const n = px.length / 4;
  const sat = sumS / n, light = sumV / n;
  const hue = best * 10 + 5;
  const key = sat < 0.12 ? 1000 + (1 - light) * 100 : ((hue + 345) % 360) + light * 0.5;
  return { hue, sat, light, key };
}

export function analyseColors(imgs: HTMLImageElement[], timeout = 4000): Promise<Color[]> {
  const load = (img: HTMLImageElement) =>
    new Promise<HTMLImageElement>((done) => {
      if (img.complete && img.naturalWidth) return done(img);
      const copy = new Image();
      copy.onload = () => done(copy);
      copy.onerror = () => done(copy);
      copy.src = img.currentSrc || img.src;
    });
  const work = Promise.all(imgs.map(load)).then((loaded) =>
    loaded.map((im) => { try { return im.naturalWidth ? analyse(im) : null; } catch { return null; } })
      .map((c) => c ?? { hue: 0, sat: 0, light: 0.5, key: 1050 })
  );
  const limit = new Promise<Color[]>((done) => setTimeout(() => done([]), timeout));
  return Promise.race([work, limit]);
}
