// V2 du notebook · « Le même Wh ne pèse pas pareil selon le pays »
// Intensité carbone de l'électricité par pays (Ember via Our World in Data, table intensite_brute), même logique que le notebook :
// pays seulement (code ISO à 3 lettres), une seule année = la plus récente couvrant au moins 90 % des pays.
// Contours : Natural Earth 1:110m (la base de world-atlas, utilisé dans le notebook).
// Usage : node notebook/export-carte.mjs
import { DatabaseSync } from "node:sqlite";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/";

const db = new DatabaseSync(fileURLToPath(new URL("./ia_energie_tokens.db", import.meta.url)));
const intensiteBrute = db.prepare("SELECT * FROM intensite_brute").all().map((r) => ({ ...r }));

// notebook : intensite, couvertureParAnnee, anneeIntensite, intensiteAnnee
const intensite = intensiteBrute
  .filter((d) => d.Code != null && d.Code.length === 3)
  .map((d) => ({ pays: d.Entity, code: d.Code, annee: d.Year, gco2_kwh: d["Carbon intensity"] }));
const couverture = Map.groupBy(intensite.filter((d) => d.gco2_kwh != null), (d) => d.annee);
const couvertureParAnnee = [...couverture].map(([annee, v]) => [annee, v.length]).toSorted((a, b) => b[0] - a[0]);
const max = Math.max(...couvertureParAnnee.map((d) => d[1]));
const anneeIntensite = couvertureParAnnee.find(([, n]) => n >= 0.9 * max)[0];
const intensiteAnnee = intensite.filter((d) => d.annee === anneeIntensite);

const charger = async (fichier) => (await fetch(NE + fichier)).json();
const [contours, noms50] = await Promise.all([
  charger("ne_110m_admin_0_countries.geojson"),
  charger("ne_50m_admin_0_countries.geojson"), // noms français des petits pays absents du 1:110m
]);
// France et Norvège ont ISO_A3 = -99 dans Natural Earth : ISO_A3_EH les corrige
const codeNE = (p) => (p.ISO_A3_EH !== "-99" ? p.ISO_A3_EH : p.ADM0_A3);
const nomFr = new Map([...noms50.features, ...contours.features].map((f) => [codeNE(f.properties), f.properties.NAME_FR]));
nomFr.set("GUF", "Guyane");

const r = (v) => Math.round(v);
const pays = intensiteAnnee
  .filter((d) => d.gco2_kwh != null)
  .map((d) => ({ code: d.code, pays: nomFr.get(d.code) ?? d.pays, gco2_kwh: r(d.gco2_kwh) }))
  .toSorted((a, b) => a.gco2_kwh - b.gco2_kwh || a.pays.localeCompare(b.pays, "fr"));

// notebook : reperesIntensite
const fr = pays.find((d) => d.code === "FRA");
const us = pays.find((d) => d.code === "USA");
const resultat = {
  source: {
    nom: "Ember (2026), retraité par Our World in Data",
    url: "https://ourworldindata.org/grapher/carbon-intensity-electricity",
    licence: "CC BY 4.0",
    contours: "Natural Earth 1:110m (domaine public)",
  },
  annee: anneeIntensite,
  controles: { avant: intensiteBrute.length, apres: intensite.length, pays_annee: pays.length },
  france: fr.gco2_kwh,
  etats_unis: us.gco2_kwh,
  rapport_us_fr: r(us.gco2_kwh / fr.gco2_kwh),
  plus_bas: pays.slice(0, 3).map((d) => d.pays),
  plus_hauts: pays.slice(-3).reverse().map((d) => d.pays),
  pays,
};

const parCode = new Map(pays.map((d) => [d.code, d]));
const arrondir = (c) => (typeof c[0] === "number" ? [+c[0].toFixed(2), +c[1].toFixed(2)] : c.map(arrondir));
const geo = {
  type: "FeatureCollection",
  features: contours.features.map((f) => {
    const code = codeNE(f.properties);
    return {
      type: "Feature",
      properties: { code, pays: parCode.get(code)?.pays ?? nomFr.get(code), gco2_kwh: parCode.get(code)?.gco2_kwh ?? null },
      geometry: { type: f.geometry.type, coordinates: arrondir(f.geometry.coordinates) },
    };
  }),
};

for (const dossier of ["../src/data/", "../public/donnees/"]) {
  const url = new URL(dossier, import.meta.url);
  mkdirSync(url, { recursive: true });
  writeFileSync(new URL("intensite.json", url), JSON.stringify(resultat, null, 2) + "\n");
}
writeFileSync(new URL("../src/data/pays.geo.json", import.meta.url), JSON.stringify(geo) + "\n");

console.table({
  "année": anneeIntensite,
  "pays (année)": pays.length,
  "France gCO₂e/kWh": fr.gco2_kwh,
  "États-Unis gCO₂e/kWh": us.gco2_kwh,
  "rapport US / FR": resultat.rapport_us_fr,
  "plus bas": resultat.plus_bas.join(", "),
  "plus hauts": resultat.plus_hauts.join(", "),
  "contours sans donnée": geo.features.filter((f) => f.properties.gco2_kwh == null).length,
});
