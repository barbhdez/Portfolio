// Bombilla: alterna entre modo cine (oscuro) y modo claro.
import { gsap } from 'gsap';

export function iniciarTema() {
  const btn = document.getElementById('bombilla');
  const html = document.documentElement;
  if (!btn) return;
  gsap.set(btn, { transformOrigin: '50% 0%' });

  const pintarColor = () => {
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', getComputedStyle(document.body).backgroundColor);
  };
  pintarColor();

  btn.addEventListener('click', () => {
    const nuevo = html.dataset.tema === 'oscuro' ? 'claro' : 'oscuro';
    const aplicar = () => {
      html.dataset.tema = nuevo;
      try { localStorage.setItem('tema', nuevo); } catch (e) {}
      pintarColor();
    };

    // La bombilla se balancea como si tiraras del cable
    gsap.fromTo(btn, { rotation: 0 }, { keyframes: { rotation: [9, -6, 3.5, -1.5, 0] }, duration: 1.4, ease: 'power1.out' });

    // Transición: un círculo de luz (o de sombra) que se expande desde la bombilla
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
    if (!doc.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return aplicar();
    const r = btn.querySelector('svg')!.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height * 0.6;
    const radio = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    doc.startViewTransition(aplicar).ready.then(() => {
      html.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radio}px at ${x}px ${y}px)`] },
        { duration: 900, easing: 'cubic-bezier(.7,0,.2,1)', pseudoElement: '::view-transition-new(root)' }
      );
    });
  });
}
