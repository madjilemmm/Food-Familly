/*
 * Les achats habituels et les articles pas pris : ce que Kaddie propose d'ajouter
 * avant de partir (« À ajouter ? »). Rien n'est mis sur la liste sans un geste.
 *
 * - Achats comptés : les articles cochés ajoutés à la main ou demandés (pas les
 *   ingrédients de recettes), dans des courses vraiment faites, sur 12 mois.
 * - Habitude : au moins 3 achats, dans 3 courses, étalés sur 14 jours ou plus.
 * - Rythme : l'écart médian entre deux achats ; « régulier » si le plus grand écart
 *   vaut au plus 2 fois le plus petit.
 * - Moment de proposer : jours depuis le dernier achat ÷ rythme ≥ 0,8 (régulier) ou 1.
 *   Un produit rare (lessive tous les 2 mois) revient quand c'est le moment, même tard.
 * - « Pas besoin » (×) : le rythme repart de ce jour-là. Mise en veille après 2 « pas
 *   besoin » ou 3 propositions sans réponse de suite, jusqu'au prochain achat.
 * - Au plus 6 propositions, les plus en retard d'abord ; jamais ce qui est déjà sur la
 *   liste ; une seule fois par course.
 * - « La dernière fois » : tant que la maison a fait moins de 3 courses (les habitudes ne peuvent pas encore parler),
 *   ce qui a été acheté à la main à la dernière course faite, au plus 8 articles, proposé de la même façon.
 */

export const HABITUDES = {
  ACHATS_MIN: 3,
  ETALEMENT_MIN_JOURS: 14,
  SEUIL_REGULIER: 0.8,
  SEUIL_IRREGULIER: 1,
  PAS_BESOIN_VEILLE: 2,
  SANS_REPONSE_VEILLE: 3,
  MAX: 6,
  /** « La dernière fois » : au plus ce nombre d'articles. */
  DERNIERE_MAX: 8,
  HISTOIRE_JOURS: 365,
} as const;

const JOUR = 86_400_000;

export type ArticlePasse = {
  name: string;
  cle: string;
  source: string;
  checked: boolean;
  quantity?: number | null;
  unit?: string;
  aisle: string;
};

/** Une course passée (les plus récentes d'abord). */
export type CoursePassee = {
  id: string;
  /** Quand elle a été faite (fin, sinon liste validée). */
  le: number;
  /** Terminée avec « J'ai fini les courses ». */
  finie: boolean;
  /** Close (finie ou fermée au lancement de la suivante). */
  close: boolean;
  items: ArticlePasse[];
};

export type Reponse = { cle: string; reponse: "pas_besoin" | "sans_reponse"; le: number };

export type Suggestion = {
  cle: string;
  nom: string;
  rayon: string;
  quantite: number | null;
  unite: string;
  origine: "habituel" | "reporte" | "derniere";
};

const achatCompte = (i: ArticlePasse) => i.checked && (i.source === "manual" || i.source === "request");

/** Une course compte si elle a été finie, ou (avant le suivi) close avec au moins la moitié de la liste cochée. */
export function vraimentFaite(c: CoursePassee): boolean {
  if (c.finie) return true;
  const utiles = c.items.filter((i) => i.source !== "maison");
  return c.close && utiles.length > 0 && utiles.filter((i) => i.checked).length * 2 >= utiles.length;
}

const mediane = (xs: number[]) => {
  const t = [...xs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
};

/** Les achats habituels à proposer maintenant. */
export function habituelsDus(courses: CoursePassee[], reponses: Reponse[], now: number): (Suggestion & { retard: number })[] {
  const faites = courses.filter((c) => now - c.le < HABITUDES.HISTOIRE_JOURS * JOUR && vraimentFaite(c));
  const parProduit = new Map<string, { dates: number[]; noms: Map<string, number>; dernier: ArticlePasse }>();
  // Des plus anciennes aux plus récentes : le dernier article vu est le plus récent.
  for (const c of [...faites].reverse()) {
    const vus = new Set<string>();
    for (const i of c.items.filter(achatCompte)) {
      if (vus.has(i.cle)) continue;
      vus.add(i.cle);
      const p = parProduit.get(i.cle) ?? { dates: [] as number[], noms: new Map<string, number>(), dernier: i };
      p.dates.push(c.le);
      p.noms.set(i.name, (p.noms.get(i.name) ?? 0) + 1);
      p.dernier = i;
      parProduit.set(i.cle, p);
    }
  }

  const sorties: (Suggestion & { retard: number })[] = [];
  for (const [cle, p] of parProduit) {
    const { dates } = p;
    if (dates.length < HABITUDES.ACHATS_MIN || dates.at(-1)! - dates[0] < HABITUDES.ETALEMENT_MIN_JOURS * JOUR) continue;
    const ecarts = dates.slice(1).map((d, k) => d - dates[k]);
    const rythme = mediane(ecarts);
    if (rythme <= 0) continue;
    const regulier = Math.max(...ecarts) <= 2 * Math.min(...ecarts);
    const dernierAchat = dates.at(-1)!;

    // Les réponses depuis le dernier achat, les plus récentes d'abord.
    const depuis = reponses.filter((r) => r.cle === cle && r.le > dernierAchat).sort((a, b) => b.le - a.le);
    const pasBesoin = depuis.filter((r) => r.reponse === "pas_besoin");
    if (pasBesoin.length >= HABITUDES.PAS_BESOIN_VEILLE) continue;
    const sansReponseDeSuite = depuis.findIndex((r) => r.reponse !== "sans_reponse");
    if ((sansReponseDeSuite === -1 ? depuis.length : sansReponseDeSuite) >= HABITUDES.SANS_REPONSE_VEILLE) continue;

    const depart = Math.max(dernierAchat, pasBesoin[0]?.le ?? 0);
    const avancement = (now - depart) / rythme;
    if (avancement < (regulier ? HABITUDES.SEUIL_REGULIER : HABITUDES.SEUIL_IRREGULIER)) continue;
    // Le nom le plus acheté (« Danette chocolat » plutôt que « Danette » s'il revient le plus souvent).
    const nom = [...p.noms].sort((a, b) => b[1] - a[1])[0][0];
    sorties.push({ cle, nom, rayon: p.dernier.aisle, quantite: null, unite: "", origine: "habituel", retard: avancement });
  }
  return sorties.sort((a, b) => b.retard - a.retard);
}

/** Les articles pas pris à la dernière course terminée avec « J'ai fini » (ajoutés à la main ou demandés). */
export function pasPrisLaDerniereFois(courses: CoursePassee[]): Suggestion[] {
  const derniere = courses.find((c) => c.close);
  if (!derniere?.finie) return [];
  const vus = new Set<string>();
  return derniere.items
    .filter((i) => !i.checked && (i.source === "manual" || i.source === "request"))
    .filter((i) => !vus.has(i.cle) && Boolean(vus.add(i.cle)))
    .map((i) => ({ cle: i.cle, nom: i.name, rayon: i.aisle, quantite: i.quantity ?? null, unite: i.unit ?? "", origine: "reporte" as const }));
}

/**
 * Ce qui a été acheté à la main à la dernière course faite : de quoi répondre à « qu'est-ce qu'il nous faut ? » dès la deuxième
 * course, avant que les habitudes se dessinent (il leur faut 3 achats). À partir de 3 courses faites, c'est « Tes habituels » qui parle.
 */
export function achetesLaDerniereFois(courses: CoursePassee[]): Suggestion[] {
  const faites = courses.filter(vraimentFaite);
  if (faites.length === 0 || faites.length >= HABITUDES.ACHATS_MIN) return [];
  const vus = new Set<string>();
  return faites[0].items
    .filter(achatCompte)
    .filter((i) => !vus.has(i.cle) && Boolean(vus.add(i.cle)))
    .map((i) => ({ cle: i.cle, nom: i.name, rayon: i.aisle, quantite: i.quantity ?? null, unite: i.unit ?? "", origine: "derniere" as const }));
}

/**
 * « À ajouter ? » pour la course en cours : d'abord ce qui n'a pas été pris, puis les
 * habituels, puis (aux premières courses) ce qui a été acheté la dernière fois.
 * Jamais ce qui est déjà sur la liste, ni ce qui a déjà eu une réponse ici.
 */
export function aAjouter(
  courses: CoursePassee[],
  reponses: Reponse[],
  { surLaListe, repondusIci, now }: { surLaListe: Set<string>; repondusIci: Set<string>; now: number },
): { reportes: Suggestion[]; habituels: Suggestion[]; derniere: Suggestion[] } {
  const libre = (s: Suggestion) => !surLaListe.has(s.cle) && !repondusIci.has(s.cle);
  const reportes = pasPrisLaDerniereFois(courses).filter(libre);
  const dejaProposes = new Set(reportes.map((r) => r.cle));
  const habituels = habituelsDus(courses, reponses, now)
    .filter((s) => libre(s) && !dejaProposes.has(s.cle))
    .slice(0, HABITUDES.MAX)
    .map(({ retard: _r, ...s }) => s);
  for (const h of habituels) dejaProposes.add(h.cle);
  const derniere = achetesLaDerniereFois(courses)
    .filter((s) => libre(s) && !dejaProposes.has(s.cle))
    .slice(0, HABITUDES.DERNIERE_MAX);
  return { reportes, habituels, derniere };
}
