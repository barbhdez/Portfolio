// Lamp: off → dim → medium → full → off
import { gsap } from 'gsap';
import { switchClick } from './sound';
import { t, onLangChange } from './i18n';

const MAX = 3;
const HINTS = ['lamp.on', 'lamp.more', 'lamp.more', 'lamp.off'];

export function initLight() {
  const html = document.documentElement;
  const lamp = document.getElementById('lamp');
  if (!lamp) return;
  const button = lamp.querySelector<HTMLButtonElement>('.lamp-switch')!;
  const body = lamp.querySelector<SVGGElement>('.lamp-body');
  const hint = lamp.querySelector<HTMLElement>('.lamp-hint');

  let level = Number(html.dataset.light || 0);
  if (!(level >= 0 && level <= MAX)) level = 0;

  let changing: number | undefined;

  function paint() {
    html.classList.add('light-changing');
    clearTimeout(changing);
    changing = window.setTimeout(() => html.classList.remove('light-changing'), 1500);
    html.dataset.light = String(level);
    html.dataset.theme = level >= 2 ? 'light' : 'dark';
    if (hint) hint.textContent = t(HINTS[level]);
    try { localStorage.setItem('light', String(level)); } catch (e) {}
    button.setAttribute('aria-label', `${t('lamp.aria')} · ${t(HINTS[level])}`);
    const meta = document.querySelector('meta[name="theme-color"]');
    setTimeout(() => meta?.setAttribute('content', getComputedStyle(document.body).backgroundColor), 1500);
  }
  paint();

  // desktop: the lamp hangs just left of the menu, whatever its width
  // phones: the lamp hangs below the menu, and the signature drops if the role text gets too close to it
  const nav = document.querySelector<HTMLElement>('.top-right');
  const brand = document.querySelector<HTMLElement>('.top-left');
  const role = brand?.querySelector<HTMLElement>('.muted');
  function place() {
    if (!nav) return;
    const buttons = Array.from(nav.querySelectorAll('.nav-btn')).map((b) => b.getBoundingClientRect());
    const navLeft = Math.min(...buttons.map((r) => r.left));
    const navBottom = Math.max(...buttons.map((r) => r.bottom));
    if (brand) brand.style.transform = '';
    if (innerWidth >= 700) {
      lamp!.style.right = `${Math.round(innerWidth - navLeft + 24)}px`;
      return;
    }
    lamp!.style.right = '';
    if (brand && role) {
      const r = role.getBoundingClientRect();
      const MIN_GAP = 18;
      if (r.right > navLeft - MIN_GAP && r.top < navBottom + MIN_GAP) {
        brand.style.transform = `translateY(${Math.ceil(navBottom + MIN_GAP - r.top)}px)`;
      }
    }
  }
  place();
  addEventListener('resize', place);
  onLangChange(() => {
    if (hint) hint.textContent = t(HINTS[level]);
    button.setAttribute('aria-label', `${t('lamp.aria')} · ${t(HINTS[level])}`);
    place();
  });
  document.fonts?.ready.then(place);

  gsap.set(lamp, { transformOrigin: '50% 0%' });
  button.addEventListener('click', () => {
    level = level >= MAX ? 0 : level + 1;
    paint();
    switchClick(level > 0);
    gsap.fromTo(lamp, { rotation: 0 }, { keyframes: { rotation: [5, -3.5, 2, -1, 0] }, duration: 1.6, ease: 'power1.out' });
    if (body) gsap.fromTo(body, { y: 0 }, { y: 3, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out' });
  });
}
