/*
 * Reconnaître un article tapé à la main : quantité, nom courant, rayon, et son identité
 * (la même pour « PQ », « P.Q » et « papier toilette »). 100 % local, instantané, hors ligne.
 * Règles : rien n'est inventé (ni parfum, ni marque, ni quantité) ; une faute n'est corrigée
 * que si un seul produit est assez proche ; ce que la famille a choisi passe avant tout.
 */
import type { AisleId } from "./aisles";
import { guessAisle } from "./recipe-import";

export type Produit = {
  id: string;
  nom: string; // nom affiché : la marque telle qu'on l'écrit, ou le nom courant
  rayon: AisleId;
  type?: string; // « biscuits », « dessert lacté » : sert au rangement, jamais affiché à la place du nom
  alias: string[]; // surnoms, abréviations, fautes courantes
  variantes?: string[]; // parfums / déclinaisons reconnus : ne fusionnent jamais entre eux
};

export type Ambigu = { rayon: AisleId; choix: string[] };

export type Lecture = {
  saisi: string;
  nom: string;
  quantite: number | null;
  unite: string;
  rayon: AisleId;
  cle: string; // identité : « danette:chocolat », « papier-toilette », ou le nom normalisé si inconnu
  confiance: "sur" | "probable" | "incertain" | "inconnu";
  produit?: string;
  type?: string;
  corrige?: boolean; // le nom affiché diffère vraiment de ce qui a été tapé
  choix?: { id: string; nom: string; rayon: AisleId }[]; // à proposer en pastilles, sans bloquer
};

// ─── Normalisation ───────────────────────────────────────────────────

/** Casse, accents, apostrophes et points collés retirés : « Pim's » → « pims », « P.Q » → « pq ». */
export function forme(s: string, accents = false): string {
  let t = s.toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD");
  if (!accents) t = t.replace(/[̀-ͯ]/g, "");
  return t
    .normalize("NFC")
    .replace(/(\p{L})['’.](?=\p{L})/gu, "$1")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Comme `forme`, pluriels en plus : sert à reconnaître le même produit. */
export function plier(s: string): string {
  return forme(s)
    .split(" ")
    .filter(Boolean)
    .map((w) => (w.length > 3 ? w.replace(/[sx]$/, "") : w))
    .join(" ");
}

const MOTS_VIDES = new Set(["de", "d", "du", "des", "la", "le", "les", "l", "a", "au", "aux", "en", "pour", "avec"]);
const PREPOSITIONS = new Set(["de", "d", "du", "des", "a", "au", "aux", "en"]);
/** Ce qui peut précéder un produit sans le changer : « gros paquet de chips », « bouteille de coca ». */
const CONTENANTS = new Set([
  "gro", "gros", "grand", "grande", "petit", "petite", "paquet", "bouteille", "pack", "boite", "sachet", "lot", "pot",
  "brique", "barquette", "filet", "canette", "rouleau", "tablette", "de", "d",
]);

// ─── Quantités et unités propres aux courses ─────────────────────────

const NOMBRES: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, douze: 12,
};
const UNITES: [RegExp, string][] = [
  [/^packs?\b/i, "pack"],
  [/^lots?\b/i, "lot"],
  [/^bouteilles?\b/i, "bouteille"],
  [/^canettes?\b/i, "canette"],
  [/^bo[iî]tes?\b/i, "boîte"],
  [/^barquettes?\b/i, "barquette"],
  [/^paquets?\b/i, "paquet"],
  [/^sachets?\b/i, "sachet"],
  [/^pots?\b/i, "pot"],
  [/^briques?\b/i, "brique"],
  [/^rouleaux?\b/i, "rouleau"],
  [/^tablettes?\b/i, "tablette"],
  [/^filets?\b/i, "filet"],
  [/^(?:kg|kilos?)\b/i, "kg"],
  [/^(?:g|grammes?)\b/i, "g"],
  [/^(?:l|litres?)\b/i, "l"],
  [/^cl\b/i, "cl"],
  [/^ml\b/i, "ml"],
];

/** « 2 packs de lait » → 2 pack « lait » ; « Lait 1L » → 1 l ; « coca x6 » → 6. Rien n'est inventé. */
export function extraireQuantite(texte: string): { quantite: number | null; unite: string; reste: string } {
  const t = texte.trim();
  const douzaine = t.match(/^(?:une\s+|1\s+)?(demi-?\s*)?douzaines?\s+(?:de\s+|d['’]\s*)?(.+)$/i);
  if (douzaine) return { quantite: douzaine[1] ? 6 : 12, unite: "", reste: douzaine[2] };
  // En tête : « 2x lait », « 2kg pommes », « 6 oeufs », « une bouteille de coca » ; « 7up » reste un nom.
  const tete =
    t.match(/^(\d+(?:[.,]\d+)?)\s*x\s+(.+)$/i) ??
    t.match(/^(\d+(?:[.,]\d+)?)(?=(?:kg|g|l|cl|ml)\s)(.+)$/i) ??
    t.match(/^(\d+(?:[.,]\d+)?|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|douze)\s+(.+)$/i);
  if (tete) {
    const n = /\d/.test(tete[1]) ? Number(tete[1].replace(",", ".")) : NOMBRES[tete[1].toLowerCase()];
    let reste = tete[2].trim();
    let unite = "";
    for (const [re, u] of UNITES) {
      const m = reste.match(re);
      if (m) {
        unite = u;
        reste = reste.slice(m[0].length).trim();
        break;
      }
    }
    reste = reste.replace(/^(?:de\s+|d['’]\s*)/i, "");
    if (n > 0 && reste) return { quantite: n, unite, reste };
  }
  // En fin : « coca x6 », « lait (2) », « Lait 1L », « coca 1,5 l »
  const fin = t.match(/^(.+?)\s+(?:x\s*(\d+)|\((\d+)\)|(\d+(?:[.,]\d+)?)\s*(l|cl|ml|kg|g)\.?)$/i);
  if (fin) {
    const n = Number((fin[2] ?? fin[3] ?? fin[4]).replace(",", "."));
    return { quantite: n, unite: fin[5]?.toLowerCase() ?? "", reste: fin[1] };
  }
  return { quantite: null, unite: "", reste: t };
}

// ─── Distance d'édition (Damerau-Levenshtein restreinte) ─────────────

function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let mini = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      mini = Math.min(mini, d[i][j]);
    }
    if (mini > max) return max + 1;
  }
  return d[a.length][b.length];
}

/** Tolérance selon la longueur : rien sous 5 lettres, 1 faute jusqu'à 7, 2 au-delà. */
const tolerance = (n: number) => (n < 5 ? 0 : n < 8 ? 1 : 2);

// ─── Index du catalogue ──────────────────────────────────────────────

export type Appris = Record<string, { nom: string; rayon: AisleId; produit?: string } | "tel-quel">;

export function indexer(catalogue: Produit[], ambigus: Record<string, Ambigu>) {
  const parAccents = new Map<string, Produit[]>(); // « pâtes », « pâté », « pates » : formes exactes
  const parCle = new Map<string, Produit[]>(); // sans accents ni pluriels
  const ajoute = (m: Map<string, Produit[]>, k: string, p: Produit) => {
    const l = m.get(k) ?? [];
    if (!l.includes(p)) l.push(p);
    m.set(k, l);
  };
  for (const p of catalogue)
    for (const a of [p.nom, ...p.alias]) {
      ajoute(parAccents, forme(a, true), p);
      ajoute(parCle, plier(a), p);
    }
  const parId = new Map(catalogue.map((p) => [p.id, p]));
  const variantes = new Map(catalogue.map((p) => [p.id, new Set((p.variantes ?? []).map(plier))]));
  const ambigusPlies = new Map(
    Object.entries(ambigus).map(([k, a]) => [plier(k), { rayon: a.rayon, choix: a.choix.map((id) => parId.get(id)!) }]),
  );
  const longueurMax = Math.max(...[...parCle.keys()].map((k) => k.split(" ").length));
  return { parAccents, parCle, parId, variantes, ambigusPlies, longueurMax };
}

type Index = ReturnType<typeof indexer>;

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Les mots tels qu'ils ont été tapés, découpés comme `forme` les découpe. */
const motsDe = (s: string) => [...s.matchAll(/[\p{L}\p{N}]+(?:['’.][\p{L}\p{N}]+)*/gu)];
function couper(original: string, n: number): [string, string] {
  const mots = motsDe(original);
  if (n >= mots.length) return [original.trim(), ""];
  const fin = mots[n - 1].index! + mots[n - 1][0].length;
  return [original.slice(0, fin).trim(), original.slice(fin).replace(/^[\s\-–,]+/, "").trim()];
}

/** La saisie sans quantité ni article (« 2 paquets de Kinder » → « Kinder ») : ce que la famille apprend. */
function decouper(texte: string) {
  const propre = texte.replace(/\s+/g, " ").trim().slice(0, 200);
  const { quantite, unite, reste } = extraireQuantite(propre);
  const brut = reste.replace(/^(?:(?:des|du|de la|un|une|le|la|les)\s+|(?:de l|d|l)['’]\s*)/i, "").trim() || propre;
  return { propre, quantite, unite, brut };
}

/** La clé sous laquelle la famille apprend un mot (« Kinder », « kinders » → la même). */
export const cleApprise = (texte: string) => plier(decouper(texte).brut);

export function reconnaitre(texte: string, idx: Index, appris: Appris = {}): Lecture | null {
  const { propre, quantite, unite, brut } = decouper(texte);
  if (!propre) return null;
  const k = plier(brut);
  const base = { saisi: propre, quantite, unite };
  const inconnu = (): Lecture => ({ ...base, nom: majuscule(brut), rayon: guessAisle(brut), cle: k, confiance: "inconnu" });
  const incertain = (choix: Produit[], rayon?: AisleId): Lecture => ({
    ...inconnu(),
    confiance: "incertain",
    rayon: rayon ?? (new Set(choix.map((p) => p.rayon)).size === 1 ? choix[0].rayon : guessAisle(brut)),
    choix: choix.map((p) => ({ id: p.id, nom: p.nom, rayon: p.rayon })),
  });

  // 1. Ce que la famille a déjà corrigé ou choisi l'emporte sur tout.
  const a = appris[k];
  if (a === "tel-quel") return inconnu();
  if (a) return { ...base, nom: a.nom, rayon: a.rayon, cle: a.produit ?? plier(a.nom), produit: a.produit, confiance: "sur" };

  // 2. Correspondance exacte, du plus long au plus court, en tête de saisie (« lait de coco » avant « lait ») ;
  //    quelques mots de contenant peuvent précéder (« gros paquet de chips »).
  const avecAccents = forme(brut, true).split(" ");
  const mots = k.split(" ");
  for (let debut = 0; debut < mots.length; debut++) {
    if (debut > 0 && !CONTENANTS.has(mots[debut - 1])) break;
    for (let n = Math.min(idx.longueurMax, mots.length - debut); n >= 1; n--) {
      const exact = idx.parAccents.get(avecAccents.slice(debut, debut + n).join(" "));
      if (exact?.length === 1) return lu(exact[0], brut, debut, n, base, "sur", idx);
      const cle = mots.slice(debut, debut + n).join(" ");
      const amb = idx.ambigusPlies.get(cle);
      if (amb) return incertain(amb.choix, amb.rayon);
      const produits = idx.parCle.get(cle);
      if (produits?.length === 1) return lu(produits[0], brut, debut, n, base, "sur", idx);
      if (produits) return incertain(produits);
    }
  }

  // 3. Faute de frappe : un seul candidat assez proche, même première lettre ; sinon on ne touche à rien.
  const candidats: { p: Produit; d: number; n: number }[] = [];
  for (const [alias, produits] of idx.parCle) {
    const n = alias.split(" ").length;
    if (n > mots.length) continue;
    const tape = mots.slice(0, n).join(" ");
    const tol = tolerance(Math.min(tape.replace(/ /g, "").length, alias.replace(/ /g, "").length));
    if (tol === 0 || tape[0] !== alias[0]) continue;
    const d = distance(tape, alias, tol);
    if (d <= tol) for (const p of produits) candidats.push({ p, d, n });
  }
  if (candidats.length === 0) return inconnu();
  const meilleur = Math.min(...candidats.map((c) => c.d));
  const retenus = [...new Map(candidats.filter((c) => c.d === meilleur).map((c) => [c.p.id, c])).values()];
  if (retenus.length > 1) return incertain(retenus.map((c) => c.p));
  const { p, d, n } = retenus[0];
  // Une faute sur 6 lettres ou plus : corrigé, avec « Annuler ». Plus court ou plus éloigné : simple suggestion.
  if (d === 1 && mots.slice(0, n).join("").length >= 6) return lu(p, brut, 0, n, base, "probable", idx);
  return { ...incertain([p]), rayon: guessAisle(brut) };
}

function lu(
  p: Produit,
  brut: string,
  debut: number,
  n: number,
  base: Pick<Lecture, "saisi" | "quantite" | "unite">,
  confiance: Lecture["confiance"],
  idx: Index,
): Lecture {
  const [tapeJusquAuProduit, complement] = couper(brut, debut + n);
  const tapeProduit = debut === 0 ? tapeJusquAuProduit : couper(tapeJusquAuProduit, debut)[1];
  const utiles = plier(complement).split(" ").filter((m) => m && !MOTS_VIDES.has(m));
  const variantes = idx.variantes.get(p.id)!;
  const variante = utiles.length > 0 && variantes.has(utiles.join(" ")) ? utiles.join(" ") : null;
  // « eau de javel », « beurre de cacahuète » : un complément inconnu introduit par « de » change de produit.
  if (!variante && utiles.length > 0 && PREPOSITIONS.has(plier(complement).split(" ")[0]))
    return { ...base, nom: majuscule(brut), rayon: guessAisle(brut), cle: plier(brut), confiance: "inconnu" };
  // Nom affiché : l'orthographe du catalogue si c'est le même mot (« pates » → « Pâtes », « pims » → « Pim's »),
  // le mot tapé si c'est une simple flexion (« poire » reste « Poire »), le nom courant sinon (« PQ » → « Papier toilette »).
  const nomProduit =
    confiance === "sur" && forme(tapeProduit) !== forme(p.nom) && plier(tapeProduit) === plier(p.nom)
      ? majuscule(tapeProduit)
      : p.nom;
  const nom =
    debut > 0
      ? majuscule(`${couper(brut, debut)[0]} ${p.type ? nomProduit : nomProduit.charAt(0).toLowerCase() + nomProduit.slice(1)}${complement ? " " + complement : ""}`)
      : complement
        ? `${nomProduit} ${complement}`
        : nomProduit;
  return {
    ...base,
    nom,
    rayon: p.rayon,
    cle: utiles.length === 0 ? p.id : `${p.id}:${utiles.join(" ")}`,
    produit: p.id,
    type: p.type,
    confiance,
    corrige: plier(tapeProduit) !== plier(p.nom),
  };
}

// ─── L'index de Kaddie (construit une fois) ──────────────────────────

import { AMBIGUS, CATALOGUE } from "./catalogue";

let index: Index | null = null;
const indexKaddie = () => (index ??= indexer(CATALOGUE, AMBIGUS));

/** Lit un article tapé (ou demandé) avec le catalogue de Kaddie et ce que la famille a appris. */
export function lireSaisie(texte: string, appris: Appris = {}): Lecture | null {
  return reconnaitre(texte, indexKaddie(), appris);
}

/** L'identité d'un article déjà sur la liste : « PQ » et « Papier toilette » ont la même. */
export function cleProduit(nom: string, appris: Appris = {}): string {
  return lireSaisie(nom, appris)?.cle ?? plier(nom);
}
