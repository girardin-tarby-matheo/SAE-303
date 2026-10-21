// Fonctions Plot pures : elles n'importent que Plot et ne lisent que leurs arguments.
// Rendu au build : on leur passe un `document` (linkedom) et on récupère le SVG (outerHTML).
// Règles : barres sur un axe commun partant de zéro, échelle normale, valeurs écrites sur les barres
// (pas d'infobulle), couleur = taille du modèle uniquement (palette séquentielle).

import * as Plot from "@observablehq/plot";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { ParTaille, Distribution, ProprietesPays, ChiffrePublie } from "./types";

const TAILLES = {
  domain: ["petit", "moyen", "grand", "inconnue"],
  range: ["#A9C6F5", "#5B8DEF", "#0A1F44", "#C3CAD6"],
};
// version sombre (fond navy) : le grand modèle passe en volt pour rester visible
const TAILLES_SOMBRE = {
  domain: ["petit", "moyen", "grand", "inconnue"],
  range: ["#A9C6F5", "#5B8DEF", "#FFC23D", "#C3CAD6"],
};

// espace insécable (U+00A0) à la place de l'espace fine U+202F, quasi invisible en Manrope
const ESPACE_FINE = String.fromCharCode(0x202f);
const ESPACE_INSECABLE = String.fromCharCode(0xa0);
const fr = (v: number, d = 0) =>
  v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).replaceAll(ESPACE_FINE, ESPACE_INSECABLE);
const graduation = (d: number) => d.toLocaleString("fr-FR").replaceAll(ESPACE_FINE, ESPACE_INSECABLE);
const style = (sombre = false) => ({
  fontFamily: "var(--font-mono), monospace",
  fontSize: "13px",
  color: sombre ? "#EAF2FE" : "#0A1F44",
  background: "transparent",
  overflow: "visible",
});

type Doc = Document | undefined;

/** Barres par taille de modèle (graphiques de la révélation) */
export function barresParTaille(
  donnees: ParTaille[],
  { champ, label, document, width = 640, sombre = false }: {
    champ: "tokens_median" | "wh_1000_tokens_median";
    label: string; document?: Doc; width?: number; sombre?: boolean;
  },
) {
  const texte = (d: ParTaille) => {
    const v = d[champ];
    if (v == null) return "inconnu";
    return champ === "tokens_median" ? fr(Math.round(v)) : `${fr(v, 2)} Wh`;
  };
  return Plot.plot({
    document, width, height: 220, marginLeft: 80, marginRight: 80, marginBottom: 44,
    ariaLabel: label,
    style: style(sombre),
    x: { label, grid: true, labelAnchor: "left", labelArrow: "none", tickFormat: graduation },
    y: { label: null, domain: donnees.map((d) => d.taille), padding: 0.22 },
    color: sombre ? TAILLES_SOMBRE : TAILLES,
    marks: [
      Plot.barX(donnees, { x: champ, y: "taille", fill: "taille", rx: 6 }),
      // valeur inconnue : pas de barre, et « inconnu » écrit à l'origine (jamais 0)
      Plot.text(donnees, {
        x: (d: ParTaille) => d[champ] ?? 0, y: "taille", dx: 8, textAnchor: "start", fontWeight: 600,
        fill: "currentColor", text: texte,
      }),
      Plot.ruleX([0], { stroke: "currentColor" }),
    ],
  });
}

/** gRelatif du notebook (question 4) : électricité d'une conversation typique, pour les 15 modèles les plus utilisés */
export function barresModeles(
  modeles: { modele: string; wh_median_conv: number | null }[],
  { label, document, width = 1040 }: { label: string; document?: Doc; width?: number },
) {
  const tri = modeles.toSorted((a, b) => (b.wh_median_conv ?? 0) - (a.wh_median_conv ?? 0));
  return Plot.plot({
    document, width, height: tri.length * 30 + 70, marginLeft: 260, marginRight: 90, marginBottom: 44,
    ariaLabel: label,
    style: style(),
    x: { label: "Wh par conversation (médiane) →", grid: true, labelAnchor: "left", labelArrow: "none", tickFormat: graduation },
    y: { label: null, domain: tri.map((d) => d.modele), padding: 0.28 },
    marks: [
      Plot.barX(tri, { x: "wh_median_conv", y: "modele", fill: "#1E5BD8", rx: 4 }),
      Plot.text(tri, {
        x: (d: { wh_median_conv: number | null }) => d.wh_median_conv ?? 0, y: "modele", dx: 8, textAnchor: "start", fontWeight: 600,
        text: (d: { wh_median_conv: number | null }) => (d.wh_median_conv == null ? "inconnu" : `${fr(d.wh_median_conv, 2)} Wh`),
      }),
      Plot.ruleX([0]),
    ],
  });
}

/** V1 du notebook : histogramme de l'énergie par conversation, échelle logarithmique, médiane et moyenne en repères */
export function histogrammeConversations(
  d: Distribution,
  { label, document, width = 640 }: { label: string; document?: Doc; width?: number },
) {
  const domaine: [number, number] = [d.classes[0].x1, d.classes.at(-1)!.x2];
  const reperes = [0.001, 0.01, 0.1, 1, 10, 100, 1000].filter((t) => t >= domaine[0] && t <= domaine[1]);
  return Plot.plot({
    document, width, height: 300, marginLeft: 48, marginRight: 20, marginTop: 24, marginBottom: 48,
    ariaLabel: label,
    style: style(),
    x: {
      type: "log", domain: domaine, ticks: reperes, tickFormat: graduation,
      label: "Énergie estimée par conversation (Wh, échelle logarithmique) →", labelAnchor: "left", labelArrow: "none",
    },
    y: { label: "↑ nombre de conversations", grid: true, labelArrow: "none", tickFormat: graduation },
    marks: [
      Plot.rectY(d.classes, { x1: "x1", x2: "x2", y: "n", fill: "#5B8DEF", inset: 0.5 }),
      Plot.ruleX([d.mediane], { stroke: "#0A1F44", strokeWidth: 2 }),
      Plot.text([d.mediane], {
        x: (v: number) => v, frameAnchor: "top", textAnchor: "start", dx: 6, dy: 4, fontWeight: 600,
        text: (v: number) => `Médiane : ${fr(v, 2)} Wh`,
      }),
      Plot.ruleX([d.moyenne], { stroke: "#0A1F44", strokeDasharray: "4,3" }),
      Plot.text([d.moyenne], {
        x: (v: number) => v, frameAnchor: "top", textAnchor: "start", dx: 6, dy: 22,
        text: (v: number) => `Moyenne : ${fr(v, 2)} Wh`,
      }),
      Plot.ruleY([0]),
    ],
  });
}

// Palette du site, du clair (électricité peu carbonée) au foncé ; le notebook utilise YlOrBr
const BLEUS = ["#CFE0FB", "#8FB3F2", "#5B8DEF", "#1E5BD8", "#0A1F44"];
export const SANS_DONNEE = "#E3E7EE";
const interpolerBleus = (t: number) => {
  const i = Math.min(BLEUS.length - 2, Math.floor(t * (BLEUS.length - 1)));
  const u = t * (BLEUS.length - 1) - i;
  const rgb = (h: string) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  const [a, b] = [rgb(BLEUS[i]), rgb(BLEUS[i + 1])];
  return `rgb(${a.map((x, k) => Math.round(x + (b[k] - x) * u)).join(",")})`;
};

/**
 * V2 du notebook : carte choroplèthe de l'intensité carbone de l'électricité (projection Equal Earth,
 * échelle quantize à 5 classes, gris = pas de donnée, France et États-Unis légendés).
 * La légende est dessinée en HTML à partir de plot.scale("color").
 */
export function carteIntensite(
  geo: FeatureCollection<Geometry, ProprietesPays>,
  { annee, france, etatsUnis, label, document, width = 960 }: {
    annee: number; france: number; etatsUnis: number; label: string; document?: Doc; width?: number;
  },
) {
  return Plot.plot({
    document, width, projection: "equal-earth", margin: 8,
    ariaLabel: label,
    style: style(),
    color: { type: "quantize", n: 5, interpolate: interpolerBleus, unknown: SANS_DONNEE, label: `gCO₂e/kWh en ${annee}` },
    marks: [
      Plot.sphere({ stroke: "#A9C6F5" }),
      Plot.geo(geo.features, {
        fill: (f: Feature<Geometry, ProprietesPays>) => f.properties.gco2_kwh,
        stroke: "white",
        strokeWidth: 0.4,
        title: (f: Feature<Geometry, ProprietesPays>) =>
          `${f.properties.pays} : ${f.properties.gco2_kwh == null ? "pas de donnée" : fr(f.properties.gco2_kwh) + " gCO₂e/kWh"}`,
      }),
      Plot.text(
        [
          { lon: 2.5, lat: 46.5, t: `France : ${fr(france)}` },
          { lon: -98, lat: 39, t: `États-Unis : ${fr(etatsUnis)}` },
        ],
        { x: "lon", y: "lat", text: "t", fontWeight: 700, fill: "#0A1F44", stroke: "white", strokeWidth: 3, paintOrder: "stroke" },
      ),
    ],
  });
}

// Nature de la source (nominale) : palette du notebook, bleu du site en premier ; validée daltonisme (dataviz)
export const NATURES = {
  domain: ["Mesure interne", "Déclaration sans méthode", "Analyse de cycle de vie", "Estimation externe"],
  range: ["#1E5BD8", "#E0A120", "#1A9A6B", "#C97AA6"],
};

/**
 * V3 du notebook (graphiqueChiffres2) : chiffres publiés par requête, sur échelle logarithmique,
 * couleur = nature de la source, Compar:IA cerclé avec la plage des médianes de nos modèles.
 */
export function pointsChiffresPublies(
  donnees: ChiffrePublie[],
  { grandeur = "énergie", unite = "Wh", mettreEnAvant, plage, label, document, width = 1040 }: {
    grandeur?: string; unite?: string; mettreEnAvant: string; plage: [number, number]; label: string; document?: Doc; width?: number;
  },
) {
  const lignes = donnees.filter((d) => d.grandeur === grandeur && d.valeur > 0).toSorted((a, b) => a.valeur - b.valeur);
  const vmax = Math.max(...lignes.map((d) => d.valeur));
  const vmin = Math.min(...lignes.map((d) => d.valeur), plage[0]);
  const xmin = 10 ** Math.floor(Math.log10(vmin) - 0.3);
  const xmax = vmax * 12;
  const reperes = [0.01, 0.1, 1, 10, 100, 1000].filter((t) => t >= xmin && t <= xmax);
  const position = (v: number) => Math.log10(v / xmin) / Math.log10(xmax / xmin);
  return Plot.plot({
    document, width, height: 60 + 70 * lignes.length, marginLeft: 190, marginRight: 20, marginTop: 30, marginBottom: 46,
    ariaLabel: label,
    style: style(),
    x: {
      type: "log", domain: [xmin, xmax], ticks: reperes, grid: true, tickFormat: (d: number) => `${graduation(d)} ${unite}`,
      label: `${grandeur} par requête, échelle logarithmique →`, labelAnchor: "left", labelArrow: "none",
    },
    y: { domain: lignes.map((d) => d.source), label: null },
    color: NATURES,
    marks: [
      Plot.ruleY([mettreEnAvant], { x1: plage[0], x2: plage[1], stroke: "#C97AA6", strokeWidth: 12, strokeOpacity: 0.28, strokeLinecap: "round" }),
      Plot.text([mettreEnAvant], {
        x: plage[1], text: () => `médianes des modèles : de ${fr(plage[0], 2)} à ${fr(plage[1], 2)} ${unite}`,
        dy: -16, textAnchor: "end", fill: "#7A3F66", fontSize: 11,
      }),
      Plot.ruleY(lignes, { y: "source", x1: xmin, x2: "valeur", stroke: "#D6E3F8" }),
      Plot.dot(lignes, {
        x: "valeur", y: "source", r: 8, fill: "nature",
        stroke: (d: ChiffrePublie) => (d.source === mettreEnAvant ? "#0A1F44" : "white"), strokeWidth: 2,
        title: (d: ChiffrePublie) => `${d.source}
${fr(d.valeur, 2)} ${unite} par ${d.par}
${d.nature}
${d.perimetre}`,
      }),
      // libellés à droite du point, ou à gauche quand le point est dans le dernier tiers de l'axe
      ...[
        { cote: lignes.filter((d) => position(d.valeur) < 0.6), dx: 14, textAnchor: "start" as const },
        { cote: lignes.filter((d) => position(d.valeur) >= 0.6), dx: -14, textAnchor: "end" as const },
      ].flatMap(({ cote, dx, textAnchor }) => [
        Plot.text(cote, {
          x: "valeur", y: "source", dx, textAnchor, fontWeight: 700,
          text: (d: ChiffrePublie) => `${fr(d.valeur, d.valeur < 1 ? 2 : 0)} ${unite} · ${d.par}`,
        }),
        Plot.text(cote, {
          x: "valeur", y: "source", dx, dy: 17, textAnchor, fill: "#4A5A78", fontSize: 11, lineWidth: 46, lineAnchor: "top",
          text: "perimetre",
        }),
      ]),
    ],
  });
}
