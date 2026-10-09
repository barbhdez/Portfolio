import { gsap } from 'gsap';
import { tap } from './sound';
import type { Color } from './colors';

type Photo = {
  el: HTMLElement;
  ratio: number;
  angle: number;
  radius: number;
  depth: number;  // parallax amount
  k: number;      // 0 = centre, 1 = on the ring
  scale: number;
  focus: number;  // hover zoom, 0..1
  stackY: number; // intro column offset
  opacity: number;
};
type Mode = 'color' | 'trip';
type Trip = { name: string; subtitle: string; text: string };

const SPIN_SPEED = 0.035; // rad/s
const PARALLAX = 22;      // px
const FOCUS_HEIGHT = 0.4; // fraction of viewport height
const FOCUS_TIME = 1;     // s

export function initPortfolio(colors: Color[] = []) {
  const scene = document.getElementById('scene')!;
  const els = Array.from(scene.querySelectorAll<HTMLElement>('.item'));
  const N = els.length;
  if (!N) return;

  const counter = document.getElementById('counter')!;
  const hoverTitle = document.getElementById('hover-title')!;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const photos: Photo[] = els.map((el) => ({
    el, ratio: parseFloat(getComputedStyle(el).getPropertyValue('--ratio')) || 1,
    angle: 0, radius: 0, depth: 0, k: 0, scale: 0, focus: 0, stackY: 0, opacity: 0,
  }));

  let side = 56, rMax = 300;
  let slots: { angle: number; radius: number; depth: number }[] = [];
  let order: number[] = photos.map((_, i) => i);

  function computeSlots() {
    const vw = innerWidth, vh = innerHeight;
    rMax = Math.min(vw, vh) * (vw < 700 ? 0.42 : 0.355);
    let rings: { r: number; cap: number }[] = [];
    // largest thumbnail size that fits every photo
    for (side = 110; side > 14; side -= 2) {
      const rMin = Math.max(rMax * 0.7, side * 1.6); 
      rings = [];
      for (let r = rMin; r <= rMax; r += side * 1.25) {
        rings.push({ r, cap: Math.floor((Math.PI * 2 * r) / (side * 1.45)) });
      }
      if (rings.reduce((s, a) => s + a.cap, 0) >= N) break;
    }
    const totalCap = rings.reduce((s, a) => s + a.cap, 0);
    slots = [];
    let i = 0;
    rings.forEach((ring, j) => {
      const n = j === rings.length - 1 ? N - i : Math.round((ring.cap / totalCap) * N);
      for (let m = 0; m < n && i < N; m++, i++) {
        const jitter = pseudoRandom(i);
        slots.push({
          angle: j * 0.9 + (m / n) * Math.PI * 2 + (jitter - 0.5) * (0.6 / n) * Math.PI,
          radius: ring.r + (pseudoRandom(i + 99) - 0.5) * side * 0.35,
          depth: ring.r / rMax,
        });
      }
    });
    // sorted by angle so that groups form slices of the circle
    const norm = (x: number) => ((x % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    slots.forEach((s) => (s.angle = norm(s.angle) - Math.PI / 2));
    slots.sort((a, b) => a.angle - b.angle);
    photos.forEach((p, i) => {
      const box = side * 1.05 * (0.92 + pseudoRandom(i) * 0.16);
      const w = p.ratio >= 1 ? box : box * p.ratio;
      p.el.style.setProperty('--w', `${w.toFixed(1)}px`);
    });
  }

  const turn = (a: number, b: number) => ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

  function placeOnRing(animate: boolean) {
    order.forEach((idx, k) => {
      const p = photos[idx], s = slots[k];
      if (!animate) { p.angle = s.angle; p.radius = s.radius; p.depth = s.depth; return; }
      gsap.to(p, { angle: p.angle + turn(p.angle, s.angle), radius: s.radius, depth: s.depth, duration: 1.6, ease: 'expo.inOut', delay: (k / N) * 0.35 });
    });
  }

  let spin = 0, inertia = 0, paused = false;
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  const view = { offX: 0, zoom: 1, rotate: 1 };

  const trips: Trip[] = JSON.parse(scene.dataset.trips || '[]');
  const tripOf = (idx: number) => Math.min(Number(photos[idx].el.dataset.trip ?? trips.length - 1), trips.length - 1);
  const colorKey = (idx: number) => (colors.length === N ? colors[idx].key : idx);
  const labelBox = document.getElementById('labels')!;
  const tripText = document.getElementById('trip-text')!;
  const ttName = tripText.querySelector<HTMLElement>('.tt-name')!;
  const ttBody = tripText.querySelector<HTMLElement>('.tt-body')!;
  const intro = tripText.dataset.intro || '';
  const ringSwitch = document.querySelector<HTMLElement>('.bottom-center .sort')!;
  let mode: Mode = 'color';
  let labels: { el: HTMLElement; x: number; y: number; trip: number }[] = [];

  function markSwitch(ctrl: Element | null, m: Mode) {
    ctrl?.setAttribute('data-mode', m);
    ctrl?.querySelectorAll<HTMLButtonElement>('.sort-btn').forEach((b) => {
      const on = b.dataset.sort === m;
      b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on));
    });
  }

  // trips mode: one sunflower-spiral cluster per trip, laid out around a circle
  function layoutTrips() {
    const mobile = innerWidth < 700;
    const offX = mobile ? 0 : Math.min(innerWidth * 0.16, 290);
    const zoom = mobile ? 0.62 : 0.8;
    const groups = trips.map(() => [] as number[]);
    photos.forEach((_, idx) => groups[tripOf(idx)].push(idx));
    groups.forEach((g) => g.sort((a, b) => colorKey(a) - colorKey(b)));
    const used = groups.map((g, trip) => ({ g, trip })).filter((x) => x.g.length);

    const labelMargin = mobile ? 34 : 56;
    const R0 = Math.min(innerHeight / 2 - labelMargin - side * 0.6, innerWidth / 2 - offX - labelMargin * 2.4);
    let c = side * 0.5 * zoom, R = R0 * 0.62;
    const islandR = (n: number) => c * Math.sqrt(n) + side * 0.45 * zoom;
    for (let it = 0; it < 5; it++) {
      const maxR = Math.max(...used.map((u) => islandR(u.g.length)));
      R = Math.max(R0 - maxR, R0 * 0.45);
      const D = used.reduce((s, u) => s + islandR(u.g.length) * 2.2, 0);
      if (D > Math.PI * 2 * R) c *= ((Math.PI * 2 * R) / D) * 0.98; else break;
    }
    const D = used.reduce((s, u) => s + islandR(u.g.length) * 2.2, 0);
    let cursor = -Math.PI / 2 - ((islandR(used[0]?.g.length ?? 0) * 2.2) / D) * Math.PI;
    const targets: { idx: number; x: number; y: number }[] = [];
    const next: typeof labels = [];
    labelBox.innerHTML = '';
    for (const { g, trip } of used) {
      const r = islandR(g.length);
      const width = ((r * 2.2) / D) * Math.PI * 2;
      const a = cursor + width / 2;
      cursor += width;
      const cx = Math.cos(a) * R, cy = Math.sin(a) * R;
      g.forEach((idx, j) => {
        const t = j * 2.39996, d = c * Math.sqrt(j + 0.5); // golden angle
        targets.push({ idx, x: cx + Math.cos(t) * d, y: cy + Math.sin(t) * d });
      });
      const el = document.createElement('div');
      el.className = 'label';
      el.innerHTML = '<strong></strong><small></small>';
      el.querySelector('strong')!.textContent = trips[trip].name;
      el.querySelector('small')!.textContent = `${trips[trip].subtitle} · ${g.length}`;
      const ux = Math.cos(a), uy = Math.sin(a);
      el.style.textAlign = ux < -0.3 ? 'right' : ux > 0.3 ? 'left' : 'center';
      el.style.setProperty('--tx', ux < -0.3 ? '-100%' : ux > 0.3 ? '0%' : '-50%');
      el.style.setProperty('--ty', uy < -0.3 ? '-100%' : uy > 0.3 ? '0%' : '-50%');
      labelBox.appendChild(el);
      next.push({ el, x: cx + ux * (r + 10), y: cy + uy * (r + 10), trip });
    }
    labels = next;
    return { targets, offX, zoom };
  }

  function sortBy(m: Mode, animate = true) {
    mode = m;
    markSwitch(ringSwitch, m);
    document.body.dataset.sort = m;
    if (m === 'color') {
      labelBox.innerHTML = ''; labels = [];
      order = photos.map((_, i) => i).sort((a, b) => colorKey(a) - colorKey(b));
      gsap.to(view, { offX: 0, zoom: 1, rotate: 1, duration: animate ? 1.4 : 0, ease: 'expo.inOut' });
      placeOnRing(animate);
      return;
    }
    inertia = 0; view.rotate = 0;
    const { targets, offX, zoom } = layoutTrips();
    gsap.to(view, { offX, zoom, duration: animate ? 1.4 : 0, ease: 'expo.inOut' });
    targets.forEach(({ idx, x, y }, k) => {
      const p = photos[idx];
      const angle = p.angle + turn(p.angle, Math.atan2(y, x) - spin);
      const radius = Math.hypot(x, y);
      if (animate) gsap.to(p, { angle, radius, depth: 0.4, duration: 1.6, ease: 'expo.inOut', delay: (k / N) * 0.3 });
      else Object.assign(p, { angle, radius, depth: 0.4 });
    });
    gsap.fromTo(labelBox.children, { opacity: 0 }, { opacity: 1, duration: 0.8, delay: animate ? 1.1 : 0, stagger: 0.05 });
    showTrip(-1);
  }

  function showTrip(trip: number) {
    const name = trip < 0 ? '' : trips[trip]?.name ?? '';
    const body = trip < 0 ? intro : trips[trip]?.text ?? '';
    labels.forEach((l) => l.el.classList.toggle('active', l.trip === trip));
    if (ttBody.textContent === body && ttName.textContent === name) return;
    gsap.killTweensOf([ttName, ttBody]);
    gsap.to([ttName, ttBody], { opacity: 0, y: -6, duration: 0.18, onComplete: () => {
      ttName.textContent = name; ttBody.textContent = body;
      gsap.fromTo([ttName, ttBody], { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', stagger: 0.05 });
    } });
  }
  scene.addEventListener('pointerleave', () => { if (mode === 'trip') showTrip(-1); });

  computeSlots();
  sortBy('color', false);
  ringSwitch.querySelectorAll<HTMLButtonElement>('.sort-btn').forEach((b) =>
    b.addEventListener('click', () => { if (b.dataset.sort !== mode) sortBy(b.dataset.sort as Mode); }));
  ringSwitch.querySelector('.sort-track')?.addEventListener('click', () => sortBy(mode === 'color' ? 'trip' : 'color'));

  const focusScale = (p: Photo) => {
    const h = parseFloat(p.el.style.getPropertyValue('--w') || '50') / p.ratio;
    return Math.max(1.5, (innerHeight * FOCUS_HEIGHT) / (h * view.zoom));
  };
  let pinned: Photo | null = null;

  gsap.ticker.add((_t, dt) => {
    const sec = dt / 1000;
    if (!paused) {
      const slow = pinned ? 0 : scene.classList.contains('hovering') ? 0.12 : 1;
      spin += (SPIN_SPEED * slow + inertia) * sec * view.rotate;
    }
    inertia *= Math.pow(0.04, sec);
    mouse.sx += (mouse.x - mouse.sx) * Math.min(1, sec * 4);
    mouse.sy += (mouse.y - mouse.sy) * Math.min(1, sec * 4);

    for (const p of photos) {
      const a = p.angle + spin;
      const x = Math.cos(a) * p.radius * p.k + mouse.sx * PARALLAX * p.depth * p.k + view.offX;
      const y = Math.sin(a) * p.radius * p.k + mouse.sy * PARALLAX * p.depth * p.k + p.stackY * (1 - p.k);
      const grow = 1 + (focusScale(p) - 1) * p.focus;
      p.el.style.transform = `translate(-50%,-50%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${(p.scale * grow * view.zoom).toFixed(3)})`;
      p.el.style.opacity = String(p.opacity);
      p.el.style.zIndex = p === pinned ? '60' : p.focus > 0.01 ? '50' : '1';
    }
    for (const l of labels) {
      const x = l.x + view.offX + mouse.sx * PARALLAX * 0.4, y = l.y + mouse.sy * PARALLAX * 0.4;
      l.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(var(--tx),var(--ty))`;
    }
  });

  const grid = document.querySelector<HTMLElement>('#index .grid');
  const indexSwitch = document.querySelector('.sort-index');
  function sortIndex(m: Mode) {
    if (!grid) return;
    markSwitch(indexSwitch, m);
    grid.querySelectorAll('.trip-header').forEach((h) => h.remove());
    const items = Array.from(grid.querySelectorAll<HTMLLIElement>(':scope > li'));
    const idxOf = (li: HTMLLIElement) => Number(li.querySelector<HTMLElement>('.cell')!.dataset.i);
    if (m === 'color') {
      items.sort((a, b) => colorKey(idxOf(a)) - colorKey(idxOf(b))).forEach((li) => grid.appendChild(li));
    } else {
      const byTrip = trips.map(() => [] as HTMLLIElement[]);
      items.forEach((li) => byTrip[tripOf(idxOf(li))].push(li));
      byTrip.forEach((group, trip) => {
        if (!group.length) return;
        const header = document.createElement('li');
        header.className = 'trip-header';
        header.innerHTML = '<h3></h3><p class="muted"></p><p class="trip-header-text"></p>';
        header.querySelector('h3')!.textContent = trips[trip].name;
        header.querySelector('.muted')!.textContent = `${trips[trip].subtitle} · ${group.length} photos`;
        header.querySelector('.trip-header-text')!.textContent = trips[trip].text;
        grid.appendChild(header);
        group.sort((a, b) => colorKey(idxOf(a)) - colorKey(idxOf(b))).forEach((li) => grid.appendChild(li));
      });
    }
    gsap.fromTo(grid.children, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.006 });
  }
  sortIndex('color');
  indexSwitch?.querySelectorAll<HTMLButtonElement>('.sort-btn').forEach((b) =>
    b.addEventListener('click', () => sortIndex(b.dataset.sort as Mode)));
  indexSwitch?.querySelector('.sort-track')?.addEventListener('click', () =>
    sortIndex(indexSwitch.getAttribute('data-mode') === 'color' ? 'trip' : 'color'));

  const setCounter = (n: number) => (counter.textContent = String(Math.round(n)).padStart(3, '0'));
  if (reducedMotion) {
    photos.forEach((p) => Object.assign(p, { k: 1, scale: 1, opacity: 1 }));
    setCounter(N);
  } else {
    const stack = photos.slice(0, Math.min(9, N));
    stack.forEach((p, j) => (p.stackY = (j - (stack.length - 1) / 2) * side * 1.15));
    const count = { n: 0 };
    gsap.timeline({ delay: 0.25 })
      .to(stack, { opacity: 1, scale: 1.3, duration: 0.5, ease: 'power3.out', stagger: 0.07 })
      .to(stack, { stackY: 0, scale: 0.25, duration: 0.6, ease: 'expo.in' }, '+=0.3')
      .set(photos, { opacity: 1 })
      .fromTo(photos, { k: 0, scale: 0.25 }, { k: 1, scale: 1, duration: 1.3, ease: 'expo.out', stagger: { each: 0.25 / N } })
      .fromTo({ g: -0.9 }, { g: -0.9 }, { g: 0, duration: 2, ease: 'expo.out',
        onUpdate() { spin = (this.targets()[0] as any).g; } }, '<')
      .to(count, { n: N, duration: 1.2, ease: 'power2.out', onUpdate: () => setCounter(count.n) }, '<');
  }

  addEventListener('pointermove', (ev) => {
    mouse.x = (ev.clientX / innerWidth - 0.5) * 2;
    mouse.y = (ev.clientY / innerHeight - 0.5) * 2;
  });
  scene.addEventListener('wheel', (ev) => { if (mode === 'color') inertia += ev.deltaY * 0.004; }, { passive: true });

  let drag: { a: number; moved: number } | null = null;
  const pointerAngle = (ev: PointerEvent) => Math.atan2(ev.clientY - innerHeight / 2, ev.clientX - innerWidth / 2);
  scene.addEventListener('pointerdown', (ev) => { drag = { a: pointerAngle(ev), moved: 0 }; });
  addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const a = pointerAngle(ev);
    let d = a - drag.a;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    drag.moved += Math.abs(d); drag.a = a;
    if (mode === 'color') { spin += d; inertia = d * 30; }
  });
  addEventListener('pointerup', () => setTimeout(() => (drag = null), 0));

  // hover grows a photo, click pins it, a second click opens it, clicking elsewhere releases it
  let focused: Photo | null = null;
  let slotRect: DOMRect | null = null;
  const inside = (r: DOMRect | null, x: number, y: number, m = 8) => !!r && x > r.left - m && x < r.right + m && y > r.top - m && y < r.bottom + m;

  function focus(p: Photo, i: number) {
    if (focused && focused !== p) unfocus();
    focused = p;
    slotRect = p.el.getBoundingClientRect();
    scene.classList.add('hovering'); p.el.classList.add('hover');
    if (mode === 'trip') {
      const trip = tripOf(i);
      photos.forEach((o, k) => o.el.classList.toggle('same-trip', tripOf(k) === trip));
      showTrip(trip);
    }
    gsap.to(p, { focus: 1, duration: FOCUS_TIME, ease: 'power3.inOut', overwrite: true });
    hoverTitle.textContent = p.el.dataset.title || p.el.dataset.place || '';
    setCounter(i + 1);
    tap();
  }

  function unfocus() {
    const p = focused;
    if (!p || p === pinned) return;
    focused = null; slotRect = null;
    p.el.classList.remove('hover');
    scene.classList.remove('hovering');
    photos.forEach((o) => o.el.classList.remove('same-trip'));
    hoverTitle.textContent = '';
    gsap.to(p, { focus: 0, duration: 0.6, ease: 'power3.out', overwrite: true });
  }

  function pin(p: Photo) {
    pinned = p;
    p.el.classList.add('pinned', 'hover');
    scene.classList.add('hovering', 'has-pinned');
    gsap.to(p, { focus: 1, duration: Math.max(0.35, (1 - p.focus) * FOCUS_TIME), ease: 'power3.out', overwrite: true });
  }

  function unpin() {
    if (!pinned) return;
    const p = pinned;
    pinned = null;
    p.el.classList.remove('pinned');
    scene.classList.remove('has-pinned');
    focused = p;
    unfocus();
  }

  photos.forEach((p, i) => {
    p.el.addEventListener('pointerenter', (ev) => {
      if (ev.pointerType !== 'mouse' || pinned || focused === p) return;
      if (focused && inside(slotRect, ev.clientX, ev.clientY, 0)) return;
      focus(p, i);
    });
  });

  addEventListener('pointermove', (ev) => {
    if (!focused || pinned || ev.pointerType !== 'mouse') return;
    const over = inside(focused.el.getBoundingClientRect(), ev.clientX, ev.clientY, 0);
    if (!over && !inside(slotRect, ev.clientX, ev.clientY)) unfocus();
  });

  addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    if (t.closest('#viewer, #lamp, nav, .panel, .sort')) return;
    if (document.body.dataset.view !== 'ring') return;
    if (drag && drag.moved > 0.05) return;
    const itemEl = t.closest<HTMLElement>('.item');
    if (pinned) {
      if (itemEl === pinned.el || inside(pinned.el.getBoundingClientRect(), ev.clientX, ev.clientY, 0)) {
        const p = pinned, idx = photos.indexOf(p);
        unpin();
        return open(idx, p.el);
      }
      return unpin();
    }
    if (focused && (itemEl === focused.el || inside(slotRect, ev.clientX, ev.clientY))) return pin(focused);
    if (itemEl) { // touch
      const idx = Number(itemEl.dataset.i);
      focus(photos[idx], idx);
      pin(photos[idx]);
    }
  });

  const viewer = document.getElementById('viewer')!;
  const vImg = document.getElementById('viewer-img') as HTMLImageElement;
  const vN = document.getElementById('viewer-n')!;
  const vTitle = document.getElementById('viewer-title')!;
  const vMeta = document.getElementById('viewer-meta')!;
  const vExtras = viewer.querySelectorAll('.viewer-caption, .viewer-btn');
  let current = -1;
  let source: HTMLElement | null = null;
  let animating = false;

  function finalSize(ratio: number) {
    const mobile = innerWidth < 700;
    const maxW = innerWidth * (mobile ? 0.9 : 0.62);
    const maxH = innerHeight * (mobile ? 0.6 : 0.7);
    let w = maxW, h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    return { w, h, x: (innerWidth - w) / 2, y: (innerHeight - h) / 2 - (mobile ? 20 : 10) };
  }

  function loadLarge(i: number) {
    const url = photos[i].el.dataset.large!;
    const pre = new Image();
    pre.onload = () => { if (current === i) vImg.src = url; };
    pre.src = url;
  }

  function fillCaption(i: number) {
    const d = photos[i].el.dataset;
    vN.textContent = `${String(i + 1).padStart(3, '0')}/${String(N).padStart(3, '0')}`;
    vTitle.textContent = d.title ?? '';
    vMeta.textContent = d.meta ?? '';
  }

  function open(i: number, from: HTMLElement) {
    if (animating) return;
    animating = true; current = i; source = from; paused = true;
    const end = finalSize(photos[i].ratio);
    const r = (from.querySelector('img') ?? from).getBoundingClientRect();

    vImg.src = (from.querySelector('img') as HTMLImageElement).currentSrc;
    vImg.style.width = `${end.w}px`; vImg.style.height = `${end.h}px`;
    fillCaption(i); loadLarge(i);

    gsap.set(viewer, { visibility: 'visible' });
    gsap.set(vImg, { opacity: 1 });
    from.style.visibility = 'hidden';
    document.body.classList.add('viewer-open');
    viewer.setAttribute('aria-hidden', 'false');

    gsap.timeline({ onComplete: () => (animating = false) })
      .fromTo(vImg, { x: r.left, y: r.top, scale: r.width / end.w },
        { x: end.x, y: end.y, scale: 1, duration: 1, ease: 'expo.inOut' })
      .to(viewer, { '--veil': 0.92, duration: 0.8, ease: 'power2.out' }, 0)
      .to(vExtras, { opacity: 1, duration: 0.5, stagger: 0.05 }, 0.7);
  }

  function close() {
    if (animating || current < 0) return;
    animating = true;
    const to = sourceOf(current);
    const r = (to.querySelector('img') ?? to).getBoundingClientRect();
    const end = finalSize(photos[current].ratio);
    if (source && source !== to) source.style.visibility = '';
    to.style.visibility = 'hidden';

    gsap.timeline({
      onComplete: () => {
        to.style.visibility = '';
        gsap.set(viewer, { visibility: 'hidden' });
        viewer.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('viewer-open');
        current = -1; source = null; animating = false;
        paused = document.body.dataset.view !== 'ring';
      },
    })
      .to(vExtras, { opacity: 0, duration: 0.25 })
      .to(vImg, { x: r.left, y: r.top, scale: r.width / end.w, duration: 0.85, ease: 'expo.inOut' }, 0.05)
      .to(viewer, { '--veil': 0, duration: 0.6 }, 0.2);
  }

  function sourceOf(i: number): HTMLElement {
    if (document.body.dataset.view === 'index') {
      return document.querySelector<HTMLElement>(`#index .cell[data-i="${i}"] .cell-img`)!;
    }
    return photos[i].el;
  }

  function step(dir: number) {
    if (animating || current < 0) return;
    animating = true;
    const next = (current + dir + N) % N;
    if (source) source.style.visibility = '';
    gsap.timeline({ onComplete: () => (animating = false) })
      .to(vImg, { opacity: 0, x: `-=${dir * 30}`, duration: 0.3, ease: 'power2.in' })
      .add(() => {
        current = next; source = sourceOf(next); source.style.visibility = 'hidden';
        const end = finalSize(photos[next].ratio);
        vImg.src = (photos[next].el.querySelector('img') as HTMLImageElement).currentSrc;
        vImg.style.width = `${end.w}px`; vImg.style.height = `${end.h}px`;
        gsap.set(vImg, { x: end.x + dir * 30, y: end.y, scale: 1 });
        fillCaption(next); loadLarge(next);
      })
      .to(vImg, { opacity: 1, x: `-=${dir * 30}`, duration: 0.45, ease: 'power3.out' });
  }

  viewer.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    if (t.closest('.prev')) return step(-1);
    if (t.closest('.next')) return step(1);
    close();
  });
  addEventListener('keydown', (ev) => {
    if (current < 0) return;
    if (ev.key === 'Escape') close();
    if (ev.key === 'ArrowRight') step(1);
    if (ev.key === 'ArrowLeft') step(-1);
  });
  let touchX = 0;
  viewer.addEventListener('touchstart', (ev) => (touchX = ev.touches[0].clientX), { passive: true });
  viewer.addEventListener('touchend', (ev) => {
    const d = ev.changedTouches[0].clientX - touchX;
    if (Math.abs(d) > 50) { ev.preventDefault(); step(d < 0 ? 1 : -1); }
  });

  const index = document.getElementById('index')!;
  const panels = Array.from(document.querySelectorAll<HTMLElement>('.panel'));
  const navButtons = document.querySelectorAll<HTMLButtonElement>('.nav-btn[data-go]');

  function goTo(target: string) {
    if (document.body.dataset.view === target) return;
    document.body.dataset.view = target;
    navButtons.forEach((b) => b.classList.toggle('active', b.dataset.go === target));
    for (const panel of panels) {
      if (panel.id === target) {
        panel.scrollTop = 0;
        gsap.fromTo(panel, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'expo.out' });
        const children = panel.querySelectorAll('li, .compare, .info-box > *');
        gsap.fromTo(children, { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out', stagger: { each: 0.015, from: 'start' } });
        if (target === 'info') panel.dispatchEvent(new CustomEvent('show'));
      } else {
        gsap.to(panel, { autoAlpha: 0, duration: 0.35 });
      }
    }
    paused = target !== 'ring';
  }
  navButtons.forEach((b) => b.addEventListener('click', () => goTo(b.dataset.go!)));

  index.querySelectorAll<HTMLElement>('.cell').forEach((c) => {
    c.addEventListener('pointerenter', (ev) => { if (ev.pointerType === 'mouse') tap(); });
    c.addEventListener('click', () => open(Number(c.dataset.i), c.querySelector('.cell-img')!));
  });

  let resizeTimer: number | undefined;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => { computeSlots(); if (mode === 'color') placeOnRing(false); else sortBy('trip', false); }, 150);
  });
}

// deterministic, so the layout is the same on every load
function pseudoRandom(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
