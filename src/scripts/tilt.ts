// Inclinaison CSS 3D (± 6°) des cartes selon la position du pointeur
const MAX = 6;
const cartes = [...document.querySelectorAll<HTMLElement>("[data-tilt]")];
const reduit = matchMedia("(prefers-reduced-motion: reduce)").matches;
const souris = matchMedia("(pointer: fine)").matches;

if (cartes.length && !reduit && souris) {
  let x = 0, y = 0, attente = false;
  const appliquer = () => {
    attente = false;
    for (const c of cartes) {
      c.style.setProperty("--ry", `${(x * MAX).toFixed(2)}deg`);
      c.style.setProperty("--rx", `${(-y * MAX).toFixed(2)}deg`);
    }
  };
  addEventListener("pointermove", (e) => {
    x = (e.clientX / innerWidth) * 2 - 1;
    y = (e.clientY / innerHeight) * 2 - 1;
    if (!attente) { attente = true; requestAnimationFrame(appliquer); }
  }, { passive: true });
}
