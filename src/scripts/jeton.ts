import {
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";

interface Etape {
  section: HTMLElement;
  boucle: boolean;
  mode: "cible" | "colonne";
  cible: HTMLElement;
  // géométrie en coordonnées de document, mesurée une fois (pas de lecture de layout à chaque image)
  top: number;
  hauteur: number;
  cx: number;
  cy: number;
  largeur: number;
  hCible: number;
}

interface Boite {
  cx: number;
  cy: number;
  cote: number;
}

/** Pose d'un jeton : position (en rayons), échelle, épaisseur relative, décalage de rotation. */
interface Pose {
  x: number;
  y: number;
  s: number;
  e: number;
  o: number;
}

const NB = 4;
const seul = (): Pose[] => Array.from({ length: NB }, () => ({ x: 0, y: 0, s: 1, e: 1, o: 0 }));
const pile = (): Pose[] => Array.from({ length: NB }, (_, i) => ({ x: 0, y: (i - 1.5) * 0.5, s: 1, e: 0.5, o: 0 }));
const petitEtGrand = (): Pose[] =>
  Array.from({ length: NB }, (_, i) =>
    i === 0 ? { x: -1.35, y: -0.2, s: 0.42, e: 1, o: 0 } : { x: 0.7, y: 0, s: 1, e: 1, o: 0 },
  );
const grandSeul = (): Pose[] =>
  Array.from({ length: NB }, (_, i) =>
    i === 0 ? { x: 0, y: -0.2, s: 0, e: 1, o: 0 } : { x: 0, y: 0, s: 1.15, e: 1, o: 0 },
  );
/** départ → arrivée de chaque section : hero, contexte, exploration, révélation, conclusion */
const SEQUENCE: [Pose[], Pose[]][] = [
  [seul(), seul()],
  [seul(), pile()],
  [pile(), pile()],
  [pile(), petitEtGrand()],
  [petitEtGrand(), grandSeul()],
];

const H0 = 0.55; // hauteur d'un jeton, en rayons
const INCLINAISON = 0.55;

function demarrer(scene: HTMLElement) {
  const canvas = scene.querySelector<HTMLCanvasElement>("canvas")!;
  const imageFixe = document.querySelector<HTMLImageElement>("#jeton-fixe");

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch {
    return; // sans WebGL, l'image fixe du hero reste affichée
  }
  renderer.setClearColor(0x000000, 0);

  const etapes: Etape[] = [...scene.querySelectorAll<HTMLElement>("[data-jeton]")].map((section) => ({
    section,
    boucle: section.hasAttribute("data-jeton-boucle"),
    mode: section.dataset.jetonMode === "colonne" ? "colonne" : "cible",
    cible: section.querySelector<HTMLElement>("[data-jeton-cible]")!,
    top: 0, hauteur: 0, cx: 0, cy: 0, largeur: 0, hCible: 0,
  }));

  // ---- Scène : caméra orthographique en pixels CSS, origine en bas à gauche
  const sc = new Scene();
  const camera = new OrthographicCamera(0, 1, 1, 0, -4000, 4000);
  camera.position.z = 1000;
  const racine = new Group();
  racine.rotation.x = INCLINAISON;
  sc.add(racine);

  // Face du dessus : dégradé, lueur et éclair dessinés sur la face elle-même, donc
  // l'éclair tourne avec le jeton et ne peut pas dépasser de l'hexagone.
  function textureDessus() {
    const T = 1024;
    const c = document.createElement("canvas");
    c.width = c.height = T;
    const g = c.getContext("2d")!;
    const fond = g.createLinearGradient(0, T * 0.15, T, T * 0.85);
    fond.addColorStop(0, "#B3CCF7");
    fond.addColorStop(1, "#6E9BEE");
    g.fillStyle = fond;
    g.fillRect(0, 0, T, T);
    const lueur = g.createRadialGradient(T / 2, T / 2, 0, T / 2, T / 2, T * 0.3);
    lueur.addColorStop(0, "rgba(255,194,61,0.65)");
    lueur.addColorStop(1, "rgba(255,194,61,0)");
    g.fillStyle = lueur;
    g.fillRect(0, 0, T, T);
    const pts: [number, number][] = [[0.03, -0.17], [-0.11, 0.03], [-0.02, 0.03], [-0.06, 0.18], [0.11, -0.05], [0.02, -0.05], [0.1, -0.17]];
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo : g.moveTo).call(g, T * (0.5 + x), T * (0.5 + y)));
    g.closePath();
    g.fillStyle = "#FFC23D";
    g.fill();
    g.lineJoin = "round";
    g.lineWidth = T * 0.006;
    g.strokeStyle = "#FFE08A";
    g.stroke();
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }

  function textureOmbre() {
    const T = 256;
    const c = document.createElement("canvas");
    c.width = c.height = T;
    const g = c.getContext("2d")!;
    const d = g.createRadialGradient(T / 2, T / 2, 0, T / 2, T / 2, T / 2);
    d.addColorStop(0, "rgba(110,122,150,0.5)");
    d.addColorStop(0.72, "rgba(110,122,150,0.42)");
    d.addColorStop(0.78, "rgba(110,122,150,0.16)");
    d.addColorStop(1, "rgba(110,122,150,0)");
    g.fillStyle = d;
    g.fillRect(0, 0, T, T);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  }

  const geoCotes = new CylinderGeometry(1, 1, H0, 6, 1, true).toNonIndexed();
  geoCotes.computeVertexNormals();
  const geoDessus = new CircleGeometry(1, 6, Math.PI / 6).rotateX(-Math.PI / 2).translate(0, H0 / 2 + 0.001, 0);
  const geoAretes = new EdgesGeometry(new CylinderGeometry(1, 1, H0, 6, 1, false), 20);
  const geoOmbre = new CircleGeometry(1.1, 48).rotateX(-Math.PI / 2);

  const matCotes = new ShaderMaterial({
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    vertexShader: `
      varying vec3 vN; varying float vH;
      void main() {
        vN = normalize(mat3(modelMatrix) * normal);
        vH = position.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vN; varying float vH;
      void main() {
        float l = clamp(dot(normalize(vN), normalize(vec3(-0.7, 0.3, 0.65))) * 0.5 + 0.5, 0.0, 1.0);
        vec3 sombre = vec3(0.05, 0.13, 0.34);
        vec3 moyen = vec3(0.24, 0.40, 0.80);
        vec3 clair = vec3(0.38, 0.57, 0.95);
        vec3 c = l < 0.5 ? mix(sombre, moyen, l * 2.0) : mix(moyen, clair, (l - 0.5) * 2.0);
        float g = clamp(vH / ${H0.toFixed(2)} + 0.5, 0.0, 1.0);
        gl_FragColor = vec4(c * mix(0.5, 1.0, g), 1.0);
      }`,
  });
  const matDessus = new MeshBasicMaterial({ map: textureDessus(), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const matAretes = new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  const texOmbre = textureOmbre();

  interface Jeton { pivot: Group; tour: Group; ombre: Mesh<CircleGeometry, MeshBasicMaterial> }
  const jetons: Jeton[] = Array.from({ length: NB }, () => {
    const pivot = new Group();
    const tour = new Group();
    tour.add(new Mesh(geoCotes, matCotes), new Mesh(geoDessus, matDessus), new LineSegments(geoAretes, matAretes));
    pivot.add(tour);
    const ombre = new Mesh(geoOmbre, new MeshBasicMaterial({ map: texOmbre, transparent: true, depthWrite: false }));
    ombre.renderOrder = -1;
    racine.add(ombre, pivot);
    return { pivot, tour, ombre };
  });

  // ---- Géométrie de la page
  const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const melanger = (a: Boite, b: Boite, t: number): Boite => ({
    cx: a.cx + (b.cx - a.cx) * t,
    cy: a.cy + (b.cy - a.cy) * t,
    cote: a.cote + (b.cote - a.cote) * t,
  });
  function mesurer() {
    for (const e of etapes) {
      const s = e.section.getBoundingClientRect();
      const c = e.cible.getBoundingClientRect();
      e.top = s.top + scrollY;
      e.hauteur = s.height;
      e.cx = c.left + c.width / 2;
      e.cy = c.top + scrollY + c.height / 2;
      e.largeur = c.width;
      e.hCible = c.height;
    }
  }
  function boite(e: Etape, y: number): Boite {
    if (e.mode === "colonne") {
      // épinglé : centré verticalement dans l'écran, dans la colonne de droite
      return { cx: e.cx, cy: innerHeight * 0.52, cote: Math.min(e.largeur * 1.15, innerHeight * 0.72) };
    }
    return { cx: e.cx, cy: e.cy - y, cote: Math.max(e.largeur, e.hCible) };
  }

  function dimensionner() {
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    renderer.setSize(innerWidth, innerHeight, false);
    camera.left = 0;
    camera.right = innerWidth;
    camera.top = innerHeight;
    camera.bottom = 0;
    camera.updateProjectionMatrix();
  }

  // ---- Rendu
  let premierRendu = false;
  let attente = false;
  let dernierTemps = 0;
  let defile = -1; // défilement lissé : amortit les crans de la molette
  let tourHero = 0;

  function dessiner(temps: number) {
    attente = false;
    const dt = Math.min(64, temps - dernierTemps || 16);
    dernierTemps = temps;

    const y = scrollY;
    if (defile < 0) defile = y;
    else defile += (y - defile) * (1 - Math.exp(-dt / 55));
    const ecart = Math.abs(y - defile);
    if (ecart < 0.3) defile = y;

    const mid = defile + innerHeight * 0.5;
    let i = 0;
    etapes.forEach((e, n) => { if (e.top <= mid) i = n; });
    const e = etapes[i];
    const derniere = i === etapes.length - 1;
    const u = clamp((mid - e.top) / (e.hauteur - (derniere ? innerHeight * 0.5 : 0)));

    let b = boite(e, y);
    let t = 0;
    if (!derniere && u > 0.7) {
      t = ease((u - 0.7) / 0.3);
      b = melanger(b, boite(etapes[i + 1], y), t);
    }

    // rotation : continue dans le hero, puis liée au défilement
    if (e.boucle) tourHero += dt * 0.0006;
    const rotation = tourHero + defile * 0.0025;

    // poses : interpolation entre le départ et l'arrivée de la section
    const [de, vers] = SEQUENCE[Math.min(i, SEQUENCE.length - 1)];
    const k = ease(clamp(u / 0.85));
    const R = b.cote * 0.29;
    racine.position.set(b.cx, innerHeight - b.cy, 0);
    racine.scale.setScalar(R);

    const poses = de.map((p, n) => {
      const q = vers[n];
      return { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k, s: p.s + (q.s - p.s) * k, e: p.e + (q.e - p.e) * k, o: p.o + (q.o - p.o) * k };
    });

    jetons.forEach((j, n) => {
      const p = poses[n];
      const visible = p.s > 0.02;
      j.pivot.visible = visible;
      j.pivot.position.set(p.x, p.y, 0);
      j.pivot.scale.set(p.s, p.s * p.e, p.s);
      j.tour.rotation.y = rotation + p.o + Math.PI / 6;

      // ombre : seulement sous le jeton le plus bas de chaque colonne
      let dessous = visible;
      for (let m = 0; m < n && dessous; m++) {
        const o = poses[m];
        if (o.s > 0.02 && Math.abs(o.x - p.x) < 0.4 && o.y <= p.y + 0.01) dessous = false;
      }
      for (let m = n + 1; m < NB && dessous; m++) {
        const o = poses[m];
        if (o.s > 0.02 && Math.abs(o.x - p.x) < 0.4 && o.y < p.y - 0.01) dessous = false;
      }
      j.ombre.visible = dessous;
      j.ombre.position.set(p.x, p.y - (H0 * p.s * p.e) / 2 - 0.02, 0);
      j.ombre.scale.setScalar(p.s);
    });

    renderer.render(sc, camera);

    if (!premierRendu) {
      premierRendu = true;
      canvas.style.opacity = "1";
      if (imageFixe) imageFixe.style.visibility = "hidden";
    }

    // on continue tant que le hero tourne ou que le lissage n'a pas rattrapé le défilement
    if (e.boucle || ecart > 0.3) demander();
  }

  function demander() {
    if (attente) return;
    attente = true;
    requestAnimationFrame(dessiner);
  }

  const remesurer = () => { dimensionner(); mesurer(); demander(); };
  dimensionner();
  mesurer();
  addEventListener("scroll", demander, { passive: true });
  addEventListener("resize", remesurer, { passive: true });
  addEventListener("load", remesurer, { once: true });
  new ResizeObserver(() => { mesurer(); demander(); }).observe(scene);
  demander();
}

const scene = document.querySelector<HTMLElement>("#scene-jeton");
const reduit = matchMedia("(prefers-reduced-motion: reduce)").matches;

if (scene && !reduit) demarrer(scene);
