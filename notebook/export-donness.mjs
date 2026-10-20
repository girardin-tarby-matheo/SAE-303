import { DatabaseSync } from "node:sqlite";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as d3 from "d3";

const SOURCE_DB = new URL("./ia_energie_tokens.db", import.meta.url);
const db = new DatabaseSync(fileURLToPath(SOURCE_DB));
const table = (nom) => db.prepare(`SELECT * FROM ${nom}`).all().map((r) => ({ ...r }));

const r2 = (v) => (v == null || Number.isNaN(v) ? null : +v.toFixed(2));
const TAILLES = ["petit", "moyen", "grand", "inconnue"];
const slugifier = (texte) =>
  texte.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const TRADUCTIONS = {
  "Natural Science & Formal Science & Technology": "Sciences & technologie",
  "Education": "Éducation",
  "Business & Economics & Finance": "Entreprise, économie & finance",
  "Entertainment & Travel & Hobby": "Loisirs, voyages & divertissement",
  "Society & Social Issues & Human Rights": "Société & droits humains",
  "Politics & Government": "Politique & gouvernement",
  "Culture & Cultural geography": "Culture & géographie culturelle",
  "Arts": "Arts",
  "Personal Development & Human Resources & Career": "Développement personnel & carrière",
  "Law & Justice": "Droit & justice",
  "Health & Wellness & Medicine": "Santé & médecine",
  "Environment": "Environnement",
  "Daily Life & Home & Lifestyle": "Vie quotidienne & maison",
  "Other": "Autres demandes",
  "Food & Drink & Cooking": "Cuisine & alimentation",
  "Shopping & Commodity": "Achats & consommation",
  "Sports": "Sport",
  "Religion & Spirituality": "Religion & spiritualité",
};

const energie = table("energie");
const echantillon = table("echantillon");
const tokensCategorie = table("tokens_categorie");

const tailleDe = (p) => (p == null ? "inconnue" : p < 15 ? "petit" : p < 70 ? "moyen" : "grand");
const energieClean = energie.filter((d) => d.n_conv >= 100).map((d) => ({ ...d, taille: tailleDe(d.params_actifs) }));
const tailleParModele = new Map(energieClean.map((d) => [d.modele, d.taille]));
const tokensClean = tokensCategorie.filter((d) => d.n_conv >= 100 && d.tokens_median > 0 && d.wh_median_conv > 0);
const tokensEnrichi = tokensClean.map((d) => ({ ...d, taille: tailleParModele.get(d.modele) ?? "inconnue" }));

const controles = {
  energie: { avant: energie.length, apres: energieClean.length },
  tokens: { avant: tokensCategorie.length, apres: tokensClean.length },
  echantillon: { avant: echantillon.length, apres: echantillon.filter((d) => d.wh > 0 && d.tokens > 0).length },
};

const wh = echantillon.map((d) => d.wh);
const tokens = echantillon.map((d) => d.tokens).filter((v) => v > 0);
const NOMS_TRANCHES = ["moins de 1 Wh", "de 1 à 10 Wh", "plus de 10 Wh"];
const tranche = (v) => (v < 1 ? NOMS_TRANCHES[0] : v < 10 ? NOMS_TRANCHES[1] : NOMS_TRANCHES[2]);
const comptes = d3.rollup(echantillon, (v) => v.length, (d) => tranche(d.wh));
const tranches = NOMS_TRANCHES.map((t) => ({
  tranche: t,
  n: comptes.get(t) ?? 0,
  part: r2((comptes.get(t) ?? 0) / echantillon.length),
}));

const echantillonTaille = echantillon
  .filter((d) => d.wh > 0 && d.tokens > 0)
  .map((d) => ({ ...d, taille: tailleParModele.get(d.modele) ?? "inconnue" }));
const ensembleParTaille = TAILLES.map((taille) => {
  const v = echantillonTaille.filter((d) => d.taille === taille);
  return {
    taille,
    conversations: v.length,
    tokens_median: r2(d3.median(v, (d) => d.tokens)),
    wh_1000_tokens_median: r2(d3.median(v, (d) => (d.wh / d.tokens) * 1000)),
  };
});

const sansParams = energie.filter((d) => d.params_actifs == null);
const partConvSansParams = d3.sum(sansParams, (d) => d.n_conv) / d3.sum(energie, (d) => d.n_conv);

const ESPACE_FINE = String.fromCharCode(0x202f);
const ESPACE_INSECABLE = String.fromCharCode(0xa0);
const fr = (n) => n.toLocaleString("fr-FR").replaceAll(ESPACE_FINE, ESPACE_INSECABLE);
const categoriesTriees = d3
  .rollups(tokensEnrichi, (v) => d3.sum(v, (d) => d.n_conv), (d) => d.categorie)
  .toSorted((a, b) => b[1] - a[1])
  .map((d) => d[0]);

const slugModele = (m) => m.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");

const categories = categoriesTriees.map((categorie, i) => {
  const lignes = tokensEnrichi.filter((d) => d.categorie === categorie);
  const nom = TRADUCTIONS[categorie] ?? categorie;
  const brut = Object.fromEntries(
    d3.rollups(
      lignes,
      (v) => ({
        modeles: v.length,
        tokens_median: d3.median(v, (d) => d.tokens_median),
        wh_1000_tokens_median: d3.median(v, (d) => d.wh_1000_tokens),
      }),
      (d) => d.taille,
    ),
  );
  const parTaille = TAILLES.filter((t) => brut[t]).map((taille) => ({
    taille,
    modeles: brut[taille].modeles,
    tokens_median: r2(brut[taille].tokens_median),
    wh_1000_tokens_median: r2(brut[taille].wh_1000_tokens_median),
  }));
  const g = brut.grand, p = brut.petit, m = brut.moyen;
  const ecart = g && p ? Math.round(g.wh_1000_tokens_median / p.wh_1000_tokens_median) : null;
  const tkG = g ? Math.round(g.tokens_median) : null;
  const tkP = p ? Math.round(p.tokens_median) : null;

  const phraseLongueur = g && p
    ? tkG <= tkP
      ? `Les grands modèles n'écrivent pas plus : ${fr(tkG)} tokens, contre ${fr(tkP)} pour les petits`
      : `Les grands modèles écrivent ${(tkG / tkP).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} fois plus : ${fr(tkG)} tokens, contre ${fr(tkP)} pour les petits`
    : null;
  const phraseCout = ecart != null ? `1 000 tokens coûtent ${ecart} fois plus à un grand modèle qu'à un petit` : null;
  const valeurs = (champ, unite) =>
    ["grand", "moyen", "petit"].filter((t) => brut[t]).map((t) => `${t === "grand" ? "Grands" : t === "moyen" ? "moyens" : "petits"} : ${fr(r2(brut[t][champ]))}${unite}`).join(" ; ");

  return {
    rang: i + 1,
    categorie,
    nom,
    slug: slugifier(nom),
    conversations: d3.sum(lignes, (d) => d.n_conv),
    modeles: lignes.length,
    ecart,
    parTaille,
    phrase_longueur: phraseLongueur,
    phrase: phraseCout,
    reponse: g && p
      ? `Pour « ${nom} », une réponse fait ${fr(tkG)} tokens avec un grand modèle et ${fr(tkP)} avec un petit ; 1 000 tokens coûtent ${fr(r2(g.wh_1000_tokens_median))} Wh à un grand modèle contre ${fr(r2(p.wh_1000_tokens_median))} Wh à un petit, soit ${ecart} fois plus.`
      : null,
    alt_longueur: `Diagramme en barres horizontales. Il compare le nombre de tokens écrits par réponse (médiane) selon la taille du modèle, dans la catégorie ${nom.toLowerCase()}. ${tkG != null && tkP != null && tkG <= tkP ? "Les grands modèles n'écrivent pas plus que les petits." : "La longueur varie peu d'une taille à l'autre."} ${valeurs("tokens_median", " tokens")}.`,
    alt: `Diagramme en barres horizontales. Il compare l'électricité consommée pour 1 000 tokens selon la taille du modèle, dans la catégorie ${nom.toLowerCase()}. Les grands modèles consomment bien plus par token que les petits. ${valeurs("wh_1000_tokens_median", " Wh")}${ecart != null ? `, soit ${ecart} fois moins pour les petits` : ""}.`,
    liste: lignes
      .toSorted((a, b) => b.wh_median_conv - a.wh_median_conv)
      .map((d) => ({
        modele: d.modele,
        slug: slugModele(d.modele),
        taille: d.taille,
        n_conv: d.n_conv,
        tokens_median: r2(d.tokens_median),
        wh_1000_tokens: r2(d.wh_1000_tokens),
        wh_median_conv: r2(d.wh_median_conv),
      })),
  };
});
const nomCategorie = new Map(categories.map((c) => [c.categorie, c]));

const whTriees = energieClean.map((d) => d.wh_median_conv);
const modeles = energieClean
  .toSorted((a, b) => a.wh_median_conv - b.wh_median_conv || a.modele.localeCompare(b.modele))
  .map((d, i) => {
    const toutes = tokensCategorie.filter((t) => t.modele === d.modele && t.tokens_median > 0);
    // tokens par réponse : médiane des médianes par catégorie, pondérée par le nombre de conversations
    const tokensPondere = toutes.length
      ? d3.quantileSorted(
          toutes.toSorted((a, b) => a.tokens_median - b.tokens_median).flatMap((t) => Array(t.n_conv).fill(t.tokens_median)),
          0.5,
        )
      : null;
    return {
      rang: i + 1,
      modele: d.modele,
      slug: slugModele(d.modele),
      taille: d.taille,
      params_actifs: d.params_actifs,
      n_conv: d.n_conv,
      wh_median_conv: r2(d.wh_median_conv),
      wh_moyen_conv: r2(d.wh_moyen_conv),
      wh_1000_tokens: r2(d.wh_1000_tokens),
      tokens_median: r2(tokensPondere),
      plus_sobre_que: r2(whTriees.filter((w) => w > d.wh_median_conv).length / (whTriees.length - 1)),
      parCategorie: tokensEnrichi
        .filter((t) => t.modele === d.modele)
        .map((t) => ({
          categorie: t.categorie,
          nom: nomCategorie.get(t.categorie)?.nom ?? t.categorie,
          slug: nomCategorie.get(t.categorie)?.slug ?? null,
          n_conv: t.n_conv,
          tokens_median: r2(t.tokens_median),
          wh_1000_tokens: r2(t.wh_1000_tokens),
          wh_median_conv: r2(t.wh_median_conv),
        }))
        .toSorted((a, b) => b.n_conv - a.n_conv),
    };
  });

const principale = categories[0];
const chiffres = {
  source: {
    nom: "Compar:IA",
    producteur: "ministère de la Culture",
    url: "https://www.data.gouv.fr/datasets/compar-ia",
    licence: "Licence Ouverte 2.0",
    date: "3 juin 2026",
    conversations_total: 410016,
    conversations_fr: 384953,
    part_fr: 0.94,
  },
  conversation: {
    echantillon: echantillon.length,
    wh_median: r2(d3.median(wh)),
    wh_moyen: r2(d3.mean(wh)),
    rapport_moyenne_mediane: r2(d3.mean(wh) / d3.median(wh)),
    wh_max: r2(d3.max(wh)),
    part_moins_1wh: tranches[0].part,
    tokens_median: d3.median(tokens),
    tokens_q25: d3.quantile(tokens, 0.25),
    tokens_q75: d3.quantile(tokens, 0.75),
  },
  modeles: {
    retenus: energieClean.length,
    seuil_conversations: 100,
    sans_params: sansParams.length,
    total: energie.length,
    part_conv_sans_params: +partConvSansParams.toFixed(3),
    wh_1000_tokens_median: r2(d3.median(energieClean, (d) => d.wh_1000_tokens)),
  },
  categorie_principale: {
    slug: principale.slug,
    nom: principale.nom,
    ecart: principale.ecart,
    parTaille: principale.parTaille,
  },
  ensemble: {
    parTaille: ensembleParTaille,
    ecart: Math.round(ensembleParTaille[2].wh_1000_tokens_median / ensembleParTaille[0].wh_1000_tokens_median),
  },
  controles,
};

const fichiers = { "chiffres.json": chiffres, "tranches.json": tranches, "categories.json": categories, "modeles.json": modeles };
for (const dossier of ["../src/data/", "../public/donnees/"]) {
  const url = new URL(dossier, import.meta.url);
  mkdirSync(url, { recursive: true });
  for (const [nom, contenu] of Object.entries(fichiers)) writeFileSync(new URL(nom, url), JSON.stringify(contenu, null, 2) + "\n");
}

console.table({
  "médiane Wh / conversation": chiffres.conversation.wh_median,
  "moyenne Wh / conversation": chiffres.conversation.wh_moyen,
  "part < 1 Wh": chiffres.conversation.part_moins_1wh,
  "tokens médians": chiffres.conversation.tokens_median,
  "modèles retenus": chiffres.modeles.retenus,
  [`${principale.nom} · grand Wh/1000`]: principale.parTaille.find((d) => d.taille === "grand").wh_1000_tokens_median,
  [`${principale.nom} · petit Wh/1000`]: principale.parTaille.find((d) => d.taille === "petit").wh_1000_tokens_median,
  [`${principale.nom} · grand tokens`]: principale.parTaille.find((d) => d.taille === "grand").tokens_median,
  [`${principale.nom} · petit tokens`]: principale.parTaille.find((d) => d.taille === "petit").tokens_median,
  "écart principal": principale.ecart,
  "écart ensemble": chiffres.ensemble.ecart,
});