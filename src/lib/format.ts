// Format français partout : virgule décimale, espace fine pour les milliers.
// Une valeur null s'affiche « inconnu », jamais 0.

export const INCONNU = "inconnu";

// toLocaleString("fr-FR") produit une espace fine insécable (U+202F) quasi invisible en Manrope (0,1 em) :
// on la remplace par l'espace insécable (U+00A0), lisible, qui ne coupe jamais un nombre.
const ESPACE_FINE = String.fromCharCode(0x202f);
const ESPACE_INSECABLE = String.fromCharCode(0xa0);
const espace = (t: string) => t.replaceAll(ESPACE_FINE, ESPACE_INSECABLE);

export function nombre(v: number | null | undefined, decimales = 0): string {
  if (v == null || Number.isNaN(v)) return INCONNU;
  return espace(v.toLocaleString("fr-FR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales }));
}

/** Électricité : toujours 2 décimales (« 0,40 Wh ») */
export function wh(v: number | null | undefined, unite = true): string {
  if (v == null || Number.isNaN(v)) return INCONNU;
  return nombre(v, 2) + (unite ? ESPACE_INSECABLE + "Wh" : "");
}

/** Tokens : entier (« 1 072 ») */
export function tokens(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return INCONNU;
  return nombre(Math.round(v));
}

export function pourcent(part: number | null | undefined): string {
  if (part == null || Number.isNaN(part)) return INCONNU;
  return `${Math.round(part * 100)}${ESPACE_INSECABLE}%`;
}

/** Repère du quotidien : 1 Wh = une ampoule LED de 10 W allumée 6 minutes */
export function minutesLED(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return INCONNU;
  const min = v * 6;
  if (min < 1) return `${nombre(Math.round(min * 60))} s`;
  if (min < 10) {
    const s = Math.round((min % 1) * 60);
    return s ? `${Math.floor(min)} min ${s} s` : `${Math.floor(min)} min`;
  }
  if (min < 120) return `${nombre(Math.round(min))} min`;
  return `${nombre(min / 60, 1)} h`;
}

export function slugifier(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/\p{M}/gu, "") // retire les accents (marques combinantes après NFD)
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Numéro de ligne « 001 » */
export const numero = (i: number) => String(i).padStart(3, "0");
