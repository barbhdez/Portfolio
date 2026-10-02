// Analiza el color dominante de cada miniatura (en el navegador, con un canvas diminuto)
// y devuelve una clave para ordenar: primero los colores del arcoíris, luego los grises.

export type Color = { tono: number; sat: number; luz: number; clave: number };

function rgbAHsv(r: number, g: number, b: number) {
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

function analizar(img: HTMLImageElement): Color {
  const L = 32;
  const c = document.createElement('canvas');
  c.width = c.height = L;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.drawImage(img, 0, 0, L, L);
  const px = x.getImageData(0, 0, L, L).data;
  const bins = new Float32Array(36);
  let sumS = 0, sumV = 0;
  for (let i = 0; i < px.length; i += 4) {
    const { h, s, v } = rgbAHsv(px[i], px[i + 1], px[i + 2]);
    sumS += s; sumV += v;
    const peso = s * v * (v > 0.12 ? 1 : 0); // cuentan los píxeles con color (y no los casi negros)
    bins[Math.floor(h / 10) % 36] += peso;
    bins[(Math.floor(h / 10) + 1) % 36] += peso * 0.5; // suavizado
  }
  let mejor = 0;
  bins.forEach((b, i) => { if (b > bins[mejor]) mejor = i; });
  const n = px.length / 4;
  const sat = sumS / n, luz = sumV / n;
  const tono = mejor * 10 + 5;
  // Fotos casi sin color: al final, de claras a oscuras
  // Fotos casi sin color: al final, de claras a oscuras. El resto, por tono (empezando en los rojos)
  const clave = sat < 0.12 ? 1000 + (1 - luz) * 100 : ((tono + 345) % 360) + luz * 0.5;
  return { tono, sat, luz, clave };
}

export function analizarColores(imgs: HTMLImageElement[], limite = 4000): Promise<Color[]> {
  const cargar = (img: HTMLImageElement) =>
    new Promise<HTMLImageElement>((ok) => {
      if (img.complete && img.naturalWidth) return ok(img);
      const copia = new Image();
      copia.onload = () => ok(copia);
      copia.onerror = () => ok(copia);
      copia.src = img.currentSrc || img.src;
    });
  const trabajo = Promise.all(imgs.map(cargar)).then((cargadas) =>
    cargadas.map((im) => { try { return im.naturalWidth ? analizar(im) : null; } catch { return null; } })
      .map((c) => c ?? { tono: 0, sat: 0, luz: 0.5, clave: 1050 })
  );
  const tope = new Promise<Color[]>((ok) => setTimeout(() => ok([]), limite));
  return Promise.race([trabajo, tope]);
}
