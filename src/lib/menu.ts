import "server-only";
import { db } from "@/lib/supabase/server";
import { getAppris, getFoyer, getHistorique, getProfiles, getRecipesWithIngredients, loadCurrentTrip, TRIP_MAX_AGE_MS, type Trip } from "@/lib/data";
import { classerLesPlats, donneesDesPlats, platsDeLaCourse } from "@/lib/views";
import { cleMaison } from "@/lib/domain/maison";
import { foyerValide } from "@/lib/domain/foyer";
import { articlesDe } from "@/lib/domain/articles";
import { itemKey, mergeIngredients, normalizeName, scaleIngredients } from "@/lib/domain/shopping-list";
import { cleProduit } from "@/lib/domain/reconnaissance";
import { insererArticles } from "@/lib/liste";

/*
 * « Tu swipes, Kaddie fait le reste. »
 * La famille a toujours une liste ouverte (la course en cours), sans que personne la lance.
 * Un plat qui plaît (un match ; seul, une envie) entre au Menu, et ses ingrédients vont
 * sur la liste. Il y reste jusqu'aux courses finies, ou jusqu'à ce qu'on le retire.
 */

/** Au plus, Kaddie met d'elle-même ce nombre de plats au Menu. */
export const MENU_MAX = 5;

/** La course en cours ; s'il n'y en a pas, une liste vide s'ouvre (personne n'a à la lancer). */
export async function assurerCourse(familyId: string): Promise<Trip> {
  const trip = await loadCurrentTrip(familyId);
  if (trip) return trip;
  // Une seule liste à la fois : les anciennes, oubliées depuis longtemps, sont closes.
  await db()
    .from("shopping_trips")
    .update({ status: "done" })
    .eq("family_id", familyId)
    .neq("status", "done")
    .lt("created_at", new Date(Date.now() - TRIP_MAX_AGE_MS).toISOString());
  const maintenant = new Date().toISOString();
  const { data: creee, error } = await db()
    .from("shopping_trips")
    .insert({ family_id: familyId, created_by: null, departs_at: maintenant, deadline_at: maintenant })
    .select("id")
    .single();
  // Base migrée (une seule liste ouverte par famille) : « déjà ouverte » veut dire qu'un autre écran l'a ouverte au même moment.
  if (error && error.code !== "23505") throw new Error(error.message);
  // Sans cette garantie, deux écrans au même moment ont pu en ouvrir deux : tout le monde garde la plus ancienne (voir
  // loadCurrentTrip), et chaque écran ne retire que celle qu'il vient d'ouvrir (supprimée, jamais close : une course close
  // compterait comme faite). Aucun écran ne supprime la liste d'un autre : celui-ci pourrait être en train d'y écrire.
  if (creee) {
    const { data: ouvertes } = await db()
      .from("shopping_trips")
      .select("id")
      .eq("family_id", familyId)
      .neq("status", "done")
      .order("created_at")
      .order("id");
    if ((ouvertes ?? []).length > 1 && ouvertes![0].id !== creee.id) await db().from("shopping_trips").delete().eq("id", creee.id);
  }
  const ouverte = await loadCurrentTrip(familyId);
  if (!ouverte) throw new Error("Impossible d'ouvrir la liste");
  return ouverte;
}

/** La course a pu disparaître entre-temps (une liste ouverte en double, retirée par l'écran qui l'avait ouverte) : on reprend avec celle qui reste. */
const courseDisparue = (error: { code?: string } | null) => error?.code === "23503";

/**
 * Un plat est au Menu mais rien n'est sur la liste, alors qu'il a des ingrédients : la liste n'a pas suivi (deux écrans au même
 * moment, une écriture interrompue). On la refait : rien n'attend qu'on ajoute un plat pour la réparer.
 */
async function rattraper(familyId: string, trip: Trip): Promise<Trip> {
  const menu = platsDuMenu(trip);
  if (menu.length === 0 || trip.shopping_list_items.some((i) => i.source === "recipe" || i.source === "maison")) return trip;
  const { data } = await db().from("recipe_ingredients").select("recipe_id").in("recipe_id", menu).limit(1);
  return data?.length ? reconstruireListe(familyId, trip.id) : trip;
}

/** Les plats du Menu : ceux gardés pour la course en cours. */
export const platsDuMenu = (trip: Trip) => trip.trip_recipes.filter((r) => r.selected).map((r) => r.recipe_id);

/**
 * Complète le Menu avec les plats que Kaddie propose, jusqu'à MENU_MAX, puis remet la liste
 * à jour. À plusieurs, il faut un match (au moins deux envies) : la première personne qui
 * swipe ne remplit pas le Menu à elle seule. Seul dans la famille, une envie suffit.
 * Un plat retiré à la main ne revient pas pendant cette course. Rien n'est écrit s'il n'y a
 * rien à ajouter.
 */
export async function synchroniserMenu(familyId: string, essai = 0): Promise<{ trip: Trip; ajoutes: string[] }> {
  // Les données du classement se chargent pendant que la course s'ouvre : elles n'en dépendent pas.
  const [trip, donnees] = await Promise.all([assurerCourse(familyId), donneesDesPlats(familyId)]);
  const gardes = platsDuMenu(trip).length;
  if (gardes >= MENU_MAX) return { trip: await rattraper(familyId, trip), ajoutes: [] };
  const dejaDecides = new Set(trip.trip_recipes.map((r) => r.recipe_id));
  // Toujours « ouverte » : une liste faite à l'ancienne continue de recevoir les matchs.
  const plats = classerLesPlats(donnees, { ...trip, status: "open" });
  const membres = donnees[0];
  const ajoutes = plats
    .filter((p) => p.propose && !dejaDecides.has(p.id))
    .filter((p) => membres.length === 1 || p.raison.type === "demande" || p.raison.qui.length >= 2)
    .slice(0, MENU_MAX - gardes)
    .map((p) => p.id);
  if (ajoutes.length === 0) return { trip: await rattraper(familyId, trip), ajoutes };
  // Un repas de famille : pour tout le monde (qui en a envie est gardé pour l'affichage).
  const pour = trip.people ?? Math.max((await getFoyer(familyId)) ?? 1, membres.length);
  const { error } = await db()
    .from("trip_recipes")
    .upsert(
      ajoutes.map((id) => ({ trip_id: trip.id, recipe_id: id, selected: true, eaters: membres.map((m) => m.id), people: pour })),
      { onConflict: "trip_id,recipe_id", ignoreDuplicates: true },
    );
  if (courseDisparue(error) && essai < 2) return synchroniserMenu(familyId, essai + 1);
  if (error) throw new Error(error.message);
  return { trip: await reconstruireListe(familyId, trip.id), ajoutes };
}

/**
 * Recalcule la liste : les ingrédients des plats du Menu, pour celles et ceux qui les
 * mangent, et les demandes écrites, découpées en articles (« des céréales, du Nutella »).
 * Les articles ajoutés à la main restent ; ce qui était coché le reste ; ce qu'on a déjà
 * à la maison ne revient pas. Renvoie la course relue.
 * `tripId` : la course où le geste a eu lieu. Sans lui, « la course en cours » aurait pu devenir une autre entre-temps
 * (une liste ouverte au même moment par un autre écran) et le Menu resterait sans ses articles.
 */
export async function reconstruireListe(familyId: string, tripId?: string): Promise<Trip> {
  const trip = await loadCurrentTrip(familyId, tripId);
  if (!trip) return tripId ? reconstruireListe(familyId) : assurerCourse(familyId);
  const menu = new Set(platsDuMenu(trip));
  const [tousLesPlats, hist, appris] = await Promise.all([platsDeLaCourse(familyId, trip), getHistorique(familyId), getAppris(familyId)]);
  const plats = tousLesPlats.filter((p) => menu.has(p.id));
  const recipes = await getRecipesWithIngredients(familyId, plats.map((p) => p.id));
  // Quantités recalculées plat par plat : pour celles et ceux qui le mangent.
  const pourCombien = new Map(plats.map((p) => [p.id, p.convives.n]));
  const previous = trip.shopping_list_items;
  const aLaMaison = new Set(previous.filter((i) => i.source === "maison").map((i) => itemKey(i.name, i.unit)));
  // Les quantités de chaque plat ne sont pas arrondies avant d'être additionnées : on arrondit une fois, sur la somme.
  const merged = mergeIngredients(
    recipes.map((r) => ({ recipeTitle: r.title, ingredients: scaleIngredients(r.recipe_ingredients, r.servings, pourCombien.get(r.id) ?? 1, true) })),
    { arrondir: true },
  )
    .filter((m) => !aLaMaison.has(m.key))
    // Sans doute toujours à la maison (sel, huile…) : à vérifier avant de partir, pas d'office sur la liste.
    .filter((m) => !hist.aLaMaison.has(cleMaison(m.name)));
  // Les ingrédients déjà sur la liste gardent leur ligne (et donc leur coche, et les coches
  // en attente sur un téléphone sans réseau) : seules les quantités changent.
  const existants = new Map<string, (typeof previous)[number]>();
  const enTrop: string[] = [];
  for (const i of previous.filter((i) => i.source === "recipe")) {
    const cle = itemKey(i.name, i.unit);
    if (existants.has(cle)) enTrop.push(i.id);
    else existants.set(cle, i);
  }
  const voulus = new Set(merged.map((m) => m.key));
  for (const [cle, i] of existants) if (!voulus.has(cle)) enTrop.push(i.id);
  // Les demandes écrites vont sur la liste toutes seules (sauf ce qui y est déjà, ou a été retiré).
  const dejaLa = new Set(previous.map((i) => i.name.trim().toLowerCase()));
  const ecrites = trip.trip_requests
    .filter((r) => r.free_text && r.profile_id !== trip.created_by)
    .flatMap((r) => articlesDe(r.free_text!, appris))
    .filter((a) => !dejaLa.has(a.name.toLowerCase()) && Boolean(dejaLa.add(a.name.toLowerCase())));

  const forRecipes = (m: (typeof merged)[number]) => m.forRecipes.join(", ");
  const aMettreAJour = merged.filter((m) => {
    const i = existants.get(m.key);
    return i && (i.quantity !== m.quantity || i.for_recipes !== forRecipes(m) || i.aisle !== m.aisle);
  });
  await Promise.all([
    enTrop.length ? db().from("shopping_list_items").delete().in("id", enTrop).eq("trip_id", trip.id) : null,
    ...aMettreAJour.map((m) =>
      db().from("shopping_list_items").update({ quantity: m.quantity, for_recipes: forRecipes(m), aisle: m.aisle }).eq("id", existants.get(m.key)!.id),
    ),
  ]);
  await insererArticles([
    ...merged
      .filter((m) => !existants.has(m.key))
      .map((m) => ({
        trip_id: trip.id,
        name: m.name,
        quantity: m.quantity,
        unit: m.unit,
        aisle: m.aisle,
        source: "recipe" as const,
        for_recipes: forRecipes(m),
        // Même regroupement que mergeIngredients : un ingrédient par nom et par unité.
        cle: normalizeName(m.name),
      })),
    ...ecrites.map((a) => ({ trip_id: trip.id, ...a, source: "request" as const, cle: cleProduit(a.name, appris) })),
  ]);
  return (await loadCurrentTrip(familyId, trip.id)) ?? trip;
}

/** Mettre un plat au Menu (ou l'en retirer) à la main ; la liste suit, et Kaddie complète le Menu. */
export async function choisirPlat(familyId: string, recipeId: string, auMenu: boolean, essai = 0): Promise<void> {
  const [trip, membres] = await Promise.all([assurerCourse(familyId), getProfiles(familyId)]);
  const { error } = await db()
    .from("trip_recipes")
    .upsert(
      auMenu
        ? { trip_id: trip.id, recipe_id: recipeId, selected: true, eaters: membres.map((m) => m.id), people: trip.people ?? Math.max((await getFoyer(familyId)) ?? 1, membres.length) }
        : { trip_id: trip.id, recipe_id: recipeId, selected: false },
      { onConflict: "trip_id,recipe_id" },
    );
  if (courseDisparue(error) && essai < 2) return choisirPlat(familyId, recipeId, auMenu, essai + 1);
  if (error) throw new Error(error.message);
  await reconstruireListe(familyId, trip.id);
  if (!auMenu) await synchroniserMenu(familyId);
}

/** « Annuler » un swipe qui venait de mettre le plat au Menu : comme s'il n'y était jamais entré. */
export async function oublierDuMenu(familyId: string, recipeId: string) {
  const trip = await loadCurrentTrip(familyId);
  if (!trip) return;
  await db().from("trip_recipes").delete().eq("trip_id", trip.id).eq("recipe_id", recipeId);
  await reconstruireListe(familyId, trip.id);
}

/**
 * « Pour 4 » : le nombre de personnes à table, retenu pour la famille et appliqué à la course en cours
 * (quantités de la liste recalculées). Base pas encore migrée : seule la course en cours s'en souvient.
 */
export async function changerFoyer(familyId: string, n: number) {
  const pour = foyerValide(n);
  if (!pour) return;
  await db().from("families").update({ foyer: pour }).eq("id", familyId);
  const trip = await loadCurrentTrip(familyId);
  if (!trip) return;
  await db().from("shopping_trips").update({ people: pour }).eq("id", trip.id);
  await db().from("trip_recipes").update({ people: pour }).eq("trip_id", trip.id).eq("selected", true);
  await reconstruireListe(familyId, trip.id);
}
