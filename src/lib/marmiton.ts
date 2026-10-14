import "server-only";
import { broadcastRefresh, db } from "@/lib/supabase/server";
import { extractRecipe, type ImportedRecipe } from "@/lib/domain/recipe-import";
import { safeFetch } from "@/lib/safe-fetch";

/*
 * Recettes importées toutes seules depuis Marmiton, pour que le swipe ne
 * s'arrête jamais : quand une famille n'a presque plus de plats à découvrir,
 * on pioche au hasard dans le plan du site (≈ 45 000 recettes) et on garde
 * les bons plats principaux. Les pages recettes sont autorisées par le
 * robots.txt de Marmiton ; on reste discret (quelques pages à la fois).
 */

const SITEMAPS = 9; // wsitemap_recipes_1.xml … _9.xml
const PAR_IMPORT = 10;
const ESSAIS_MAX = 120;
const OUBLI_JOURS = 28;

/** Familles dont l'import tourne déjà sur ce serveur (les onglets préchargés relancent la page). */
const enCours = new Set<string>();

/** Assez de plats à découvrir ? Sinon on en ajoute (appelé après l'affichage du swipe). */
export async function remplirSiBesoin(familyId: string, nouveautes: number) {
  if (nouveautes >= 8 || enCours.has(familyId)) return;
  enCours.add(familyId);
  try {
    await remplir(familyId);
  } finally {
    enCours.delete(familyId);
  }
}

async function remplir(familyId: string) {
  // Un import vient d'avoir lieu (autre téléphone, onglet ouvert deux fois) : on ne recommence pas.
  const { data: recent } = await db()
    .from("recipes")
    .select("id")
    .eq("family_id", familyId)
    .not("source_url", "is", null)
    .gte("created_at", new Date(Date.now() - 2 * 60 * 1000).toISOString())
    .limit(1);
  if (recent?.length) return;

  await oublierLesRecettesBoudees(familyId);
  const ajoutees = await importer(familyId, PAR_IMPORT).catch((err) => {
    console.warn("Import Marmiton impossible :", err);
    return 0;
  });
  // Les téléphones ouverts sur le swipe reçoivent les nouvelles cartes.
  if (ajoutees > 0) await broadcastRefresh(familyId);
}

/** Un bon plat pour le swipe : un plat principal, bien noté, avec photo et ingrédients. */
export function estUnBonPlat(r: ImportedRecipe): boolean {
  return (
    /plat principal/i.test(r.category ?? "") &&
    (r.rating ?? 0) >= 4 &&
    (r.ratingCount ?? 0) >= 3 &&
    Boolean(r.imageUrl) &&
    r.ingredients.length >= 3
  );
}

async function importer(familyId: string, combien: number): Promise<number> {
  const plan = await safeFetch(`https://www.marmiton.org/wsitemap_recipes_${1 + Math.floor(Math.random() * SITEMAPS)}.xml`, {
    maxBytes: 4 * 1024 * 1024,
    accept: "application/xml",
  });
  const liens = [...plan.body.toString("utf8").matchAll(/<loc>([^<]+recette_[^<]+)<\/loc>/g)].map((m) => m[1]);
  const { data: dejaLa } = await db().from("recipes").select("source_url").eq("family_id", familyId).not("source_url", "is", null);
  const connus = new Set((dejaLa ?? []).map((r) => r.source_url as string));
  const aEssayer = melange(liens.filter((l) => !connus.has(l))).slice(0, ESSAIS_MAX);

  let ajoutees = 0;
  // 6 pages à la fois, jusqu'à avoir assez de plats.
  for (let i = 0; i < aEssayer.length && ajoutees < combien; i += 6) {
    const lot = await Promise.all(aEssayer.slice(i, i + 6).map(lireRecette));
    for (const [url, recette] of lot) {
      if (ajoutees >= combien || !recette || !estUnBonPlat(recette)) continue;
      if (await enregistrer(familyId, url, recette)) ajoutees++;
    }
  }
  return ajoutees;
}

async function lireRecette(url: string): Promise<[string, ImportedRecipe | null]> {
  try {
    const page = await safeFetch(url, { maxBytes: 3 * 1024 * 1024, accept: "text/html" });
    return [url, extractRecipe(page.body.toString("utf8"))];
  } catch {
    return [url, null];
  }
}

async function enregistrer(familyId: string, url: string, r: ImportedRecipe): Promise<boolean> {
  const { data, error } = await db()
    .from("recipes")
    .insert({ family_id: familyId, title: r.title, emoji: "🍽️", photo_url: r.imageUrl, source_url: url })
    .select("id")
    .single();
  if (error) return false; // déjà importée entre-temps (index unique)
  await db()
    .from("recipe_ingredients")
    .insert(r.ingredients.slice(0, 60).map((ing, position) => ({ ...ing, position, recipe_id: data.id })));
  return true;
}

/** Les recettes importées que personne n'a aimées en 4 semaines laissent la place aux nouvelles. */
async function oublierLesRecettesBoudees(familyId: string) {
  const avant = new Date(Date.now() - OUBLI_JOURS * 24 * 60 * 60 * 1000).toISOString();
  const { data: vieilles } = await db()
    .from("recipes")
    .select("id, swipes(liked), trip_recipes(recipe_id)")
    .eq("family_id", familyId)
    .not("source_url", "is", null)
    .lt("created_at", avant)
    .limit(200);
  const aOublier = (vieilles ?? [])
    .filter((r) => !(r.swipes as { liked: boolean }[]).some((s) => s.liked) && (r.trip_recipes as unknown[]).length === 0)
    .map((r) => r.id as string);
  if (aOublier.length) await db().from("recipes").delete().in("id", aOublier);
}

function melange<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
