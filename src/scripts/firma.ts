// Animación de la firma: se "escribe" letra a letra y luego se rellena.
import { gsap } from 'gsap';

const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function escribir(svg: SVGSVGElement, duracion = 1.6) {
  const trazos = Array.from(svg.querySelectorAll('path'));
  // cada trazo está invisible hasta que empieza a dibujarse (si no, el extremo redondeado se ve como un punto)
  gsap.set(trazos, { strokeDasharray: 1, strokeDashoffset: 1, fillOpacity: 0, opacity: 0 });
  const paso = duracion / (trazos.length + 2);
  const tl = gsap.timeline();
  trazos.forEach((t, i) => {
    tl.set(t, { opacity: 1 }, i * paso)
      .to(t, { strokeDashoffset: 0, duration: duracion / 2.2, ease: 'power1.inOut' }, i * paso);
  });
  return tl.to(trazos, { fillOpacity: 1, duration: 0.5, ease: 'power2.out' }, '-=0.25');
}

// Pantalla de entrada. Devuelve una promesa que se resuelve cuando empieza a desaparecer,
// para que el anillo arranque justo detrás.
export function dibujarEntrada(): Promise<void> {
  const entrada = document.getElementById('entrada');
  const grande = entrada?.querySelector<SVGSVGElement>('svg');
  const mini = document.querySelector<SVGSVGElement>('.firma-mini');
  const info = document.getElementById('info');
  const firmaInfo = document.querySelector<SVGSVGElement>('.firma-info');
  if (info && firmaInfo) info.addEventListener('mostrar', () => escribir(firmaInfo, 1.4));

  let yaVista = false;
  try { yaVista = sessionStorage.getItem('entrada') === '1'; sessionStorage.setItem('entrada', '1'); } catch (e) {}

  if (!entrada || !grande || reducido() || yaVista) {
    entrada?.remove();
    if (mini && !reducido()) escribir(mini, 1);
    return Promise.resolve();
  }

  return new Promise((resolver) => {
    escribir(grande, 1.9)
      .to({}, { duration: 0.35 })
      .add(() => { resolver(); if (mini) escribir(mini, 1); })
      .to(entrada, { autoAlpha: 0, duration: 0.8, ease: 'power2.inOut', onComplete: () => entrada.remove() });
  });
}
