import "server-only";
import { db } from "@/lib/supabase/server";
import { getFamilyTastes, getProfiles, getProfilsGouts, getRecipes } from "@/lib/data";
import { dureeMax, lireEnvies } from "@/lib/domain/envies";
import { etiquettesPreferees } from "@/lib/domain/profil-gouts";
import { recipeConflicts } from "@/lib/domain/foods";
import { parseIngredientLine } from "@/lib/domain/recipe-import";
import { choisirDansLeCatalogue, creditDeLaRecette, motifsDeRefus, type CandidatCatalogue } from "@/lib/domain/catalogue-commun";

/*
 * Ajoute à une famille des recettes du catalogue commun (domain/catalogue-commun.ts) : complètes, avec photo, de sources autorisées.
 * Rien ne sort sur le réseau : une lecture en base. C'est la source principale du paquet ; Marmiton n'est plus qu'un secours (lib/marmiton.ts).
 * Un plat déjà dans la famille (même refusé : la recette et son « Bof » restent) n'est jamais proposé deux fois.
 */

type LigneCatalogue = {
  id: string;
  source: string;
  source_id: string;
  titre: string;
  photo_url: string;
  photo_auteur: string | null;
  photo_licence: string;
  texte_licence: string;
  attribution_url: string;
  attribution_texte: string;
  minutes: number | null;
  portions: number | null;
  etapes: string[];
  ingredients: string[];
  cuisine: string | null;
  langue: string;
};

const enCandidat = (l: LigneCatalogue): CandidatCatalogue => ({
  id: l.id,
  source: l.source,
  sourceId: l.source_id,
  titre: l.titre,
  photoUrl: l.photo_url,
  photoAuteur: l.photo_auteur,
  photoLicence: l.photo_licence,
  texteLicence: l.texte_licence,
  attributionUrl: l.attribution_url,
  attributionTexte: l.attribution_texte,
  minutes: l.minutes,
  portions: l.portions,
  etapes: l.etapes,
  ingredients: l.ingredients,
  cuisine: l.cuisine,
  langue: l.langue,
});

/** Combien de recettes du catalogue ont été ajoutées à cette famille. Erreur ou base pas migrée : 0 (l'appelant a un secours). */
export async function piocherDansLeCatalogue(familyId: string, combien: number): Promise<number> {
  const [{ members, strict }, profiles, recettes, profils, dejaLa, catalogue] = await Promise.all([
    getFamilyTastes(familyId),
    getProfiles(familyId),
    getRecipes(familyId),
    getProfilsGouts(familyId),
    db().from("recipes").select("catalogue_id").eq("family_id", familyId).not("catalogue_id", "is", null),
    db()
      .from("catalogue_commun")
      .select("id, source, source_id, titre, photo_url, photo_auteur, photo_licence, texte_licence, attribution_url, attribution_texte, minutes, portions, etapes, ingredients, cuisine, langue")
      .eq("publiable", true)
      .eq("langue", "fr")
      .limit(3000),
  ]);
  if (catalogue.error || dejaLa.error || !catalogue.data) {
    console.warn("Catalogue commun indisponible :", catalogue.error?.message ?? dejaLa.error?.message);
    return 0;
  }
  const connus = new Set((dejaLa.data ?? []).map((r) => r.catalogue_id as string));
  const maxi = dureeMax(profiles.map((p) => lireEnvies(p.envies)));

  // Sécurité d'abord : la même règle que pour toute recette (allergies, régimes, interdits), puis la durée, puis ce qui est complet.
  const sansRisque = (catalogue.data as unknown as LigneCatalogue[])
    .filter((l) => !connus.has(l.id))
    .map(enCandidat)
    .filter((c) => motifsDeRefus(c).length === 0)
    .filter((c) => !recipeConflicts([c.titre, ...c.ingredients], members, strict).familleCache && (c.minutes ?? 0) <= maxi);

  const choisies = choisirDansLeCatalogue({
    candidats: sansRisque,
    titresDeLaFamille: recettes.map((r) => r.title),
    stylesAimes: etiquettesPreferees([...profils.values()], "style:", 3),
    combien,
  });

  // Une trace dans les journaux : sans elle, un catalogue qui ne donne rien passe inaperçu.
  console.info(`Catalogue commun : ${catalogue.data.length} recettes, ${sansRisque.length} compatibles avec la famille, ${choisies.length} choisies`);
  let ajoutees = 0;
  for (const c of choisies) if (await ajouter(familyId, c)) ajoutees++;
  if (ajoutees > 0) console.info(`Catalogue commun : ${ajoutees} recettes ajoutées (${choisies.map((c) => c.titre).join(" / ")})`);
  return ajoutees;
}

async function ajouter(familyId: string, c: CandidatCatalogue): Promise<boolean> {
  const lignes = c.ingredients.flatMap((l) => parseIngredientLine(l) ?? []);
  if (lignes.length < 3) return false;
  const { data, error } = await db()
    .from("recipes")
    .insert({
      family_id: familyId,
      title: c.titre,
      emoji: "🍽️",
      photo_url: c.photoUrl,
      catalogue_id: c.id,
      servings: c.portions,
      total_minutes: c.minutes,
      steps: c.etapes,
    })
    .select("id")
    .single();
  if (error) return false; // déjà ajoutée entre-temps (index unique)
  const { error: e2 } = await db()
    .from("recipe_ingredients")
    .insert(lignes.slice(0, 60).map((ing, position) => ({ ...ing, position, recipe_id: data.id })));
  if (e2) {
    // Une recette sans ingrédients n'a pas sa place dans le paquet : on la retire, elle sera retentée.
    await db().from("recipes").delete().eq("id", data.id);
    return false;
  }
  return true;
}

/**
 * Les crédits à afficher sur une recette qui vient du catalogue (origine du texte, auteur de la photo), sinon null.
 * Une lecture à part et tolérante : tant que la migration du catalogue n'est pas passée, la fiche s'affiche comme avant.
 */
export async function creditsDeLaRecette(familyId: string, recipeId: string): Promise<{ texte: string; url: string } | null> {
  const { data: r, error } = await db().from("recipes").select("catalogue_id").eq("family_id", familyId).eq("id", recipeId).maybeSingle();
  if (error || !r?.catalogue_id) return null;
  const { data } = await db().from("catalogue_commun").select("attribution_texte, attribution_url, photo_auteur, photo_licence").eq("id", r.catalogue_id as string).maybeSingle();
  if (!data) return null;
  return {
    texte: creditDeLaRecette({ attributionTexte: data.attribution_texte as string, photoAuteur: (data.photo_auteur as string | null) ?? null, photoLicence: data.photo_licence as string }),
    url: data.attribution_url as string,
  };
}
