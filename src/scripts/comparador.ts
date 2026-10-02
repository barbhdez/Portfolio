// Antes / Después: la línea sigue al ratón (o se arrastra con el dedo / teclado).
import { gsap } from 'gsap';

export function iniciarComparadores() {
  document.querySelectorAll<HTMLElement>('.comparador').forEach((fig) => {
    const caja = fig.querySelector<HTMLElement>('.comp-caja')!;
    const rango = fig.querySelector<HTMLInputElement>('.comp-rango')!;
    const estado = { p: 50 };
    const pintar = () => fig.style.setProperty('--pos', `${estado.p}%`);
    const mover = gsap.quickTo(estado, 'p', { duration: 0.45, ease: 'power3.out', onUpdate: pintar });

    // Ratón: basta con pasar por encima
    caja.addEventListener('pointermove', (ev) => {
      if (ev.pointerType !== 'mouse') return;
      const r = caja.getBoundingClientRect();
      const p = Math.min(100, Math.max(0, ((ev.clientX - r.left) / r.width) * 100));
      rango.value = String(p);
      mover(p);
    });
    // Dedo o teclado: la barra (input range invisible encima de la foto)
    rango.addEventListener('input', () => { estado.p = Number(rango.value); gsap.killTweensOf(estado); pintar(); });

    // Pequeño "guiño" la primera vez que aparece, para que se entienda que se puede mover
    const obs = new IntersectionObserver((entradas) => {
      if (!entradas[0].isIntersecting) return;
      obs.disconnect();
      gsap.timeline({ delay: 0.4, onUpdate: pintar })
        .to(estado, { p: 72, duration: 0.7, ease: 'power2.inOut' })
        .to(estado, { p: 30, duration: 0.9, ease: 'power2.inOut' })
        .to(estado, { p: 50, duration: 0.6, ease: 'power2.out' });
    }, { threshold: 0.6 });
    obs.observe(fig);
  });
}
