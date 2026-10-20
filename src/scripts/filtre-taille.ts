// Route B légère (/modeles) : le filtre masque des lignes déjà rendues au build (attribut data-taille).
// Aucun graphique n'est recalculé dans le navigateur.
const boutons = [...document.querySelectorAll<HTMLButtonElement>("[data-filtre]")];
const lignes = [...document.querySelectorAll<HTMLElement>("[data-taille]")];
const compteur = document.querySelector<HTMLElement>("[data-filtre-compte]");
const zone = document.querySelector<HTMLElement>("[data-filtre-zone]");

if (zone) zone.hidden = false; // le filtre n'apparaît qu'avec JavaScript

function filtrer(taille: string) {
  for (const b of boutons) b.setAttribute("aria-pressed", String(b.dataset.filtre === taille));
  let n = 0;
  for (const l of lignes) {
    const visible = taille === "tous" || l.dataset.taille === taille;
    l.hidden = !visible;
    if (visible && l.dataset.compte !== undefined) n++;
  }
  if (compteur) compteur.textContent = `${n} modèle${n > 1 ? "s" : ""} affiché${n > 1 ? "s" : ""}`;
}

for (const b of boutons) b.addEventListener("click", () => filtrer(b.dataset.filtre!));
