"use server";

import { redirect } from "next/navigation";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { getAppris, getCoursesPassees, getCurrentTrip, getHistorique, getRecipes, getRecipesWithIngredients, getProfile, getProfiles, loadCurrentTrip, type Trip } from "@/lib/data";
import { cleMaison } from "@/lib/domain/maison";
import { platsDeLaCourse } from "@/lib/views";
import { articlesDe } from "@/lib/domain/articles";
import { deadlineFor, type DepartureChoice } from "@/lib/domain/trip";
import { mergeIngredients, itemKey, normalizeName, scaleIngredients } from "@/lib/domain/shopping-list";
import { aAjouter, type Suggestion } from "@/lib/domain/habitudes";
import { cleProduit } from "@/lib/domain/reconnaissance";
import { isAisle } from "@/lib/domain/aisles";
import { insererArticles } from "@/lib/liste";
import { notifyCoursesFinies, notifyEnviesRetenues, notifyMerci, notifyTripStarted, notifyRequestReceived, notifyTakeOver } from "@/lib/notifications";
import { ROUTES } from "@/lib/routes";
import { changed, cleanText } from "./_shared";

const CHOICES: DepartureChoice[] = ["30min", "1h", "2h", "soir"];

async function currentTripOrThrow(user: CurrentUser) {
  const trip = await getCurrentTrip(user.familyId);
  if (!trip) throw new Error("Aucune course en cours");
  return trip;
}

/** Seule la personne qui fait les courses choisit les plats et valide la liste. */
async function myTripOrThrow(user: CurrentUser) {
  const trip = await currentTripOrThrow(user);
  if (trip.created_by !== user.profileId) throw new Error("Ce n'est pas vous qui faites ces courses");
  return trip;
}

/** Ne garde que les recettes de la famille. */
async function familyRecipeIds(user: CurrentUser, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const { data } = await db().from("recipes").select("id").eq("family_id", user.familyId).in("id", ids);
  return (data ?? []).map((r) => r.id as string);
}

// ─── La personne qui part faire les courses ────────────────────────────

export async function startTrip(choice: DepartureChoice) {
  const user = await requireUser();
  if (!CHOICES.includes(choice)) throw new Error("Choix invalide");

  const current = await getCurrentTrip(user.familyId);
  if (current && current.created_by !== user.profileId) {
    const shopper = current.created_by ? await getProfile(user.familyId, current.created_by) : null;
    // L'écran des courses montre alors qui les fait déjà.
    if (shopper) redirect(ROUTES.courses);
  }

  const deadline = deadlineFor(choice);
  // Ce qui n'a pas été pris la dernière fois n'est plus recopié d'office :
  // il est proposé dans « À ajouter ? » (voir domain/habitudes.ts).
  // Une seule session à la fois par famille : les anciennes sont closes.
  await db().from("shopping_trips").update({ status: "done" }).eq("family_id", user.familyId).neq("status", "done");
  const { data: trip, error } = await db()
    .from("shopping_trips")
    .insert({
      family_id: user.familyId,
      created_by: user.profileId,
      deadline_at: deadline.toISOString(),
      departs_at: deadline.toISOString(),
    })
    .select("id, deadline_at")
    .single();
  if (error) throw new Error(error.message);

  changed(() => notifyTripStarted(user.familyId, user.profileId, trip.deadline_at));
  // Une redirection plutôt qu'un rafraîchissement sur place : l'écran suit même si
  // les onglets sont encore en train de se précharger.
  redirect(ROUTES.courses);
}

export async function cancelTrip() {
  const user = await requireUser();
  const trip = await myTripOrThrow(user);
  await db().from("shopping_trips").delete().eq("id", trip.id);
  changed();
}

/** « Je prends le relais » : la course (demandes, plats, liste) passe à moi. */
export async function takeOverTrip() {
  const user = await requireUser();
  const trip = await currentTripOrThrow(user);
  if (trip.created_by === user.profileId) redirect(ROUTES.courses);
  const ancien = trip.created_by;
  await db().from("shopping_trips").update({ created_by: user.profileId }).eq("id", trip.id);
  changed(() => notifyTakeOver(user.familyId, user.profileId, ancien));
  redirect(ROUTES.courses);
}

/** N'importe qui peut clore des courses terminées (par exemple si on les a faites à deux). */
export async function finishTrip() {
  const user = await requireUser();
  const trip = await currentTripOrThrow(user);
  // finished_at : ces courses ont vraiment été faites (achats habituels, articles pas pris).
  const { error } = await db().from("shopping_trips").update({ status: "done", finished_at: new Date().toISOString() }).eq("id", trip.id);
  if (error) await db().from("shopping_trips").update({ status: "done" }).eq("id", trip.id);
  // Pas de redirection ici : le bouton recharge l'écran des courses (voir ConfirmButton « apres »).
  const shopper = trip.created_by ?? user.profileId;
  changed(async () => notifyCoursesFinies(user.familyId, shopper, ceQuiAEtePris(trip, await getAppris(user.familyId))));
}

export async function setTripRecipe(recipeId: string, selected: boolean) {
  const user = await requireUser();
  const trip = await myTripOrThrow(user);
  if ((await familyRecipeIds(user, [recipeId])).length === 0) throw new Error("Recette inconnue");
  const { error } = await db()
    .from("trip_recipes")
    .upsert({ trip_id: trip.id, recipe_id: recipeId, selected }, { onConflict: "trip_id,recipe_id" });
  if (error) throw new Error(error.message);
  if (trip.status === "validated") await rebuildList(user.familyId);
  changed();
}

/**
 * Qui mange ce plat, et combien d'invités en plus : la liste suit.
 * Indépendant de qui l'aime d'habitude : c'est le repas réel.
 */
export async function setTripRecipeEaters(recipeId: string, eaters: string[], invites = 0) {
  const user = await requireUser();
  const [trip, members] = await Promise.all([myTripOrThrow(user), getProfiles(user.familyId)]);
  const membres = new Set(members.map((m) => m.id));
  const qui = [...new Set(eaters)].filter((id) => membres.has(id));
  const extra = Math.max(0, Math.min(20, Math.round(Number(invites) || 0)));
  if (qui.length + extra < 1) throw new Error("Il faut au moins une personne");
  // Le plat a pu être proposé d'office par Kaddie (pas encore enregistré) : on l'enregistre gardé.
  const { error } = await db()
    .from("trip_recipes")
    .upsert(
      { trip_id: trip.id, recipe_id: recipeId, selected: true, eaters: qui, people: qui.length + extra },
      { onConflict: "trip_id,recipe_id" },
    );
  if (error) throw new Error(error.message);
  if (trip.status === "validated") await rebuildList(user.familyId);
  changed();
}

/**
 * Génère (ou régénère) la liste à partir des plats cochés.
 * Les articles ajoutés à la main sont conservés ; les articles déjà cochés
 * le restent ; ceux qu'on a déjà à la maison ne reviennent pas.
 */
export async function validateTrip() {
  const user = await requireUser();
  const trip = await myTripOrThrow(user);
  // Les plats gardés deviennent des repas retenus, avec qui les mange : la liste faite
  // n'en ajoute plus d'elle-même, et on saura plus tard qui a mangé quoi (équité, répétition).
  const plats = await platsDeLaCourse(user.familyId, trip);
  const retenus = plats.filter((p) => p.checked);
  const premiereFois = trip.status !== "validated";
  if (retenus.length > 0) {
    await db()
      .from("trip_recipes")
      .upsert(
        retenus.map((p) => ({ trip_id: trip.id, recipe_id: p.id, selected: true, eaters: p.eaters, people: p.convives.n })),
        { onConflict: "trip_id,recipe_id" },
      );
  }
  await Promise.all([
    rebuildList(user.familyId, trip),
    db().from("shopping_trips").update({ status: "validated", validated_at: new Date().toISOString() }).eq("id", trip.id),
    noterSansReponse(user.familyId, trip),
  ]);
  // La première fois que la liste est faite : « Tacos : c'est prévu, grâce à toi ».
  const titres = premiereFois ? new Map((await getRecipes(user.familyId)).map((r) => [r.id, r.title])) : null;
  changed(() =>
    titres
      ? notifyEnviesRetenues(
          user.familyId,
          user.profileId,
          retenus
            .filter((p) => p.raison.type === "demande" || p.raison.type === "envie")
            .map((p) => ({ title: titres.get(p.id) ?? "", qui: p.raison.qui })),
        )
      : Promise.resolve(),
  );
  redirect(ROUTES.liste);
}

/**
 * Recalcule la liste : les ingrédients des plats gardés, pour celles et ceux qui les
 * mangent, et les demandes écrites, découpées en articles (« des céréales, du Nutella »).
 */
async function rebuildList(familyId: string, known?: Trip) {
  const trip = known ?? (await loadCurrentTrip(familyId));
  if (!trip) return;
  const [tousLesPlats, hist, appris] = await Promise.all([platsDeLaCourse(familyId, trip), getHistorique(familyId), getAppris(familyId)]);
  const plats = tousLesPlats.filter((p) => p.checked);
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
  const wasChecked = new Set(
    previous.filter((i) => i.source === "recipe" && i.checked).map((i) => itemKey(i.name, i.unit)),
  );
  // Les demandes écrites vont sur la liste toutes seules (sauf ce qui y est déjà, ou a été retiré).
  const dejaLa = new Set(previous.map((i) => i.name.trim().toLowerCase()));
  const ecrites = trip.trip_requests
    .filter((r) => r.free_text && r.profile_id !== trip.created_by)
    .flatMap((r) => articlesDe(r.free_text!, appris))
    .filter((a) => !dejaLa.has(a.name.toLowerCase()) && Boolean(dejaLa.add(a.name.toLowerCase())));

  await db().from("shopping_list_items").delete().eq("trip_id", trip.id).eq("source", "recipe");
  await insererArticles([
    ...merged.map((m) => ({
      trip_id: trip.id,
      name: m.name,
      quantity: m.quantity,
      unit: m.unit,
      aisle: m.aisle,
      source: "recipe" as const,
      for_recipes: m.forRecipes.join(", "),
      checked: wasChecked.has(m.key),
      // Même regroupement que mergeIngredients : un ingrédient par nom et par unité.
      cle: normalizeName(m.name),
    })),
    ...ecrites.map((a) => ({ trip_id: trip.id, ...a, source: "request" as const, cle: cleProduit(a.name, appris) })),
  ]);
}

// ─── Les autres membres ────────────────────────────────────────────────

export async function submitRequest(
  _prev: { ok?: boolean; error?: string },
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireUser();
  const trip = await getCurrentTrip(user.familyId);
  if (!trip) return { error: "Personne n'a (encore) annoncé de courses." };
  if (trip.created_by === user.profileId) return { error: "C'est vous qui faites ces courses !" };

  const freeText = cleanText(formData.get("free_text")) || null;
  const recipeIds = await familyRecipeIds(user, [...new Set(formData.getAll("recipe_ids").map(String))].slice(0, 30));
  if (!freeText && recipeIds.length === 0) {
    return { error: "Écris quelque chose ou choisis au moins un plat." };
  }

  // La demande et le pré-cochage des plats demandés partent en même temps
  // (sans annuler un plat que la personne aurait volontairement décoché).
  const [{ error }] = await Promise.all([
    db()
      .from("trip_requests")
      .upsert(
        { trip_id: trip.id, profile_id: user.profileId, free_text: freeText, recipe_ids: recipeIds },
        { onConflict: "trip_id,profile_id" },
      ),
    recipeIds.length > 0
      ? db()
          .from("trip_recipes")
          .upsert(
            recipeIds.map((id) => ({ trip_id: trip.id, recipe_id: id, selected: true })),
            { onConflict: "trip_id,recipe_id", ignoreDuplicates: true },
          )
      : Promise.resolve(),
  ]);
  if (error) return { error: "Oups, l'envoi a échoué. Réessaie." };
  // La liste est déjà faite : les plats et les articles demandés y arrivent tout seuls.
  if (trip.status === "validated") await rebuildList(user.familyId).catch(() => {});

  changed(() => notifyRequestReceived(user.familyId, trip.created_by, user.profileId, freeText, recipeIds.length));
  return { ok: true };
}

// ─── « À ajouter ? » : achats habituels et articles pas pris ───────────

/** Une proposition acceptée (« + » ou « Tout ajouter ») va sur la liste, avec sa provenance. */
export async function ajouterSuggestions(suggestions: Suggestion[]) {
  const user = await requireUser();
  const trip = await currentTripOrThrow(user);
  const propres = suggestions.slice(0, 30).flatMap((s) => {
    const nom = typeof s?.nom === "string" ? s.nom.trim().slice(0, 100) : "";
    if (!nom || (s.origine !== "habituel" && s.origine !== "reporte")) return [];
    const quantite = typeof s.quantite === "number" && s.quantite > 0 ? s.quantite : null;
    return [
      {
        trip_id: trip.id,
        name: nom,
        quantity: quantite,
        unit: typeof s.unite === "string" ? s.unite.slice(0, 20) : "",
        aisle: isAisle(s.rayon) ? s.rayon : "autre",
        source: "manual" as const,
        cle: String(s.cle).slice(0, 120),
        origine: s.origine,
      },
    ];
  });
  await insererArticles(propres);
  changed();
}

/** « Pas besoin » (×) : le rythme repart de ce jour ; deux fois de suite, la proposition se met en veille. */
export async function refuserSuggestion(cle: string) {
  const user = await requireUser();
  const trip = await currentTripOrThrow(user);
  await db()
    .from("suggestions_reponses")
    .upsert({ trip_id: trip.id, cle: String(cle).slice(0, 120), reponse: "pas_besoin" }, { onConflict: "trip_id,cle" });
  changed();
}

/** La liste est faite : ce qui était proposé et n'a reçu aucune réponse est noté « sans réponse ». */
async function noterSansReponse(familyId: string, trip: Trip) {
  const [{ courses, reponses, repondusIci }, appris] = await Promise.all([getCoursesPassees(familyId), getAppris(familyId)]);
  const surLaListe = new Set(trip.shopping_list_items.filter((i) => i.source === "manual" || i.source === "request").map((i) => cleProduit(i.name, appris)));
  const { reportes, habituels } = aAjouter(courses, reponses, { surLaListe, repondusIci, now: Date.now() });
  const ignores = [...reportes, ...habituels];
  if (ignores.length === 0) return;
  await db()
    .from("suggestions_reponses")
    .upsert(ignores.map((s) => ({ trip_id: trip.id, cle: s.cle, reponse: "sans_reponse" })), { onConflict: "trip_id,cle", ignoreDuplicates: true });
}

// ─── Après les courses : les repas ─────────────────────────────────────

/** Une course passée de la famille (pas forcément la course en cours). */
async function courseDeLaFamille(user: CurrentUser, tripId: string) {
  const { data } = await db().from("shopping_trips").select("id, created_by").eq("id", tripId).eq("family_id", user.familyId).maybeSingle();
  if (!data) throw new Error("Course inconnue");
  return data as { id: string; created_by: string | null };
}

/** « C'est fait » (ou « pas encore ») pour un plat acheté. */
export async function marquerRepas(tripId: string, recipeId: string, fait: boolean) {
  const user = await requireUser();
  await courseDeLaFamille(user, tripId);
  const { error } = await db()
    .from("repas")
    .upsert({ trip_id: tripId, recipe_id: recipeId, fait_le: fait ? new Date().toISOString() : null }, { onConflict: "trip_id,recipe_id" });
  if (error) throw new Error(error.message);
  changed();
}

/** Pour chaque membre qui a demandé des articles : ce qui a été pris, ce qui manque. */
function ceQuiAEtePris(trip: Trip, appris: Awaited<ReturnType<typeof getAppris>>) {
  const surLaListe = new Map(trip.shopping_list_items.filter((i) => i.source !== "maison").map((i) => [cleProduit(i.name, appris), i.checked]));
  const resultat = new Map<string, { pris: string[]; manquants: string[] }>();
  for (const r of trip.trip_requests) {
    if (!r.free_text || r.profile_id === trip.created_by) continue;
    const bilan = { pris: [] as string[], manquants: [] as string[] };
    for (const a of articlesDe(r.free_text, appris)) {
      const coche = surLaListe.get(cleProduit(a.name, appris));
      if (coche === true) bilan.pris.push(a.name);
      else if (coche === false) bilan.manquants.push(a.name);
    }
    resultat.set(r.profile_id, bilan);
  }
  return resultat;
}

/** « Merci » à la personne qui a fait les dernières courses : un cœur par personne. */
export async function direMerci(tripId: string) {
  const user = await requireUser();
  const course = await courseDeLaFamille(user, tripId);
  if (!course.created_by || course.created_by === user.profileId) return;
  const { data } = await db()
    .from("mercis")
    .upsert({ trip_id: tripId, profile_id: user.profileId }, { onConflict: "trip_id,profile_id", ignoreDuplicates: true })
    .select("trip_id");
  // Déjà dit : pas de deuxième notification.
  changed(() => (data?.length ? notifyMerci(user.familyId, user.profileId, course.created_by!) : Promise.resolve()));
}
