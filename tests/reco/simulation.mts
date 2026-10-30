// Simulation hors ligne de la découverte (swipe) : une famille fictive swipe PAR_JOUR plats par jour (12 par défaut) pendant 90 jours, le paquet vient du vrai moteur
// (ordonnerPaquet, profilDe, prediction) et l'import Marmiton est modélisé (10 plats tirés dans un fonds fini, déclenché sous 8 nouveautés).
//
// Lancer : npx tsx tests/reco/simulation.mts   (variables : FONDS=600 PAR_JOUR=4)
// ATTENTION : c'est une simulation. Les goûts de la famille, le fonds de plats (FONDS, 160 par défaut, réparti comme les 62 plats mesurés sur Marmiton) et
// la façon dont elle répond sont inventés : les chiffres comparent deux comportements du MÊME système, ils ne prédisent pas la satisfaction réelle.
import { ordonnerPaquet, type CartePaquet } from "../../src/lib/domain/reco";
import { prediction, profilDe } from "../../src/lib/domain/profil-gouts";

const FONDS = Number(process.env.FONDS ?? 160);
const PAR_JOUR = Number(process.env.PAR_JOUR ?? 12);
const JOUR = 86_400_000;
const T0 = Date.parse("2026-11-01T08:00:00Z");

function hasard(graine: number) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Répartition mesurée sur 62 plats Marmiton retenus (styles reconnus, durées) ; « poisson » et « grillades » n'y étaient pas.
const STYLES = [["grand_mere", 15], ["pates", 12], ["vege", 5], ["pizza", 5], ["mexicain", 4], ["street_food", 3], ["asiatique", 2], [null, 2]] as const;
const MINUTES = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 120];

function fonds(n: number, rnd: () => number) {
  const total = STYLES.reduce((s, [, k]) => s + k, 0);
  return Array.from({ length: n }, (_, i) => {
    let x = rnd() * total;
    const style = STYLES.find(([, k]) => (x -= k) < 0)![0];
    return { id: `p${i}`, style: style as string | null, minutes: MINUTES[Math.floor(rnd() * MINUTES.length)] };
  });
}

type Avis = { liked: boolean; swipedAt: number; likedAt: number | null };
type Resultat = { repetition: number; refusesRevus: number; couverture: number; swipesParMiam: number; fondsEpuiseAuJour: number | null };

function simuler(mode: "avant" | "apres", graine: number, jours = 90, parJour = PAR_JOUR): Resultat {
  const rnd = hasard(graine);
  const pool = fonds(FONDS, rnd);
  const favoris = new Set(["pates", "street_food"]);
  const aime = (p: { style: string | null }) => (p.style && favoris.has(p.style) ? 0.75 : p.style ? 0.25 : 0.4);
  // Le catalogue de la famille : 10 plats de départ, puis les imports.
  const catalogue = new Map<string, { id: string; style: string | null; minutes: number; creeLe: number }>();
  for (const p of pool.slice(0, 10)) catalogue.set(p.id, { ...p, creeLe: T0 });
  const importables = new Set(pool.slice(10).map((p) => p.id));
  const avis = new Map<string, Avis>();
  const vus = new Set<string>();
  const refuses = new Set<string>();
  let montres = 0, repetitions = 0, refusesRevus = 0, miams = 0, epuise: number | null = null;
  const parId = new Map(pool.map((p) => [p.id, p]));
  for (let j = 0; j < jours; j++) {
    const now = T0 + j * JOUR;
    // L'oubli : « avant », une recette importée sans « Miam » de plus de 28 jours disparaît avec son avis ; « après », seulement si personne ne l'a swipée.
    for (const [id, r] of [...catalogue]) {
      if (r.creeLe === T0 || now - r.creeLe < 28 * JOUR) continue;
      const a = avis.get(id);
      const supprimer = mode === "avant" ? !a?.likedAt : !a;
      if (!supprimer) continue;
      catalogue.delete(id);
      avis.delete(id);
      if (mode === "avant") importables.add(id); // plus dans les adresses connues : la source peut le renvoyer
    }
    const cartes = (): (CartePaquet & { id: string })[] => {
      const tags = new Map([...catalogue.values()].map((r) => [r.id, [...(r.style ? [`style:${r.style}`] : []), ...(r.minutes <= 30 ? ["temps:rapide"] : r.minutes > 60 ? ["temps:long"] : [])]] as const));
      const profil = profilDe([...avis].filter(([id]) => catalogue.has(id)), tags, now);
      return [...catalogue.values()].map((r) => ({
        id: r.id,
        created_at: new Date(r.creeLe).toISOString(),
        avis: avis.get(r.id),
        signaux: { avis: avis.get(r.id), prediction: prediction(profil, tags.get(r.id) ?? []) },
        enviesDesAutres: 0,
        vuParLaFamille: avis.has(r.id),
        style: r.style,
        minutes: r.minutes,
        matchProbable: 0,
        lassitude: 0,
        cache: false,
        fin: false,
      })) as (CartePaquet & { id: string })[];
    };
    let deck = ordonnerPaquet(cartes(), now, null);
    // L'import : sous 8 nouveautés, 10 plats tirés dans ce que la source peut encore renvoyer.
    if (deck.filter((c) => !c.avis).length < 8) {
      const dispo = [...importables].filter((id) => !catalogue.has(id));
      for (let k = 0; k < 10 && dispo.length; k++) {
        const id = dispo.splice(Math.floor(rnd() * dispo.length), 1)[0];
        const p = parId.get(id)!;
        catalogue.set(id, { ...p, minutes: p.minutes, creeLe: now });
        if (mode === "apres") importables.delete(id);
      }
      if (dispo.length === 0 && epuise === null) epuise = j;
      deck = ordonnerPaquet(cartes(), now, null);
    }
    for (const c of deck.slice(0, parJour)) {
      const p = parId.get(c.id)!;
      montres++;
      if (vus.has(c.id)) repetitions++;
      if (refuses.has(c.id)) refusesRevus++;
      vus.add(c.id);
      const oui = rnd() < aime(p);
      if (oui) miams++;
      else refuses.add(c.id);
      avis.set(c.id, { liked: oui, swipedAt: now, likedAt: oui ? now : null });
    }
  }
  return { repetition: repetitions / montres, refusesRevus: refusesRevus / montres, couverture: vus.size / FONDS, swipesParMiam: montres / Math.max(1, miams), fondsEpuiseAuJour: epuise };
}

const moyenne = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
for (const mode of ["avant", "apres"] as const) {
  const r = Array.from({ length: 30 }, (_, k) => simuler(mode, 1000 + k));
  const ep = r.map((x) => x.fondsEpuiseAuJour).filter((x): x is number => x !== null);
  console.log(
    `${mode === "avant" ? "AVANT (oubli des plats refusés)" : "APRÈS (mémoire gardée)       "} : répétition ${(100 * moyenne(r.map((x) => x.repetition))).toFixed(0)} % des cartes déjà vues · dont refusées ${(100 * moyenne(r.map((x) => x.refusesRevus))).toFixed(0)} % · couverture du fonds ${(100 * moyenne(r.map((x) => x.couverture))).toFixed(0)} % · ${moyenne(r.map((x) => x.swipesParMiam)).toFixed(1)} swipes par « Miam » · fonds épuisé dans ${ep.length}/30 simulations${ep.length ? ` (jour ${Math.round(moyenne(ep))} en moyenne)` : ""}`,
  );
}
