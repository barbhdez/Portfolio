import { gsap } from 'gsap';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function write(svg: SVGSVGElement, duration = 1.6) {
  const strokes = Array.from(svg.querySelectorAll('path'));
  // hidden until drawn, otherwise the round caps show as dots
  gsap.set(strokes, { strokeDasharray: 1, strokeDashoffset: 1, opacity: 0 });
  const step = duration / (strokes.length + 2);
  const tl = gsap.timeline();
  strokes.forEach((s, i) => {
    tl.set(s, { opacity: 1 }, i * step)
      .to(s, { strokeDashoffset: 0, duration: duration / 2.2, ease: 'power1.inOut' }, i * step);
  });
  return tl;
}

// resolves when the intro starts fading out; plays once per session
export function playIntro(): Promise<void> {
  const intro = document.getElementById('intro');
  const large = intro?.querySelector<SVGSVGElement>('svg');
  const small = document.querySelector<SVGSVGElement>('.signature-small');

  let seen = false;
  try { seen = sessionStorage.getItem('intro') === '1'; sessionStorage.setItem('intro', '1'); } catch (e) {}

  if (!intro || !large || reducedMotion() || seen) {
    intro?.remove();
    if (small && !reducedMotion()) write(small, 1);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    write(large, 1.9)
      .to({}, { duration: 0.35 })
      .add(() => { resolve(); if (small) write(small, 1); })
      .to(intro, { autoAlpha: 0, duration: 0.8, ease: 'power2.inOut', onComplete: () => intro.remove() });
  });
}
