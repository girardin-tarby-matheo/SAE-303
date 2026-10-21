// Types des données exportées par le notebook (src/data/*.json)

export type Taille = "petit" | "moyen" | "grand" | "inconnue";

export interface ParTaille {
  taille: Taille;
  modeles?: number;
  conversations?: number;
  tokens_median: number | null;
  wh_1000_tokens_median: number | null;
}

export interface LigneModeleCategorie {
  modele: string;
  slug: string;
  taille: Taille;
  n_conv: number;
  tokens_median: number | null;
  wh_1000_tokens: number | null;
  wh_median_conv: number | null;
}

export interface Categorie {
  rang: number;
  categorie: string;
  nom: string;
  slug: string;
  conversations: number;
  modeles: number;
  ecart: number | null;
  parTaille: ParTaille[];
  phrase_longueur: string | null;
  phrase: string | null;
  reponse: string | null;
  alt_longueur: string;
  alt: string;
  liste: LigneModeleCategorie[];
}

export interface CategorieDuModele {
  categorie: string;
  nom: string;
  slug: string | null;
  n_conv: number;
  tokens_median: number | null;
  wh_1000_tokens: number | null;
  wh_median_conv: number | null;
}

export interface Modele {
  rang: number;
  modele: string;
  slug: string;
  taille: Taille;
  params_actifs: number | null;
  n_conv: number;
  wh_median_conv: number | null;
  wh_moyen_conv: number | null;
  wh_1000_tokens: number | null;
  tokens_median: number | null;
  plus_sobre_que: number | null;
  parCategorie: CategorieDuModele[];
}

export interface Distribution {
  n: number;
  mediane: number;
  moyenne: number;
  q50: number;
  part_top10: number;
  ordres_de_grandeur: number;
  classes: { x1: number; x2: number; n: number }[];
}

export interface ProprietesPays {
  code: string;
  pays: string;
  gco2_kwh: number | null;
}

export interface ChiffrePublie {
  source: string;
  grandeur: string;
  valeur: number;
  unite: string;
  par: string;
  nature: string;
  perimetre: string;
  date: string;
  url: string;
}
