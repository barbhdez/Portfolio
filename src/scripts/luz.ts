// ─────────────────────────────────────────────────────────────
//  Lámpara colgante: controla la luz de la web.
//  Cada clic sube un nivel:  0 apagada (modo cine) → 1 tenue → 2 media → 3 toda la luz.
//  Un clic más con toda la luz → se apaga.
// ─────────────────────────────────────────────────────────────
import { gsap } from 'gsap';
import { sonidoInterruptor } from './sonido';

const MAX = 3;
const NOMBRES = ['off', 'dim', 'medium', 'full'];

export function iniciarLuz() {
  const html = document.documentElement;
  const lampara = document.getElementById('lampara');
  if (!lampara) return;
  const cuerpo = lampara.querySelector<SVGGElement>('.lampara-cuerpo');

  let nivel = Number(html.dataset.luz || 0);
  if (!(nivel >= 0 && nivel <= MAX)) nivel = 0;

  function pintar() {
    html.dataset.luz = String(nivel);
    html.dataset.tema = nivel >= 2 ? 'claro' : 'oscuro';
    try { localStorage.setItem('luz', String(nivel)); } catch (e) {}
    lampara!.setAttribute('aria-label', `Light: ${NOMBRES[nivel]}. ${nivel === MAX ? 'Click to switch off' : 'Click for more light'}`);
    const meta = document.querySelector('meta[name="theme-color"]');
    setTimeout(() => meta?.setAttribute('content', getComputedStyle(document.body).backgroundColor), 1500);
  }
  pintar();

  gsap.set(lampara, { transformOrigin: '50% 0%' });
  lampara.addEventListener('click', () => {
    nivel = nivel >= MAX ? 0 : nivel + 1;
    pintar();
    sonidoInterruptor(nivel > 0);
    // la lámpara se balancea un poco, como si tiraras de ella
    gsap.fromTo(lampara, { rotation: 0 }, { keyframes: { rotation: [5, -3.5, 2, -1, 0] }, duration: 1.6, ease: 'power1.out' });
    if (cuerpo) gsap.fromTo(cuerpo, { y: 0 }, { y: 3, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out' });
  });
}
