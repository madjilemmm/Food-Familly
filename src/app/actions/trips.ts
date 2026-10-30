"use server";

import { requireUser, type CurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { getAppris, getCoursesPassees, getCurrentTrip, loadCurrentTrip, type Trip } from "@/lib/data";
import { articlesDe } from "@/lib/domain/articles";
import { aAjouter, type Suggestion } from "@/lib/domain/habitudes";
import { cleProduit } from "@/lib/domain/reconnaissance";
import { isAisle } from "@/lib/domain/aisles";
import { insererArticles } from "@/lib/liste";
import { assurerCourse, choisirPlat } from "@/lib/menu";
import { notifyCoursesFinies, notifyMerci, notifyTripStarted } from "@/lib/notifications";
import { changed } from "./_shared";

async function currentTripOrThrow(user: CurrentUser) {
  const trip = await getCurrentTrip(user.familyId);
  if (!trip) throw new Error("Aucune course en cours");
  return trip;
}

/** Ne garde que les recettes de la famille. */
async function familyRecipeIds(user: CurrentUser, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const { data } = await db().from("recipes").select("id").eq("family_id", user.familyId).in("id", ids);
  return (data ?? []).map((r) => r.id as string);
}

// ─── Le Menu et la liste ───────────────────────────────────────────────

/**
 * « Je pars faire les courses » (facultatif) : la liste est déjà prête ; on prévient
 * seulement la famille, pour une dernière envie.
 */
export async function jePars() {
  const user = await requireUser();
  const trip = await assurerCourse(user.familyId);
  const maintenant = new Date().toISOString();
  const { error } = await db().from("shopping_trips").update({ created_by: user.profileId, departs_at: maintenant }).eq("id", trip.id);
  if (error) throw new Error(error.message);
  changed(() => notifyTripStarted(user.familyId, user.profileId));
}

/**
 * « Je ne pars plus » : la personne qui avait annoncé son départ l'annule ; la liste redevient celle de tout le monde
 * (« Je prends le relais » : une autre personne dit « Je pars » à son tour).
 */
export async function jeNePartsPlus() {
  const user = await requireUser();
  const trip = await assurerCourse(user.familyId);
  // Pas la personne qui est partie : rien à annuler (déjà annulé depuis un autre écran, ou quelqu'un a pris le relais).
  if (trip.created_by !== user.profileId) return;
  const { error } = await db().from("shopping_trips").update({ created_by: null }).eq("id", trip.id).eq("created_by", user.profileId);
  if (error) throw new Error(error.message);
  changed();
}

/**
 * Mettre un plat au Menu, ou l'en retirer : la liste suit (n'importe qui dans la famille).
 * « Pas ce soir » retire seulement le plat ; « Pas pour moi » (refus) le retire et note mon « Bof » :
 * c'est un vrai signal pour mes goûts, comme au swipe (on n'oublie pas que j'ai pu l'aimer avant).
 */
export async function choisirPourLeMenu(recipeId: string, auMenu: boolean, refus = false) {
  const user = await requireUser();
  if ((await familyRecipeIds(user, [recipeId])).length === 0) throw new Error("Recette inconnue");
  await choisirPlat(user.familyId, recipeId, auMenu === true);
  if (refus === true && auMenu !== true) {
    await db()
      .from("swipes")
      .upsert({ profile_id: user.profileId, recipe_id: recipeId, liked: false, swiped_at: new Date().toISOString() }, { onConflict: "profile_id,recipe_id" });
  }
  changed();
}

/**
 * « J'ai fini les courses » (n'importe qui) : les plats achetés passent « à cuisiner »,
 * et une nouvelle liste s'ouvre d'elle-même au prochain écran.
 * `tripId` : la liste que l'écran montrait. Si quelqu'un l'a déjà terminée, il n'y a rien à refaire : on ne ferme pas
 * la nouvelle liste (vide) qui vient de s'ouvrir, et on ne prévient pas deux fois la famille.
 */
export async function finishTrip(tripId?: string) {
  const user = await requireUser();
  const trip = tripId ? await loadCurrentTrip(user.familyId, tripId) : await currentTripOrThrow(user);
  if (!trip) throw new Error("Course inconnue");
  if (trip.status === "done") return;
  await noterSansReponse(user.familyId, trip).catch(() => {});
  const maintenant = new Date().toISOString();
  // validated_at : la date des plats retenus (historique, récap) ; finished_at : vraiment faites.
  const fin = { status: "done", validated_at: trip.validated_at ?? maintenant, created_by: trip.created_by ?? user.profileId };
  // « .neq("status", "done") » : si deux personnes appuient au même moment, une seule ferme la course (et prévient la famille).
  const fermer = (champs: Record<string, unknown>) => db().from("shopping_trips").update(champs).eq("id", trip.id).neq("status", "done").select("id");
  const premiere = await fermer({ ...fin, finished_at: maintenant });
  // Base pas encore migrée (pas de « finished_at ») : on ferme sans.
  const fermee = premiere.error ? (await fermer(fin)).data : premiere.data;
  if (!fermee?.length) return;
  // Pas de redirection ici : le bouton recharge l'écran des courses (voir ConfirmButton « apres »).
  changed(async () => notifyCoursesFinies(user.familyId, fin.created_by, ceQuiAEtePris(trip, await getAppris(user.familyId))));
}

// ─── « À ajouter ? » : achats habituels et articles pas pris ───────────

/** Une proposition acceptée (« + » ou « Tout ajouter ») va sur la liste, avec sa provenance. */
export async function ajouterSuggestions(suggestions: Suggestion[]) {
  const user = await requireUser();
  const trip = await assurerCourse(user.familyId);
  const propres = suggestions.slice(0, 30).flatMap((s) => {
    const nom = typeof s?.nom === "string" ? s.nom.trim().slice(0, 100) : "";
    if (!nom || (s.origine !== "habituel" && s.origine !== "reporte" && s.origine !== "derniere")) return [];
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
        // « La dernière fois » n'a pas d'étiquette sur la liste : la base n'en connaît que deux (habituel, pas pris la dernière fois).
        origine: s.origine === "derniere" ? null : s.origine,
      },
    ];
  });
  await insererArticles(propres);
  changed();
}

/** « Pas besoin » (×) : le rythme repart de ce jour ; deux fois de suite, la proposition se met en veille. */
export async function refuserSuggestion(cle: string) {
  const user = await requireUser();
  const trip = await assurerCourse(user.familyId);
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
