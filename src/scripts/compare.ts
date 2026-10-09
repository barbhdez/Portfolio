import { gsap } from 'gsap';

export function initCompare() {
  document.querySelectorAll<HTMLElement>('.compare').forEach((fig) => {
    const frame = fig.querySelector<HTMLElement>('.compare-frame')!;
    const range = fig.querySelector<HTMLInputElement>('.compare-range')!;
    const state = { p: 50 };
    const paint = () => fig.style.setProperty('--pos', `${state.p}%`);
    const moveTo = gsap.quickTo(state, 'p', { duration: 0.45, ease: 'power3.out', onUpdate: paint });

    frame.addEventListener('pointermove', (ev) => {
      if (ev.pointerType !== 'mouse') return;
      const r = frame.getBoundingClientRect();
      const p = Math.min(100, Math.max(0, ((ev.clientX - r.left) / r.width) * 100));
      range.value = String(p);
      moveTo(p);
    });
    // touch / keyboard
    range.addEventListener('input', () => { state.p = Number(range.value); gsap.killTweensOf(state); paint(); });

    // hint animation on first view
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      gsap.timeline({ delay: 0.4, onUpdate: paint })
        .to(state, { p: 72, duration: 0.7, ease: 'power2.inOut' })
        .to(state, { p: 30, duration: 0.9, ease: 'power2.inOut' })
        .to(state, { p: 50, duration: 0.6, ease: 'power2.out' });
    }, { threshold: 0.6 });
    io.observe(fig);
  });
}
