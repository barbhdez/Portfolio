// Before/after: scrolling through each pair wipes the edited version down over the original.
export function initCompare() {
  const panel = document.getElementById('before-after');
  if (!panel) return;
  const pairs = Array.from(panel.querySelectorAll<HTMLElement>('.compare')).map((fig) => ({
    fig,
    frame: fig.querySelector<HTMLElement>('.compare-frame')!,
    before: fig.querySelector<HTMLElement>('.compare-tag.before')!,
    after: fig.querySelector<HTMLElement>('.compare-tag.after')!,
  }));
  let queued = false;

  function update() {
    queued = false;
    const vh = panel!.clientHeight;
    for (const { fig, frame, before, after } of pairs) {
      const r = fig.getBoundingClientRect();
      const t = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - vh)));
      // hold on the original at the start and on the edit at the end
      const p = Math.min(1, Math.max(0, (t - 0.15) / 0.7));
      frame.style.setProperty('--pos', `${(p * 100).toFixed(2)}%`);
      after.style.opacity = p > 0.08 ? '1' : '0';
      before.style.opacity = p < 0.92 ? '1' : '0';
    }
  }
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  panel.addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  update();
}
