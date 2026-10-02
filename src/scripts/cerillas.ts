// ─────────────────────────────────────────────────────────────
//  Raspador de cerillas: controla la luz de la web.
//  El ratón es la cerilla: bájalo RÁPIDO por la tira de la derecha y prende.
//   0 llamas · oscuridad (modo cine)
//   1 llama  · penumbra cálida con un halo que sigue al ratón
//   2 llamas · luz cálida de papel antiguo
//   3 llamas · luz de día
//  · Cada llama se consume sola en 2:30 (DURACION) y baja un nivel de luz.
//  · "Blow out" las apaga todas de golpe. "Mic": si soplas al micrófono, también.
// ─────────────────────────────────────────────────────────────
import { gsap } from 'gsap';
import { sonidoRascar, sonidoPrender, sonidoSoplar } from './sonido';

const MAX = 3;
const DURACION = 150_000;   // ⚙ lo que dura cada llama (ms) → 2 min 30 s
const ENERGIA = 200;        // ⚙ cuánto hay que frotar para que prenda (más = más difícil)
const VEL_MINIMA = 0.7;     // ⚙ velocidad mínima hacia abajo (px/ms) para que cuente
const UMBRAL_SOPLO = 0.13;  // ⚙ sensibilidad del micrófono (más bajo = más sensible)
const NOMBRES = ['Dark', 'One flame', 'Two flames', 'Daylight'];

type Llama = { k: number; t0: number };

export function iniciarCerillas() {
  const html = document.documentElement;
  const raspador = document.getElementById('raspador');
  const pista = document.querySelector<HTMLElement>('.cerillas-pista');
  const btnSoplar = document.getElementById('soplar-btn') as HTMLButtonElement | null;
  const btnMic = document.getElementById('mic-btn') as HTMLButtonElement | null;
  const chispas = document.getElementById('chispas');
  const luz = document.getElementById('luz-llama');
  const llamaCursor = document.getElementById('llama-cursor');
  if (!raspador || !pista || !btnSoplar || !chispas || !luz || !llamaCursor) return;
  const indicadores = Array.from(document.querySelectorAll<HTMLElement>('.llamita'));
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ahora = () => Date.now();

  // ───────── Estado (se guarda: al recargar siguen ardiendo) ─────────
  let llamas: Llama[] = [];
  try { llamas = JSON.parse(localStorage.getItem('cerillas') || '[]'); } catch (e) {}
  llamas = llamas.filter((c) => c.t0 + DURACION > ahora() && c.k >= 0 && c.k < MAX).slice(0, MAX);
  const guardar = () => { try { localStorage.setItem('cerillas', JSON.stringify(llamas)); } catch (e) {} };
  let nivel = llamas.length;
  let pistaBase = '';

  const decir = (t: string, ms = 1600) => {
    pista.textContent = t;
    gsap.delayedCall(ms / 1000, () => { if (pista.textContent === t) pista.textContent = pistaBase; });
  };

  function pintar() {
    html.dataset.luz = String(nivel);
    html.dataset.tema = nivel >= 2 ? 'claro' : 'oscuro';
    btnSoplar!.disabled = nivel === 0;
    raspador!.setAttribute('aria-label', `Striker: swipe down quickly to light a match (now: ${NOMBRES[nivel]})`);
    pistaBase = nivel >= MAX ? 'Full light' : nivel === 0 ? 'Swipe down to light' : 'Again for more light';
    pista!.textContent = pistaBase;
    indicadores.forEach((el, k) => el.classList.toggle('viva', llamas.some((c) => c.k === k)));
    const meta = document.querySelector('meta[name="theme-color"]');
    requestAnimationFrame(() => meta?.setAttribute('content', getComputedStyle(document.body).backgroundColor));
  }

  // Transición: fundido suave entre un nivel de luz y otro
  function cambiarNivel(nuevo: number, _x = 0, _y = 0) {
    // el fundido lo hace el CSS (los colores están registrados con @property y tienen transición),
    // así la página sigue respondiendo mientras cambia la luz
    nivel = nuevo;
    pintar();
  }

  pintar();

  const centroIndicador = (k: number) => {
    const r = indicadores[k].getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  // ───────── Apagar ─────────
  function apagar(lista: Llama[], porSoplido: boolean) {
    if (!lista.length) return;
    if (porSoplido) sonidoSoplar();
    const ref = centroIndicador(lista[lista.length - 1].k);
    const quitar = new Set(lista.map((c) => c.k));
    llamas = llamas.filter((c) => !quitar.has(c.k));
    guardar();
    lista.forEach((c) => {
      const el = indicadores[c.k];
      const humo = document.createElement('i');
      humo.className = 'humito';
      el.appendChild(humo);
      gsap.fromTo(humo, { opacity: 0.7, y: 0, scaleY: 0.4 }, { opacity: 0, y: -22, scaleY: 1.4, duration: 1.4, ease: 'power1.out', onComplete: () => humo.remove() });
    });
    gsap.delayedCall(porSoplido ? 0.1 : 0.6, () => cambiarNivel(llamas.length, ref.x, ref.y));
  }
  const soplarTodo = () => apagar([...llamas], true);

  // Cada fotograma: el tiempo restante de cada llama (barrita bajo el icono)
  gsap.ticker.add(() => {
    const t = ahora();
    const gastadas: Llama[] = [];
    for (const c of llamas) {
      const p = Math.min(1, (t - c.t0) / DURACION);
      indicadores[c.k].style.setProperty('--resta', String(1 - p));
      indicadores[c.k].classList.toggle('acabando', p > 0.9);
      if (p >= 1) gastadas.push(c);
    }
    if (gastadas.length) apagar(gastadas, false);
  });

  // ───────── Encender: bajar el ratón rápido por la tira ─────────
  let energia = 0, bloqueado = false, subida = 0;
  let ultimo = { x: 0, y: 0, t: 0 }, ultimoRasc = 0;

  function soltarChispas(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const c = document.createElement('i');
      chispas!.appendChild(c);
      const a = Math.PI + (Math.random() - 0.5) * 2.2, d = 12 + Math.random() * 36;
      gsap.fromTo(c, { x, y, opacity: 1, scale: 0.6 + Math.random() },
        { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.6 + 14, opacity: 0, duration: 0.3 + Math.random() * 0.4, ease: 'power2.out', onComplete: () => c.remove() });
    }
  }

  function prender(x: number, y: number) {
    const libres = [0, 1, 2].filter((k) => !llamas.some((c) => c.k === k));
    if (!libres.length) return;
    llamas.push({ k: libres[0], t0: ahora() });
    guardar();
    sonidoPrender();
    soltarChispas(x, y, 16);
    // la llama aparece en la punta del cursor y se queda un momento
    gsap.killTweensOf(llamaCursor);
    gsap.set(llamaCursor, { display: 'block', left: x - 9, top: y - 26, opacity: 1 });
    gsap.timeline()
      .fromTo(llamaCursor, { scale: 0 }, { scale: 1.6, duration: 0.12, ease: 'power2.out', transformOrigin: '50% 100%' })
      .to(llamaCursor, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' })
      .to(llamaCursor, { opacity: 0, duration: 1, delay: 1.8, onComplete: () => { gsap.set(llamaCursor, { display: 'none' }); } });
    cambiarNivel(llamas.length, x, y);
    decir(llamas.length >= MAX ? 'Full light' : 'Lit!');
  }

  raspador.addEventListener('pointerenter', (ev) => {
    ultimo = { x: ev.clientX, y: ev.clientY, t: performance.now() };
    energia = 0; bloqueado = false; subida = 0;
  });
  raspador.addEventListener('pointerleave', () => { energia = 0; bloqueado = false; });
  raspador.addEventListener('pointermove', (ev) => {
    const t = performance.now(), dt = Math.max(1, t - ultimo.t);
    const vy = (ev.clientY - ultimo.y) / dt;
    ultimo = { x: ev.clientX, y: ev.clientY, t };
    if (bloqueado) {
      // para encender otra hay que salir de la tira o volver a subir el ratón
      if (vy < 0) subida += -vy * dt;
      if (subida > 60) { bloqueado = false; subida = 0; energia = 0; }
      return;
    }
    if (llamas.length >= MAX) return;
    if (vy > VEL_MINIMA) {
      energia += vy * dt;
      soltarChispas(ev.clientX, ev.clientY, Math.min(5, Math.floor(vy * 1.5)));
      if (t - ultimoRasc > 60) { sonidoRascar(Math.min(1, vy / 3)); ultimoRasc = t; }
      if (energia > ENERGIA) { bloqueado = true; energia = 0; prender(ev.clientX, ev.clientY); }
    } else if (vy > 0.05) {
      energia *= 0.9;
      if (Math.random() < 0.04) decir('Faster!', 900);
    }
  });
  if (llamas.length >= MAX) bloqueado = true;

  // Teclado (Enter / Espacio sobre la tira): enciende directamente
  raspador.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    ev.preventDefault();
    const r = raspador.getBoundingClientRect();
    prender(r.left + r.width / 2, r.top + r.height / 2);
  });

  // ───────── Apagar de golpe ─────────
  btnSoplar.addEventListener('click', soplarTodo);

  // ───────── Soplar al micrófono ─────────
  let mic: { stream: MediaStream; ctx: AudioContext; raf: number } | null = null;
  if (!navigator.mediaDevices?.getUserMedia) btnMic?.remove();
  btnMic?.addEventListener('click', async () => {
    if (mic) {
      cancelAnimationFrame(mic.raf); mic.stream.getTracks().forEach((t) => t.stop()); mic.ctx.close(); mic = null;
      btnMic.setAttribute('aria-pressed', 'false'); btnMic.textContent = 'Mic';
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const ctx = new AudioContext();
      const an = ctx.createAnalyser(); an.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(an);
      const datos = new Float32Array(an.fftSize);
      let seguidos = 0, espera = 0;
      const escuchar = () => {
        an.getFloatTimeDomainData(datos);
        let suma = 0; for (const d of datos) suma += d * d;
        const rms = Math.sqrt(suma / datos.length);
        seguidos = rms > UMBRAL_SOPLO ? seguidos + 1 : 0;
        if (espera > 0) espera--;
        if (seguidos > 6 && espera === 0 && llamas.length) { soplarTodo(); espera = 90; seguidos = 0; }
        if (mic) mic.raf = requestAnimationFrame(escuchar);
      };
      mic = { stream, ctx, raf: requestAnimationFrame(escuchar) };
      btnMic.setAttribute('aria-pressed', 'true'); btnMic.textContent = 'Mic on · blow!';
    } catch (e) {
      btnMic.textContent = 'Mic blocked';
    }
  });

  // ───────── Halo de la llama que sigue al ratón (niveles 1 y 2) ─────────
  const p = { x: innerWidth / 2, y: innerHeight * 0.4, sx: innerWidth / 2, sy: innerHeight * 0.4 };
  addEventListener('pointermove', (ev) => {
    if (ev.pointerType === 'mouse') { p.x = ev.clientX; p.y = ev.clientY; }
    if (llamaCursor.style.display === 'block') gsap.set(llamaCursor, { left: ev.clientX - 9, top: ev.clientY - 26 });
  });
  gsap.ticker.add((t) => {
    if (nivel === 0 || nivel === MAX) return;
    p.sx += (p.x - p.sx) * 0.12; p.sy += (p.y - p.sy) * 0.12;
    const parpadeo = 1 + Math.sin(t * 13) * 0.03 + Math.sin(t * 29) * 0.02 + (Math.random() - 0.5) * 0.03;
    luz.style.setProperty('--mx', `${p.sx.toFixed(0)}px`);
    luz.style.setProperty('--my', `${p.sy.toFixed(0)}px`);
    luz.style.setProperty('--parpadeo', parpadeo.toFixed(3));
  });
}
