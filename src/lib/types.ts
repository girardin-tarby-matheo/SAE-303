// Types des données exportées par le notebook (src/data/*.json)

export type Taille = "petit" | "moyen" | "grand" | "inconnue";

export interface ParTaille {
  taille: Taille;
  modeles?: number;
  conversations?: number;
  tokens_median: number | null;
  wh_1000_tokens_median: number | null;
}

export interface Tranche {
  tranche: string;
  n: number;
  part: number;
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
