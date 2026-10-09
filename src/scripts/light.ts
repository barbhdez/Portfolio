// Lamp: off → dim → medium → full → off
import { gsap } from 'gsap';
import { switchClick } from './sound';

const MAX = 3;
const NAMES = ['off', 'dim', 'medium', 'full'];
const HINTS = ['On', 'More', 'More', 'Off'];

export function initLight() {
  const html = document.documentElement;
  const lamp = document.getElementById('lamp');
  if (!lamp) return;
  const body = lamp.querySelector<SVGGElement>('.lamp-body');
  const hint = lamp.querySelector<HTMLElement>('.lamp-hint');

  let level = Number(html.dataset.light || 0);
  if (!(level >= 0 && level <= MAX)) level = 0;

  function paint() {
    html.dataset.light = String(level);
    html.dataset.theme = level >= 2 ? 'light' : 'dark';
    if (hint) hint.textContent = HINTS[level];
    try { localStorage.setItem('light', String(level)); } catch (e) {}
    lamp!.setAttribute('aria-label', `Light: ${NAMES[level]}. ${level === MAX ? 'Click to switch off' : 'Click for more light'}`);
    const meta = document.querySelector('meta[name="theme-color"]');
    setTimeout(() => meta?.setAttribute('content', getComputedStyle(document.body).backgroundColor), 1500);
  }
  paint();

  gsap.set(lamp, { transformOrigin: '50% 0%' });
  lamp.addEventListener('click', () => {
    level = level >= MAX ? 0 : level + 1;
    paint();
    switchClick(level > 0);
    gsap.fromTo(lamp, { rotation: 0 }, { keyframes: { rotation: [5, -3.5, 2, -1, 0] }, duration: 1.6, ease: 'power1.out' });
    if (body) gsap.fromTo(body, { y: 0 }, { y: 3, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out' });
  });
}
