import "server-only";
import { db } from "@/lib/supabase/server";
import { getAppris, getHistorique, getProfiles, getRecipesWithIngredients, loadCurrentTrip, TRIP_MAX_AGE_MS, type Trip } from "@/lib/data";
import { platsDeLaCourse } from "@/lib/views";
import { cleMaison } from "@/lib/domain/maison";
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
  const { error } = await db().from("shopping_trips").insert({ family_id: familyId, created_by: null, departs_at: maintenant, deadline_at: maintenant });
  if (error) throw new Error(error.message);
  // Deux écrans au même moment ont pu en ouvrir deux : on garde la première, les autres
  // (vides) sont supprimées, jamais closes (une course close compterait comme faite).
  const { data: ouvertes } = await db()
    .from("shopping_trips")
    .select("id")
    .eq("family_id", familyId)
    .neq("status", "done")
    .order("created_at")
    .order("id");
  for (const t of (ouvertes ?? []).slice(1)) await db().from("shopping_trips").delete().eq("id", t.id);
  const ouverte = await loadCurrentTrip(familyId);
  if (!ouverte) throw new Error("Impossible d'ouvrir la liste");
  return ouverte;
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
export async function synchroniserMenu(familyId: string): Promise<{ trip: Trip; ajoutes: string[] }> {
  const trip = await assurerCourse(familyId);
  const gardes = platsDuMenu(trip).length;
  if (gardes >= MENU_MAX) return { trip, ajoutes: [] };
  const dejaDecides = new Set(trip.trip_recipes.map((r) => r.recipe_id));
  // Toujours « ouverte » : une liste faite à l'ancienne continue de recevoir les matchs.
  const [plats, membres] = await Promise.all([platsDeLaCourse(familyId, { ...trip, status: "open" }), getProfiles(familyId)]);
  const ajoutes = plats
    .filter((p) => p.propose && !dejaDecides.has(p.id))
    .filter((p) => membres.length === 1 || p.raison.type === "demande" || p.raison.qui.length >= 2)
    .slice(0, MENU_MAX - gardes)
    .map((p) => p.id);
  if (ajoutes.length === 0) return { trip, ajoutes };
  // Un repas de famille : pour tout le monde (qui en a envie est gardé pour l'affichage).
  const pour = trip.people ?? Math.max(1, membres.length);
  const { error } = await db()
    .from("trip_recipes")
    .upsert(
      ajoutes.map((id) => ({ trip_id: trip.id, recipe_id: id, selected: true, eaters: membres.map((m) => m.id), people: pour })),
      { onConflict: "trip_id,recipe_id", ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);
  return { trip: await reconstruireListe(familyId), ajoutes };
}

/**
 * Recalcule la liste : les ingrédients des plats du Menu, pour celles et ceux qui les
 * mangent, et les demandes écrites, découpées en articles (« des céréales, du Nutella »).
 * Les articles ajoutés à la main restent ; ce qui était coché le reste ; ce qu'on a déjà
 * à la maison ne revient pas. Renvoie la course relue.
 */
export async function reconstruireListe(familyId: string): Promise<Trip> {
  const trip = await loadCurrentTrip(familyId);
  if (!trip) return assurerCourse(familyId);
  const menu = new Set(platsDuMenu(trip));
  const [tousLesPlats, hist, appris] = await Promise.all([platsDeLaCourse(familyId, trip), getHistorique(familyId), getAppris(familyId)]);
  const plats = tousLesPlats.filter((p) => menu.has(p.id));
  const recipes = await getRecipesWithIngredients(familyId, plats.map((p) => p.id));
  // Quantités recalculées plat par plat : pour celles et ceux qui le mangent.
  const pourCombien = new Map(plats.map((p) => [p.id, p.convives.n]));
  const previous = trip.shopping_list_items;
  const aLaMaison = new Set(previous.filter((i) => i.source === "maison").map((i) => itemKey(i.name, i.unit)));
  const merged = mergeIngredients(
    recipes.map((r) => ({ recipeTitle: r.title, ingredients: scaleIngredients(r.recipe_ingredients, r.servings, pourCombien.get(r.id) ?? 1) })),
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
  return (await loadCurrentTrip(familyId)) ?? trip;
}

/** Mettre un plat au Menu (ou l'en retirer) à la main ; la liste suit, et Kaddie complète le Menu. */
export async function choisirPlat(familyId: string, recipeId: string, auMenu: boolean) {
  const [trip, membres] = await Promise.all([assurerCourse(familyId), getProfiles(familyId)]);
  const { error } = await db()
    .from("trip_recipes")
    .upsert(
      auMenu
        ? { trip_id: trip.id, recipe_id: recipeId, selected: true, eaters: membres.map((m) => m.id), people: trip.people ?? Math.max(1, membres.length) }
        : { trip_id: trip.id, recipe_id: recipeId, selected: false },
      { onConflict: "trip_id,recipe_id" },
    );
  if (error) throw new Error(error.message);
  await reconstruireListe(familyId);
  if (!auMenu) await synchroniserMenu(familyId);
}

/** « Annuler » un swipe qui venait de mettre le plat au Menu : comme s'il n'y était jamais entré. */
export async function oublierDuMenu(familyId: string, recipeId: string) {
  const trip = await loadCurrentTrip(familyId);
  if (!trip) return;
  await db().from("trip_recipes").delete().eq("trip_id", trip.id).eq("recipe_id", recipeId);
  await reconstruireListe(familyId);
}
