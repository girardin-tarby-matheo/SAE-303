

const N = 120;
const DUREE_IMAGE_HERO = 140; 

const scene = document.querySelector<HTMLElement>("#scene-jeton");
const reduit = matchMedia("(prefers-reduced-motion: reduce)").matches;

if (scene && !reduit) demarrer(scene);

interface Etape {
  section: HTMLElement;
  debut: number;
  fin: number;
  boucle: boolean;
  mode: "cible" | "colonne";
  cible: HTMLElement;
}

interface Boite {
  cx: number;
  cy: number;
  cote: number;
}

function demarrer(scene: HTMLElement) {
  const canvas = scene.querySelector<HTMLCanvasElement>("canvas")!;
  const ctx = canvas.getContext("2d")!;
  const imageFixe = document.querySelector<HTMLImageElement>("#jeton-fixe");

  const etapes: Etape[] = [...scene.querySelectorAll<HTMLElement>("[data-jeton]")].map((section) => {
    const [debut, fin] = section.dataset.jeton!.split("-").map(Number);
    return {
      section,
      debut,
      fin,
      boucle: section.hasAttribute("data-jeton-boucle"),
      mode: section.dataset.jetonMode === "colonne" ? "colonne" : "cible",
      cible: section.querySelector<HTMLElement>("[data-jeton-cible]")!,
    };
  });

  // ---- Images
  const images: HTMLImageElement[] = [];
  const charger = (i: number) => {
    if (images[i]) return;
    const img = new Image();
    img.decoding = "async";
    img.onload = demander;
    img.src = `/3d/jeton/${String(i).padStart(3, "0")}.webp`;
    images[i] = img;
  };
  for (let i = 0; i < 30; i++) charger(i);
  let resteCharge = false;
  const chargerLeReste = () => {
    if (resteCharge) return;
    resteCharge = true;
    const go = () => { for (let i = 30; i < N; i++) charger(i); };
    if ("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 1500 });
    else setTimeout(go, 600);
  };
  /** image prête la plus proche (en remontant) pour ne jamais afficher un trou */
  const imagePrete = (i: number) => {
    for (let k = i; k >= 0; k--) if (images[k]?.complete && images[k].naturalWidth) return images[k];
    return null;
  };

  // ---- Géométrie
  const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const melanger = (a: Boite, b: Boite, t: number): Boite => ({
    cx: a.cx + (b.cx - a.cx) * t,
    cy: a.cy + (b.cy - a.cy) * t,
    cote: a.cote + (b.cote - a.cote) * t,
  });
  function boite(e: Etape): Boite {
    const r = e.cible.getBoundingClientRect();
    if (e.mode === "colonne") {
      // épinglé : centré verticalement dans l'écran, dans la colonne de droite
      const cote = Math.min(r.width * 1.15, innerHeight * 0.72);
      return { cx: r.left + r.width / 2, cy: innerHeight * 0.52, cote };
    }
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, cote: Math.max(r.width, r.height) };
  }

  // ---- Taille du canvas (densité d'écran plafonnée à 2)
  let dpr = 1;
  function dimensionner() {
    dpr = Math.min(2, devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
  }

  // ---- Rendu
  let premierRendu = false;
  let enBoucle = false;
  let attente = false;

  function dessiner(temps: number) {
    attente = false;
    const mid = innerHeight * 0.5;
    let i = 0;
    etapes.forEach((e, k) => { if (e.section.getBoundingClientRect().top <= mid) i = k; });
    const e = etapes[i];
    const r = e.section.getBoundingClientRect();
    const derniere = i === etapes.length - 1;
    const u = clamp((mid - r.top) / (r.height - (derniere ? innerHeight * 0.5 : 0)));

    let image: number;
    if (e.boucle) image = e.debut + (Math.floor(temps / DUREE_IMAGE_HERO) % (e.fin - e.debut + 1));
    else image = Math.round(e.debut + (e.fin - e.debut) * u);

    let b = boite(e);
    if (!derniere && u > 0.7) b = melanger(b, boite(etapes[i + 1]), ease((u - 0.7) / 0.3));

    const img = imagePrete(image);
    const calque = canvas.getBoundingClientRect();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (img) {
      ctx.drawImage(img, b.cx - calque.left - b.cote / 2, b.cy - calque.top - b.cote / 2, b.cote, b.cote);
      if (!premierRendu) {
        premierRendu = true;
        canvas.style.opacity = "1";
        if (imageFixe) imageFixe.style.visibility = "hidden";
        chargerLeReste();
      }
    }

    // rotation lente au repos tant que le hero est actif
    enBoucle = e.boucle;
    if (enBoucle) demander();
  }

  function demander() {
    if (attente) return;
    attente = true;
    requestAnimationFrame(dessiner);
  }

  dimensionner();
  addEventListener("scroll", demander, { passive: true });
  addEventListener("resize", () => { dimensionner(); demander(); }, { passive: true });
  demander();
}
