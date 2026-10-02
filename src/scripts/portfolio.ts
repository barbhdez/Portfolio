// ─────────────────────────────────────────────────────────────
//  Lógica del portfolio: anillo animado, zoom (visor) e índice.
//  Los números marcados con  ⚙  son buenos para trastear.
// ─────────────────────────────────────────────────────────────
import { gsap } from 'gsap';
import { sonar } from './sonido';
import type { Color } from './colores';

type Estado = {
  el: HTMLElement;
  ratio: number;
  ang: number;   // ángulo base en el anillo
  rad: number;   // radio base
  prof: number;  // 0..1, cuánto le afecta el parallax
  k: number;     // 0 = en el centro, 1 = en su sitio del anillo
  vuelta: number;// giro extra mientras viaja en espiral (se anula al llegar)
  z: number;     // capa (la foto de portada va delante durante la intro)
  pos: number;   // posición actual en el anillo (para la melodía)
  sc: number;    // escala
  foco: number;  // 0..1: cuánto ha crecido al dejar el ratón encima
  pilaY: number; // posición en la columna de la intro
  op: number;    // opacidad
};

const VEL_GIRO = 0.035;   // ⚙ velocidad de giro automático (radianes/seg)
const PARALLAX = 22;      // ⚙ px que se mueve el anillo con el ratón
const ALTO_FOCO = 0.4;    // ⚙ al dejar el ratón encima, la foto crece hasta este % del alto de pantalla
const TIEMPO_FOCO = 1;    // ⚙ segundos que tarda en crecer y centrarse

export function iniciarPortfolio(colores: Color[] = []) {
  const escena = document.getElementById('escena')!;
  const els = Array.from(escena.querySelectorAll<HTMLElement>('.item'));
  const N = els.length;
  if (!N) return;

  const contador = document.getElementById('contador')!;
  const tituloHover = document.getElementById('titulo-hover')!;
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const estados: Estado[] = els.map((el) => ({
    el, ratio: parseFloat(getComputedStyle(el).getPropertyValue('--ratio')) || 1,
    ang: 0, rad: 0, prof: 0, k: 0, vuelta: 0, z: 1, pos: 0, sc: 0, foco: 0, pilaY: 0, op: 0,
  }));

  // ───────── Distribución en anillos concéntricos ─────────
  // "huecos" = posiciones del anillo ordenadas por ángulo. "orden[k]" = qué foto va en el hueco k.
  let lado = 56, rMax = 300;
  let huecos: { ang: number; rad: number; prof: number }[] = [];
  let orden: number[] = estados.map((_, i) => i);

  function calcularHuecos() {
    const vw = innerWidth, vh = innerHeight;
    rMax = Math.min(vw, vh) * (vw < 700 ? 0.42 : 0.355);
    let anillos: { r: number; cap: number }[] = [];
    // Busca el tamaño de miniatura más grande con el que caben todas
    for (lado = 110; lado > 14; lado -= 2) {
      const rMin = Math.max(rMax * 0.7, lado * 1.6); // ⚙ 0.7 = anillo estrecho (todas las fotos en la corona)
      anillos = [];
      for (let r = rMin; r <= rMax; r += lado * 1.25) {
        anillos.push({ r, cap: Math.floor((Math.PI * 2 * r) / (lado * 1.45)) });
      }
      if (anillos.reduce((s, a) => s + a.cap, 0) >= N) break;
    }
    const capTotal = anillos.reduce((s, a) => s + a.cap, 0);
    huecos = [];
    let i = 0;
    anillos.forEach((a, j) => {
      const n = j === anillos.length - 1 ? N - i : Math.round((a.cap / capTotal) * N);
      for (let m = 0; m < n && i < N; m++, i++) {
        const azar = pseudo(i);
        huecos.push({
          ang: j * 0.9 + (m / n) * Math.PI * 2 + (azar - 0.5) * (0.6 / n) * Math.PI,
          rad: a.r + (pseudo(i + 99) - 0.5) * lado * 0.35,
          prof: a.r / rMax,
        });
      }
    });
    // Ordenados por ángulo: así los grupos (colores, lugares) forman "porciones" del círculo
    const norm = (x: number) => ((x % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    huecos.forEach((h) => (h.ang = norm(h.ang) - Math.PI / 2)); // empieza arriba
    huecos.sort((a, b) => a.ang - b.ang);
    estados.forEach((e, i) => {
      // todas caben en la misma caja: verticales por su alto, horizontales por su ancho
      const caja = lado * 1.05 * (0.92 + pseudo(i) * 0.16);
      const w = e.ratio >= 1 ? caja : caja * e.ratio;
      e.el.style.setProperty('--w', `${w.toFixed(1)}px`);
    });
  }

  function asignar(animar: boolean) {
    orden.forEach((idx, k) => {
      const e = estados[idx], h = huecos[k];
      e.pos = k;
      if (!animar) { e.ang = h.ang; e.rad = h.rad; e.prof = h.prof; return; }
      const delta = ((h.ang - e.ang + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      gsap.to(e, { ang: e.ang + delta, rad: h.rad, prof: h.prof, duration: 1.6, ease: 'expo.inOut', delay: (k / N) * 0.35 });
    });
  }

  // ───────── Estado general del render ─────────
  let giro = 0, inercia = 0, pausado = false;
  const raton = { x: 0, y: 0, sx: 0, sy: 0 };
  const vista = { offX: 0, esc: 1, rot: 1 }; // desplazamiento, escala y giro según el modo

  // ───────── Ordenar por color o por viajes ─────────
  type Viaje = { nombre: string; subtitulo: string; texto: string };
  const viajes: Viaje[] = JSON.parse(escena.dataset.viajes || '[]');
  const viajeDe = (idx: number) => Math.min(Number(estados[idx].el.dataset.viaje ?? viajes.length - 1), viajes.length - 1);
  const claveColor = (idx: number) => (colores.length === N ? colores[idx].clave : idx);
  const etiquetasCaja = document.getElementById('etiquetas')!;
  const textoViaje = document.getElementById('viaje-texto')!;
  const vtNombre = textoViaje.querySelector<HTMLElement>('.vt-nombre')!;
  const vtCuerpo = textoViaje.querySelector<HTMLElement>('.vt-cuerpo')!;
  const intro = textoViaje.dataset.intro || '';
  const controlAnillo = document.querySelector<HTMLElement>('.inf-centro .orden')!;
  let modo: 'color' | 'viaje' = 'color';
  let etiquetas: { el: HTMLElement; x: number; y: number; v: number }[] = [];

  function marcarControl(ctrl: Element | null, m: string) {
    ctrl?.setAttribute('data-modo', m);
    ctrl?.querySelectorAll<HTMLButtonElement>('.orden-btn').forEach((b) => {
      const on = b.dataset.orden === m;
      b.classList.toggle('activo', on); b.setAttribute('aria-selected', String(on));
    });
  }

  // Modo Viajes: cada viaje es una "isla" de fotos (espiral de girasol) alrededor de un círculo
  function layoutViajes() {
    const movil = innerWidth < 700;
    const offX = movil ? 0 : Math.min(innerWidth * 0.16, 290);
    const esc = movil ? 0.62 : 0.8;
    const grupos = viajes.map(() => [] as number[]);
    estados.forEach((_, idx) => grupos[viajeDe(idx)].push(idx));
    grupos.forEach((g) => g.sort((a, b) => claveColor(a) - claveColor(b)));
    const activos = grupos.map((g, v) => ({ g, v })).filter((x) => x.g.length);

    const margenEt = movil ? 34 : 56;
    const R0 = Math.min(innerHeight / 2 - margenEt - lado * 0.6, innerWidth / 2 - offX - margenEt * 2.4);
    let c = lado * 0.5 * esc, R = R0 * 0.62;
    const rc = (n: number) => c * Math.sqrt(n) + lado * 0.45 * esc;
    for (let it = 0; it < 5; it++) {
      const maxRc = Math.max(...activos.map((a) => rc(a.g.length)));
      R = Math.max(R0 - maxRc, R0 * 0.45);
      const D = activos.reduce((s, a) => s + rc(a.g.length) * 2.2, 0);
      if (D > Math.PI * 2 * R) c *= ((Math.PI * 2 * R) / D) * 0.98; else break;
    }
    const D = activos.reduce((s, a) => s + rc(a.g.length) * 2.2, 0);
    let cursor = -Math.PI / 2;
    const destinos: { idx: number; x: number; y: number }[] = [];
    const nuevas: typeof etiquetas = [];
    etiquetasCaja.innerHTML = '';
    for (const { g, v } of activos) {
      const r = rc(g.length);
      const ancho = ((r * 2.2) / D) * Math.PI * 2;
      const a = cursor + ancho / 2;
      cursor += ancho;
      const cx = Math.cos(a) * R, cy = Math.sin(a) * R;
      g.forEach((idx, j) => {
        const t = j * 2.39996, d = c * Math.sqrt(j + 0.5);
        destinos.push({ idx, x: cx + Math.cos(t) * d, y: cy + Math.sin(t) * d });
      });
      const el = document.createElement('div');
      el.className = 'etiqueta';
      el.innerHTML = '<strong></strong><small></small>';
      el.querySelector('strong')!.textContent = viajes[v].nombre;
      el.querySelector('small')!.textContent = `${viajes[v].subtitulo} · ${g.length}`;
      const ux = Math.cos(a), uy = Math.sin(a);
      el.style.textAlign = ux < -0.3 ? 'right' : ux > 0.3 ? 'left' : 'center';
      el.style.setProperty('--tx', ux < -0.3 ? '-100%' : ux > 0.3 ? '0%' : '-50%');
      el.style.setProperty('--ty', uy < -0.3 ? '-100%' : uy > 0.3 ? '0%' : '-50%');
      etiquetasCaja.appendChild(el);
      nuevas.push({ el, x: cx + ux * (r + 10), y: cy + uy * (r + 10), v });
    }
    etiquetas = nuevas;
    return { destinos, offX, esc };
  }

  function ordenarPor(m: 'color' | 'viaje', animar = true) {
    modo = m;
    marcarControl(controlAnillo, m);
    document.body.dataset.orden = m;
    if (m === 'color') {
      etiquetasCaja.innerHTML = ''; etiquetas = [];
      orden = estados.map((_, i) => i).sort((a, b) => claveColor(a) - claveColor(b));
      gsap.to(vista, { offX: 0, esc: 1, rot: 1, duration: animar ? 1.4 : 0, ease: 'expo.inOut' });
      asignar(animar);
      return;
    }
    // Viajes: se para el giro y cada foto vuela a su isla
    inercia = 0; vista.rot = 0;
    const { destinos, offX, esc } = layoutViajes();
    gsap.to(vista, { offX, esc, duration: animar ? 1.4 : 0, ease: 'expo.inOut' });
    destinos.forEach(({ idx, x, y }, k) => {
      const e = estados[idx];
      e.pos = k;
      let ang = Math.atan2(y, x) - giro;
      const delta = ((ang - e.ang + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      ang = e.ang + delta;
      const rad = Math.hypot(x, y);
      if (animar) gsap.to(e, { ang, rad, prof: 0.4, duration: 1.6, ease: 'expo.inOut', delay: (k / N) * 0.3 });
      else Object.assign(e, { ang, rad, prof: 0.4 });
    });
    gsap.fromTo(etiquetasCaja.children, { opacity: 0 }, { opacity: 1, duration: 0.8, delay: animar ? 1.1 : 0, stagger: 0.05 });
    mostrarViaje(-1);
  }

  function mostrarViaje(v: number) {
    const nombre = v < 0 ? '' : viajes[v]?.nombre ?? '';
    const cuerpo = v < 0 ? intro : viajes[v]?.texto ?? '';
    etiquetas.forEach((et) => et.el.classList.toggle('activa', et.v === v));
    if (vtCuerpo.textContent === cuerpo && vtNombre.textContent === nombre) return;
    gsap.killTweensOf([vtNombre, vtCuerpo]);
    gsap.to([vtNombre, vtCuerpo], { opacity: 0, y: -6, duration: 0.18, onComplete: () => {
      vtNombre.textContent = nombre; vtCuerpo.textContent = cuerpo;
      gsap.fromTo([vtNombre, vtCuerpo], { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', stagger: 0.05 });
    } });
  }
  escena.addEventListener('pointerleave', () => { if (modo === 'viaje') mostrarViaje(-1); });

  calcularHuecos();
  ordenarPor('color', false);
  controlAnillo.querySelectorAll<HTMLButtonElement>('.orden-btn').forEach((b) =>
    b.addEventListener('click', () => { if (b.dataset.orden !== modo) ordenarPor(b.dataset.orden as 'color' | 'viaje'); }));
  controlAnillo.querySelector('.orden-riel')?.addEventListener('click', () => ordenarPor(modo === 'color' ? 'viaje' : 'color'));

  // Escala necesaria para que una miniatura mida ALTO_FOCO de la pantalla
  const escalaFoco = (e: Estado) => {
    const alto = parseFloat(e.el.style.getPropertyValue('--w') || '50') / e.ratio;
    return Math.max(1.5, (innerHeight * ALTO_FOCO) / (alto * vista.esc));
  };
  let fijada: Estado | null = null;

  // ───────── Bucle de render ─────────
  gsap.ticker.add((_t, dt) => {
    const seg = dt / 1000;
    if (!pausado) {
      const lento = fijada ? 0 : escena.classList.contains('hovering') ? 0.12 : 1;
      giro += (VEL_GIRO * lento + inercia) * seg * vista.rot;
    }
    inercia *= Math.pow(0.04, seg); // frenado de la inercia
    raton.sx += (raton.x - raton.sx) * Math.min(1, seg * 4);
    raton.sy += (raton.y - raton.sy) * Math.min(1, seg * 4);

    for (const e of estados) {
      const a = e.ang + giro + e.vuelta * (1 - e.k);
      // la foto crece en su sitio
      const x = Math.cos(a) * e.rad * e.k + raton.sx * PARALLAX * e.prof * e.k + vista.offX;
      const y = Math.sin(a) * e.rad * e.k + raton.sy * PARALLAX * e.prof * e.k + e.pilaY * (1 - e.k);
      const crece = 1 + (escalaFoco(e) - 1) * e.foco;
      e.el.style.transform = `translate(-50%,-50%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${(e.sc * crece * vista.esc).toFixed(3)})`;
      e.el.style.opacity = String(e.op);
      e.el.style.zIndex = e === fijada ? '60' : e.foco > 0.01 ? '50' : String(e.z);
    }
    for (const et of etiquetas) {
      const x = et.x + vista.offX + raton.sx * PARALLAX * 0.4, y = et.y + raton.sy * PARALLAX * 0.4;
      et.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(var(--tx),var(--ty))`;
    }
  });

  // ───────── Índice: ordenar por color o por viajes ─────────
  const rejilla = document.querySelector<HTMLElement>('#indice .rejilla');
  const controlIndice = document.querySelector('.orden-indice');
  function ordenarIndice(m: 'color' | 'viaje') {
    if (!rejilla) return;
    marcarControl(controlIndice, m);
    rejilla.querySelectorAll('.cabecera').forEach((c) => c.remove());
    const lis = Array.from(rejilla.querySelectorAll<HTMLLIElement>(':scope > li'));
    const idxDe = (li: HTMLLIElement) => Number(li.querySelector<HTMLElement>('.celda')!.dataset.i);
    if (m === 'color') {
      lis.sort((a, b) => claveColor(idxDe(a)) - claveColor(idxDe(b))).forEach((li) => rejilla.appendChild(li));
    } else {
      const porViaje = viajes.map(() => [] as HTMLLIElement[]);
      lis.forEach((li) => porViaje[viajeDe(idxDe(li))].push(li));
      porViaje.forEach((grupo, v) => {
        if (!grupo.length) return;
        const cab = document.createElement('li');
        cab.className = 'cabecera';
        cab.innerHTML = '<h3></h3><p class="tenue"></p><p class="cab-texto"></p>';
        cab.querySelector('h3')!.textContent = viajes[v].nombre;
        cab.querySelector('.tenue')!.textContent = `${viajes[v].subtitulo} · ${grupo.length} photos`;
        cab.querySelector('.cab-texto')!.textContent = viajes[v].texto;
        rejilla.appendChild(cab);
        grupo.sort((a, b) => claveColor(idxDe(a)) - claveColor(idxDe(b))).forEach((li) => rejilla.appendChild(li));
      });
    }
    gsap.fromTo(rejilla.children, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.006 });
  }
  ordenarIndice('color');
  controlIndice?.querySelectorAll<HTMLButtonElement>('.orden-btn').forEach((b) =>
    b.addEventListener('click', () => ordenarIndice(b.dataset.orden as 'color' | 'viaje')));
  controlIndice?.querySelector('.orden-riel')?.addEventListener('click', () =>
    ordenarIndice(controlIndice.getAttribute('data-modo') === 'color' ? 'viaje' : 'color'));

  // ───────── Intro: una columna de fotos se junta en el centro y el anillo aparece de golpe ─────────
  const ponerContador = (n: number) => (contador.textContent = String(Math.round(n)).padStart(3, '0'));
  if (reducido) {
    estados.forEach((e) => Object.assign(e, { k: 1, sc: 1, op: 1 }));
    ponerContador(N);
  } else {
    const pila = estados.slice(0, Math.min(9, N));
    pila.forEach((e, j) => (e.pilaY = (j - (pila.length - 1) / 2) * lado * 1.15));
    const cuenta = { n: 0 };
    gsap.timeline({ delay: 0.25 })
      .to(pila, { op: 1, sc: 1.3, duration: 0.5, ease: 'power3.out', stagger: 0.07 })
      .to(pila, { pilaY: 0, sc: 0.25, duration: 0.6, ease: 'expo.in' }, '+=0.3')
      .set(estados, { op: 1 })
      .fromTo(estados, { k: 0, sc: 0.25 }, { k: 1, sc: 1, duration: 1.3, ease: 'expo.out', stagger: { each: 0.25 / N } })
      .fromTo({ g: -0.9 }, { g: -0.9 }, { g: 0, duration: 2, ease: 'expo.out',
        onUpdate() { giro = (this.targets()[0] as any).g; } }, '<')
      .to(cuenta, { n: N, duration: 1.2, ease: 'power2.out', onUpdate: () => ponerContador(cuenta.n) }, '<');
  }

  // ───────── Ratón, rueda y arrastre ─────────
  addEventListener('pointermove', (ev) => {
    raton.x = (ev.clientX / innerWidth - 0.5) * 2;
    raton.y = (ev.clientY / innerHeight - 0.5) * 2;
  });
  escena.addEventListener('wheel', (ev) => { if (modo === 'color') inercia += ev.deltaY * 0.004; }, { passive: true });

  let arrastre: { a: number; movido: number } | null = null;
  const anguloPuntero = (ev: PointerEvent) => Math.atan2(ev.clientY - innerHeight / 2, ev.clientX - innerWidth / 2);
  escena.addEventListener('pointerdown', (ev) => { arrastre = { a: anguloPuntero(ev), movido: 0 }; });
  addEventListener('pointermove', (ev) => {
    if (!arrastre) return;
    const a = anguloPuntero(ev);
    let d = a - arrastre.a;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    arrastre.movido += Math.abs(d); arrastre.a = a;
    if (modo === 'color') { giro += d; inercia = d * 30; }
  });
  addEventListener('pointerup', () => setTimeout(() => (arrastre = null), 0));

  // Hover: la foto crece despacio (TIEMPO_FOCO). Clic: se queda fija y grande. Otro clic: se abre. Clic fuera: se suelta.
  // La foto sigue en foco mientras el ratón esté en su hueco o encima de la foto ya grande.
  let enfocada: Estado | null = null;
  let hueco: DOMRect | null = null;
  const dentro = (r: DOMRect | null, x: number, y: number, m = 8) => !!r && x > r.left - m && x < r.right + m && y > r.top - m && y < r.bottom + m;

  function enfocar(e: Estado, i: number) {
    if (enfocada && enfocada !== e) desenfocar();
    enfocada = e;
    hueco = e.el.getBoundingClientRect();
    escena.classList.add('hovering'); e.el.classList.add('hover');
    if (modo === 'viaje') {
      const v = viajeDe(i);
      estados.forEach((o, k) => o.el.classList.toggle('mismo', viajeDe(k) === v));
      mostrarViaje(v);
    }
    gsap.to(e, { foco: 1, duration: TIEMPO_FOCO, ease: 'power3.inOut', overwrite: true });
    tituloHover.textContent = e.el.dataset.titulo || e.el.dataset.lugar || '';
    ponerContador(i + 1);
    sonar(e.pos, e.el.dataset.sonido);
  }

  function desenfocar() {
    const e = enfocada;
    if (!e || e === fijada) return;
    enfocada = null; hueco = null;
    e.el.classList.remove('hover');
    escena.classList.remove('hovering');
    estados.forEach((o) => o.el.classList.remove('mismo'));
    tituloHover.textContent = '';
    gsap.to(e, { foco: 0, duration: 0.6, ease: 'power3.out', overwrite: true });
  }

  function fijar(e: Estado) {
    fijada = e;
    e.el.classList.add('fijada', 'hover');
    escena.classList.add('hovering', 'con-fijada');
    gsap.to(e, { foco: 1, duration: Math.max(0.35, (1 - e.foco) * TIEMPO_FOCO), ease: 'power3.out', overwrite: true });
  }

  function soltarFijada() {
    if (!fijada) return;
    const f = fijada;
    fijada = null;
    f.el.classList.remove('fijada');
    escena.classList.remove('con-fijada');
    enfocada = f;
    desenfocar();
  }

  estados.forEach((e, i) => {
    e.el.addEventListener('pointerenter', (ev) => {
      if (ev.pointerType !== 'mouse' || fijada || enfocada === e) return;
      // mientras el ratón siga en el hueco de la foto que se está ampliando, no cambiamos de foto
      if (enfocada && dentro(hueco, ev.clientX, ev.clientY, 0)) return;
      enfocar(e, i);
    });
  });

  addEventListener('pointermove', (ev) => {
    if (!enfocada || fijada || ev.pointerType !== 'mouse') return;
    const encima = dentro(enfocada.el.getBoundingClientRect(), ev.clientX, ev.clientY, 0);
    if (!encima && !dentro(hueco, ev.clientX, ev.clientY)) desenfocar();
  });

  // Clics: 1º fija la foto (grande y centrada) · 2º sobre ella la abre en el visor · fuera la suelta
  addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    if (t.closest('#visor, #cerillas, #lampara, nav, .panel, .orden, #sonido')) return;
    if (document.body.dataset.vista !== 'anillo') return;
    if (arrastre && arrastre.movido > 0.05) return; // fue un arrastre, no un clic
    const itemEl = t.closest<HTMLElement>('.item');
    if (fijada) {
      if (itemEl === fijada.el || dentro(fijada.el.getBoundingClientRect(), ev.clientX, ev.clientY, 0)) {
        const f = fijada, idx = estados.indexOf(f);
        soltarFijada();
        return abrir(idx, f.el);
      }
      return soltarFijada();
    }
    if (enfocada && (itemEl === enfocada.el || dentro(hueco, ev.clientX, ev.clientY))) return fijar(enfocada);
    if (itemEl) { // táctil: el primer toque amplía y fija
      const idx = Number(itemEl.dataset.i);
      enfocar(estados[idx], idx);
      fijar(estados[idx]);
    }
  });

  // ───────── Visor con zoom ─────────
  const visor = document.getElementById('visor')!;
  const vImg = document.getElementById('visor-img') as HTMLImageElement;
  const vN = document.getElementById('visor-n')!;
  const vTitulo = document.getElementById('visor-titulo')!;
  const vMeta = document.getElementById('visor-meta')!;
  const vExtras = visor.querySelectorAll('.visor-pie, .visor-btn');
  let actual = -1;
  let origen: HTMLElement | null = null;
  let animando = false;

  function medidaFinal(ratio: number) {
    const movil = innerWidth < 700;
    const maxW = innerWidth * (movil ? 0.9 : 0.62);
    const maxH = innerHeight * (movil ? 0.6 : 0.7);
    let w = maxW, h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    return { w, h, x: (innerWidth - w) / 2, y: (innerHeight - h) / 2 - (movil ? 20 : 10) };
  }

  function cargarGrande(i: number) {
    const url = estados[i].el.dataset.grande!;
    const pre = new Image();
    pre.onload = () => { if (actual === i) vImg.src = url; };
    pre.src = url;
  }

  function rellenarPie(i: number) {
    const d = estados[i].el.dataset;
    vN.textContent = `${String(i + 1).padStart(3, '0')}/${String(N).padStart(3, '0')}`;
    vTitulo.textContent = d.titulo ?? '';
    vMeta.textContent = d.meta ?? '';
  }

  function abrir(i: number, desde: HTMLElement) {
    if (animando) return;
    animando = true; actual = i; origen = desde; pausado = true;
    const e = estados[i];
    const fin = medidaFinal(e.ratio);
    const r = (desde.querySelector('img') ?? desde).getBoundingClientRect();

    vImg.src = (desde.querySelector('img') as HTMLImageElement).currentSrc;
    vImg.style.width = `${fin.w}px`; vImg.style.height = `${fin.h}px`;
    rellenarPie(i); cargarGrande(i);

    gsap.set(visor, { visibility: 'visible' });
    gsap.set(vImg, { opacity: 1 });
    desde.style.visibility = 'hidden';
    document.body.classList.add('visor-abierto');
    visor.setAttribute('aria-hidden', 'false');

    gsap.timeline({ onComplete: () => (animando = false) })
      .fromTo(vImg, { x: r.left, y: r.top, scale: r.width / fin.w },
        { x: fin.x, y: fin.y, scale: 1, duration: 1, ease: 'expo.inOut' })
      .to(visor, { '--velo': 0.92, duration: 0.8, ease: 'power2.out' }, 0)
      .to(vExtras, { opacity: 1, duration: 0.5, stagger: 0.05 }, 0.7);
  }

  function cerrar() {
    if (animando || actual < 0) return;
    animando = true;
    const desde = origenDe(actual);
    const r = (desde.querySelector('img') ?? desde).getBoundingClientRect();
    const fin = medidaFinal(estados[actual].ratio);
    if (origen && origen !== desde) origen.style.visibility = '';
    desde.style.visibility = 'hidden';

    gsap.timeline({
      onComplete: () => {
        desde.style.visibility = '';
        gsap.set(visor, { visibility: 'hidden' });
        visor.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('visor-abierto');
        actual = -1; origen = null; animando = false;
        pausado = document.body.dataset.vista !== 'anillo';
      },
    })
      .to(vExtras, { opacity: 0, duration: 0.25 })
      .to(vImg, { x: r.left, y: r.top, scale: r.width / fin.w, duration: 0.85, ease: 'expo.inOut' }, 0.05)
      .to(visor, { '--velo': 0, duration: 0.6 }, 0.2);
  }

  // Si el índice está abierto volvemos a su celda; si no, a la miniatura del anillo
  function origenDe(i: number): HTMLElement {
    if (document.body.dataset.vista === 'indice') {
      return document.querySelectorAll<HTMLElement>('#indice .celda-img')[i];
    }
    return estados[i].el;
  }

  function pasar(dir: number) {
    if (animando || actual < 0) return;
    animando = true;
    const sig = (actual + dir + N) % N;
    if (origen) origen.style.visibility = '';
    gsap.timeline({ onComplete: () => (animando = false) })
      .to(vImg, { opacity: 0, x: `-=${dir * 30}`, duration: 0.3, ease: 'power2.in' })
      .add(() => {
        actual = sig; origen = origenDe(sig); origen.style.visibility = 'hidden';
        const fin = medidaFinal(estados[sig].ratio);
        vImg.src = (estados[sig].el.querySelector('img') as HTMLImageElement).currentSrc;
        vImg.style.width = `${fin.w}px`; vImg.style.height = `${fin.h}px`;
        gsap.set(vImg, { x: fin.x + dir * 30, y: fin.y, scale: 1 });
        rellenarPie(sig); cargarGrande(sig);
      })
      .to(vImg, { opacity: 1, x: `-=${dir * 30}`, duration: 0.45, ease: 'power3.out' });
  }

  visor.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    if (t.closest('.ant')) return pasar(-1);
    if (t.closest('.sig')) return pasar(1);
    cerrar();
  });
  addEventListener('keydown', (ev) => {
    if (actual < 0) return;
    if (ev.key === 'Escape') cerrar();
    if (ev.key === 'ArrowRight') pasar(1);
    if (ev.key === 'ArrowLeft') pasar(-1);
  });
  // Deslizar con el dedo en el visor
  let toqueX = 0;
  visor.addEventListener('touchstart', (ev) => (toqueX = ev.touches[0].clientX), { passive: true });
  visor.addEventListener('touchend', (ev) => {
    const d = ev.changedTouches[0].clientX - toqueX;
    if (Math.abs(d) > 50) { ev.preventDefault(); pasar(d < 0 ? 1 : -1); }
  });

  // ───────── Navegación entre vistas ─────────
  const indice = document.getElementById('indice')!;
  const paneles = Array.from(document.querySelectorAll<HTMLElement>('.panel'));
  const botones = document.querySelectorAll<HTMLButtonElement>('.nav-btn[data-ir]');

  function irA(vista: string) {
    if (document.body.dataset.vista === vista) return;
    document.body.dataset.vista = vista;
    botones.forEach((b) => b.classList.toggle('activo', b.dataset.ir === vista));
    for (const panel of paneles) {
      if (panel.id === vista) {
        panel.scrollTop = 0;
        gsap.fromTo(panel, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'expo.out' });
        const hijos = panel.querySelectorAll('li, .comparador, .info-caja > *');
        gsap.fromTo(hijos, { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out', stagger: { each: 0.015, from: 'start' } });
        if (vista === 'info') panel.dispatchEvent(new CustomEvent('mostrar'));
      } else {
        gsap.to(panel, { autoAlpha: 0, duration: 0.35 });
      }
    }
    pausado = vista !== 'anillo';
  }
  botones.forEach((b) => b.addEventListener('click', () => irA(b.dataset.ir!)));

  indice.querySelectorAll<HTMLElement>('.celda').forEach((c) => {
    c.addEventListener('pointerenter', (ev) => { if (ev.pointerType === 'mouse') sonar(Number(c.dataset.i), c.dataset.sonido); });
    c.addEventListener('click', () => abrir(Number(c.dataset.i), c.querySelector('.celda-img')!));
  });

  // ───────── Redimensionar ─────────
  let t: number | undefined;
  addEventListener('resize', () => { clearTimeout(t); t = window.setTimeout(() => { calcularHuecos(); if (modo === 'color') asignar(false); else ordenarPor('viaje', false); }, 150); });
}

// Número pseudoaleatorio estable (la misma foto siempre cae en el mismo sitio)
function pseudo(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
