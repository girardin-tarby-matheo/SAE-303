// Fonctions pures Plot (méthode TP 5) : elles n'importent que Plot et ne lisent que leurs arguments.
// Rendu au build : on leur passe un `document` (linkedom) et on récupère le SVG (outerHTML).
// Règles : barres sur un axe commun partant de zéro, échelle normale, valeurs écrites sur les barres
// (pas d'infobulle), couleur = taille du modèle uniquement (palette séquentielle).

import * as Plot from "@observablehq/plot";
import type { ParTaille, Tranche, CategorieDuModele, Taille } from "./types";

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

/** Tranches de consommation d'une conversation (3 barres) */
export function barresTranches(
  tranches: Tranche[],
  { label, document, width = 560 }: { label: string; document?: Doc; width?: number },
) {
  return Plot.plot({
    document, width, height: 190, marginLeft: 110, marginRight: 60, marginBottom: 44,
    ariaLabel: label,
    style: style(),
    x: { label: "part des conversations →", domain: [0, 1], tickFormat: (d: number) => `${Math.round(d * 100)} %`, grid: true, labelAnchor: "right", labelArrow: "none" },
    y: { label: null, domain: tranches.map((d) => d.tranche), padding: 0.25 },
    marks: [
      Plot.barX(tranches, { x: "part", y: "tranche", fill: "#1E5BD8", rx: 6 }),
      Plot.text(tranches, {
        x: "part", y: "tranche", dx: 8, textAnchor: "start", fontWeight: 600,
        text: (d: Tranche) => `${Math.round(d.part * 100)} %`,
      }),
      Plot.ruleX([0]),
    ],
  });
}

/**
 * Une ligne du classement des modèles : une barre, sur une échelle commune [0, max] partant de zéro.
 * Une valeur au-delà de `max` (valeur extrême) est dessinée coupée, avec une coupure visible
 * et sa valeur exacte écrite « hors échelle ».
 */
export function barreModele(
  d: { wh_median_conv: number | null; taille: Taille },
  { max, document, width = 760, hauteur = 14 }: { max: number; document?: Doc; width?: number; hauteur?: number },
) {
  const v = d.wh_median_conv;
  const coupee = v != null && v > max;
  const fin = coupee ? max : v ?? 0;
  const pas = max / 60;
  return Plot.plot({
    document, width, height: hauteur, margin: 0, marginRight: 140,
    style: { ...style(), fontSize: "10px" },
    x: { domain: [0, max], axis: null },
    y: { axis: null, domain: [0, 1] },
    color: TAILLES,
    marks: [
      Plot.gridX({ stroke: "#A9C6F5", strokeOpacity: 0.5 }),
      Plot.rectX([d], { x1: 0, x2: fin, y1: 0.12, y2: 0.88, fill: "taille", rx: 2 }),
      // coupure de la barre (deux traits blancs obliques)
      ...(coupee
        ? [Plot.link([0, 1], {
            x1: (i: number) => max - pas * (2.4 + i * 1.2), x2: (i: number) => max - pas * (1.6 + i * 1.2),
            y1: 0, y2: 1, stroke: "white", strokeWidth: 3,
          })]
        : []),
      Plot.text([d], {
        x: fin, y: 0.5, dx: 5, textAnchor: "start", fontWeight: 600,
        text: () => (v == null ? "inconnu" : coupee ? `${fr(v, 2)} Wh (hors échelle)` : `${fr(v, 2)} Wh`),
      }),
      Plot.ruleX([0]),
    ],
  });
}

/** Axe commun du classement (aligné sur les lignes de barreModele) */
export function axeClassement(
  { max, label, document, width = 760 }: { max: number; label: string; document?: Doc; width?: number },
) {
  return Plot.plot({
    document, width, height: 44, marginLeft: 0, marginRight: 140, marginTop: 4, marginBottom: 36,
    ariaLabel: label,
    style: { ...style(), fontSize: "11px" },
    x: { domain: [0, max], label, labelAnchor: "left", labelArrow: "none" },
    marks: [Plot.axisX({ anchor: "bottom", tickFormat: graduation }), Plot.ruleX([0])],
  });
}

/** Fiche modèle : Wh pour 1 000 tokens dans chaque catégorie, avec la médiane de tous les modèles en référence */
export function barresCategoriesModele(
  lignes: CategorieDuModele[],
  { reference, taille, label, document, width = 760 }: {
    reference: number; taille: Taille; label: string; document?: Doc; width?: number;
  },
) {
  const tri = lignes.toSorted((a, b) => (b.wh_1000_tokens ?? 0) - (a.wh_1000_tokens ?? 0));
  const couleur = TAILLES.range[TAILLES.domain.indexOf(taille)];
  return Plot.plot({
    document, width, height: tri.length * 30 + 80, marginLeft: 280, marginRight: 90, marginTop: 28, marginBottom: 44,
    ariaLabel: label,
    style: style(),
    x: { label: "Wh pour 1 000 tokens →", grid: true, labelAnchor: "left", labelArrow: "none", tickFormat: graduation },
    y: { label: null, domain: tri.map((d) => d.nom), padding: 0.28 },
    marks: [
      Plot.barX(tri, { x: "wh_1000_tokens", y: "nom", fill: couleur, rx: 4 }),
      Plot.text(tri, {
        x: (d: CategorieDuModele) => d.wh_1000_tokens ?? 0, y: "nom", dx: 8, textAnchor: "start", fontWeight: 600,
        text: (d: CategorieDuModele) => (d.wh_1000_tokens == null ? "inconnu" : `${fr(d.wh_1000_tokens, 2)} Wh`),
      }),
      Plot.ruleX([reference], { stroke: "#1E5BD8", strokeWidth: 2, strokeDasharray: "6 4" }),
      Plot.text([reference], {
        x: (d: number) => d, frameAnchor: "top", dy: -18, textAnchor: "start", dx: 6, fill: "#1E5BD8", fontWeight: 600,
        text: (d: number) => `médiane de tous les modèles : ${fr(d, 2)} Wh`,
      }),
      Plot.ruleX([0]),
    ],
  });
}
