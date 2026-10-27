// All sound is synthesised with Web Audio: background sea, hover tap, lamp switch.

const SEA_VOLUME = 0.045;
const TAP_VOLUME = 0.03;

let ctx: AudioContext | null = null;
let fx: GainNode | null = null;
let sea: GainNode | null = null;
let noise: AudioBuffer | null = null;
let lastTap = 0;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function reverbImpulse(c: AudioContext, seconds = 2.5) {
  const len = c.sampleRate * seconds;
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return buf;
}

function setup() {
  if (ctx) return;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  noise = ctx.createBuffer(2, ctx.sampleRate * 6, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = noise.getChannelData(ch);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const master = ctx.createGain();
  master.connect(ctx.destination);
  const reverb = ctx.createConvolver();
  reverb.buffer = reverbImpulse(ctx);
  const send = ctx.createGain(); send.gain.value = 0.3;
  reverb.connect(master);
  fx = ctx.createGain();
  fx.connect(master);
  fx.connect(send).connect(reverb);
  sea = ctx.createGain();
  sea.gain.value = 0;
  sea.connect(master);
  if (SEA_VOLUME > 0) startSea();
}

function distantSea() {
  if (!ctx || !sea || !noise) return;
  const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 280;
  const g = ctx.createGain(); g.gain.value = 0.35;
  src.connect(lp).connect(g).connect(sea);
  src.start();
}

function wave() {
  if (!ctx || !sea || !noise) return;
  const t = ctx.currentTime + 0.05;
  const strength = rand(0.5, 0.8);
  const rise = rand(4, 6.5);
  const fall = rand(6, 9.5);
  const end = t + rise + fall;
  const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.4;
  lp.frequency.setValueAtTime(rand(200, 260), t);
  lp.frequency.exponentialRampToValueAtTime(rand(480, 720), t + rise);
  lp.frequency.exponentialRampToValueAtTime(rand(200, 260), end);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(strength, t + rise);
  g.gain.exponentialRampToValueAtTime(strength * 0.5, t + rise + fall * 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  const pan = ctx.createStereoPanner();
  pan.pan.setValueAtTime(rand(-0.35, 0.35), t);
  pan.pan.linearRampToValueAtTime(rand(-0.35, 0.35), end);
  src.connect(lp).connect(g).connect(pan).connect(sea);
  src.start(t, rand(0, 5)); src.stop(end + 0.1);

  // occasional foam
  if (Math.random() < 0.15) {
    const foam = ctx.createBufferSource(); foam.buffer = noise; foam.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = rand(1500, 2200); bp.Q.value = 0.6;
    const gf = ctx.createGain();
    const tf = t + rise * 0.9;
    gf.gain.setValueAtTime(0.0001, tf);
    gf.gain.exponentialRampToValueAtTime(strength * 0.04, tf + 1.2);
    gf.gain.exponentialRampToValueAtTime(0.0001, tf + fall * 0.8);
    foam.connect(bp).connect(gf).connect(pan);
    foam.start(tf, rand(0, 5)); foam.stop(tf + fall);
  }
  const next = (rise + fall) * rand(0.7, 1) + rand(0, 3);
  setTimeout(wave, next * 1000);
}

function startSea() {
  distantSea();
  wave();
  setTimeout(wave, rand(6000, 9000));
}

export function tap() {
  if (!ctx || !fx || ctx.state !== 'running' || TAP_VOLUME <= 0) return;
  const t = ctx.currentTime;
  if (t - lastTap < 0.09) return;
  lastTap = t;
  const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
  const f = rand(430, 520);
  o.type = 'sine';
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * 0.82, t + 0.12);
  lp.type = 'lowpass'; lp.frequency.value = 1200;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(TAP_VOLUME, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  const pan = ctx.createStereoPanner(); pan.pan.value = rand(-0.3, 0.3);
  o.connect(g).connect(lp).connect(pan).connect(fx);
  o.start(t); o.stop(t + 0.2);
}

export function switchClick(on = true) {
  if (!ctx || !fx || !noise || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noise;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = on ? 2600 : 1900; bp.Q.value = 2;
  const gn = ctx.createGain();
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.exponentialRampToValueAtTime(0.08, t + 0.002);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  src.connect(bp).connect(gn).connect(fx);
  src.start(t, Math.random() * 4); src.stop(t + 0.05);
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.value = on ? 900 : 650;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.02, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  o.connect(g).connect(fx); o.start(t); o.stop(t + 0.08);
}

export function initSound() {
  const unlock = () => {
    const first = !ctx;
    setup();
    ctx?.resume();
    if (first && ctx && sea) sea.gain.setTargetAtTime(SEA_VOLUME, ctx.currentTime, 4);
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => addEventListener(ev, unlock, { passive: true }));
}
