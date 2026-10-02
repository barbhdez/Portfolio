// ─────────────────────────────────────────────────────────────
//  Sonido, generado en el navegador (Web Audio) — sin archivos de audio.
//  · Fondo: playa en calma. Olas lentas y redondas, cada una algo distinta — nunca suena igual.
//  · Al pasar por una foto: un toque mínimo y apagado, muy suave, que no cansa.
//  · Sonidos del raspador de cerillas (frotar, prender, soplar).
//  Nota: los navegadores no dejan sonar nada hasta el primer clic o tecla en la página.
// ─────────────────────────────────────────────────────────────

const VOLUMEN_OLAS = 0.045;  // ⚙ volumen del mar de fondo (0 = sin mar)
const VOLUMEN_TOQUE = 0.03;  // ⚙ volumen del toque al pasar por una foto (0 = sin toque)

let ctx: AudioContext | null = null;
let salida: GainNode | null = null;
let mar: GainNode | null = null;
let ruido: AudioBuffer | null = null;
let ultimo = 0;

const azar = (a: number, b: number) => a + Math.random() * (b - a);

function impulsoReverb(c: AudioContext, segundos = 2.5) {
  const len = c.sampleRate * segundos;
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return buf;
}

function preparar() {
  if (ctx) return;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  ruido = ctx.createBuffer(2, ctx.sampleRate * 6, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ruido.getChannelData(ch);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const master = ctx.createGain();
  master.connect(ctx.destination);
  const rev = ctx.createConvolver();
  rev.buffer = impulsoReverb(ctx);
  const envio = ctx.createGain(); envio.gain.value = 0.3;
  rev.connect(master);
  salida = ctx.createGain();
  salida.connect(master);
  salida.connect(envio).connect(rev);
  mar = ctx.createGain();
  mar.gain.value = 0;
  mar.connect(master);
  if (VOLUMEN_OLAS > 0) iniciarMar();
}

// ───────── Mar de fondo, cambiante ─────────
function fondoMar() {
  // rumor continuo muy bajito (el mar lejano)
  if (!ctx || !mar || !ruido) return;
  const src = ctx.createBufferSource(); src.buffer = ruido; src.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 280;
  const g = ctx.createGain(); g.gain.value = 0.35;
  src.connect(lp).connect(g).connect(mar);
  src.start();
}

function ola() {
  if (!ctx || !mar || !ruido) return;
  const t = ctx.currentTime + 0.05;
  const fuerza = azar(0.5, 0.8);                // olas suaves, unas apenas más grandes que otras
  const subida = azar(4, 6.5);                 // llegan despacio
  const bajada = azar(6, 9.5);                 // y se retiran aún más despacio
  const fin = t + subida + bajada;
  const src = ctx.createBufferSource(); src.buffer = ruido; src.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.4;
  lp.frequency.setValueAtTime(azar(200, 260), t);
  lp.frequency.exponentialRampToValueAtTime(azar(480, 720), t + subida);   // sonido redondo, sin agudos
  lp.frequency.exponentialRampToValueAtTime(azar(200, 260), fin);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(fuerza, t + subida);
  g.gain.exponentialRampToValueAtTime(fuerza * 0.5, t + subida + bajada * 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, fin);
  const pan = ctx.createStereoPanner();
  pan.pan.setValueAtTime(azar(-0.35, 0.35), t);
  pan.pan.linearRampToValueAtTime(azar(-0.35, 0.35), fin);
  src.connect(lp).connect(g).connect(pan).connect(mar);
  src.start(t, azar(0, 5)); src.stop(fin + 0.1);

  // a veces, espuma al romper: un siseo fino que se retira
  if (Math.random() < 0.15) {
    const e = ctx.createBufferSource(); e.buffer = ruido; e.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = azar(1500, 2200); hp.Q.value = 0.6;
    const ge = ctx.createGain();
    const te = t + subida * 0.9;
    ge.gain.setValueAtTime(0.0001, te);
    ge.gain.exponentialRampToValueAtTime(fuerza * 0.04, te + 1.2);
    ge.gain.exponentialRampToValueAtTime(0.0001, te + bajada * 0.8);
    e.connect(hp).connect(ge).connect(pan);
    e.start(te, azar(0, 5)); e.stop(te + bajada);
  }
  // la siguiente ola: a veces enseguida (se solapan), a veces una pausa larga
  const siguiente = (subida + bajada) * azar(0.7, 1) + azar(0, 3);
  setTimeout(ola, siguiente * 1000);
}

function iniciarMar() {
  fondoMar();
  ola();
  setTimeout(ola, azar(6000, 9000)); // un segundo tren de olas, muy desfasado
}

// ───────── Toque al pasar por una foto ─────────
// Un "tap" muy corto y apagado (como rozar madera blanda); cada vez un pelín distinto.
export function sonar(_foto?: number, _tipo?: string) {
  if (!ctx || !salida || ctx.state !== 'running' || VOLUMEN_TOQUE <= 0) return;
  const t = ctx.currentTime;
  if (t - ultimo < 0.09) return;
  ultimo = t;
  const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
  const f = azar(430, 520);
  o.type = 'sine';
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * 0.82, t + 0.12);
  lp.type = 'lowpass'; lp.frequency.value = 1200;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(VOLUMEN_TOQUE, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  const pan = ctx.createStereoPanner(); pan.pan.value = azar(-0.3, 0.3);
  o.connect(g).connect(lp).connect(pan).connect(salida);
  o.start(t); o.stop(t + 0.2);
}

export function iniciarSonido() {
  const desbloquear = () => {
    const nuevo = !ctx;
    preparar();
    ctx?.resume();
    if (nuevo && ctx && mar) mar.gain.setTargetAtTime(VOLUMEN_OLAS, ctx.currentTime, 4); // el mar entra muy poco a poco
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => addEventListener(ev, desbloquear, { passive: true }));
}

// ───────── Sonidos del raspador de cerillas ─────────
type Punto = [number, number];
function ruidoF(t: number, dur: number, tipo: BiquadFilterType, f: number, q: number, env: Punto[], fEnv?: Punto[]) {
  if (!ctx || !salida || !ruido) return;
  const src = ctx.createBufferSource(); src.buffer = ruido;
  const fil = ctx.createBiquadFilter(); fil.type = tipo; fil.frequency.value = f; fil.Q.value = q;
  if (fEnv) { fil.frequency.setValueAtTime(f, t); for (const [dt, v] of fEnv) fil.frequency.exponentialRampToValueAtTime(v, t + dt); }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  for (const [dt, v] of env) g.gain.exponentialRampToValueAtTime(Math.max(v, 0.0001), t + dt);
  src.connect(fil).connect(g).connect(salida);
  src.start(t, Math.random() * 4); src.stop(t + dur);
}

export function sonidoRascar(intensidad = 0.6) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime, v = 0.04 + intensidad * 0.1;
  ruidoF(t, 0.12, 'bandpass', 3000 + intensidad * 2500, 1.4, [[0.01, v], [0.04, v * 0.3], [0.06, v * 0.8], [0.1, 0.0001]]);
}

export function sonidoPrender() {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  ruidoF(t, 0.1, 'bandpass', 5000, 1, [[0.01, 0.12], [0.08, 0.0001]]);
  ruidoF(t + 0.03, 0.9, 'lowpass', 300, 0.7, [[0.05, 0.18], [0.25, 0.07], [0.85, 0.0001]], [[0.09, 1700], [0.87, 450]]);
}

export function sonidoSoplar() {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  ruidoF(t, 0.9, 'lowpass', 400, 0.5, [[0.12, 0.14], [0.4, 0.08], [0.85, 0.0001]], [[0.15, 1200], [0.85, 350]]);
}

// Clic suave del interruptor de la lámpara
export function sonidoInterruptor(encender = true) {
  if (!ctx || !salida || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  ruidoF(t, 0.05, 'bandpass', encender ? 2600 : 1900, 2, [[0.002, 0.08], [0.03, 0.0001]]);
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.value = encender ? 900 : 650;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.02, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  o.connect(g).connect(salida); o.start(t); o.stop(t + 0.08);
}
